import { describe, expect, it, vi } from "vitest"

import type { EventServiceOfferingQuotePreviewBody, EventServiceTemplateCreateBody } from "@crm/contracts"

import { ApiEventServiceRepository, FixtureEventServiceRepository } from "./event-services-repository"

const id = (seed: string) => `${seed.repeat(8)}-4444-4${seed.repeat(3)}-8${seed.repeat(3)}-${seed.repeat(12)}`
const commandMeta = () => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID() })

function createBody(): EventServiceTemplateCreateBody {
  return {
    ...commandMeta(),
    operationalName: "Корпоративная категория",
    offeringCode: "EVENT-CORPORATE",
    templateCode: "EVENT-CORPORATE",
    internalComment: "Внутренняя заметка",
    salesMode: "quoted",
    priceDisplayMode: "from",
    currency: "RUB",
    timezone: "Europe/Moscow",
    taxMode: "tax_included",
    businessCalendarId: id("a"),
    format: "corporate",
    icon: "building",
    tone: "violet",
    defaultDurationMinutes: 180,
    minimumGuests: 5,
    maximumGuests: 120,
    preparationBeforeMinutes: 45,
    preparationAfterMinutes: 30,
  }
}

function priceBookBody(expectedPricingVersion = 1) {
  return {
    ...commandMeta(),
    expectedPricingVersion,
    name: "Будни",
    validFrom: "2026-01-01",
    validToExclusive: null,
    changeReason: "Тестовая цена",
    supersedesPriceBookId: null,
    ratePlans: [{
      key: "standard",
      label: "Стандарт",
      pricingBasis: "flat_package" as const,
      quantityMetric: "guests" as const,
      baseAmount: 100_000,
      includedQuantity: 10,
      baseExtraUnitAmount: 5_000,
      minQuantity: 1,
      maxQuantity: null,
      minDurationMinutes: null,
      maxDurationMinutes: null,
      isDefault: true,
      displayOrder: 0,
      rules: [],
    }],
  }
}

function previewBody(): EventServiceOfferingQuotePreviewBody {
  return {
    ...commandMeta(),
    quoteType: "event_service_preview",
    ratePlanKey: "standard",
    startsAt: "2026-09-20T22:00:00+03:00",
    endsAt: "2026-09-21T02:00:00+03:00",
    guests: 12,
    currency: "RUB",
    addOns: [],
  }
}

describe("FixtureEventServiceRepository", () => {
  it("keeps create, package activation and immutable quote reload in one repository boundary", async () => {
    const repository = new FixtureEventServiceRepository()
    const created = await repository.create(createBody())
    expect(created.template).toMatchObject({ icon: "building", tone: "violet" })
    const updated = await repository.updateTemplate(created.template.id, {
      ...commandMeta(), expectedSubjectVersion: created.template.version, expectedOfferingVersion: created.offering.version,
      operationalName: "Обновлённая категория", internalComment: "Обновлённая заметка", format: created.template.format,
      icon: created.template.icon, tone: created.template.tone, defaultDurationMinutes: created.template.defaultDurationMinutes,
      minimumGuests: created.template.minimumGuests, maximumGuests: created.template.maximumGuests,
      preparationBeforeMinutes: created.template.preparationBeforeMinutes, preparationAfterMinutes: created.template.preparationAfterMinutes,
    })
    expect(updated.template).toMatchObject({ icon: "building", tone: "violet" })
    expect((await repository.getByOfferingId(created.offering.id))?.dossier.offering).toMatchObject({ operationalName: "Обновлённая категория", internalComment: "Обновлённая заметка", version: 2 })
    const draft = await repository.createDraftPriceBook(created.offering.id, priceBookBody())
    const active = await repository.activatePriceBook(created.offering.id, draft.priceBook.id, { ...commandMeta(), expectedPricingVersion: draft.pricingVersion, reason: "Тестовая активация" })
    const quote = await repository.previewQuote(created.offering.id, previewBody())
    const reloaded = await repository.getQuote(quote.quoteId)

    expect(active.priceBook.state).toBe("active")
    expect(quote.acceptanceReady).toBe(false)
    expect(quote.immutableSnapshot).toBe(true)
    expect(quote.inputs.timezone).toBe("Europe/Moscow")
    expect(quote.total.amountMinor).toBe(110_000)
    expect(reloaded).toEqual(quote)
    expect((await repository.getByOfferingId(created.offering.id))?.dossier.publicReady).toBe(false)
  })

  it("fails closed for unsupported package shapes before persistence", async () => {
    const repository = new FixtureEventServiceRepository()
    const item = (await repository.list()).items[0]!
    await expect(repository.createDraftPriceBook(item.offering!.offeringId, {
      ...priceBookBody(),
      ratePlans: [{ ...priceBookBody().ratePlans[0]!, pricingBasis: "per_hour" as never }],
    })).rejects.toThrow()
  })
})

describe("ApiEventServiceRepository", () => {
  it("uses the category routes and sends typed preview inputs without fixture fallback", async () => {
    const source = new FixtureEventServiceRepository()
    const registry = await source.list()
    const item = registry.items[0]!
    const linked = await source.getByTemplateId(item.template.id)
    if (linked.resolution !== "linked") throw new Error("fixture must be linked")
    const draft = await source.createDraftPriceBook(linked.data.dossier.offering.id, priceBookBody())
    await source.activatePriceBook(linked.data.dossier.offering.id, draft.priceBook.id, { ...commandMeta(), expectedPricingVersion: draft.pricingVersion, reason: "Тестовая активация" })
    const quote = await source.previewQuote(linked.data.dossier.offering.id, previewBody())
    const lookup = { ...item.offering!, operationalName: linked.data.dossier.offering.operationalName, code: linked.data.dossier.offering.code }
    const get = vi.fn(async (path: string) => {
      if (path.startsWith("/event-services/templates/")) return { resolution: "linked", offering: lookup }
      if (path.startsWith("/event-services?") || path.startsWith("/event-services?")) return registry
      if (path.includes("/editor")) return linked.data.editor
      if (path.startsWith("/event-services/quotes/")) return quote
      throw new Error(`Unexpected GET ${path}`)
    })
    const post = vi.fn(async (path: string) => {
      if (path.endsWith("/quotes/preview")) return quote
      if (path.endsWith("/prepare")) return linked.data.dossier
      if (path.endsWith("/reopen")) return { template: linked.data.dossier.template, subjectVersion: linked.data.dossier.template.version }
      return linked.data.dossier
    })
    const patch = vi.fn(async () => ({ template: linked.data.dossier.template, subjectVersion: linked.data.dossier.template.version }))
    const request = vi.fn()
    const repository = new ApiEventServiceRepository({ get, post, patch, request } as never)

    await repository.list({ q: "свадьба" })
    await repository.getByTemplateId(item.template.id)
    await repository.create(createBody())
    await repository.updateTemplate(item.template.id, { ...commandMeta(), expectedSubjectVersion: 1, format: "corporate", icon: "cake", tone: "amber", defaultDurationMinutes: 180, minimumGuests: 5, maximumGuests: 120, preparationBeforeMinutes: 45, preparationAfterMinutes: 30 })
    await repository.updateTemplate(item.template.id, { ...commandMeta(), expectedSubjectVersion: 1, expectedOfferingVersion: linked.data.dossier.offering.version, operationalName: "Обновлённая категория", internalComment: "Заметка CRM", format: "corporate", icon: "cake", tone: "amber", defaultDurationMinutes: 180, minimumGuests: 5, maximumGuests: 120, preparationBeforeMinutes: 45, preparationAfterMinutes: 30 })
    await repository.prepare(item.template.id, { ...commandMeta(), expectedEventServiceTemplateVersion: 1 })
    await repository.reopen(item.template.id, { ...commandMeta(), expectedSubjectVersion: 1 })
    await repository.previewQuote(linked.data.dossier.offering.id, previewBody())
    await repository.getQuote(quote.quoteId)

    expect(get).toHaveBeenCalledWith("/event-services?limit=25&q=%D1%81%D0%B2%D0%B0%D0%B4%D1%8C%D0%B1%D0%B0", expect.anything())
    expect(post).toHaveBeenCalledWith(`/event-services/${linked.data.dossier.offering.id}/quotes/preview`, expect.objectContaining({ quoteType: "event_service_preview", startsAt: previewBody().startsAt }), expect.anything())
    expect(post).toHaveBeenCalledWith("/event-services", expect.objectContaining({ icon: "building", tone: "violet" }), expect.anything())
    expect(patch).toHaveBeenCalledWith(`/event-services/templates/${item.template.id}`, expect.objectContaining({ operationalName: "Обновлённая категория", internalComment: "Заметка CRM", expectedOfferingVersion: linked.data.dossier.offering.version }), expect.anything())
    expect(get).toHaveBeenCalledWith(`/event-services/quotes/${quote.quoteId}`, expect.anything())
    expect(request).not.toHaveBeenCalled()
  })

  it("rejects a repeated pagination cursor instead of looping", async () => {
    const source = new FixtureEventServiceRepository()
    const registry = await source.list()
    const item = registry.items[0]!
    const lookup = { ...item.offering!, operationalName: "Категория", code: "EVENT" }
    const get = vi.fn(async (path: string) => path.startsWith("/event-services/templates/")
      ? { resolution: "linked", offering: lookup }
      : { items: [], nextCursor: "same-cursor" })
    const repository = new ApiEventServiceRepository({ get, post: vi.fn(), patch: vi.fn(), request: vi.fn() } as never)

    await expect(repository.getByTemplateId(item.template.id)).rejects.toThrow("повторяющийся курсор")
    expect(get).toHaveBeenCalledTimes(3)
  })
})
