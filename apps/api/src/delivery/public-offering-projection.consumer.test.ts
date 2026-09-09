import { describe, expect, it, vi } from "vitest"

import type { CacheInvalidationPort } from "./cache-invalidation.port.js"
import { PublicOfferingProjectionConsumer } from "./public-offering-projection.consumer.js"
import type { OutboxDeliveryStore } from "./outbox-delivery.store.js"
import { PermanentDeliveryError, type ClaimedOutboxDelivery } from "./outbox-delivery.types.js"

const eventId = "11111111-1111-4111-8111-111111111111"
const offeringId = "22222222-2222-4222-8222-222222222222"

function claim(overrides: Partial<ClaimedOutboxDelivery> = {}): ClaimedOutboxDelivery {
  return {
    eventId,
    consumer: "public_projection",
    topic: "public.offering_projection.invalidated",
    aggregateType: "catalog_offering",
    aggregateId: offeringId,
    deliveryEpoch: 1,
    attempt: 1,
    maxAttempts: 8,
    leaseToken: "33333333-3333-4333-8333-333333333333",
    payload: {
      eventId,
      eventType: "public.offering_projection.invalidated",
      occurredAt: "2026-09-01T12:00:00.000Z",
      actorId: "55555555-5555-4555-8555-555555555555",
      requestId: "test",
      operationId: "44444444-4444-4444-8444-444444444444",
      entrySurface: "internal",
      aggregate: { type: "catalog_offering", id: offeringId },
      versions: { calendar: null, subject: 2, addOns: null },
      configurationHash: "a".repeat(64),
    },
    ...overrides,
  }
}

describe("PublicOfferingProjectionConsumer", () => {
  it("persists the pending receipt before applying its bounded database epoch effect", async () => {
    const prepare = vi.fn().mockResolvedValue({
      cacheTags: [`public-offering:${offeringId}`, "public-offering-kind:house", "public-offering-collection"],
      effectAlreadyApplied: false,
    })
    const store = { preparePublicProjection: prepare, markPublicProjectionEffectFailed: vi.fn() } as unknown as OutboxDeliveryStore
    const invalidate = vi.fn().mockResolvedValue({ mode: "database_epoch", providerCode: "DATABASE_EPOCH", providerRequestId: null })
    const consumer = new PublicOfferingProjectionConsumer({ invalidate } as CacheInvalidationPort, store)

    const result = await consumer.consume(claim())

    expect(prepare).toHaveBeenCalledOnce()
    expect(invalidate).toHaveBeenCalledWith({
      idempotencyKey: eventId,
      tags: [`public-offering:${offeringId}`, "public-offering-kind:house", "public-offering-collection"],
    })
    expect(result.effect.mode).toBe("database_epoch")
  })

  it("does not mutate a receipt for a poisoned public envelope", async () => {
    const prepare = vi.fn()
    const consumer = new PublicOfferingProjectionConsumer(
      { invalidate: vi.fn() } as unknown as CacheInvalidationPort,
      { preparePublicProjection: prepare } as unknown as OutboxDeliveryStore,
    )
    await expect(consumer.consume(claim({ aggregateType: "business_calendar" })))
      .rejects.toEqual(expect.objectContaining<Partial<PermanentDeliveryError>>({ code: "INVALID_PUBLIC_PROJECTION_ENVELOPE" }))
    expect(prepare).not.toHaveBeenCalled()
  })

  it("records a failed effect before retrying the fenced delivery", async () => {
    const markFailed = vi.fn().mockResolvedValue(undefined)
    const consumer = new PublicOfferingProjectionConsumer(
      { invalidate: vi.fn().mockRejectedValue(new Error("offline")) } as unknown as CacheInvalidationPort,
      {
        preparePublicProjection: vi.fn().mockResolvedValue({
          cacheTags: [`public-offering:${offeringId}`, "public-offering-kind:house", "public-offering-collection"],
          effectAlreadyApplied: false,
        }),
        markPublicProjectionEffectFailed: markFailed,
      } as unknown as OutboxDeliveryStore,
    )
    await expect(consumer.consume(claim())).rejects.toThrow("offline")
    expect(markFailed).toHaveBeenCalledWith(expect.anything(), "DATABASE_EPOCH_FAILED")
  })

  it("reuses a prepared pending receipt after a crash before the effect", async () => {
    const tags = [`public-offering:${offeringId}`, "public-offering-kind:house", "public-offering-collection"]
    // The store returns the same durable receipt on a later lease; it owns
    // generation creation, so the consumer has no path that can increment it.
    const prepare = vi.fn().mockResolvedValue({ cacheTags: tags, effectAlreadyApplied: false })
    const invalidate = vi.fn().mockResolvedValue({ mode: "database_epoch", providerCode: "DATABASE_EPOCH", providerRequestId: null })
    const consumer = new PublicOfferingProjectionConsumer(
      { invalidate } as CacheInvalidationPort,
      { preparePublicProjection: prepare, markPublicProjectionEffectFailed: vi.fn() } as unknown as OutboxDeliveryStore,
    )
    await consumer.consume(claim())
    await consumer.consume(claim({ attempt: 2, leaseToken: "66666666-6666-4666-8666-666666666666" }))
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(invalidate).toHaveBeenNthCalledWith(2, { idempotencyKey: eventId, tags })
  })

  it("accepts a future external tag-purge adapter without changing receipt semantics", async () => {
    const consumer = new PublicOfferingProjectionConsumer(
      { invalidate: vi.fn().mockResolvedValue({ mode: "external_tag_purge", providerCode: "CDN_TAG_PURGE", providerRequestId: "purge-42" }) } as CacheInvalidationPort,
      {
        preparePublicProjection: vi.fn().mockResolvedValue({
          cacheTags: [`public-offering:${offeringId}`, "public-offering-kind:house", "public-offering-collection"],
          effectAlreadyApplied: false,
        }),
        markPublicProjectionEffectFailed: vi.fn(),
      } as unknown as OutboxDeliveryStore,
    )
    expect((await consumer.consume(claim())).effect.mode).toBe("external_tag_purge")
  })
})
