import { describe, expect, it } from "vitest"

import {
  PermanentDeliveryError,
  deliveryErrorCode,
  isRetryableDeliveryError,
} from "./outbox-delivery.types.js"

describe("outbox delivery retry boundary", () => {
  it("dead-letters malformed input while retrying transient failures", () => {
    const poison = new PermanentDeliveryError("INVALID_PUBLIC_PROJECTION_PAYLOAD")
    expect(deliveryErrorCode(poison)).toBe("INVALID_PUBLIC_PROJECTION_PAYLOAD")
    expect(isRetryableDeliveryError(poison)).toBe(false)
    expect(deliveryErrorCode(new Error("provider unavailable"))).toBe("DELIVERY_HANDLER_FAILED")
    expect(isRetryableDeliveryError(new Error("provider unavailable"))).toBe(true)
  })
})
