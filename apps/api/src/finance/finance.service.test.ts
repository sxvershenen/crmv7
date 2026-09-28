import { describe, expect, it, vi } from "vitest"

import type { SessionUser } from "@crm/contracts"

import { FinanceService } from "./finance.service.js"

const capabilities: SessionUser["capabilities"] = {
  canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: true, canAssign: true,
  canChangeStatus: true, canAddPayment: true, canRefund: true, canOverrideConflict: true,
  canViewFinance: true, canViewAudit: true, canManageUsers: true, canManageSettings: true,
}
const actor: SessionUser = { id: "11111111-1111-4111-8111-111111111111", name: "Администратор", role: "admin", capabilities }
const query = { section: "summary", date: "2026-08-01", rangeEnd: "2026-08-31", type: "all", method: "all", refundsOnly: false, page: 1, pageSize: 25, sort: "date", order: "desc" } as const

describe("FinanceService", () => {
  it("returns a stable empty projection", async () => {
    const dataSource = { query: vi.fn().mockResolvedValue([]) }
    const result = await new FinanceService(dataSource as never).get(query, actor)
    expect(result).toMatchObject({ operations: [], pagination: { page: 1, total: 0, totalPages: 1 }, summary: { accruedMinor: 0, paidMinor: 0 } })
  })

  it("enforces finance visibility on the server", async () => {
    const service = new FinanceService({ query: vi.fn() } as never)
    await expect(service.get(query, { ...actor, capabilities: { ...capabilities, canViewFinance: false } })).rejects.toMatchObject({ status: 403 })
  })

  it("classifies booking revenue by the booked item instead of a stale category label", async () => {
    const kinds = [
      { id: "house", item_type: "accommodation", resource_kind: "house", category: "houses" },
      { id: "bath", item_type: "bath", resource_kind: "bath", category: "bath" },
      { id: "venue", item_type: "venue", resource_kind: "venue", category: "venues" },
      { id: "camp", item_type: "camping", resource_kind: "campground_owned_tent", category: "camping" },
      { id: "legacy-camp", item_type: null, resource_kind: "campground_own_tent_area", category: "camping" },
    ]
    const rows = kinds.map((kind) => ({ id: kind.id, code: kind.id, version: 1, total_amount: 10_000, currency: "RUB", created_at: new Date("2026-08-10T10:00:00Z"), snapshot: { category: "events" }, client_name: "Клиент", item_type: kind.item_type, starts_at: new Date("2026-08-11T10:00:00Z"), resource_id: kind.id, resource_kind: kind.resource_kind, resource_name: kind.id }))
    const dataSource = { query: vi.fn().mockResolvedValueOnce(rows).mockResolvedValueOnce([]) }
    const result = await new FinanceService(dataSource as never).get(query, actor)
    expect(new Map(result.operations.map((operation) => [operation.bookingId, operation.category]))).toEqual(new Map(kinds.map((kind) => [kind.id, kind.category])))
  })
})
