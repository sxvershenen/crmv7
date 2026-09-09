import { describe, expect, it } from "vitest"

import { DomainError } from "../src/errors.js"
import { resolveEventServiceQuote, validateEventServicePricingForActivation, type EventServicePricingSnapshot } from "../src/event-service-pricing.js"

const ids = {
  offering: "11111111-1111-4111-8111-111111111111",
  template: "22222222-2222-4222-8222-222222222222",
  book: "33333333-3333-4333-8333-333333333333",
  plan: "44444444-4444-4444-8444-444444444444",
  holidayRule: "55555555-5555-4555-8555-555555555555",
  customRule: "66666666-6666-4666-8666-666666666666",
}

function snapshot(overrides: Partial<EventServicePricingSnapshot["ratePlans"][number]> = {}): EventServicePricingSnapshot {
  return {
    offering: { id: ids.offering, version: 2, subjectVersion: 3, pricingVersion: 4, addOnAssignmentsVersion: 1, kind: "event_service", state: "active", currency: "RUB", timezone: "Europe/Moscow", businessCalendarId: ids.book, activePriceBookId: ids.book },
    template: { id: ids.template, version: 5, defaultDurationMinutes: 120, minimumGuests: 1, maximumGuests: 100, preparationBeforeMinutes: 45, preparationAfterMinutes: 30 },
    priceBook: { id: ids.book, version: 2, revision: 1, offeringId: ids.offering, state: "active", currency: "RUB", timezone: "Europe/Moscow", validFrom: "2026-01-01", validToExclusive: "2026-02-01" },
    ratePlans: [{ id: ids.plan, version: 1, priceBookId: ids.book, key: "standard", label: "Standard", pricingBasis: "flat_package", quantityMetric: "guests", baseAmountMinor: 50_000, includedQuantity: 20, baseExtraUnitAmountMinor: 2_000, minQuantity: null, maxQuantity: null, minDurationMinutes: null, maxDurationMinutes: null, isDefault: true, rules: [], ...overrides }],
    calendar: { id: ids.book, version: 3, state: "active", timezone: "Europe/Moscow", sourceVersion: "2026.1", dates: [{ date: "2026-01-15", official: { id: "77777777-7777-4777-8777-777777777777", version: 1, dayClass: "weekday", sourceVersion: "2026.1" }, activeOverride: null }] },
  }
}

const context = { quoteId: "88888888-8888-4888-8888-888888888888", calculatedAt: new Date("2026-01-01T00:00:00Z"), quoteTtlSeconds: 900, nextPricingActivationAt: null }

function request(extra: Partial<Parameters<typeof resolveEventServiceQuote>[1]> = {}) {
  return { offeringId: ids.offering, eventServiceTemplateId: ids.template, ratePlanKey: "standard", startsAt: "2026-01-15T10:00:00+03:00", endsAt: "2026-01-15T12:00:00+03:00", guests: 25, currency: "RUB", ...extra }
}

describe("event-service typed package pricing", () => {
  it("calculates an included package plus server-side extra guests", () => {
    const result = resolveEventServiceQuote(snapshot(), request(), context)
    expect(result.totalAmountMinor).toBe(60_000)
    expect(result.lines.map((line) => [line.kind, line.quantity])).toEqual([["base", 1], ["extra_unit", 5]])
    expect(result.acceptanceReady).toBe(false)
    expect(result).toMatchObject({
      calendarDateId: "77777777-7777-4777-8777-777777777777",
      calendarDateVersion: 1,
      calendarDateOverrideId: null,
      calendarDateOverrideVersion: null,
      preparationBeforeMinutes: 45,
      preparationAfterMinutes: 30,
      preparationStartsAt: "2026-01-15T06:15:00.000Z",
      preparationEndsAt: "2026-01-15T09:30:00.000Z",
    })
  })

  it("fails closed when guests exceed the package and no extra price exists", () => {
    expect(() => resolveEventServiceQuote(snapshot({ baseExtraUnitAmountMinor: null }), request(), context)).toThrowError(
      expect.objectContaining({ code: "EVENT_PACKAGE_EXTRA_UNSUPPORTED" }),
    )
  })

  it("requires an exact template duration when a plan has no duration bounds", () => {
    expect(() => resolveEventServiceQuote(snapshot(), request({ endsAt: "2026-01-15T12:01:00+03:00" }), context)).toThrowError(
      expect.objectContaining({ code: "EVENT_DURATION_OUT_OF_RANGE" }),
    )
  })

  it("rejects a local-day crossing even when the instant duration is valid", () => {
    expect(() => resolveEventServiceQuote(snapshot(), request({ startsAt: "2026-01-15T23:00:00+03:00", endsAt: "2026-01-16T01:00:00+03:00" }), context)).toThrowError(
      expect.objectContaining({ code: "EVENT_INTERVAL_CROSSES_LOCAL_DATE" }),
    )
  })

  it("uses custom-date rules ahead of holiday rules", () => {
    const custom = { id: ids.customRule, version: 1, dateSelector: { type: "custom_date_override" as const, from: "2026-01-15", toExclusive: "2026-01-16", label: "special" }, quantityRange: null, bookingLeadDays: null, durationMinutes: null, amountMinor: 70_000, extraUnitAmountMinor: 3_000, priority: 0, reason: "special", enabled: true }
    const holiday = { id: ids.holidayRule, version: 1, dateSelector: { type: "calendar_holiday" as const }, quantityRange: null, bookingLeadDays: null, durationMinutes: null, amountMinor: 80_000, extraUnitAmountMinor: 4_000, priority: 0, reason: "holiday", enabled: true }
    const base = snapshot({ rules: [custom, holiday] })
    const priced = { ...base, calendar: { ...base.calendar, dates: base.calendar.dates.map((day) => ({ ...day, activeOverride: { id: "99999999-9999-4999-8999-999999999999", version: 1, dayClass: "holiday" as const, reason: "holiday" } })) } }
    const result = resolveEventServiceQuote(priced, request(), context)
    expect(result.lines[0]!.unitAmountMinor).toBe(70_000)
    expect(result.lines[0]!.matchedRule?.id).toBe(ids.customRule)
    expect(result.calendarDateOverrideId).toBe("99999999-9999-4999-8999-999999999999")
    expect(result.calendarDateOverrideVersion).toBe(1)
  })

  it("caps TTL at the next offering-timezone midnight", () => {
    const nearMidnight = { ...context, calculatedAt: new Date("2026-01-01T20:59:30.000Z"), quoteTtlSeconds: 900 }
    expect(resolveEventServiceQuote(snapshot(), request(), nearMidnight).validUntil).toBe("2026-01-01T21:00:00.000Z")
  })

  it("rejects activation when day-class and recurring-weekday rules can overlap", () => {
    const dayClass = { id: ids.holidayRule, version: 1, dateSelector: { type: "day_class" as const, dayClass: "weekday" as const }, quantityRange: null, bookingLeadDays: null, durationMinutes: null, amountMinor: 70_000, extraUnitAmountMinor: 3_000, priority: 0, reason: "weekday", enabled: true }
    const recurring = { id: ids.customRule, version: 1, dateSelector: { type: "recurring_weekdays" as const, days: ["thu" as const] }, quantityRange: null, bookingLeadDays: null, durationMinutes: null, amountMinor: 80_000, extraUnitAmountMinor: 4_000, priority: 0, reason: "thursday", enabled: true }
    const issues = validateEventServicePricingForActivation(snapshot({ rules: [dayClass, recurring] }), { from: "2026-01-15", toExclusive: "2026-01-16" })
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "PRICE_RULE_AMBIGUOUS", ruleIds: [ids.holidayRule, ids.customRule] })]))
  })

  it("rejects a preview date outside the active price book", () => {
    try {
      resolveEventServiceQuote(snapshot(), request({ startsAt: "2026-02-01T10:00:00+03:00", endsAt: "2026-02-01T12:00:00+03:00" }), context)
      throw new Error("expected rejection")
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError)
      expect((error as DomainError).code).toBe("PRICE_BOOK_COVERAGE_GAP")
    }
  })
})
