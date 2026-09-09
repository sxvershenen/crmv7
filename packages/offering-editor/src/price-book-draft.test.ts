import { describe, expect, it } from "vitest"

import type { PriceBook } from "@crm/contracts"

import {
  buildCreateDraftPriceBookBody,
  buildReplaceDraftPriceBookBody,
  createDraftPriceBookForm,
  priceBookToDraftForm,
} from "./price-book-draft.js"
import { allowOfferingEditorClose, buildHouseQuoteBody, canEditPricingDraft, HouseQuoteRequestCache, incrementDateOnly, majorMoneyToMinor, minorMoneyToMajor, serviceDateInTimezone, shouldPreserveLocalPricingDraft, zonedLocalDateTimeToIso } from "./house-offering-helpers.js"

const ids = {
  operation: "11111111-1111-4111-8111-111111111111",
  priceBook: "22222222-2222-4222-8222-222222222222",
  ratePlan: "33333333-3333-4333-8333-333333333333",
  rule: "44444444-4444-4444-8444-444444444444",
  offering: "55555555-5555-4555-8555-555555555555",
}

const priceBook: PriceBook = {
  activatedAt: "2026-09-01T00:00:00.000Z",
  changeReason: "Первичная настройка",
  createdAt: "2026-09-01T00:00:00.000Z",
  currency: "RUB",
  id: ids.priceBook,
  name: "Сезон 2026",
  offeringId: ids.offering,
  ratePlans: [{
    baseAmount: 1250000,
    baseExtraUnitAmount: 250000,
    displayOrder: 0,
    id: ids.ratePlan,
    includedQuantity: 2,
    isDefault: true,
    key: "standard",
    label: "Стандарт",
    maxDurationMinutes: null,
    maxQuantity: null,
    minDurationMinutes: null,
    minQuantity: null,
    priceBookId: ids.priceBook,
    pricingBasis: "per_night",
    quantityMetric: "guests",
    rules: [{
      amount: 1750000,
      bookingLeadDays: null,
      dateSelector: { from: "2026-12-30", label: "Новый год", toExclusive: "2027-01-04", type: "custom_date_override" },
      durationMinutes: null,
      enabled: true,
      extraUnitAmount: null,
      id: ids.rule,
      priority: 100,
      quantityRange: null,
      ratePlanId: ids.ratePlan,
      reason: "Праздничная цена",
      version: 4,
    }],
    version: 3,
  }],
  retiredAt: null,
  revision: 1,
  scheduledActivationAt: null,
  state: "active",
  supersedesPriceBookId: null,
  timezone: "Europe/Moscow",
  updatedAt: "2026-09-01T00:00:00.000Z",
  validFrom: "2026-09-01",
  validToExclusive: null,
  version: 2,
}

const meta = {
  expectedPricingVersion: 7,
  idempotencyKey: "offering-editor-11111111-1111-4111-8111-111111111111",
  operationId: ids.operation,
}

describe("price-book draft conversion", () => {
  it("round-trips an existing draft without rewriting its name or change reason", () => {
    const draft = { ...priceBook, changeReason: "Уточнение праздничных дат", name: "Сезон 2026 — черновик", state: "draft" as const }
    expect(createDraftPriceBookForm(draft, "2026-10-01")).toEqual(priceBookToDraftForm(draft))
  })

  it("copies every existing date rule into an editable draft without widening its selector", () => {
    const form = priceBookToDraftForm(priceBook)

    expect(form.ratePlans[0]?.rules).toEqual([{
      amount: 1750000,
      bookingLeadDays: null,
      dateSelector: { from: "2026-12-30", label: "Новый год", toExclusive: "2027-01-04", type: "custom_date_override" },
      durationMinutes: null,
      enabled: true,
      extraUnitAmount: null,
      id: ids.rule,
      priority: 100,
      quantityRange: null,
      reason: "Праздничная цена",
    }])
  })

  it("builds full contract bodies for create and replace with one supplied CAS command meta", () => {
    const form = createDraftPriceBookForm(priceBook, "2026-10-01")
    const create = buildCreateDraftPriceBookBody(form, meta, ids.priceBook)
    const replace = buildReplaceDraftPriceBookBody(form, meta)

    expect(create).toMatchObject({ ...meta, supersedesPriceBookId: ids.priceBook, validFrom: "2026-09-01" })
    expect(replace).toMatchObject(meta)
    expect(create.ratePlans[0]?.rules[0]?.dateSelector).toEqual(priceBook.ratePlans[0]?.rules[0]?.dateSelector)
    expect(create.ratePlans[0]?.id).toBeUndefined()
    expect(create.ratePlans[0]?.rules[0]?.id).toBeUndefined()
    expect(replace.ratePlans[0]?.id).toBe(ids.ratePlan)
    expect(replace.ratePlans[0]?.rules[0]?.id).toBe(ids.rule)
  })
})

describe("house quote request boundaries", () => {
  const meta = { expectedPricingVersion: 7, idempotencyKey: "offering-editor-22222222-2222-4222-8222-222222222222", operationId: ids.operation }

  it("normalizes a valid quote click body and omits pricing CAS", () => {
    const body = buildHouseQuoteBody({ arrivalDate: "2026-09-10", currency: "RUB", departureDate: "2026-09-12", guests: 2, meta, ratePlanKey: "standard" })
    expect(body).toEqual(expect.objectContaining({ operationId: ids.operation, idempotencyKey: meta.idempotencyKey, quantities: { guests: 2, participants: null, units: 1 } }))
    expect(body).not.toHaveProperty("expectedPricingVersion")
  })

  it("reuses the exact normalized request pair after a lost response, then resets on success/input change", () => {
    const cache = new HouseQuoteRequestCache()
    const first = cache.getOrCreate("stay:2026-09-10:2026-09-12:2", () => buildHouseQuoteBody({ arrivalDate: "2026-09-10", currency: "RUB", departureDate: "2026-09-12", guests: 2, meta, ratePlanKey: "standard" }))
    expect(cache.getOrCreate("stay:2026-09-10:2026-09-12:2", () => { throw new Error("must reuse after error") })).toBe(first)
    cache.markSuccess("stay:2026-09-10:2026-09-12:2")
    expect(cache.getOrCreate("stay:2026-09-10:2026-09-12:2", () => buildHouseQuoteBody({ arrivalDate: "2026-09-10", currency: "RUB", departureDate: "2026-09-12", guests: 2, meta: { ...meta, operationId: ids.offering }, ratePlanKey: "standard" })).operationId).toBe(ids.offering)
    cache.reset()
    expect(cache.getOrCreate("stay:2026-09-11:2026-09-12:2", () => buildHouseQuoteBody({ arrivalDate: "2026-09-11", currency: "RUB", departureDate: "2026-09-12", guests: 2, meta, ratePlanKey: "standard" })).period.arrivalDate).toBe("2026-09-11")
  })
})

describe("offering timezone service dates", () => {
  it("uses Moscow local date at midnight and increments date-only", () => {
    expect(serviceDateInTimezone("Europe/Moscow", new Date("2026-08-31T21:00:00.000Z"))).toBe("2026-09-01")
    expect(incrementDateOnly("2026-09-01")).toBe("2026-09-02")
  })

  it("converts activation wall time using the offering timezone and rejects a DST gap", () => {
    expect(zonedLocalDateTimeToIso("2026-09-01T12:30", "Europe/Moscow")).toBe("2026-09-01T09:30:00.000Z")
    expect(() => zonedLocalDateTimeToIso("2026-03-08T02:30", "America/New_York")).toThrow("Такого локального времени нет")
  })
})

describe("editor close guard", () => {
  it("protects dirty/conflicted drafts while allowing clean close", () => {
    expect(allowOfferingEditorClose(false, () => { throw new Error("must not ask") })).toBe(true)
    expect(allowOfferingEditorClose(true, () => false)).toBe(false)
    expect(allowOfferingEditorClose(true, () => true)).toBe(true)
  })
})

describe("pricing conflict recovery", () => {
  it("freezes edits on 409 and preserves local form through server reload", () => {
    expect(canEditPricingDraft(true, true)).toBe(false)
    expect(shouldPreserveLocalPricingDraft(true, true)).toBe(true)
    // Reload clears conflict, while the still-dirty local form remains intact.
    expect(canEditPricingDraft(true, false)).toBe(true)
    expect(shouldPreserveLocalPricingDraft(true, false)).toBe(true)
  })
})

describe("money input conversion", () => {
  it("keeps the API in minor units while showing major RUB units", () => {
    expect(majorMoneyToMinor("12500.50")).toBe(1250050)
    expect(minorMoneyToMajor(1250050)).toBe("12500.50")
  })
})
