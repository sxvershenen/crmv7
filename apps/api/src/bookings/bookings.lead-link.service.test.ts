import { describe, expect, it } from "vitest"
import { QueryFailedError } from "typeorm"

import type { BookingLeadLinkInput, BookingLeadUnlinkInput, SessionUser } from "@crm/contracts"
import { BookingEntity, BookingLeadLinkEntity, ChangeLogEntity, IdempotencyKeyEntity, LeadEntity, OutboxEventEntity } from "@crm/db"

import { BookingsService } from "./bookings.service.js"

const bookingId = "11111111-1111-4111-8111-111111111111"
const actorId = "22222222-2222-4222-8222-222222222222"
const leadA = "33333333-3333-4333-8333-333333333333"
const leadB = "44444444-4444-4444-8444-444444444444"

const actor = {
  id: actorId, name: "Manager", email: "manager@test.local", role: "manager",
  capabilities: {
    canView: true, canCreate: true, canEdit: true, canDelete: false, canArchive: true, canAssign: true,
    canChangeStatus: true, canAddPayment: true, canRefund: true, canOverrideConflict: false,
    canViewFinance: true, canViewAudit: true, canManageUsers: false, canManageSettings: false,
  },
} as SessionUser

type StoredIdempotency = {
  id: string
  scope: string
  operationId: string
  idempotencyKey: string
  requestHash: string
  responseStatus: number | null
  responseBody: Record<string, unknown> | null
  createdAt: Date
}

type HarnessState = {
  booking: BookingEntity
  leads: Map<string, LeadEntity>
  links: BookingLeadLinkEntity[]
  idempotency: StoredIdempotency[]
  audit: unknown[]
  outbox: unknown[]
}

function booking(version = 1) {
  return Object.assign(new BookingEntity(), {
    id: bookingId, code: "B-42", version, customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    status: "confirmed", currency: "RUB", totalAmount: 50_000, snapshot: {},
    createdBy: actorId, updatedBy: actorId, archivedAt: null,
    createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  })
}

function lead(id: string, archived = false) {
  return Object.assign(new LeadEntity(), { id, archivedAt: archived ? new Date("2026-09-02T00:00:00.000Z") : null })
}

function activeLink(leadId: string, linkedAt = new Date("2026-09-03T00:00:00.000Z")): BookingLeadLinkEntity {
  return Object.assign(new BookingLeadLinkEntity(), {
    id: `55555555-5555-4555-8555-${leadId === leadA ? "555555555555" : "666666666666"}`,
    bookingId, leadId, method: "manual", linkedAt, linkedBy: actorId, unlinkedAt: null, unlinkedBy: null,
  })
}

function linkInput(overrides: Partial<BookingLeadLinkInput> = {}): BookingLeadLinkInput {
  return {
    leadId: leadA, method: "manual", expectedVersion: 1,
    operationId: "66666666-6666-4666-8666-666666666666", idempotencyKey: "lead-link-key-a",
    ...overrides,
  }
}

function unlinkInput(overrides: Partial<BookingLeadUnlinkInput> = {}): BookingLeadUnlinkInput {
  return {
    expectedVersion: 1, operationId: "77777777-7777-4777-8777-777777777777", idempotencyKey: "lead-unlink-key-a",
    ...overrides,
  }
}

function createHarness(options: { version?: number; links?: BookingLeadLinkEntity[]; archivedLeadIds?: string[]; failAudit?: boolean; failActiveInsert?: boolean } = {}) {
  const state: HarnessState = {
    booking: booking(options.version),
    leads: new Map([[leadA, lead(leadA, options.archivedLeadIds?.includes(leadA))], [leadB, lead(leadB, options.archivedLeadIds?.includes(leadB))]]),
    links: options.links ?? [], idempotency: [], audit: [], outbox: [],
  }
  const metrics = { bookingLookups: 0, bookingWriteLocks: 0, advisoryLocks: [] as string[] }

  const bookingRepository = {
    createQueryBuilder: () => {
      let lookup: string | undefined
      const builder = {
        where: (_sql: string, params: { idOrCode: string }) => { lookup = params.idOrCode; return builder },
        setLock: (mode: string) => { if (mode === "pessimistic_write") metrics.bookingWriteLocks += 1; return builder },
        getOne: async () => { metrics.bookingLookups += 1; return lookup === state.booking.id || lookup === state.booking.code ? state.booking : null },
      }
      return builder
    },
  }

  const leadRepository = {
    findOne: async ({ where }: { where: { id: string } }) => state.leads.get(where.id) ?? null,
  }

  const linkRepository = {
    createQueryBuilder: () => {
      let targetBookingId: string | undefined
      const builder = {
        where: (_sql: string, params: { bookingId: string }) => { targetBookingId = params.bookingId; return builder },
        setLock: () => builder,
        orderBy: () => builder,
        addOrderBy: () => builder,
        getOne: async () => [...state.links].reverse().find((item) => item.bookingId === targetBookingId && item.unlinkedAt === null) ?? null,
      }
      return builder
    },
    create: (value: BookingLeadLinkEntity) => Object.assign(new BookingLeadLinkEntity(), value),
    save: async (value: BookingLeadLinkEntity) => {
      if (options.failActiveInsert) {
        throw new QueryFailedError("INSERT INTO booking_lead_links", [], Object.assign(new Error("duplicate key"), {
          code: "23505", constraint: "booking_lead_links_active_booking_unique",
        }))
      }
      if (state.links.some((item) => item.bookingId === value.bookingId && item.unlinkedAt === null)) throw new Error("test unique violation")
      state.links.push(value)
      return value
    },
    update: async ({ id }: { id: string }, patch: Partial<BookingLeadLinkEntity>) => {
      const row = state.links.find((item) => item.id === id)
      if (row) Object.assign(row, patch)
      return { affected: row ? 1 : 0 }
    },
    find: async ({ where }: { where: { bookingId: string } }) => state.links
      .filter((item) => item.bookingId === where.bookingId)
      .sort((left, right) => left.linkedAt.getTime() - right.linkedAt.getTime() || left.id.localeCompare(right.id)),
  }

  const idempotencyRepository = {
    createQueryBuilder: () => {
      let scope: string | undefined
      let operationId: string | undefined
      let idempotencyKey: string | undefined
      const builder = {
        where: (_sql: string, params: { scope: string }) => { scope = params.scope; return builder },
        andWhere: (condition: { whereFactory?: (query: unknown) => void }, params?: { operationId: string; idempotencyKey: string }) => {
          if (params) {
            operationId = params.operationId
            idempotencyKey = params.idempotencyKey
          } else {
            const nested = {
              where: (_sql: string, values: { operationId: string }) => { operationId = values.operationId; return nested },
              orWhere: (_sql: string, values: { idempotencyKey: string }) => { idempotencyKey = values.idempotencyKey; return nested },
            }
            condition.whereFactory?.(nested)
          }
          return builder
        },
        getOne: async () => state.idempotency.find((item) => item.scope === scope && (item.operationId === operationId || item.idempotencyKey === idempotencyKey)) ?? null,
      }
      return builder
    },
    create: (value: StoredIdempotency) => value,
    save: async (value: StoredIdempotency) => { state.idempotency.push(value); return value },
  }

  const manager = {
    getRepository: (entity: unknown) => {
      if (entity === BookingEntity) return bookingRepository
      if (entity === LeadEntity) return leadRepository
      if (entity === BookingLeadLinkEntity) return linkRepository
      if (entity === IdempotencyKeyEntity) return idempotencyRepository
      if (entity === ChangeLogEntity) return {
        create: (value: unknown) => value,
        save: async (value: unknown) => { if (options.failAudit) throw new Error("audit unavailable"); state.audit.push(value); return value },
      }
      if (entity === OutboxEventEntity) return {
        create: (value: unknown) => value,
        save: async (value: unknown) => { state.outbox.push(value); return value },
      }
      throw new Error(`Unexpected repository ${String(entity)}`)
    },
    create: (_entity: unknown, value: unknown) => value,
    query: async (_sql: string, params: [string]) => { metrics.advisoryLocks.push(params[0]); return [] },
    findOneByOrFail: async (entity: unknown, where: { id: string }) => {
      if (entity === BookingEntity && where.id === state.booking.id) return state.booking
      throw new Error("not found")
    },
    createQueryBuilder: () => {
      let entity: unknown
      let values: Record<string, unknown> = {}
      let where: { id: string; version: number } | undefined
      const builder = {
        update: (target: unknown) => { entity = target; return builder },
        set: (next: Record<string, unknown>) => { values = next; return builder },
        where: (_sql: string, params: { id: string; version: number }) => { where = params; return builder },
        execute: async () => {
          if (entity !== BookingEntity || !where || state.booking.id !== where.id || state.booking.version !== where.version) return { affected: 0 }
          state.booking.version += 1
          if (typeof values.updatedBy === "string") state.booking.updatedBy = values.updatedBy
          state.booking.updatedAt = new Date()
          return { affected: 1 }
        },
      }
      return builder
    },
  }

  let transactionTail = Promise.resolve()
  const dataSource = {
    manager,
    getRepository: manager.getRepository,
    transaction: async (_isolation: string, callback: (tx: typeof manager) => Promise<unknown>) => {
      let release = () => {}
      const previous = transactionTail
      transactionTail = new Promise<void>((resolve) => { release = resolve })
      await previous
      const snapshot = structuredClone(state)
      try {
        return await callback(manager)
      } catch (error) {
        state.booking = snapshot.booking
        state.leads = snapshot.leads
        state.links = snapshot.links
        state.idempotency = snapshot.idempotency
        state.audit = snapshot.audit
        state.outbox = snapshot.outbox
        throw error
      } finally {
        release()
      }
    },
  }

  return { service: new BookingsService(dataSource as never, {} as never, {} as never), state, metrics }
}

describe("BookingsService lead links", () => {
  it("replays the same result across booking code and UUID aliases before checking the stale version", async () => {
    const { service, state, metrics } = createHarness()
    const input = linkInput()
    const implicitManual = { leadId: input.leadId, expectedVersion: input.expectedVersion, operationId: input.operationId, idempotencyKey: input.idempotencyKey } as BookingLeadLinkInput

    const created = await service.linkLead("B-42", implicitManual, actor, "req-1")
    const replayed = await service.linkLead(bookingId, input, actor, "req-2")

    expect(replayed).toEqual(created)
    expect(state.booking.version).toBe(2)
    expect(state.links.filter((item) => item.unlinkedAt === null)).toHaveLength(1)
    expect(state.audit).toHaveLength(1)
    expect(state.outbox).toHaveLength(1)
    expect(state.idempotency).toHaveLength(1)
    expect(state.idempotency[0]?.scope).toBe(`booking:${bookingId}:lead-link`)
    expect(metrics.bookingWriteLocks).toBe(1)
  })

  it("authorizes before resolving the booking alias", async () => {
    const { service, metrics } = createHarness()

    await expect(service.linkLead("B-42", linkInput(), { ...actor, capabilities: { ...actor.capabilities, canEdit: false } }, "req-denied"))
      .rejects.toMatchObject({ response: { code: "PERMISSION_DENIED" } })
    expect(metrics.bookingLookups).toBe(0)
  })

  it("rejects mismatched idempotency pairs and changed canonical payloads", async () => {
    const { service, state } = createHarness()
    const input = linkInput()
    await service.linkLead(bookingId, input, actor, "req-1")

    await expect(service.linkLead(bookingId, { ...input, idempotencyKey: "other-key" }, actor, "req-2"))
      .rejects.toMatchObject({ response: { code: "IDEMPOTENCY_CONFLICT" } })
    await expect(service.linkLead(bookingId, { ...input, leadId: leadB }, actor, "req-3"))
      .rejects.toMatchObject({ response: { code: "IDEMPOTENCY_CONFLICT" } })
    expect(state.links).toHaveLength(1)
    expect(state.idempotency).toHaveLength(1)
  })

  it("checks expectedVersion before treating an existing link as a no-op", async () => {
    const current = activeLink(leadA)
    const { service, state } = createHarness({ version: 2, links: [current] })

    await expect(service.linkLead(bookingId, linkInput({ expectedVersion: 1 }), actor, "req-stale"))
      .rejects.toMatchObject({ response: { code: "VERSION_CONFLICT", details: { serverVersion: 2 } } })
    expect(state.links).toEqual([current])
    expect(state.idempotency).toHaveLength(0)
    expect(state.audit).toHaveLength(0)
    expect(state.outbox).toHaveLength(0)
  })

  it("returns an idempotent same-lead no-op without version, history, audit, or outbox mutations", async () => {
    const current = activeLink(leadA)
    const { service, state } = createHarness({ version: 2, links: [current] })

    const response = await service.linkLead(bookingId, linkInput({ expectedVersion: 2 }), actor, "req-noop")

    expect(response).toEqual({ link: expect.objectContaining({ id: current.id, leadId: leadA }), bookingVersion: 2 })
    expect(state.booking.version).toBe(2)
    expect(state.links).toHaveLength(1)
    expect(state.audit).toHaveLength(0)
    expect(state.outbox).toHaveLength(0)
    expect(state.idempotency).toHaveLength(1)
  })

  it("returns an idempotent unlink-absent no-op without operational side effects", async () => {
    const { service, state } = createHarness()
    const input = unlinkInput()

    const response = await service.unlinkLead("B-42", input, actor, "req-unlink")
    const replay = await service.unlinkLead(bookingId, input, actor, "req-unlink-replay")

    expect(response).toEqual({ link: null, bookingVersion: 1 })
    expect(replay).toEqual(response)
    expect(state.booking.version).toBe(1)
    expect(state.links).toHaveLength(0)
    expect(state.audit).toHaveLength(0)
    expect(state.outbox).toHaveLength(0)
    expect(state.idempotency).toHaveLength(1)
  })

  it("checks expectedVersion before treating unlink-absent as a no-op", async () => {
    const { service, state } = createHarness({ version: 2 })

    await expect(service.unlinkLead(bookingId, unlinkInput({ expectedVersion: 1 }), actor, "req-unlink-stale"))
      .rejects.toMatchObject({ response: { code: "VERSION_CONFLICT", details: { serverVersion: 2 } } })
    expect(state.idempotency).toHaveLength(0)
    expect(state.audit).toHaveLength(0)
    expect(state.outbox).toHaveLength(0)
  })

  it("relinks atomically with one close, one create, one version bump, and one event", async () => {
    const prior = activeLink(leadA)
    const { service, state } = createHarness({ links: [prior] })

    const response = await service.linkLead(bookingId, linkInput({ leadId: leadB }), actor, "req-relink")

    expect(response).toMatchObject({ link: { leadId: leadB }, bookingVersion: 2 })
    expect(state.links).toHaveLength(2)
    expect(state.links[0]).toMatchObject({ leadId: leadA, unlinkedBy: actorId })
    expect(state.links.filter((item) => item.unlinkedAt === null)).toHaveLength(1)
    expect(state.booking).toMatchObject({ version: 2, customerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", status: "confirmed", totalAmount: 50_000 })
    expect(state.audit).toHaveLength(1)
    expect(state.outbox).toHaveLength(1)
  })

  it("serializes competing targets so only one active link commits and the loser gets a version conflict", async () => {
    const { service, state } = createHarness()
    const outcomes = await Promise.allSettled([
      service.linkLead(bookingId, linkInput(), actor, "req-a"),
      service.linkLead(bookingId, linkInput({ leadId: leadB, operationId: "88888888-8888-4888-8888-888888888888", idempotencyKey: "lead-link-key-b" }), actor, "req-b"),
    ])

    expect(outcomes.filter((item) => item.status === "fulfilled")).toHaveLength(1)
    const rejected = outcomes.find((item): item is PromiseRejectedResult => item.status === "rejected")
    expect(rejected?.reason).toMatchObject({ response: { code: "VERSION_CONFLICT", details: { serverVersion: 2 } } })
    expect(state.booking.version).toBe(2)
    expect(state.links.filter((item) => item.unlinkedAt === null)).toHaveLength(1)
    expect(state.audit).toHaveLength(1)
    expect(state.outbox).toHaveLength(1)
  })

  it("rolls back the link and version when audit persistence fails", async () => {
    const { service, state } = createHarness({ failAudit: true })

    await expect(service.linkLead(bookingId, linkInput(), actor, "req-fail")).rejects.toThrow("audit unavailable")
    expect(state.booking.version).toBe(1)
    expect(state.links).toHaveLength(0)
    expect(state.idempotency).toHaveLength(0)
    expect(state.audit).toHaveLength(0)
    expect(state.outbox).toHaveLength(0)
  })

  it("maps the active-link partial unique race to a stable 409 conflict", async () => {
    const { service, state } = createHarness({ failActiveInsert: true })

    await expect(service.linkLead(bookingId, linkInput(), actor, "req-race"))
      .rejects.toMatchObject({ response: { code: "VERSION_CONFLICT", details: { entityId: bookingId, serverVersion: 1 } } })
    expect(state.booking.version).toBe(1)
    expect(state.links).toHaveLength(0)
  })

  it("rejects an archived target lead without mutating the booking", async () => {
    const { service, state } = createHarness({ archivedLeadIds: [leadA] })

    await expect(service.linkLead(bookingId, linkInput(), actor, "req-archived"))
      .rejects.toMatchObject({ response: { code: "LEAD_NOT_FOUND" } })
    expect(state.booking.version).toBe(1)
    expect(state.links).toHaveLength(0)
    expect(state.audit).toHaveLength(0)
  })

  it("returns the complete lead-link history in chronological order", async () => {
    const later = activeLink(leadB, new Date("2026-09-05T00:00:00.000Z"))
    const earlier = activeLink(leadA, new Date("2026-09-03T00:00:00.000Z"))
    earlier.unlinkedAt = new Date("2026-09-04T00:00:00.000Z")
    earlier.unlinkedBy = actorId
    const { service } = createHarness({ links: [later, earlier] })

    const history = await service.leadLinkHistory("B-42", actor)

    expect(history.items.map((item) => item.leadId)).toEqual([leadA, leadB])
    expect(history.items[0]?.unlinkedAt).toBe("2026-09-04T00:00:00.000Z")
  })
})
