import { describe, expect, it } from "vitest"

import { PublicHouseProjectionPinSchema, PublicHouseSummarySchema } from "@crm/contracts"

const ids = {
  offering: "11111111-1111-4111-8111-111111111111",
  node: "22222222-2222-4222-8222-222222222222",
  revision: "33333333-3333-4333-8333-333333333333",
  release: "44444444-4444-4444-8444-444444444444",
}

function house(overrides: Record<string, unknown> = {}) {
  return {
    offeringId: ids.offering,
    kind: "house",
    path: "/houses/forest",
    releaseId: ids.release,
    title: "Домик «Лесной»",
    summary: "Домик в сосновом лесу",
    price: { mode: "from", amount: { amountMinor: 650000, currency: "RUB" } },
    priceBasisLabel: "за ночь",
    quoteAvailable: false,
    requestAvailable: true,
    capacity: null,
    readiness: "ready",
    timezone: "Europe/Moscow",
    currency: "RUB",
    sourceVersions: { offering: 3, pricing: 4, priceBook: 2, calendar: 2, contentReleaseId: ids.release, profileRevisionId: ids.revision },
    asOf: "2026-09-10T10:00:00.000Z",
    fulfillment: { allocationMode: "exclusive_resource", capacityUnit: "guests", capacityTotal: 4, pricingMode: "rate_plan", spaceType: "mixed", availabilityMode: "resource" },
    ...overrides,
  }
}

describe("public house contract", () => {
  it("accepts the release-pinned safe projection", () => {
    expect(PublicHouseSummarySchema.parse(house())).toMatchObject({ kind: "house", path: "/houses/forest", fulfillment: { capacityTotal: 4 } })
  })

  it("allows honest request-only readiness without fabricating a price", () => {
    const value = PublicHouseSummarySchema.parse(house({ price: { mode: "request" }, priceBasisLabel: null, readiness: "request_only", fulfillment: { ...house().fulfillment, availabilityMode: "request_only" } }))
    expect(value.price).toEqual({ mode: "request" })
    expect(value.fulfillment.availabilityMode).toBe("request_only")
  })

  it("rejects an external or query-bearing canonical path", () => {
    expect(PublicHouseSummarySchema.safeParse(house({ path: "https://private.example/house" })).success).toBe(false)
    expect(PublicHouseSummarySchema.safeParse(house({ path: "/houses/forest?date=tomorrow" })).success).toBe(false)
  })

  it("keeps the projection pin explicit and versioned", () => {
    expect(PublicHouseProjectionPinSchema.parse({ contract: "public.house-summary.v1", kind: "house", offeringId: ids.offering, nodeId: ids.node, profileRevisionId: ids.revision })).toMatchObject({ contract: "public.house-summary.v1", kind: "house" })
  })
})
