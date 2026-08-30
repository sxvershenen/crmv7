import { describe, expect, it } from "vitest"

import type { SessionUser } from "@crm/contracts"
import { ResourceAllocationEntity, ResourceEntity } from "@crm/db"

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
})
