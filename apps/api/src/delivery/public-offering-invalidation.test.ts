import { describe, expect, it } from "vitest"

import { normalizePublicOfferingInvalidation } from "./public-offering-invalidation.js"

const ids = {
  event: "10000000-0000-4000-8000-000000000001",
  offering: "10000000-0000-4000-8000-000000000002",
  book: "10000000-0000-4000-8000-000000000003",
  actor: "10000000-0000-4000-8000-000000000004",
  operation: "10000000-0000-4000-8000-000000000005",
}

describe("normalizePublicOfferingInvalidation", () => {
  it("normalizes the pricing invalidation without commercial payload", () => {
    expect(normalizePublicOfferingInvalidation({
      eventId: ids.event, eventType: "public.offering_projection.invalidated", occurredAt: "2026-09-01T10:00:00.000Z", actorId: ids.actor, requestId: "request", operationId: ids.operation, entrySurface: "internal",
      offeringId: ids.offering, pricingVersion: 3, priceBookId: ids.book, priceBookVersion: 2,
    })).toEqual(expect.objectContaining({ eventId: ids.event, offeringId: ids.offering, pricingVersion: 3, subjectVersion: null }))
  })

  it("normalizes catalog configuration and rejects calendar aggregate events", () => {
    const shared = { eventId: ids.event, eventType: "public.offering_projection.invalidated", occurredAt: "2026-09-01T10:00:00.000Z", actorId: ids.actor, requestId: "request", operationId: ids.operation, entrySurface: "internal", versions: { calendar: 2, subject: 3, addOns: 4 }, configurationHash: "a".repeat(64) }
    expect(normalizePublicOfferingInvalidation({ ...shared, aggregate: { type: "catalog_offering", id: ids.offering } })).toEqual(expect.objectContaining({ offeringId: ids.offering, calendarVersion: 2, subjectVersion: 3, addOnsVersion: 4 }))
    expect(normalizePublicOfferingInvalidation({ ...shared, aggregate: { type: "business_calendar", id: ids.offering } })).toBeNull()
  })
})
