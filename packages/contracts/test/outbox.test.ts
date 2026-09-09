import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  OutboxDeliveryHealthSchema,
  OutboxDeliveryListResponseSchema,
  OutboxDeliveryReplayInputSchema,
  OutboxDeliverySchema,
  PublicOfferingProjectionInvalidationReceiptSchema,
  PublicOfferingProjectionStateSchema,
} from "../src/index.js";

const eventId = "11111111-1111-4111-8111-111111111111";
const offeringId = "22222222-2222-4222-8222-222222222222";
const operationId = "33333333-3333-4333-8333-333333333333";
const at = "2026-09-01T12:00:00.000Z";

describe("outbox delivery contracts", () => {
  it("exposes delivery observability without raw payload or error text", () => {
    const delivery = OutboxDeliverySchema.parse({
      eventId, consumer: "public_projection", topic: "public.offering_projection.invalidated",
      aggregateType: "catalog_offering", aggregateId: offeringId, status: "dead_letter",
      attempts: 8, maxAttempts: 8, deliveryEpoch: 1, replayCount: 0,
      availableAt: at, processedAt: null, leaseAcquiredAt: null, leaseExpiresAt: null,
      lastAttemptAt: at, lastFailureAt: at, lastErrorCode: "DELIVERY_PAYLOAD_INVALID",
      deadLetteredAt: at, createdAt: at, updatedAt: at,
    });
    expect(delivery.lastErrorCode).toBe("DELIVERY_PAYLOAD_INVALID");
    expect(OutboxDeliverySchema.safeParse({ ...delivery, payload: { customer: "private" } }).success).toBe(false);
    expect(OutboxDeliverySchema.safeParse({ ...delivery, lastError: "private external body" }).success).toBe(false);
  });

  it("models only invalidation generation and canonical cache receipt metadata", () => {
    expect(PublicOfferingProjectionStateSchema.parse({ offeringId, generation: 4, lastInvalidationEventId: eventId, invalidatedAt: at, updatedAt: at })).toMatchObject({ generation: 4 });
    const tags = [`public-offering:${offeringId}`, "public-offering-kind:house", "public-offering-collection"];
    const receipt = PublicOfferingProjectionInvalidationReceiptSchema.parse({
      eventId, offeringId, deliveryEpoch: 2, deliveryAttempt: 1, generation: 4,
      cacheTags: tags, tagsHash: createHash("sha256").update(tags.join("\n")).digest("hex"), appliedAt: at,
      effect: "pending", lastEffectAt: null, effectAttempts: 0, providerCode: null, providerRequestId: null,
    });
    expect(receipt.cacheTags).toEqual(tags);
    expect(PublicOfferingProjectionInvalidationReceiptSchema.safeParse({ ...receipt, cacheTags: ["/private/path"] }).success).toBe(false);
  });

  it("requires an idempotent, audited operator replay reason", () => {
    expect(OutboxDeliveryReplayInputSchema.safeParse({ operationId, idempotencyKey: "replay-delivery-key", expectedStatus: "dead_letter", expectedDeliveryEpoch: 1, expectedAttempts: 8, reason: "Провайдер восстановлен" }).success).toBe(true);
    expect(OutboxDeliveryReplayInputSchema.safeParse({ operationId, idempotencyKey: "short", reason: "" }).success).toBe(false);
    expect(OutboxDeliveryReplayInputSchema.safeParse({ operationId, idempotencyKey: "replay-delivery-key", expectedStatus: "failed", expectedDeliveryEpoch: 0, expectedAttempts: -1, reason: "Сбой" }).success).toBe(false);
  });

  it("keeps list and health operator responses free of payload and raw error fields", () => {
    const delivery = {
      eventId, consumer: "public_projection", topic: "public.offering_projection.invalidated",
      aggregateType: "catalog_offering", aggregateId: offeringId, status: "failed",
      attempts: 1, maxAttempts: 8, deliveryEpoch: 1, replayCount: 0,
      availableAt: at, processedAt: null, leaseAcquiredAt: null, leaseExpiresAt: null,
      lastAttemptAt: at, lastFailureAt: at, lastErrorCode: "DELIVERY_PROVIDER_MISCONFIGURED",
      deadLetteredAt: null, createdAt: at, updatedAt: at,
    };
    expect(OutboxDeliveryListResponseSchema.safeParse({ items: [{ ...delivery, payload: { pii: true } }], nextCursor: null }).success).toBe(false);
    expect(OutboxDeliveryHealthSchema.parse({ generatedAt: at, consumers: [{ consumer: "public_projection", pending: 0, processing: 0, succeeded: 1, failed: 1, deadLetter: 0, oldestReadyAt: at, oldestLeaseExpiresAt: null }] }).consumers).toHaveLength(1);
  });
});
