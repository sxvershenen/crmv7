import { describe, expect, it, vi } from "vitest"

import type { SessionUser } from "@crm/contracts"

import { SearchService } from "./search.service.js"

const actor: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111", name: "Manager", email: "manager@test.local", role: "manager",
  capabilities: {
    canView: true, canCreate: true, canEdit: true, canDelete: false, canArchive: true, canAssign: true,
    canChangeStatus: true, canAddPayment: true, canRefund: true, canOverrideConflict: false,
    canViewFinance: true, canViewAudit: true, canManageUsers: false, canManageSettings: false,
  },
}

describe("SearchService", () => {
  it("normalizes the query and returns only the search projection", async () => {
    const query = vi.fn(async () => [{
      kind: "customer", id: "22222222-2222-4222-8222-222222222222", code: null,
      title: "Алексей", meta: "Клиент · +7 921 000-00-00", phone: "+7 921 000-00-00", email: null,
      created_at: new Date("2026-01-01T00:00:00.000Z"),
    }])
    const service = new SearchService({ query } as never)

    const results = await service.search({ q: "  #Алексей  ", limit: 24 }, actor)

    expect(query).toHaveBeenCalledWith(expect.stringContaining("FROM customers"), ["%алексей%", "%__no_phone_match__%", 24, "алексей", "алексей%"])
    expect(results[0]).toEqual({
      kind: "customer", id: "22222222-2222-4222-8222-222222222222", code: null, title: "Алексей",
      meta: "Клиент · +7 921 000-00-00", href: "/customers/22222222-2222-4222-8222-222222222222",
      phone: "+7 921 000-00-00", email: null, archived: false,
      capabilities: { canView: true, canEdit: true, canArchive: true },
    })
  })

  it("rejects actors without the read capability before querying", async () => {
    const query = vi.fn()
    const service = new SearchService({ query } as never)
    await expect(service.search({ q: "Иван", limit: 24 }, { ...actor, capabilities: { ...actor.capabilities, canView: false } })).rejects.toMatchObject({ response: { code: "PERMISSION_DENIED" } })
    expect(query).not.toHaveBeenCalled()
  })
})
