import { describe, expect, it, vi } from "vitest"

import type { SessionUser } from "@crm/contracts"

import { DeliveryAdminService } from "./delivery-admin.service.js"

const ids = {
  event: "11111111-1111-4111-8111-111111111111",
  aggregate: "22222222-2222-4222-8222-222222222222",
  actor: "33333333-3333-4333-8333-333333333333",
  operation: "44444444-4444-4444-8444-444444444444",
}
const at = new Date("2026-09-01T12:00:00.000Z")
const capabilities: SessionUser["capabilities"] = {
  canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: true, canAssign: true,
  canChangeStatus: true, canAddPayment: true, canRefund: true, canOverrideConflict: true,
  canViewFinance: true, canViewAudit: true, canManageUsers: true, canManageSettings: true,
  canManageIntegrations: true,
}
const actor: SessionUser = {
  id: ids.actor, name: "Интегратор", role: "technical_admin",
  capabilities,
}
const row = {
  event_id: ids.event, consumer: "public_projection", topic: "public.offering_projection.invalidated",
  aggregate_type: "catalog_offering", aggregate_id: ids.aggregate, status: "dead_letter",
  attempts: 8, max_attempts: 8, delivery_epoch: 2, replay_count: 1,
  available_at: at, processed_at: null, lease_acquired_at: null, lease_expires_at: null,
  last_attempt_at: at, last_failure_at: at, last_error_code: "DELIVERY_PAYLOAD_INVALID",
  dead_lettered_at: at, created_at: at, updated_at: at,
  // Deliberately present in a mocked database row: the service must not project either value.
  payload: { customerPhone: "+79990000000" }, last_error: "provider response with private data",
}

describe("DeliveryAdminService", () => {
  it("lists only the sanitized delivery DTO and enforces integration capability", async () => {
    const dataSource = { query: vi.fn().mockResolvedValue([row]) }
    const service = new DeliveryAdminService(dataSource as never)
    const result = await service.list({ limit: 50 }, actor)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).not.toHaveProperty("payload")
    expect(result.items[0]).not.toHaveProperty("lastError")
    await expect(service.list({ limit: 50 }, { ...actor, capabilities: { ...capabilities, canManageIntegrations: false } })).rejects.toMatchObject({ status: 403 })
  })

  it("replays a matching dead-letter under row lock, writes audit/journal and clears delivery state", async () => {
    const after = {
      ...row, status: "pending", attempts: 0, delivery_epoch: 3, replay_count: 2,
      last_attempt_at: null, last_failure_at: null, last_error_code: null, dead_lettered_at: null,
    }
    const save = vi.fn(async (value: Record<string, unknown>) => value)
    const repository = { findOne: vi.fn().mockResolvedValue(null) }
    const manager = {
      getRepository: vi.fn().mockReturnValue(repository),
      query: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([row]).mockResolvedValueOnce([[after], 1]),
      create: vi.fn((_entity: unknown, value: Record<string, unknown>) => value), save,
    }
    const dataSource = { transaction: vi.fn(async (_level: string, work: (value: never) => Promise<unknown>) => work(manager as never)) }
    const service = new DeliveryAdminService(dataSource as never)
    const result = await service.replay(
      { eventId: ids.event, consumer: "public_projection" },
      { operationId: ids.operation, idempotencyKey: "delivery-replay-001", expectedStatus: "dead_letter", expectedDeliveryEpoch: 2, expectedAttempts: 8, reason: "Провайдер восстановлен" },
      actor,
      "request-1",
    )
    expect(result.delivery).toMatchObject({ status: "pending", attempts: 0, deliveryEpoch: 3, replayCount: 2, lastErrorCode: null })
    expect(manager.query.mock.calls.at(0)?.[0]).toContain("pg_advisory_xact_lock")
    expect(manager.query.mock.calls.at(1)?.[0]).toContain("pg_advisory_xact_lock")
    expect(manager.query.mock.calls.at(2)?.[0]).toContain("FOR UPDATE OF delivery")
    expect(manager.query.mock.calls.at(3)?.[0]).toContain("delivery_epoch = delivery_epoch + 1")
    expect(manager.query.mock.calls.at(3)?.[0]).toContain("last_error = NULL")
    expect(save).toHaveBeenCalledTimes(3)
  })

  it("fails closed when an observed epoch or attempt is stale, preventing ABA replay", async () => {
    const repository = { findOne: vi.fn().mockResolvedValue(null) }
    const manager = {
      getRepository: vi.fn().mockReturnValue(repository),
      query: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([row]),
    }
    const dataSource = { transaction: vi.fn(async (_level: string, work: (value: never) => Promise<unknown>) => work(manager as never)) }
    const service = new DeliveryAdminService(dataSource as never)
    await expect(service.replay(
      { eventId: ids.event, consumer: "public_projection" },
      { operationId: ids.operation, idempotencyKey: "delivery-replay-stale-001", expectedStatus: "dead_letter", expectedDeliveryEpoch: 1, expectedAttempts: 8, reason: "Устаревшее наблюдение" },
      actor,
      "request-stale",
    )).rejects.toMatchObject({ status: 409 })
    expect(manager.query).toHaveBeenCalledTimes(3)
    expect(manager.query.mock.calls.at(2)?.[0]).toContain("FOR UPDATE OF delivery")
  })

  it("returns the saved replay response only for the identical operation/idempotency/hash", async () => {
    const savedResponse = {
      delivery: {
        eventId: ids.event, consumer: "public_projection", topic: row.topic, aggregateType: row.aggregate_type, aggregateId: ids.aggregate,
        status: "pending", attempts: 0, maxAttempts: 8, deliveryEpoch: 3, replayCount: 2,
        availableAt: at.toISOString(), processedAt: null, leaseAcquiredAt: null, leaseExpiresAt: null,
        lastAttemptAt: null, lastFailureAt: null, lastErrorCode: null, deadLetteredAt: null,
        createdAt: at.toISOString(), updatedAt: at.toISOString(),
      },
      replay: {
        id: "55555555-5555-4555-8555-555555555555", eventId: ids.event, consumer: "public_projection",
        previousDeliveryEpoch: 2, previousAttempts: 8, operationId: ids.operation, requestId: "request-1",
        reason: "Провайдер восстановлен", replayedBy: ids.actor, replayedAt: at.toISOString(),
      },
    }
    const { canonicalSha256 } = await import("../offerings/offering-mutation-support.js")
    const input = { operationId: ids.operation, idempotencyKey: "delivery-replay-001", expectedStatus: "dead_letter" as const, expectedDeliveryEpoch: 2, expectedAttempts: 8, reason: "Провайдер восстановлен" }
    const repository = {
      findOne: vi.fn().mockResolvedValue({ operationId: ids.operation, idempotencyKey: input.idempotencyKey, requestHash: canonicalSha256({ command: "outbox_delivery.replay", eventId: ids.event, consumer: "public_projection", input }), responseBody: savedResponse }),
    }
    const manager = { getRepository: vi.fn().mockReturnValue(repository), query: vi.fn() }
    const dataSource = { transaction: vi.fn(async (_level: string, work: (value: never) => Promise<unknown>) => work(manager as never)) }
    const result = await new DeliveryAdminService(dataSource as never).replay({ eventId: ids.event, consumer: "public_projection" }, input, actor, "request-2")
    expect(result).toEqual(savedResponse)
    expect(manager.query).toHaveBeenCalledTimes(2)
    expect(manager.query.mock.calls.every(([sql]) => String(sql).includes("pg_advisory_xact_lock"))).toBe(true)
  })
})
