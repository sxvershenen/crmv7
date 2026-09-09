import { describe, expect, it, vi } from "vitest"

import type { SessionUser } from "@crm/contracts"
import { PromotionEntity } from "@crm/db"

import { MarketingService } from "./marketing.service.js"

const actor: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111", email: "admin@example.test", name: "Администратор", role: "admin",
  capabilities: {
    canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: true, canAssign: true,
    canChangeStatus: true, canAddPayment: true, canRefund: true, canOverrideConflict: true,
    canViewFinance: true, canViewAudit: true, canManageUsers: true, canManageSettings: true,
  },
}

const id = "22222222-2222-4222-8222-222222222222"

function promotion(overrides: Record<string, unknown> = {}) {
  return Object.assign(new PromotionEntity(), {
    id, version: 3, code: "AUTUMN", archivedAt: null,
    terms: {
      code: "AUTUMN", name: "Осень", active: true, discountType: "percent", value: 10, minimumAmountMinor: 0,
      startsAt: null, endsAt: null, scope: "all", resourceIds: [], offeringIds: [],
    },
    createdAt: new Date("2026-09-01T00:00:00.000Z"), updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  })
}

describe("MarketingService", () => {
  it("locks and returns an available normalized promotion for booking calculation", async () => {
    const row = promotion()
    const builder = {
      setLock: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue(row),
    }
    const manager = { getRepository: vi.fn(() => ({ createQueryBuilder: vi.fn(() => builder) })) }
    const result = await new MarketingService({} as never).findByCode(manager as never, " autumn ")
    expect(builder.setLock).toHaveBeenCalledWith("pessimistic_read")
    expect(builder.where).toHaveBeenCalledWith("promotion.code = :code", { code: "AUTUMN" })
    expect(result).toMatchObject({ id, version: 3, terms: { code: "AUTUMN" } })
  })

  it("rejects an inactive promotion after taking the read lock", async () => {
    const builder = {
      setLock: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), getOne: vi.fn().mockResolvedValue(promotion({ terms: { ...promotion().terms, active: false } })),
    }
    const manager = { getRepository: () => ({ createQueryBuilder: () => builder }) }
    await expect(new MarketingService({} as never).findByCode(manager as never, "AUTUMN")).rejects.toMatchObject({
      response: { code: "PROMOTION_UNAVAILABLE" },
    })
  })

  it("reports Moscow booking and lead cohorts, with all-time net ledger money", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce([{ promotion_id: id, bookings: "2", confirmed_bookings: "1", discount_amount_minor: "300", booking_amount_minor: "2700", paid_amount_minor: "1500" }])
      .mockResolvedValueOnce([{ source: "vk", medium: "cpc", campaign: "fall", content: "ad-1", term: "house", leads: "3", qualified_leads: "2", bookings: "1", paid_amount_minor: "700" }])
    const report = await new MarketingService({ query } as never).report({ from: "2026-09-01", to: "2026-09-02" }, actor)
    expect(report).toMatchObject({
      visitorsStatus: "not_configured", visitors: null, attributionModel: "lead_snapshot",
      promotions: [{ promotionId: id, bookings: 2, paidAmountMinor: 1500 }],
      campaigns: [{ source: "vk", qualifiedLeads: 2, paidAmountMinor: 700 }],
    })
    expect(query.mock.calls[0]![1]).toEqual([new Date("2026-08-31T21:00:00.000Z"), new Date("2026-09-02T21:00:00.000Z")])
    expect(query.mock.calls[0]![0]).not.toContain("p.created_at >= $1")
    expect(query.mock.calls[1]![0]).toContain("WHERE b.created_at >= $1 AND b.created_at < $2")
  })

  it("enforces marketing read capability in the service", async () => {
    await expect(new MarketingService({} as never).report({ from: "2026-09-01", to: "2026-09-01" }, {
      ...actor, capabilities: { ...actor.capabilities, canView: false },
    })).rejects.toMatchObject({ status: 403 })
    await expect(new MarketingService({} as never).report({ from: "2026-09-01", to: "2026-09-01" }, {
      ...actor, capabilities: { ...actor.capabilities, canViewFinance: false },
    })).rejects.toMatchObject({ status: 403 })
  })
})
