import { describe, expect, it } from "vitest"

import { OfferingFulfillmentSchema, VenueOfferingBindingsReplaceBodySchema } from "../src/offerings.js"

const operationId = "11111111-1111-4111-8111-111111111111"
const resourceId = "22222222-2222-4222-8222-222222222222"

describe("venue offering contracts", () => {
  it("requires the explicit exclusive Resource policy", () => {
    expect(OfferingFulfillmentSchema.safeParse({ kind: "venue" }).success).toBe(false)
    expect(OfferingFulfillmentSchema.parse({ kind: "venue", allocationMode: "exclusive_resource", capacityUnit: "guests", pricingMode: "rate_plan" })).toMatchObject({ kind: "venue" })
  })

  it("rejects a venue binding that can leak shared or zero capacity", () => {
    const result = VenueOfferingBindingsReplaceBodySchema.safeParse({
      operationId, idempotencyKey: operationId, expectedSubjectVersion: 1,
      bindings: [{ target: { type: "resource", id: resourceId }, role: "primary", availabilityRequired: true, defaultQuantity: 2, defaultCapacityImpact: 0, preparationBeforeMinutes: 0, preparationAfterMinutes: 0 }],
    })
    expect(result.success).toBe(false)
  })
})
