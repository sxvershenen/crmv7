import { describe, expect, it } from "vitest"

import { PublicEventServiceFulfillmentSchema, PublicEventServiceProjectionPinSchema, PublicEventServiceSummarySchema } from "@crm/contracts"

const ids = {
  offering: "11111111-1111-4111-8111-111111111111",
  node: "22222222-2222-4222-8222-222222222222",
  revision: "33333333-3333-4333-8333-333333333333",
  release: "44444444-4444-4444-8444-444444444444",
}

function eventService(overrides: Record<string, unknown> = {}) {
  return {
    offeringId: ids.offering,
    kind: "event_service",
    path: "/events/corporate",
    releaseId: ids.release,
    title: "Корпоративное мероприятие",
    summary: "Сценарий для команды",
    price: { mode: "request" },
    priceBasisLabel: null,
    quoteAvailable: false,
    requestAvailable: true,
    capacity: null,
    readiness: "request_only",
    timezone: "Europe/Moscow",
    currency: "RUB",
    sourceVersions: { offering: 3, pricing: 4, priceBook: null, calendar: 2, contentReleaseId: ids.release, profileRevisionId: ids.revision },
    asOf: "2026-09-10T10:00:00.000Z",
    format: "corporate",
    fulfillment: { durationMinutes: 360, minimumGuests: 10, maximumGuests: 80, availabilityMode: "request_only" },
    ...overrides,
  }
}

describe("public event-service contract", () => {
  it("accepts a request-only reusable event category", () => {
    expect(PublicEventServiceSummarySchema.parse(eventService())).toMatchObject({ kind: "event_service", path: "/events/corporate", format: "corporate", price: { mode: "request" } })
  })

  it("does not allow event-service price or quote readiness to become public", () => {
    expect(PublicEventServiceSummarySchema.safeParse(eventService({ price: { mode: "from", amount: { amountMinor: 100, currency: "RUB" } } })).success).toBe(false)
    expect(PublicEventServiceSummarySchema.safeParse(eventService({ quoteAvailable: true })).success).toBe(false)
    expect(PublicEventServiceSummarySchema.safeParse(eventService({ readiness: "ready" })).success).toBe(false)
  })

  it("rejects an invalid guest range", () => {
    expect(PublicEventServiceFulfillmentSchema.safeParse({ durationMinutes: 360, minimumGuests: 80, maximumGuests: 10, availabilityMode: "request_only" }).success).toBe(false)
  })

  it("keeps the projection pin explicit and versioned", () => {
    expect(PublicEventServiceProjectionPinSchema.parse({ contract: "public.event-service-summary.v1", kind: "event_service", offeringId: ids.offering, nodeId: ids.node, profileRevisionId: ids.revision })).toMatchObject({ contract: "public.event-service-summary.v1", kind: "event_service" })
  })
})
