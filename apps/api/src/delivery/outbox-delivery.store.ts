import { Inject, Injectable } from "@nestjs/common"
import { createHash, randomUUID } from "node:crypto"
import { DataSource, type EntityManager } from "typeorm"

import type { CacheInvalidationEffect } from "./cache-invalidation.port.js"
import type { PublicOfferingInvalidation } from "./public-offering-invalidation.js"
import { OUTBOX_CONSUMERS, type ClaimedOutboxDelivery, type OutboxConsumerName } from "./outbox-delivery.types.js"

const LEASE_SECONDS = 60

export type PreparedPublicOfferingProjection = Readonly<{
  cacheTags: readonly string[]
  effectAlreadyApplied: boolean
}>

type DeliveryRow = Record<string, unknown> & {
  id: string
  topic: string
  aggregate_type: string
  aggregate_id: string
  payload: Record<string, unknown>
  consumer: OutboxConsumerName
  status: string
  attempts: number
  max_attempts: number
  delivery_epoch: number
  lease_token: string | null
  lease_acquired_at: Date | string | null
}

@Injectable()
export class OutboxDeliveryStore {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async claim(consumer: OutboxConsumerName, leaseOwner: string, limit: number): Promise<ClaimedOutboxDelivery[]> {
    return this.dataSource.transaction(async (manager) => {
      if (consumer === OUTBOX_CONSUMERS.sse) await this.seedLegacySseDeliveries(manager)
      const rows = await manager.query(`
        SELECT event.id, event.topic, event.aggregate_type, event.aggregate_id, event.payload,
               delivery.consumer, delivery.status, delivery.attempts, delivery.max_attempts, delivery.delivery_epoch,
               delivery.lease_token, delivery.lease_acquired_at
        FROM outbox_deliveries delivery
        JOIN outbox_events event ON event.id = delivery.event_id
        WHERE delivery.consumer = $1
          AND (
            (delivery.status IN ('pending', 'failed') AND delivery.available_at <= clock_timestamp())
            OR (delivery.status = 'processing' AND delivery.lease_expires_at <= clock_timestamp())
          )
        ORDER BY delivery.available_at, event.created_at, event.id
        FOR UPDATE OF delivery SKIP LOCKED
        LIMIT $2
      `, [consumer, limit]) as DeliveryRow[]

      const claimed: ClaimedOutboxDelivery[] = []
      for (const row of rows) {
        if (row.status === "processing") {
          await manager.query(`
            INSERT INTO outbox_delivery_attempts (
              event_id, consumer, delivery_epoch, attempt, lease_token, outcome, error_code,
              attempted_at, completed_at, next_available_at
            )
            VALUES ($1, $2, $3, $4, $5, 'lease_expired', 'LEASE_EXPIRED', COALESCE($6, clock_timestamp()), clock_timestamp(), NULL)
            ON CONFLICT (event_id, consumer, delivery_epoch, attempt) DO NOTHING
          `, [row.id, consumer, row.delivery_epoch, row.attempts, row.lease_token, row.lease_acquired_at])
          if (row.attempts >= row.max_attempts) {
            await manager.query(`
              UPDATE outbox_deliveries
              SET status = 'dead_letter', lease_token = NULL, lease_owner = NULL,
                  lease_acquired_at = NULL, lease_expires_at = NULL,
                  last_attempt_at = clock_timestamp(), last_failure_at = clock_timestamp(),
                  last_error = 'LEASE_ATTEMPTS_EXHAUSTED', last_error_code = 'LEASE_ATTEMPTS_EXHAUSTED',
                  dead_lettered_at = clock_timestamp(), updated_at = clock_timestamp()
              WHERE event_id = $1 AND consumer = $2 AND status = 'processing'
                AND delivery_epoch = $3 AND attempts = $4 AND lease_token = $5
            `, [row.id, consumer, row.delivery_epoch, row.attempts, row.lease_token])
            continue
          }
        }
        const leaseToken = randomUUID()
        const attempt = row.attempts + 1
        await manager.query(`
          UPDATE outbox_deliveries
          SET status = 'processing', attempts = $3, lease_token = $4, lease_owner = $5,
              lease_acquired_at = clock_timestamp(), lease_expires_at = clock_timestamp() + ($6 * interval '1 second'),
              available_at = clock_timestamp() + ($6 * interval '1 second'), processed_at = NULL,
              last_error = NULL, last_error_code = NULL, updated_at = clock_timestamp()
          WHERE event_id = $1 AND consumer = $2
        `, [row.id, consumer, attempt, leaseToken, leaseOwner, LEASE_SECONDS])
        claimed.push({
          eventId: row.id,
          consumer,
          topic: row.topic,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          payload: row.payload,
          deliveryEpoch: row.delivery_epoch,
          attempt,
          maxAttempts: row.max_attempts,
          leaseToken,
        })
      }
      return claimed
    })
  }

  async succeed(claim: ClaimedOutboxDelivery): Promise<boolean> {
    return this.dataSource.transaction((manager) => this.finalizeSucceeded(manager, claim))
  }

  async preparePublicProjection(
    claim: ClaimedOutboxDelivery,
    invalidation: PublicOfferingInvalidation,
  ): Promise<PreparedPublicOfferingProjection | null> {
    return this.dataSource.transaction(async (manager) => {
      const active = await this.isActiveLease(manager, claim)
      if (!active) return null
      const existing = await manager.query(`
        SELECT cache_tags, effect FROM public_offering_projection_invalidation_receipts
        WHERE event_id = $1
        FOR UPDATE
      `, [claim.eventId]) as Array<{ cache_tags: string[]; effect: string }>
      if (existing.length === 0) {
        const offering = await manager.query(`
          SELECT kind FROM catalog_offerings WHERE id = $1 FOR KEY SHARE
        `, [invalidation.offeringId]) as Array<{ kind: string }>
        if (!offering[0]?.kind) throw new Error("PUBLIC_PROJECTION_OFFERING_MISSING")
        // Kind collections must be purged on hide/archive too; dropping the
        // kind tag here would leave an already-cached add-on card visible.
        const cacheTags = [
          `public-offering:${invalidation.offeringId}`,
          `public-offering-kind:${offering[0].kind}`,
          "public-offering-collection",
        ]
        const state = await manager.query(`
          INSERT INTO public_offering_projection_state (
            offering_id, generation, last_invalidation_event_id, invalidated_at, updated_at
          )
          VALUES ($1, 1, $2, clock_timestamp(), clock_timestamp())
          ON CONFLICT (offering_id) DO UPDATE
          SET generation = public_offering_projection_state.generation + 1,
              last_invalidation_event_id = EXCLUDED.last_invalidation_event_id,
              invalidated_at = EXCLUDED.invalidated_at,
              updated_at = EXCLUDED.updated_at
          RETURNING generation
        `, [invalidation.offeringId, claim.eventId]) as Array<{ generation: number }>
        await manager.query(`
          INSERT INTO public_offering_projection_invalidation_receipts (
            event_id, offering_id, delivery_consumer, delivery_epoch, delivery_attempt,
            generation, cache_tags, tags_hash, applied_at, effect, last_effect_at,
            effect_attempts, provider_code, provider_request_id
          )
          VALUES ($1, $2, 'public_projection', $3, $4, $5, $6::text[], $7,
            clock_timestamp(), 'pending', NULL, 0, NULL, NULL)
        `, [
          claim.eventId,
          invalidation.offeringId,
          claim.deliveryEpoch,
          claim.attempt,
          state[0]?.generation,
          cacheTags,
          createHash("sha256").update(cacheTags.join("\n")).digest("hex"),
        ])
        return { cacheTags, effectAlreadyApplied: false }
      }
      const receipt = existing[0]
      if (!receipt) throw new Error("PUBLIC_PROJECTION_RECEIPT_MISSING")
      return { cacheTags: receipt.cache_tags, effectAlreadyApplied: receipt.effect === "applied" }
    })
  }

  async completePublicProjection(claim: ClaimedOutboxDelivery, effect: CacheInvalidationEffect): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const active = await this.isActiveLease(manager, claim)
      if (!active) return false
      await manager.query(`
        UPDATE public_offering_projection_invalidation_receipts
        SET effect = 'applied', effect_attempts = effect_attempts + 1,
            last_effect_at = clock_timestamp(), provider_code = $2, provider_request_id = $3
        WHERE event_id = $1 AND effect <> 'applied'
      `, [claim.eventId, effect.providerCode, effect.providerRequestId])
      await this.recordSucceededAttempt(manager, claim)
      return this.completeLease(manager, claim)
    })
  }

  async markPublicProjectionEffectFailed(claim: ClaimedOutboxDelivery, providerCode: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const active = await this.isActiveLease(manager, claim)
      if (!active) return
      await manager.query(`
        UPDATE public_offering_projection_invalidation_receipts
        SET effect = 'failed', effect_attempts = effect_attempts + 1,
            last_effect_at = clock_timestamp(), provider_code = $2, provider_request_id = NULL
        WHERE event_id = $1 AND effect <> 'applied'
      `, [claim.eventId, providerCode])
    })
  }

  async fail(claim: ClaimedOutboxDelivery, input: { code: string; outcome: "retry" | "dead_letter"; delayMilliseconds: number | null }): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const active = await this.isActiveLease(manager, claim)
      if (!active) return false
      const outcome = input.outcome === "retry" ? "retryable_failure" : "permanent_failure"
      const nextAvailable = outcome === "retryable_failure"
      await manager.query(`
        INSERT INTO outbox_delivery_attempts (
          event_id, consumer, delivery_epoch, attempt, lease_token, outcome, error_code,
          attempted_at, completed_at, next_available_at
        )
        SELECT $1, $2, $3, $4, $5, $6, $7, lease_acquired_at, clock_timestamp(),
               CASE WHEN $8::boolean THEN clock_timestamp() + ($9 * interval '1 millisecond') ELSE NULL END
        FROM outbox_deliveries
        WHERE event_id = $1 AND consumer = $2 AND lease_token = $5 AND status = 'processing'
      `, [claim.eventId, claim.consumer, claim.deliveryEpoch, claim.attempt, claim.leaseToken, outcome, input.code, nextAvailable, input.delayMilliseconds ?? 0])
      const result = await manager.query(`
        UPDATE outbox_deliveries
        SET status = CASE WHEN $4::boolean THEN 'failed' ELSE 'dead_letter' END,
            available_at = CASE WHEN $4::boolean THEN clock_timestamp() + ($5 * interval '1 millisecond') ELSE available_at END,
            lease_token = NULL, lease_owner = NULL, lease_acquired_at = NULL, lease_expires_at = NULL,
            last_attempt_at = clock_timestamp(), last_failure_at = clock_timestamp(),
            last_error = $6, last_error_code = $6,
            dead_lettered_at = CASE WHEN $4::boolean THEN NULL ELSE clock_timestamp() END,
            updated_at = clock_timestamp()
        WHERE event_id = $1 AND consumer = $2 AND lease_token = $3 AND status = 'processing'
      `, [claim.eventId, claim.consumer, claim.leaseToken, nextAvailable, input.delayMilliseconds ?? 0, input.code]) as Array<{ affectedRows?: number }>
      return Number(result[1] ?? result[0]?.affectedRows ?? 0) > 0
    })
  }

  private async seedLegacySseDeliveries(manager: EntityManager) {
    await manager.query(`
      INSERT INTO outbox_deliveries (
        event_id, consumer, status, attempts, delivery_epoch, replay_count, max_attempts,
        available_at, created_at, updated_at
      )
      SELECT event.id, 'sse', 'pending', 0, 1, 0, 8, event.available_at, clock_timestamp(), clock_timestamp()
      FROM outbox_events event
      WHERE event.processed_at IS NULL
      ON CONFLICT (event_id, consumer) DO NOTHING
    `)
  }

  private async isActiveLease(manager: EntityManager, claim: ClaimedOutboxDelivery): Promise<boolean> {
    const rows = await manager.query(`
      SELECT 1 FROM outbox_deliveries
      WHERE event_id = $1 AND consumer = $2 AND status = 'processing'
        AND delivery_epoch = $3 AND attempts = $4 AND lease_token = $5
        AND lease_expires_at > clock_timestamp()
      FOR UPDATE
    `, [claim.eventId, claim.consumer, claim.deliveryEpoch, claim.attempt, claim.leaseToken])
    return rows.length === 1
  }

  private async recordSucceededAttempt(manager: EntityManager, claim: ClaimedOutboxDelivery) {
    await manager.query(`
      INSERT INTO outbox_delivery_attempts (
        event_id, consumer, delivery_epoch, attempt, lease_token, outcome, error_code,
        attempted_at, completed_at, next_available_at
      )
      SELECT $1, $2, $3, $4, $5, 'succeeded', NULL, lease_acquired_at, clock_timestamp(), NULL
      FROM outbox_deliveries
      WHERE event_id = $1 AND consumer = $2 AND lease_token = $5 AND status = 'processing'
    `, [claim.eventId, claim.consumer, claim.deliveryEpoch, claim.attempt, claim.leaseToken])
  }

  private async finalizeSucceeded(manager: EntityManager, claim: ClaimedOutboxDelivery): Promise<boolean> {
    const active = await this.isActiveLease(manager, claim)
    if (!active) return false
    await this.recordSucceededAttempt(manager, claim)
    return this.completeLease(manager, claim)
  }

  private async completeLease(manager: EntityManager, claim: ClaimedOutboxDelivery): Promise<boolean> {
    const result = await manager.query(`
      UPDATE outbox_deliveries
      SET status = 'succeeded', processed_at = clock_timestamp(), available_at = clock_timestamp(),
          lease_token = NULL, lease_owner = NULL, lease_acquired_at = NULL, lease_expires_at = NULL,
          last_attempt_at = clock_timestamp(), last_error = NULL, last_error_code = NULL,
          dead_lettered_at = NULL, updated_at = clock_timestamp()
      WHERE event_id = $1 AND consumer = $2 AND delivery_epoch = $3 AND attempts = $4
        AND lease_token = $5 AND status = 'processing'
    `, [claim.eventId, claim.consumer, claim.deliveryEpoch, claim.attempt, claim.leaseToken]) as Array<{ affectedRows?: number }>
    const succeeded = Number(result[1] ?? result[0]?.affectedRows ?? 0) > 0
    if (!succeeded) return false
    await manager.query(`
      UPDATE outbox_events event
      SET processed_at = clock_timestamp()
      WHERE event.id = $1
        AND NOT EXISTS (
          SELECT 1 FROM outbox_deliveries delivery
          WHERE delivery.event_id = event.id AND delivery.status <> 'succeeded'
        )
    `, [claim.eventId])
    return true
  }
}
