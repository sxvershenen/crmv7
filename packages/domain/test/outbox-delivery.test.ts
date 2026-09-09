import { describe, expect, it } from "vitest";

import {
  classifyOutboxDeliveryFailure,
  decideOutboxRetry,
} from "../src/outbox-delivery.js";

describe("outbox delivery retry policy", () => {
  it("classifies permanent and transient failures without inspecting error messages", () => {
    expect(classifyOutboxDeliveryFailure({ code: "DELIVERY_PAYLOAD_INVALID" })).toBe("permanent");
    expect(classifyOutboxDeliveryFailure({ code: "DELIVERY_PROVIDER_MISCONFIGURED" })).toBe("retryable");
    expect(classifyOutboxDeliveryFailure({ httpStatus: 422 })).toBe("permanent");
    expect(classifyOutboxDeliveryFailure({ httpStatus: 429 })).toBe("retryable");
    expect(classifyOutboxDeliveryFailure({ retryable: true, code: "DELIVERY_PAYLOAD_INVALID" })).toBe("permanent");
  });

  it("uses deterministic capped exponential retry and dead-letters final attempts", () => {
    const policy = { maxAttempts: 3, baseDelayMs: 1_000, maxDelayMs: 10_000, jitterRatio: 0 };
    expect(decideOutboxRetry({ attempts: 1, policy, failure: {}, jitterSeed: "event-a" })).toEqual({ outcome: "retry", failureClass: "retryable", delayMs: 1_000 });
    expect(decideOutboxRetry({ attempts: 2, policy, failure: {}, jitterSeed: "event-a" })).toEqual({ outcome: "retry", failureClass: "retryable", delayMs: 2_000 });
    expect(decideOutboxRetry({ attempts: 3, policy, failure: {}, jitterSeed: "event-a" })).toEqual({ outcome: "dead_letter", failureClass: "retryable", delayMs: null });
    expect(decideOutboxRetry({ attempts: 1, policy, failure: { httpStatus: 400 }, jitterSeed: "event-a" })).toEqual({ outcome: "dead_letter", failureClass: "permanent", delayMs: null });
  });
});
