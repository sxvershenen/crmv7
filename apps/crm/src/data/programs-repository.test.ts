import { describe, expect, it, vi } from "vitest"

import type { ProgramQuery, ProgramsDataset } from "@app/entities/programs"
import { programCategoriesFixture, programRegistrationsFixture, programRunsFixture, programTemplatesFixture } from "@app/fixtures/programs"

import { ApiProgramsRepository, FixtureProgramsRepository, selectPrograms } from "./programs-repository"

const data: ProgramsDataset = {
  categories: programCategoriesFixture,
  registrations: programRegistrationsFixture,
  runs: programRunsFixture,
  templates: programTemplatesFixture,
}
const baseQuery: ProgramQuery = { category: "all", date: "2026-08-24", rangeEnd: "2026-08-30", section: "templates", sort: { direction: "asc", key: "name" }, status: "all" }

describe("ProgramsRepository fixture adapter", () => {
  it("filters templates by category and sorts useful numeric fields", () => {
    const result = selectPrograms(data, { ...baseQuery, category: "children", sort: { direction: "desc", key: "price" } })
    expect(result.templates.map((item) => item.id)).toEqual(["clay-lab"])
  })

  it("keeps runs as separate dated entities and combines period, category and status", () => {
    const result = selectPrograms(data, { ...baseQuery, category: "family", date: "2026-08-24", rangeEnd: "2026-08-25", section: "runs", sort: { direction: "asc", key: "date" }, status: "registration" })
    expect(result.runs.map((item) => item.id)).toEqual(["24081"])
    expect(result.runs[0]?.templateId).toBe("forest-family")
  })

  it("filters registrations through their run category", () => {
    const result = selectPrograms(data, { ...baseQuery, category: "nature", section: "registrations", sort: { direction: "asc", key: "client" }, status: "cancelled" })
    expect(result.registrations.map((item) => item.id)).toEqual(["5004"])
  })

  it("persists generated fast status changes only inside repository fixture state", async () => {
    const repository = new FixtureProgramsRepository()
    await repository.updateRunStatus("25082", "registration")
    await repository.updateRegistrationStatus("5009", "confirmed")
    const result = await repository.list({ ...baseQuery, section: "runs", sort: { direction: "asc", key: "date" } })
    expect(result.runs.find((item) => item.id === "25082")?.status).toBe("registration")
    expect(result.registrations.find((item) => item.id === "5009")?.status).toBe("confirmed")
  })

  it("persists local assignment for each Programs entity through the repository boundary", async () => {
    const repository = new FixtureProgramsRepository()
    await repository.assignTemplate("winter-tale")
    await repository.assignRun("25082")
    await repository.assignRegistration("5009")
    const result = await repository.list(baseQuery)

    expect(result.templates.find((item) => item.id === "winter-tale")?.assignees[0]?.name).toBe("Марина Кириллова")
    expect(result.runs.find((item) => item.id === "25082")?.assignees[0]?.name).toBe("Марина Кириллова")
    expect(result.registrations.find((item) => item.id === "5009")?.assignees[0]?.name).toBe("Марина Кириллова")
  })

  it("keeps template stages and editor-only settings behind the repository boundary", async () => {
    const repository = new FixtureProgramsRepository()
    const template = await repository.getTemplate("forest-family")
    if (!template) throw new Error("Fixture template forest-family is missing")

    expect(template.relatedRuns.length).toBeGreaterThan(0)
    expect(template.stages.length).toBeGreaterThan(0)
    template.description = "Описание для редактора"
    template.stages.push({ id: "stage-test", name: "Сбор группы", durationMinutes: 20, comment: "" })
    template.name = "Семейный день — обновлён"
    await repository.saveTemplate(template)

    expect((await repository.getTemplate("forest-family"))?.stages.some((stage) => stage.name === "Сбор группы")).toBe(true)
    expect((await repository.list(baseQuery)).templates.find((item) => item.id === "forest-family")?.name).toBe("Семейный день — обновлён")
  })

  it("keeps run registrations and resource bookings behind the run editor boundary", async () => {
    const repository = new FixtureProgramsRepository()
    const run = await repository.getRun("24081")
    if (!run) throw new Error("Fixture run 24081 is missing")

    expect(run.registrations[0]?.clientName).toBe("Анна Ковалёва")
    expect(run.registrations[0]?.paid).toBe(12600)
    expect(run.resourceBookings.length).toBeGreaterThan(0)
    run.comment = "Комментарий редактора"
    run.resourceBookings.push({ id: "resource-test", resourceId: "house-pine", resourceName: "Дом «Сосна»", startAt: run.startsAt, endAt: run.endsAt, guestCount: 17 })
    run.name = "Семейный день — тест"
    await repository.saveRun(run)

    expect((await repository.getRun("24081"))?.resourceBookings.some((booking) => booking.id === "resource-test")).toBe(true)
    expect((await repository.list({ ...baseQuery, section: "runs", sort: { direction: "asc", key: "date" } })).runs.find((item) => item.id === "24081")?.name).toBe("Семейный день — тест")
  })

  it("persists registration details and payments without flattening them into list data", async () => {
    const repository = new FixtureProgramsRepository()
    const registration = await repository.getRegistration("5011")
    if (!registration) throw new Error("Fixture registration 5011 is missing")

    expect(registration.paid).toBe(2800)
    expect(registration.run?.id).toBe("24082")
    registration.participantCount = 2
    registration.participantNames = "Михаил, Анна"
    registration.paid = 3800
    registration.debt = 1800
    registration.payments.push({ amount: 1000, comment: "Доплата", date: "2026-08-24", id: "payment-test", kind: "payment", method: "card" })
    await repository.saveRegistration(registration)

    expect((await repository.getRegistration("5011"))?.payments.some((payment) => payment.comment === "Доплата")).toBe(true)
    const listed = (await repository.list({ ...baseQuery, section: "registrations", sort: { direction: "asc", key: "client" } })).registrations.find((item) => item.id === "5011")
    expect(listed?.debt).toBe(1800)
    expect(listed).not.toHaveProperty("payments")
  })

  it("persists category presentation and keeps related templates editor-only", async () => {
    const repository = new FixtureProgramsRepository()
    const category = await repository.getCategory("family")
    if (!category) throw new Error("Fixture category family is missing")
    expect(category.relatedTemplates).not.toHaveLength(0)
    category.name = "Семейный отдых"
    category.tone = "rose"
    await repository.saveCategory(category)
    expect((await repository.list(baseQuery)).categories.find((item) => item.id === "family")?.name).toBe("Семейный отдых")
    expect((await repository.list(baseQuery)).templates.find((item) => item.categoryId === "family")?.categoryTone).toBe("rose")
    expect((await repository.list(baseQuery)).categories[0]).not.toHaveProperty("relatedTemplates")
  })
})

describe("ProgramsRepository API adapter", () => {
  const capabilities = { canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true, canOverrideConflict: true, canAddPayment: true, canRefund: true }
  const template = { id: "template-1", version: 2, code: "PT-1", name: "Программа API", categoryId: "family", durationMinutes: 120, minimumParticipants: 1, participantLimit: 12, registrationCloseHours: 2, basePrice: { amountMinor: 420000, currency: "RUB" }, description: "", publication: "published", published: true, assigneeIds: [], stages: [], nextOccurrence: null, archived: false, createdAt: "2026-08-24T08:00:00.000Z", updatedAt: "2026-08-24T08:00:00.000Z", capabilities: { canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true } }
  const occurrence = { id: "occurrence-1", version: 3, code: "PO-1", templateId: "template-1", name: "Проведение API", startsAt: "2026-08-25T10:00:00.000Z", endsAt: "2026-08-25T12:00:00.000Z", participantLimit: 12, registrationLimit: 12, participantCount: 2, registrationCount: 1, revenue: { amountMinor: 840000, currency: "RUB" }, paid: { amountMinor: 420000, currency: "RUB" }, status: "open", comment: "", assigneeIds: [], archived: false, createdAt: "2026-08-24T08:00:00.000Z", updatedAt: "2026-08-24T08:00:00.000Z", capabilities }
  const registration = { id: "registration-1", version: 1, code: "PR-1", occurrenceId: "occurrence-1", customerId: "customer-1", phone: "+7", participantCount: 2, participantNames: "", total: { amountMinor: 840000, currency: "RUB" }, discount: { amountMinor: 0, currency: "RUB" }, paid: { amountMinor: 420000, currency: "RUB" }, pricingMode: "quote_required", acceptedQuote: null, status: "new", promo: "", source: "", comment: "", archived: false, createdAt: "2026-08-24T08:00:00.000Z", updatedAt: "2026-08-24T08:00:00.000Z", capabilities: { canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true, canAddPayment: true, canRefund: true } }

  it("maps canonical pages to the UI dataset and sends versioned transitions", async () => {
    const post = vi.fn(async (_path: string, _body: unknown, schema: unknown) => schema === undefined ? occurrence : occurrence)
    const client = {
      get: vi.fn(async (path: string) => path === "/auth/session" ? { user: { id: "manager-1", name: "Manager", role: "manager", capabilities } } : occurrence),
      getWithMeta: vi.fn(async (path: string) => ({ data: path.includes("templates") ? { items: [template], nextCursor: null } : path.includes("occurrences") ? { items: [occurrence], nextCursor: null } : { items: [registration], nextCursor: null }, headers: new Headers(), status: 200 })),
      patch: vi.fn(async () => template),
      post,
    }
    const repository = new ApiProgramsRepository(client as never)
    const data = await repository.list({ ...baseQuery, section: "runs", sort: { key: "date", direction: "asc" } })
    expect(data.runs[0]).toMatchObject({ id: "occurrence-1", status: "registration", revenue: 8400, paid: 4200 })
    expect(data.registrations[0]).toMatchObject({ id: "registration-1", runId: "occurrence-1", total: 8400, debt: 4200 })
    await repository.updateRunStatus("occurrence-1", "completed")
    expect(post).toHaveBeenCalledWith(expect.stringContaining("/programs/occurrences/occurrence-1/transition"), expect.objectContaining({ version: 3, status: "completed", operationId: expect.any(String), idempotencyKey: expect.any(String) }), expect.anything())
  })

  it("fails fast when a paginated API repeats the same cursor", async () => {
    const getWithMeta = vi.fn(async (path: string) => ({
      data: path.includes("templates") ? { items: [template], nextCursor: null }
        : path.includes("occurrences") ? { items: [occurrence], nextCursor: null }
          : path.includes("registrations") ? { items: [registration], nextCursor: "repeated-cursor" }
            : { items: [], nextCursor: null },
      headers: new Headers(), status: 200,
    }))
    const repository = new ApiProgramsRepository({ get: vi.fn(), getWithMeta, patch: vi.fn(), post: vi.fn(), request: vi.fn() } as never)

    await expect(repository.list(baseQuery)).rejects.toThrow("Сервер повторил курсор")
    expect(getWithMeta.mock.calls.filter(([path]) => String(path).includes("registrations"))).toHaveLength(2)
  })

  it("maps template editor settings to canonical money/stages and versioned patch", async () => {
    const patch = vi.fn(async () => template)
    const client = {
      get: vi.fn(async (path: string) => path.startsWith("/programs/templates/") ? template : occurrence),
      getWithMeta: vi.fn(async (path: string) => ({ data: path.includes("occurrences") ? { items: [occurrence], nextCursor: null } : { items: [], nextCursor: null }, headers: new Headers(), status: 200 })),
      patch,
      post: vi.fn(),
    }
    const repository = new ApiProgramsRepository(client as never)
    const editor = await repository.getTemplate("PT-1")
    if (!editor) throw new Error("API template is missing")
    expect(client.getWithMeta).toHaveBeenCalledWith("/programs/occurrences?templateId=template-1&archived=false&limit=100", expect.anything())
    editor.name = "Обновлённая программа"
    editor.basePrice = 4500
    editor.description = "Описание"
    editor.stages = [{ id: "stage-1", name: "Старт", durationMinutes: 30, comment: "" }]
    await repository.saveTemplate(editor)

    expect(patch).toHaveBeenCalledWith("/programs/templates/template-1", expect.objectContaining({
      version: 2,
      name: "Обновлённая программа",
      basePrice: { amountMinor: 450000, currency: "RUB" },
      description: "Описание",
      stages: [{ name: "Старт", durationMinutes: 30, comment: "" }],
      operationId: expect.any(String),
      idempotencyKey: expect.any(String),
    }), expect.anything())
  })

  it("restores the prepared offering through the typed lookup and exact editor projection", async () => {
    const offeringId = "11111111-1111-4111-8111-111111111111"
    const lookup = { resolution: "linked", offering: { offeringId, cmsReady: true, publicReady: false } }
    const editor = { offering: { id: offeringId, kind: "program" }, bindings: [{ role: "primary", target: { type: "program_template", id: "template-1" } }] }
    const get = vi.fn(async (path: string) => path === "/programs/template-1/offering" ? lookup : editor)
    let patchBody: Record<string, unknown> | null = null
    const patch = vi.fn(async (_path: string, body: Record<string, unknown>) => {
      patchBody = body
      return template
    })
    const repository = new ApiProgramsRepository({ get, getWithMeta: vi.fn(), patch, post: vi.fn(), request: vi.fn() } as never)

    await expect(repository.resolveProgramOffering("template-1")).resolves.toMatchObject({ resolution: "linked", cmsReady: true, publicReady: false, editor })
    expect(get).toHaveBeenNthCalledWith(1, "/programs/template-1/offering", expect.anything())
    expect(get).toHaveBeenNthCalledWith(2, `/offerings/${offeringId}/editor`, expect.anything())
    await repository.saveTemplate({ ...mapTestTemplate(), id: "template-1", version: 2, basePrice: 9999, published: false })
    expect(patchBody).not.toHaveProperty("basePrice")
    expect(patchBody).not.toHaveProperty("publication")
  })

  it("keeps prepare idempotency metadata stable for an explicit retry and sends the UI-observed version", async () => {
    const result = { offeringId: "11111111-1111-4111-8111-111111111111", offeringVersion: 1, subjectVersion: 1, pricingVersion: 1, addOnAssignmentsVersion: 1, programTemplateId: "22222222-2222-4222-8222-222222222222", programTemplateVersion: 7, cmsReady: true, publicReady: false, editorialNodeId: "33333333-3333-4333-8333-333333333333" }
    const post = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(result)
    const repository = new ApiProgramsRepository({ get: vi.fn(), getWithMeta: vi.fn(), patch: vi.fn(), post, request: vi.fn() } as never)

    await expect(repository.prepareProgramOffering(result.programTemplateId, 7)).rejects.toThrow("network")
    await expect(repository.prepareProgramOffering(result.programTemplateId, 7)).resolves.toEqual(result)

    const first = post.mock.calls[0]?.[1] as Record<string, unknown>
    const second = post.mock.calls[1]?.[1] as Record<string, unknown>
    expect(first).toMatchObject({ expectedProgramTemplateVersion: 7, operationId: expect.any(String), idempotencyKey: expect.any(String) })
    expect(second).toMatchObject({ operationId: first.operationId, idempotencyKey: first.idempotencyKey })
  })

  it("quotes the observed occurrence in its authoritative currency and keeps retry identity stable", async () => {
    const fixture = new FixtureProgramsRepository()
    const draft = await fixture.getRegistration("5011")
    if (!draft) throw new Error("fixture registration missing")
    Object.assign(draft, { pricingMode: "quote_required", occurrenceVersion: 7, currency: "EUR", participantCount: 3 })
    const result = {
      quoteType: "program_registration", acceptanceReady: true, quoteId: "11111111-1111-4111-8111-111111111111", offeringId: "22222222-2222-4222-8222-222222222222",
      programTemplateId: "33333333-3333-4333-8333-333333333333", programOccurrenceId: draft.runId, programOccurrenceVersion: 7,
      calculatedAt: "2026-09-09T10:00:00.000Z", validUntil: "2026-09-09T10:15:00.000Z", leadDays: 2, currency: "EUR",
      inputs: { serviceDate: "2026-09-12", startsAt: "2026-09-12T10:00:00.000Z", endsAt: "2026-09-12T12:00:00.000Z", participants: 3, durationMinutes: 120, addOns: [] },
      lines: [{ kind: "base", label: "Participants", serviceDate: "2026-09-12", quantity: 3, unitAmount: { amountMinor: 2500, currency: "EUR" }, amount: { amountMinor: 7500, currency: "EUR" }, ratePlanId: "44444444-4444-4444-8444-444444444444", ratePlanVersion: 1, matchedRuleId: null, matchedRuleVersion: null, explanation: "base" }],
      total: { amountMinor: 7500, currency: "EUR" }, provenance: {}, immutableSnapshot: true,
    }
    const post = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(result)
    const repository = new ApiProgramsRepository({ get: vi.fn(), getWithMeta: vi.fn(), patch: vi.fn(), post, request: vi.fn() } as never)

    await expect(repository.quoteRegistration(draft, [])).rejects.toThrow("network")
    await expect(repository.quoteRegistration(draft, [])).resolves.toMatchObject({ occurrenceVersion: 7, currency: "EUR", total: 75 })
    const first = post.mock.calls[0]?.[1] as Record<string, unknown>
    const second = post.mock.calls[1]?.[1] as Record<string, unknown>
    expect(first).toMatchObject({ expectedOccurrenceVersion: 7, participants: 3, currency: "EUR", operationId: expect.any(String), idempotencyKey: expect.any(String) })
    expect(second).toMatchObject({ operationId: first.operationId, idempotencyKey: first.idempotencyKey })
    expect(first).not.toHaveProperty("total")
    expect(first).not.toHaveProperty("discount")
  })

  it("derives only available supported add-ons from the exact program offering", async () => {
    const run = { ...programRunsFixture[0]!, version: 4, currency: "RUB", templateId: "template-1" }
    const offeringId = "11111111-1111-4111-8111-111111111111"
    const assignments = [
      { id: "assignment-breakfast", offeringId, addOnOfferingId: "addon-breakfast", enabled: true, required: true, recommended: false, groupKey: null, ratePlanKeyOverride: null, labelOverride: "Завтрак для группы", descriptionOverride: null, minQuantityOverride: 2, maxQuantityOverride: 12, defaultQuantityOverride: 4, displayOrder: 1 },
      { id: "assignment-schedule", offeringId, addOnOfferingId: "addon-schedule", enabled: true, required: false, recommended: false, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minQuantityOverride: null, maxQuantityOverride: null, defaultQuantityOverride: null, displayOrder: 2 },
      { id: "assignment-blocked", offeringId, addOnOfferingId: "addon-blocked", enabled: true, required: false, recommended: false, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minQuantityOverride: null, maxQuantityOverride: null, defaultQuantityOverride: null, displayOrder: 3 },
    ]
    const catalog = [
      { offering: { id: "addon-breakfast", operationalName: "Breakfast", state: "active", archived: false }, serviceType: "person_service", availability: { status: "available" } },
      { offering: { id: "addon-schedule", operationalName: "Transfer", state: "active", archived: false }, serviceType: "scheduled_resource", availability: { status: "available" } },
      { offering: { id: "addon-blocked", operationalName: "Blocked", state: "active", archived: false }, serviceType: "quantity_service", availability: { status: "blocked" } },
    ]
    const editor = { offering: { id: offeringId, kind: "program" }, bindings: [{ role: "primary", target: { type: "program_template", id: "template-1" } }], addOnAssignments: assignments, addOnCatalog: catalog }
    const get = vi.fn(async (path: string) => path === "/programs/template-1/offering" ? { resolution: "linked", offering: { offeringId, cmsReady: true, publicReady: false } } : editor)
    const repository = new ApiProgramsRepository({ get, getWithMeta: vi.fn(), patch: vi.fn(), post: vi.fn(), request: vi.fn() } as never)

    await expect(repository.createRegistrationDraft(run)).resolves.toMatchObject({
      pricingMode: "quote_required",
      occurrenceVersion: 4,
      currency: "RUB",
      availableAddOns: [{ assignmentId: "assignment-breakfast", label: "Завтрак для группы", serviceType: "person_service", required: true, minQuantity: 2, maxQuantity: 12, defaultQuantity: 4 }],
    })
  })

  it("omits server-owned price and accepted quote context from draft patches", async () => {
    const fixture = new FixtureProgramsRepository()
    const draft = await fixture.getRegistration("5011")
    if (!draft) throw new Error("fixture registration missing")
    Object.assign(draft, {
      version: 9,
      pricingMode: "quote_required",
      acceptedQuote: { quoteId: "quote-1", acceptedAt: "2026-09-09T10:00:00.000Z", total: 7500, currency: "RUB", addOns: [], lines: [] },
      comment: "editable note",
    })
    let body: Record<string, unknown> | null = null
    const patch = vi.fn(async (_path: string, next: Record<string, unknown>) => { body = next; throw new Error("stop after capture") })
    const repository = new ApiProgramsRepository({ get: vi.fn(), getWithMeta: vi.fn(), patch, post: vi.fn(), request: vi.fn() } as never)

    await expect(repository.saveRegistration(draft)).rejects.toThrow("stop after capture")
    expect(body).toMatchObject({ version: 9, comment: "editable note" })
    expect(body).not.toHaveProperty("occurrenceId")
    expect(body).not.toHaveProperty("participantCount")
    expect(body).not.toHaveProperty("total")
    expect(body).not.toHaveProperty("discount")
  })

  it("confirms with the observed registration version and stable retry identity", async () => {
    const fixture = new FixtureProgramsRepository()
    const draft = await fixture.getRegistration("5011")
    if (!draft) throw new Error("fixture registration missing")
    Object.assign(draft, { id: "registration-1", version: 11, pricingMode: "quote_required", status: "new" })
    const quote = { quoteId: "11111111-1111-4111-8111-111111111111", occurrenceId: draft.runId, occurrenceVersion: draft.occurrenceVersion ?? 1, calculatedAt: "2026-09-09T10:00:00.000Z", validUntil: "2026-09-09T10:15:00.000Z", participants: 2, total: 5000, currency: "RUB", addOns: [], lines: [] }
    const post = vi.fn().mockRejectedValue(new Error("network"))
    const repository = new ApiProgramsRepository({ get: vi.fn(), getWithMeta: vi.fn(), patch: vi.fn(), post, request: vi.fn() } as never)

    await expect(repository.confirmRegistration(draft, quote)).rejects.toThrow("network")
    await expect(repository.confirmRegistration(draft, quote)).rejects.toThrow("network")
    const first = post.mock.calls[0]?.[1] as Record<string, unknown>
    const second = post.mock.calls[1]?.[1] as Record<string, unknown>
    expect(first).toMatchObject({ version: 11, status: "confirmed", quoteAcceptance: { quoteSnapshotId: quote.quoteId }, operationId: expect.any(String), idempotencyKey: expect.any(String) })
    expect(second).toMatchObject({ operationId: first.operationId, idempotencyKey: first.idempotencyKey })
  })

  it("sends explicit program participant terms without leaking create-only fields into draft replacement", async () => {
    const offeringId = "11111111-1111-4111-8111-111111111111"
    const priceBookId = "22222222-2222-4222-8222-222222222222"
    const input = {
      supersedesPriceBookId: "33333333-3333-4333-8333-333333333333",
      name: "Основной тариф",
      validFrom: "2026-09-10",
      validToExclusive: null,
      changeReason: "Проверка условий",
      ratePlans: [{ key: "standard", label: "Стандарт", pricingBasis: "flat_package" as const, quantityMetric: "participants" as const, baseAmount: 500000, includedQuantity: 5, baseExtraUnitAmount: 75000, minQuantity: 1, maxQuantity: 20, minDurationMinutes: 120, maxDurationMinutes: 120, isDefault: true, displayOrder: 0, rules: [] }],
    }
    let requestedBody: Record<string, unknown> | null = null
    const request = vi.fn(async (_path: string, init: { body: Record<string, unknown> }) => {
      requestedBody = init.body
      return { priceBook: {}, pricingVersion: 9 }
    })
    const repository = new ApiProgramsRepository({ get: vi.fn(), getWithMeta: vi.fn(), patch: vi.fn(), post: vi.fn(), request } as never)

    await repository.replaceProgramPriceBook(offeringId, priceBookId, 8, input)

    expect(request).toHaveBeenCalledWith(`/offerings/${offeringId}/price-books/drafts/${priceBookId}`, {
      method: "PUT",
      body: expect.objectContaining({ expectedPricingVersion: 8, ratePlans: [expect.objectContaining({ pricingBasis: "flat_package", quantityMetric: "participants", includedQuantity: 5, baseExtraUnitAmount: 75000 })] }),
    }, expect.anything())
    expect(requestedBody).not.toHaveProperty("supersedesPriceBookId")
  })
})

function mapTestTemplate() {
  return {
    id: "template-1", version: 2, name: "Программа API", updatedAt: "2026-08-24T08:00:00.000Z", categoryId: "family", categoryName: "Семейные",
    categoryIcon: "sparkles" as const, categoryTone: "violet" as const, durationMinutes: 120, minimumParticipants: 1, participantLimit: 12,
    registrationCloseHours: 2, basePrice: 4200, description: "", published: true, assignees: [], stages: [], relatedRuns: [], nextRun: null,
  }
}
