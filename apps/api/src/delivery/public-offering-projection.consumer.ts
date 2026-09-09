import { Inject, Injectable } from "@nestjs/common"

import { CacheInvalidationPort, type CacheInvalidationEffect } from "./cache-invalidation.port.js"
import { OutboxDeliveryStore } from "./outbox-delivery.store.js"
import { normalizePublicOfferingInvalidation, type PublicOfferingInvalidation } from "./public-offering-invalidation.js"
import { PermanentDeliveryError, type ClaimedOutboxDelivery } from "./outbox-delivery.types.js"

export type PublicProjectionDeliveryCompletion = Readonly<{
  kind: "public_projection"
  invalidation: PublicOfferingInvalidation
  effect: CacheInvalidationEffect
}>

@Injectable()
export class PublicOfferingProjectionConsumer {
  constructor(
    @Inject(CacheInvalidationPort) private readonly cache: CacheInvalidationPort,
    @Inject(OutboxDeliveryStore) private readonly store: OutboxDeliveryStore,
  ) {}

  async consume(claim: ClaimedOutboxDelivery): Promise<PublicProjectionDeliveryCompletion> {
    if (claim.consumer !== "public_projection"
      || claim.topic !== "public.offering_projection.invalidated"
      || claim.aggregateType !== "catalog_offering") {
      throw new PermanentDeliveryError("INVALID_PUBLIC_PROJECTION_ENVELOPE")
    }
    const invalidation = normalizePublicOfferingInvalidation(claim.payload)
    if (!invalidation || invalidation.eventId !== claim.eventId || invalidation.offeringId !== claim.aggregateId) {
      throw new PermanentDeliveryError("INVALID_PUBLIC_PROJECTION_PAYLOAD")
    }
    const prepared = await this.store.preparePublicProjection(claim, invalidation)
    if (!prepared) throw new PermanentDeliveryError("DELIVERY_LEASE_EXPIRED")
    if (prepared.effectAlreadyApplied) {
      return {
        kind: "public_projection",
        invalidation,
        effect: { mode: "database_epoch", providerCode: "DATABASE_EPOCH", providerRequestId: null },
      }
    }
    let effect: CacheInvalidationEffect
    try {
      effect = await this.cache.invalidate({ idempotencyKey: claim.eventId, tags: prepared.cacheTags })
    } catch (error) {
      await this.store.markPublicProjectionEffectFailed(claim, "DATABASE_EPOCH_FAILED")
      throw error
    }
    return { kind: "public_projection", invalidation, effect }
  }
}
