import { describe, expect, it } from "vitest"

import type { SessionUser } from "@crm/contracts"
import { LeadEntity } from "@crm/db"

import { LeadsService } from "./leads.service.js"

const actor: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111", name: "Manager", email: "manager@test.local", role: "manager",
  capabilities: { canView: true, canCreate: true, canEdit: true, canDelete: false, canArchive: true, canAssign: true, canChangeStatus: true, canAddPayment: true, canRefund: true, canOverrideConflict: false, canViewFinance: true, canViewAudit: true, canManageUsers: false, canManageSettings: false },
}

function lead(status: LeadEntity["status"] = "new") {
  return Object.assign(new LeadEntity(), {
    id: "22222222-2222-4222-8222-222222222222", version: 1, customerId: null, name: "Алексей", phone: null, channel: null,
    direction: null, requestedItem: null, desiredStartAt: null, desiredEndAt: null, guestCount: 0, comment: "", source: null,
    utm: {}, assignees: [], nextContactAt: null, status, archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"),
  })
}

function serviceFor(current: LeadEntity) {
  const leadRepository = { findOneBy: async () => current }
  const mutations: unknown[] = []
  const mutationRepository = { save: async (value: unknown) => { mutations.push(value); return value } }
  const manager = {
    getRepository: (entity: unknown) => entity === LeadEntity ? leadRepository : mutationRepository,
    create: (_entity: unknown, value: unknown) => value,
    createQueryBuilder: () => {
      const builder = {
        update: () => builder, set: (value: Record<string, unknown>) => { if (value.status) current.status = value.status as string; if (value.archivedAt !== undefined) current.archivedAt = value.archivedAt as Date | null; current.version += 1; return builder },
        where: () => builder, execute: async () => ({ affected: 1 }),
      }
      return builder
    },
    query: async () => [],
  }
  return { service: new LeadsService({ manager, transaction: async (callback: (tx: typeof manager) => unknown) => callback(manager) } as never), mutations }
}

describe("LeadsService status transitions", () => {
  it("rejects a transition outside the domain matrix", async () => {
    const { service } = serviceFor(lead("success"))
    await expect(service.transition("22222222-2222-4222-8222-222222222222", { version: 1, status: "in_progress" }, actor, "req-1")).rejects.toMatchObject({ response: { code: "INVALID_STATE_TRANSITION" } })
  })

  it("increments version and writes audit/outbox for a valid transition", async () => {
    const current = lead("new")
    const { service, mutations } = serviceFor(current)
    await service.transition(current.id, { version: 1, status: "in_progress" }, actor, "req-2")
    expect(current).toMatchObject({ status: "in_progress", version: 2 })
    expect(mutations).toHaveLength(2)
  })
})
