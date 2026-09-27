import { describe, expect, it, vi } from "vitest"

import { OfferingConfigurationOutboxEventSchema, type SessionUser } from "@crm/contracts"
import { IdempotencyKeyEntity, OutboxDeliveryEntity, OutboxEventEntity, ResourceAllocationEntity, ResourceEntity } from "@crm/db"

import { ResourcesService } from "./resources.service.js"

const actor: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "manager@example.test",
  name: "Manager",
  role: "manager",
  capabilities: {
    canView: true, canCreate: true, canEdit: true, canDelete: false, canArchive: true,
    canAssign: true, canChangeStatus: true, canAddPayment: true, canRefund: true,
    canOverrideConflict: false, canViewFinance: true, canViewAudit: true,
    canManageUsers: false, canManageSettings: false,
  },
}

function resource(mode: "fixed" | "shared", total: number): ResourceEntity {
  return Object.assign(new ResourceEntity(), {
    id: "22222222-2222-4222-8222-222222222222", code: "house-pine", version: 1,
    kind: "houses", name: "Домик", capacityMode: mode, capacityTotal: total, settings: {},
    archivedAt: null, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
  })
}

function allocation(sourceId: string, startAt: string, endAt: string, capacityImpact: number): ResourceAllocationEntity {
  return Object.assign(new ResourceAllocationEntity(), {
    id: crypto.randomUUID(), resourceId: "22222222-2222-4222-8222-222222222222", sourceType: "booking_item",
    sourceId, startAt: new Date(startAt), endAt: new Date(endAt), quantity: 1, capacityImpact, status: "active", archivedAt: null,
  })
}

function serviceFor(current: ResourceEntity, allocations: ResourceAllocationEntity[]) {
  const builder = {
    where() { return builder },
    andWhere() { return builder },
    getMany: async () => allocations,
  }
  const allocationRepository = { createQueryBuilder: () => builder }
  const resourceRepository = { findOneBy: async () => current }
  const dataSource = {
    manager: { getRepository: () => allocationRepository },
    getRepository: (entity: unknown) => entity === ResourceEntity ? resourceRepository : allocationRepository,
  }
  return new ResourcesService(dataSource as never)
}

describe("ResourcesService availability", () => {
  it("treats concrete campground inventory kinds as one CRM camping direction", async () => {
    let kinds: string[] = []
    const builder = {
      where() { return builder },
      andWhere(_query: string, parameters: { kinds?: string[] }) { if (parameters.kinds) kinds = parameters.kinds; return builder },
      orderBy() { return builder },
      take() { return builder },
      getMany: async () => [],
    }
    const service = new ResourcesService({ getRepository: () => ({ createQueryBuilder: () => builder }) } as never)

    await service.list({ kind: "camping", archived: false, limit: 50 }, actor)
    expect(kinds).toEqual(["camping", "campground", "campground_owned_tent", "campground_own_tent_area"])
  })

  it("treats touching half-open intervals as available", async () => {
    const service = serviceFor(resource("fixed", 1), [allocation("33333333-3333-4333-8333-333333333333", "2026-09-01T10:00:00Z", "2026-09-01T11:00:00Z", 1)])
    const result = await service.availability({ resourceId: "22222222-2222-4222-8222-222222222222", startAt: "2026-09-01T11:00:00Z", endAt: "2026-09-01T12:00:00Z", quantity: 1 }, actor)
    expect(result).toEqual({ available: true, conflicts: [] })
  })

  it("checks the aggregate shared capacity, not only individual overlaps", async () => {
    const service = serviceFor(resource("shared", 3), [
      allocation("33333333-3333-4333-8333-333333333333", "2026-09-01T10:00:00Z", "2026-09-01T12:00:00Z", 2),
      allocation("44444444-4444-4444-8444-444444444444", "2026-09-01T11:00:00Z", "2026-09-01T13:00:00Z", 1),
    ])
    const result = await service.availability({ resourceId: "22222222-2222-4222-8222-222222222222", startAt: "2026-09-01T11:00:00Z", endAt: "2026-09-01T11:30:00Z", quantity: 1 }, actor)
    expect(result.available).toBe(false)
    expect(result.conflicts).toHaveLength(2)
    expect(result.conflicts.every((conflict) => conflict.reason === "capacity")).toBe(true)
  })

  it("reports an inactive resource as unavailable even without calendar conflicts", async () => {
    const inactive = resource("fixed", 1)
    inactive.settings = { active: false }
    const result = await serviceFor(inactive, []).availability({ resourceId: inactive.id, startAt: "2026-09-01T10:00:00Z", endAt: "2026-09-01T11:00:00Z", quantity: 1 }, actor)
    expect(result).toEqual({ available: false, conflicts: [] })
  })

  it("rejects a new allocation on an inactive resource before conflict override", async () => {
    const inactive = resource("fixed", 1)
    inactive.settings = { active: false }
    const manager = { getRepository: (entity: unknown) => entity === IdempotencyKeyEntity
      ? { findOneBy: vi.fn().mockResolvedValue(null) }
      : entity === ResourceEntity ? { findOne: vi.fn().mockResolvedValue(inactive) } : undefined }
    const service = new ResourcesService({} as never)
    await expect(service.createAllocationInTransaction(manager as never, {
      resourceId: inactive.id, sourceType: "booking_item", sourceId: "33333333-3333-4333-8333-333333333333",
      startAt: "2026-09-01T10:00:00.000Z", endAt: "2026-09-01T11:00:00.000Z",
      quantity: 1, capacityImpact: 1, status: "tentative", operationId: "44444444-4444-4444-8444-444444444444",
      expectedVersion: inactive.version, overrideConflict: true,
    }, actor, "request-1")).rejects.toMatchObject({ response: { code: "RESOURCE_INACTIVE" } })
  })
})

describe("ResourcesService public projection invalidation", () => {
  it("enqueues a valid offering invalidation and both deliveries for a CRM resource change", async () => {
    const offeringId = "33333333-3333-4333-8333-333333333333"
    const saved: Array<{ entity: unknown; value: Record<string, unknown> | Array<Record<string, unknown>> }> = []
    const manager = {
      query: vi.fn().mockResolvedValue([{ id: offeringId, subjectVersion: 2 }]),
      create: (entity: unknown, value: Record<string, unknown>) => ({ ...value, __entity: entity }),
      save: vi.fn(async (value: Record<string, unknown> | Array<Record<string, unknown>>) => {
        saved.push({ entity: Array.isArray(value) ? OutboxDeliveryEntity : value.__entity, value })
        return value
      }),
    }
    const service = new ResourcesService({} as never) as unknown as {
      invalidateBoundOfferings(manager: unknown, resource: ResourceEntity, actorId: string, requestId: string): Promise<void>
    }
    const changed = resource("fixed", 4)
    changed.version = 3
    await service.invalidateBoundOfferings(manager, changed, actor.id, "request-1")

    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining("binding.resource_id = $1"), [changed.id])
    const event = saved.find((entry) => entry.entity === OutboxEventEntity)?.value as Record<string, unknown>
    const payload = OfferingConfigurationOutboxEventSchema.parse(event.payload)
    expect(payload).toMatchObject({ eventType: "public.offering_projection.invalidated", aggregate: { type: "catalog_offering", id: offeringId }, versions: { subject: 2 } })
    expect(saved.find((entry) => entry.entity === OutboxDeliveryEntity)?.value).toEqual(expect.arrayContaining([
      expect.objectContaining({ consumer: "public_projection", eventId: payload.eventId }),
      expect.objectContaining({ consumer: "sse", eventId: payload.eventId }),
    ]))
  })
})
