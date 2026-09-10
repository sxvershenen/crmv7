import { describe, expect, it } from "vitest"

import { PublicVenueFulfillmentSchema, PublicVenueProjectionPinSchema, PublicVenueSummarySchema } from "@crm/contracts"

const ids = {
  offering: "11111111-1111-4111-8111-111111111111",
  node: "22222222-2222-4222-8222-222222222222",
  revision: "33333333-3333-4333-8333-333333333333",
  release: "44444444-4444-4444-8444-444444444444",
}

const exclusiveVenue = {
  allocationMode: "exclusive_resource",
  capacityUnit: "guests",
  capacityTotal: 40,
  pricingMode: "rate_plan",
  spaceType: "outdoor",
  availabilityMode: "resource",
}

function venue(overrides: Record<string, unknown> = {}) {
  return {
    offeringId: ids.offering,
    kind: "venue",
    title: "Поляна",
    summary: "Открытая площадка",
    price: { mode: "from", amount: { amountMinor: 320000, currency: "RUB" } },
    priceBasisLabel: "за час",
    quoteAvailable: false,
    requestAvailable: true,
    capacity: null,
    readiness: "ready",
    timezone: "Europe/Moscow",
    currency: "RUB",
    sourceVersions: { offering: 3, pricing: 4, priceBook: 2, calendar: 2, contentReleaseId: ids.release, profileRevisionId: ids.revision },
    asOf: "2026-09-10T10:00:00.000Z",
    fulfillment: exclusiveVenue,
    ...overrides,
  }
}

describe("public venue contract", () => {
  it("accepts an exclusive-resource release-pinned projection", () => {
    expect(PublicVenueSummarySchema.parse(venue())).toMatchObject({ kind: "venue", fulfillment: { capacityTotal: 40, spaceType: "outdoor" } })
  })

  it("allows honest request-only readiness without fabricating a price", () => {
    const value = PublicVenueSummarySchema.parse(venue({ price: { mode: "request" }, priceBasisLabel: null, readiness: "request_only", fulfillment: { ...exclusiveVenue, availabilityMode: "request_only" } }))
    expect(value.price).toEqual({ mode: "request" })
    expect(value.fulfillment.availabilityMode).toBe("request_only")
  })

  it("rejects shared-capacity fulfillment in a venue projection", () => {
    expect(PublicVenueFulfillmentSchema.safeParse({ ...exclusiveVenue, allocationMode: "shared_capacity" }).success).toBe(false)
  })

  it("keeps the projection pin explicit and versioned", () => {
    expect(PublicVenueProjectionPinSchema.parse({ contract: "public.venue-summary.v1", kind: "venue", offeringId: ids.offering, nodeId: ids.node, profileRevisionId: ids.revision })).toMatchObject({ contract: "public.venue-summary.v1", kind: "venue" })
  })
})
