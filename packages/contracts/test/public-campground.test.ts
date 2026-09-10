import { describe, expect, it } from "vitest"

import { PublicCampgroundFulfillmentSchema, PublicCampgroundProjectionPinSchema, PublicCampgroundSummarySchema } from "@crm/contracts"

const ids = {
  offering: "11111111-1111-4111-8111-111111111111",
  node: "22222222-2222-4222-8222-222222222222",
  revision: "33333333-3333-4333-8333-333333333333",
  release: "44444444-4444-4444-8444-444444444444",
}

const sharedPitch = {
  salesUnit: "own_tent_pitch",
  allocationMode: "shared_capacity",
  capacityUnit: "tent",
  capacityTotal: 15,
  guestCapacityTotal: null,
  pricingMode: "rate_plan",
  availabilityMode: "resource",
}

function campground(overrides: Record<string, unknown> = {}) {
  return {
    offeringId: ids.offering,
    kind: "campground",
    path: "/campgrounds/pitches",
    releaseId: ids.release,
    title: "Своя палатка",
    summary: "Палаточное место в общей зоне",
    price: { mode: "from", amount: { amountMinor: 180000, currency: "RUB" } },
    priceBasisLabel: "за ночь",
    quoteAvailable: false,
    requestAvailable: true,
    capacity: { unit: "tent", available: 15 },
    readiness: "ready",
    timezone: "Europe/Moscow",
    currency: "RUB",
    sourceVersions: { offering: 3, pricing: 4, priceBook: 2, calendar: 2, contentReleaseId: ids.release, profileRevisionId: ids.revision },
    asOf: "2026-09-10T10:00:00.000Z",
    fulfillment: sharedPitch,
    ...overrides,
  }
}

describe("public campground contract", () => {
  it("accepts a shared-capacity own-tent pitch", () => {
    expect(PublicCampgroundSummarySchema.parse(campground())).toMatchObject({ kind: "campground", fulfillment: { salesUnit: "own_tent_pitch", capacityTotal: 15 } })
  })

  it("accepts an owned tent with a separate guest capacity", () => {
    const fulfillment = { ...sharedPitch, salesUnit: "owned_tent", allocationMode: "discrete_inventory", capacityTotal: 1, guestCapacityTotal: 4 }
    const value = PublicCampgroundFulfillmentSchema.parse(fulfillment)
    expect(value).toMatchObject({ salesUnit: "owned_tent", capacityTotal: 1, guestCapacityTotal: 4 })
  })

  it("rejects whole-camp or mismatched capacity semantics", () => {
    expect(PublicCampgroundFulfillmentSchema.safeParse({ ...sharedPitch, salesUnit: "owned_tent", allocationMode: "shared_capacity", capacityTotal: 15, guestCapacityTotal: 4 }).success).toBe(false)
    expect(PublicCampgroundFulfillmentSchema.safeParse({ ...sharedPitch, salesUnit: "own_tent_pitch", allocationMode: "discrete_inventory" }).success).toBe(false)
  })

  it("keeps the projection pin explicit and versioned", () => {
    expect(PublicCampgroundProjectionPinSchema.parse({ contract: "public.campground-summary.v1", kind: "campground", offeringId: ids.offering, nodeId: ids.node, profileRevisionId: ids.revision })).toMatchObject({ contract: "public.campground-summary.v1", kind: "campground" })
  })
})
