import { Inject, Injectable, Logger } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { DEFAULT_OUTBOX_RETRY_POLICY, decideOutboxRetry } from "@crm/domain"

import { OutboxDeliveryStore } from "./outbox-delivery.store.js"
import {
  deliveryErrorCode,
  isRetryableDeliveryError,
  type ClaimedOutboxDelivery,
  type OutboxConsumerName,
} from "./outbox-delivery.types.js"
import type { PublicProjectionDeliveryCompletion } from "./public-offering-projection.consumer.js"

export type OutboxDeliveryHandler = (claim: ClaimedOutboxDelivery) => Promise<void | PublicProjectionDeliveryCompletion>

@Injectable()
export class OutboxDeliveryEngine {
  private readonly logger = new Logger(OutboxDeliveryEngine.name)
  private readonly workers = new Set<string>()
  private readonly workerId = `api-${process.pid}-${randomUUID()}`

  constructor(@Inject(OutboxDeliveryStore) private readonly store: OutboxDeliveryStore) {}

  async dispatch(consumer: OutboxConsumerName, handler: OutboxDeliveryHandler, limit = 8): Promise<number> {
    if (this.workers.has(consumer)) return 0
    this.workers.add(consumer)
    try {
      const claims = await this.store.claim(consumer, this.workerId, limit)
      const results = await Promise.allSettled(claims.map(async (claim) => {
        try {
          const completion = await handler(claim)
          if (completion?.kind === "public_projection") {
            await this.store.completePublicProjection(claim, completion.effect)
          } else {
            await this.store.succeed(claim)
          }
        } catch (error) {
          const code = deliveryErrorCode(error)
          const retryable = isRetryableDeliveryError(error)
          const decision = decideOutboxRetry({
            attempts: claim.attempt,
            policy: { ...DEFAULT_OUTBOX_RETRY_POLICY, maxAttempts: claim.maxAttempts },
            failure: { code, retryable },
            jitterSeed: claim.eventId,
          })
          await this.store.fail(claim, {
            code,
            outcome: decision.outcome,
            delayMilliseconds: decision.delayMs,
          })
          this.logger.warn({ eventId: claim.eventId, consumer, code, retryable, outcome: decision.outcome }, "Outbox delivery failed")
        }
      }))
      for (const result of results) {
        if (result.status === "rejected") this.logger.error(result.reason, "Outbox delivery finalization failed; fenced lease will be reclaimed")
      }
      return claims.length
    } finally {
      this.workers.delete(consumer)
    }
  }
}
