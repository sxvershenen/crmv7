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
})
