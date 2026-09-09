import { randomUUID } from "node:crypto"

import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import {
  OutboxDeliveryHealthSchema,
  OutboxDeliveryListResponseSchema,
  OutboxDeliveryReplayResultSchema,
  OutboxDeliverySchema,
  DateTimeSchema,
  IdSchema,
  OutboxConsumerSchema,
  type OutboxDelivery,
  type OutboxDeliveryDetailParams,
  type OutboxDeliveryHealth,
  type OutboxDeliveryListResponse,
  type OutboxDeliveryQuery,
  type OutboxDeliveryReplayInput,
  type OutboxDeliveryReplayResult,
  type SessionUser,
} from "@crm/contracts"
import { ChangeLogEntity, IdempotencyKeyEntity, OutboxDeliveryReplayEntity } from "@crm/db"
import { DataSource } from "typeorm"

import { canonicalSha256 } from "../offerings/offering-mutation-support.js"

type DeliveryRow = Record<string, unknown> & {
  event_id: string
  consumer: string
  topic: string
  aggregate_type: string
  aggregate_id: string
  status: string
  attempts: number | string
  max_attempts: number | string
  delivery_epoch: number | string
  replay_count: number | string
  available_at: Date | string
  processed_at: Date | string | null
  lease_acquired_at: Date | string | null
  lease_expires_at: Date | string | null
  last_attempt_at: Date | string | null
  last_failure_at: Date | string | null
  last_error_code: string | null
  dead_lettered_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

type Cursor = { updatedAt: string; eventId: string; consumer: string }

const replayScope = "outbox_delivery:replay"

@Injectable()
export class DeliveryAdminService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: OutboxDeliveryQuery, actor: SessionUser): Promise<OutboxDeliveryListResponse> {
    this.assertCanManage(actor)
    const params: unknown[] = []
    const bind = (value: unknown) => {
      params.push(value)
      return `$${params.length}`
    }
    const where = ["TRUE"]
    if (query.consumer) where.push(`delivery.consumer = ${bind(query.consumer)}`)
    if (query.status) where.push(`delivery.status = ${bind(query.status)}`)
    if (query.topic) where.push(`event.topic = ${bind(query.topic)}`)
    if (query.aggregateType) where.push(`event.aggregate_type = ${bind(query.aggregateType)}`)
    if (query.aggregateId) where.push(`event.aggregate_id = ${bind(query.aggregateId)}::uuid`)
    if (query.cursor) {
      const cursor = this.decodeCursor(query.cursor)
      const updatedAt = bind(cursor.updatedAt)
      const eventId = bind(cursor.eventId)
      const consumer = bind(cursor.consumer)
      where.push(`(delivery.updated_at, delivery.event_id, delivery.consumer) < (${updatedAt}::timestamptz, ${eventId}::uuid, ${consumer}::text)`)
    }
    const limit = bind(query.limit + 1)
    const rows = await this.dataSource.query(`
      SELECT delivery.event_id, delivery.consumer, event.topic, event.aggregate_type, event.aggregate_id,
        delivery.status, delivery.attempts, delivery.max_attempts, delivery.delivery_epoch, delivery.replay_count,
        delivery.available_at, delivery.processed_at, delivery.lease_acquired_at, delivery.lease_expires_at,
        delivery.last_attempt_at, delivery.last_failure_at, delivery.last_error_code, delivery.dead_lettered_at,
        delivery.created_at, delivery.updated_at
      FROM outbox_deliveries delivery
      INNER JOIN outbox_events event ON event.id = delivery.event_id
      WHERE ${where.join(" AND ")}
      ORDER BY delivery.updated_at DESC, delivery.event_id DESC, delivery.consumer DESC
      LIMIT ${limit}
    `, params) as DeliveryRow[]
    const page = rows.slice(0, query.limit)
    const last = page.at(-1)
    return OutboxDeliveryListResponseSchema.parse({
      items: page.map((row) => this.toDelivery(row)),
      nextCursor: rows.length > query.limit && last ? this.encodeCursor(last) : null,
    })
  }

  async health(actor: SessionUser): Promise<OutboxDeliveryHealth> {
    this.assertCanManage(actor)
    const rows = await this.dataSource.query(`
      SELECT consumer,
        count(*) FILTER (WHERE status = 'pending') AS pending,
        count(*) FILTER (WHERE status = 'processing') AS processing,
        count(*) FILTER (WHERE status = 'succeeded') AS succeeded,
        count(*) FILTER (WHERE status = 'failed') AS failed,
        count(*) FILTER (WHERE status = 'dead_letter') AS dead_letter,
        min(available_at) FILTER (WHERE status IN ('pending', 'failed')) AS oldest_ready_at,
        min(lease_expires_at) FILTER (WHERE status = 'processing') AS oldest_lease_expires_at
      FROM outbox_deliveries
      GROUP BY consumer
      ORDER BY consumer ASC
    `) as Array<Record<string, unknown>>
    return OutboxDeliveryHealthSchema.parse({
      generatedAt: new Date().toISOString(),
      consumers: rows.map((row) => ({
        consumer: row.consumer,
        pending: Number(row.pending),
        processing: Number(row.processing),
        succeeded: Number(row.succeeded),
        failed: Number(row.failed),
        deadLetter: Number(row.dead_letter),
        oldestReadyAt: this.iso(row.oldest_ready_at),
        oldestLeaseExpiresAt: this.iso(row.oldest_lease_expires_at),
      })),
    })
  }

  async detail(params: OutboxDeliveryDetailParams, actor: SessionUser): Promise<OutboxDelivery> {
    this.assertCanManage(actor)
    const rows = await this.dataSource.query(`
      SELECT delivery.event_id, delivery.consumer, event.topic, event.aggregate_type, event.aggregate_id,
        delivery.status, delivery.attempts, delivery.max_attempts, delivery.delivery_epoch, delivery.replay_count,
        delivery.available_at, delivery.processed_at, delivery.lease_acquired_at, delivery.lease_expires_at,
        delivery.last_attempt_at, delivery.last_failure_at, delivery.last_error_code, delivery.dead_lettered_at,
        delivery.created_at, delivery.updated_at
      FROM outbox_deliveries delivery
      INNER JOIN outbox_events event ON event.id = delivery.event_id
      WHERE delivery.event_id = $1::uuid AND delivery.consumer = $2
    `, [params.eventId, params.consumer]) as DeliveryRow[]
    const row = rows[0]
    if (!row) throw new NotFoundException({ code: "NOT_FOUND", message: "Outbox delivery не найдена" })
    return this.toDelivery(row)
  }

  async replay(params: OutboxDeliveryDetailParams, input: OutboxDeliveryReplayInput, actor: SessionUser, requestId: string): Promise<OutboxDeliveryReplayResult> {
    this.assertCanManage(actor)
    const requestHash = canonicalSha256({ command: "outbox_delivery.replay", eventId: params.eventId, consumer: params.consumer, input })
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      // Serialize both unique idempotency dimensions before observing either row.
      // The common lexical order prevents an operation/key cross-lock deadlock.
      const advisoryKeys = [
        `outbox_delivery:replay:idempotency:${input.idempotencyKey}`,
        `outbox_delivery:replay:operation:${input.operationId}`,
      ].sort()
      for (const key of advisoryKeys) await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [key])
      const existing = await manager.getRepository(IdempotencyKeyEntity).findOne({
        where: [{ scope: replayScope, operationId: input.operationId }, { scope: replayScope, idempotencyKey: input.idempotencyKey }],
      })
      if (existing) {
        if (existing.operationId !== input.operationId || existing.idempotencyKey !== input.idempotencyKey || existing.requestHash !== requestHash) {
          throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "operationId или idempotencyKey уже использован с другими данными" })
        }
        if (existing.responseBody) return OutboxDeliveryReplayResultSchema.parse(existing.responseBody)
        throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Операция replay уже выполняется" })
      }

      const locked = this.queryRows(await manager.query(`
        SELECT delivery.event_id, delivery.consumer, event.topic, event.aggregate_type, event.aggregate_id,
          delivery.status, delivery.attempts, delivery.max_attempts, delivery.delivery_epoch, delivery.replay_count,
          delivery.available_at, delivery.processed_at, delivery.lease_acquired_at, delivery.lease_expires_at,
          delivery.last_attempt_at, delivery.last_failure_at, delivery.last_error_code, delivery.dead_lettered_at,
          delivery.created_at, delivery.updated_at
        FROM outbox_deliveries delivery
        INNER JOIN outbox_events event ON event.id = delivery.event_id
        WHERE delivery.event_id = $1::uuid AND delivery.consumer = $2
        FOR UPDATE OF delivery
      `, [params.eventId, params.consumer]))
      const before = locked[0]
      if (!before) throw new NotFoundException({ code: "NOT_FOUND", message: "Outbox delivery не найдена" })
      if (before.status !== input.expectedStatus
        || Number(before.delivery_epoch) !== input.expectedDeliveryEpoch
        || Number(before.attempts) !== input.expectedAttempts) {
        throw new ConflictException({ code: "DELIVERY_REPLAY_STALE", message: "Состояние доставки изменилось до replay" })
      }

      const now = new Date()
      const updated = this.queryRows(await manager.query(`
        UPDATE outbox_deliveries
        SET status = 'pending', attempts = 0, delivery_epoch = delivery_epoch + 1,
          replay_count = replay_count + 1, available_at = $3::timestamptz,
          processed_at = NULL, last_error = NULL, lease_token = NULL, lease_owner = NULL,
          lease_acquired_at = NULL, lease_expires_at = NULL, last_attempt_at = NULL,
          last_failure_at = NULL, last_error_code = NULL, dead_lettered_at = NULL,
          updated_at = $3::timestamptz
        WHERE event_id = $1::uuid AND consumer = $2
          AND status = $4 AND delivery_epoch = $5 AND attempts = $6
        RETURNING event_id, consumer, status, attempts, max_attempts, delivery_epoch, replay_count,
          available_at, processed_at, lease_acquired_at, lease_expires_at, last_attempt_at,
          last_failure_at, last_error_code, dead_lettered_at, created_at, updated_at
      `, [params.eventId, params.consumer, now, input.expectedStatus, input.expectedDeliveryEpoch, input.expectedAttempts]))
      const after = updated[0]
      if (!after) throw new ConflictException({ code: "DELIVERY_REPLAY_STALE", message: "Доставка изменилась до replay" })
      const replay = await manager.save(manager.create(OutboxDeliveryReplayEntity, {
        id: randomUUID(), eventId: params.eventId, consumer: params.consumer,
        previousDeliveryEpoch: Number(before.delivery_epoch), previousAttempts: Number(before.attempts),
        operationId: input.operationId, requestId, reason: input.reason, replayedBy: actor.id, replayedAt: now,
      }))
      const delivery = this.toDelivery({ ...after, topic: before.topic, aggregate_type: before.aggregate_type, aggregate_id: before.aggregate_id })
      const response = OutboxDeliveryReplayResultSchema.parse({
        delivery,
        replay: {
          id: replay.id, eventId: replay.eventId, consumer: replay.consumer,
          previousDeliveryEpoch: replay.previousDeliveryEpoch, previousAttempts: replay.previousAttempts,
          operationId: replay.operationId, requestId: replay.requestId, reason: replay.reason,
          replayedBy: replay.replayedBy, replayedAt: this.iso(replay.replayedAt),
        },
      })
      await manager.save(manager.create(ChangeLogEntity, {
        id: randomUUID(), entityType: "outbox_delivery", entityId: params.eventId, action: "replayed",
        actorId: actor.id, requestId, createdAt: now,
        changes: {
          consumer: params.consumer, expectedStatus: input.expectedStatus,
          previousDeliveryEpoch: Number(before.delivery_epoch), nextDeliveryEpoch: Number(after.delivery_epoch),
          previousAttempts: Number(before.attempts), replayCount: Number(after.replay_count),
          operationId: input.operationId, requestHash,
        },
      }))
      await manager.save(manager.create(IdempotencyKeyEntity, {
        id: randomUUID(), scope: replayScope, operationId: input.operationId, idempotencyKey: input.idempotencyKey,
        requestHash, responseStatus: 200, responseBody: response, createdAt: now,
      }))
      return response
    })
  }

  private assertCanManage(actor: SessionUser) {
    if (actor.capabilities.canManageIntegrations !== true) {
      throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для управления интеграциями" })
    }
  }

  private toDelivery(row: DeliveryRow): OutboxDelivery {
    return OutboxDeliverySchema.parse({
      eventId: row.event_id, consumer: row.consumer, topic: row.topic, aggregateType: row.aggregate_type, aggregateId: row.aggregate_id,
      status: row.status, attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts),
      deliveryEpoch: Number(row.delivery_epoch), replayCount: Number(row.replay_count),
      availableAt: this.iso(row.available_at), processedAt: this.iso(row.processed_at),
      leaseAcquiredAt: this.iso(row.lease_acquired_at), leaseExpiresAt: this.iso(row.lease_expires_at),
      lastAttemptAt: this.iso(row.last_attempt_at), lastFailureAt: this.iso(row.last_failure_at),
      lastErrorCode: row.last_error_code, deadLetteredAt: this.iso(row.dead_lettered_at),
      createdAt: this.iso(row.created_at), updatedAt: this.iso(row.updated_at),
    })
  }

  private encodeCursor(row: DeliveryRow): string {
    return Buffer.from(JSON.stringify({ updatedAt: this.iso(row.updated_at)!, eventId: row.event_id, consumer: row.consumer } satisfies Cursor)).toString("base64url")
  }

  private decodeCursor(cursor: string): Cursor {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<Cursor>
      const updatedAt = parsed.updatedAt
      const eventId = parsed.eventId
      const consumer = parsed.consumer
      if (typeof updatedAt !== "string" || typeof eventId !== "string" || typeof consumer !== "string" || DateTimeSchema.safeParse(updatedAt).success !== true || IdSchema.safeParse(eventId).success !== true || OutboxConsumerSchema.safeParse(consumer).success !== true) throw new Error("invalid")
      return { updatedAt, eventId, consumer }
    } catch {
      throw new BadRequestException({ code: "INVALID_CURSOR", message: "Некорректный cursor доставки" })
    }
  }

  private iso(value: unknown): string | null {
    if (value === null || value === undefined) return null
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) throw new ConflictException({ code: "DELIVERY_DATA_INVALID", message: "Некорректная служебная дата доставки" })
    return date.toISOString()
  }

  /** TypeORM's PostgreSQL driver returns UPDATE ... RETURNING as [rows, count]. */
  private queryRows(value: unknown): DeliveryRow[] {
    if (Array.isArray(value) && Array.isArray(value[0])) return value[0] as DeliveryRow[]
    return Array.isArray(value) ? value as DeliveryRow[] : []
  }
}
