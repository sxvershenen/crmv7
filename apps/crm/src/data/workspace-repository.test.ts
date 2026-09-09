import { describe, expect, it, vi } from "vitest"

import { ApiWorkspaceRepository, FixtureWorkspaceRepository } from "./workspace-repository"

const id = "11111111-1111-4111-8111-111111111111"
const capabilities = { canView: true, canCreate: true, canEdit: true, canDelete: false, canArchive: true, canAssign: true, canChangeStatus: true, canAddPayment: true, canRefund: true, canOverrideConflict: true, canViewFinance: true, canViewAudit: true, canManageUsers: true, canManageSettings: true }
const profile = { id, version: 2, name: "Марина", email: "marina@example.com", phone: "+7", role: "Администратор", initials: "М", language: "ru" as const, timezone: "Europe/Moscow", browserNotifications: true, emailNotifications: false, telegramNotifications: false, notifyConflicts: true, notifyNewLeads: true, notifyOverdueTasks: true, capabilities }
const settings = { id, version: 3, organization: { currency: "RUB" as const, email: "info@example.com", locale: "ru-RU" as const, name: "CRM", phone: "+7", timezone: "Europe/Moscow" }, operations: { autoAssignNewLeads: false, bookingPrefix: "B", conflictWarnings: true, defaultLeadSource: "Сайт", requireClientPhone: true }, site: { connectionStatus: "planned" as const, defaultAssigneeId: null, defaultSource: "Сайт", intakeEnabled: true, publishAggregatedAvailability: false, publishPrices: true, publishResources: true, siteUrl: "https://example.com" }, integrations: [{ id: "site", name: "Сайт", description: "", status: "planned" as const, lastSyncAt: null }], capabilities: { canView: true, canEdit: true, canManageSettings: true } }

describe("workspace repositories", () => {
  it("keeps fixture mode explicit and isolated", async () => {
    const repository = new FixtureWorkspaceRepository()
    const value = await repository.getProfile()
    value.name = "Локальная правка"
    expect((await repository.getProfile()).name).toBe("Марина Кириллова")
  })

  it("maps canonical profile/settings and sends versioned API mutations", async () => {
    const patch = vi.fn(async (path: string) => path === "workspace/profile" ? profile : settings)
    const get = vi.fn(async (path: string) => path === "workspace/profile" ? profile : settings)
    const repository = new ApiWorkspaceRepository({ client: { get, patch } as never })
    const loadedProfile = await repository.getProfile()
    expect(loadedProfile).not.toHaveProperty("capabilities")
    await repository.saveProfile(loadedProfile)
    await repository.saveSettings(await repository.getSettings())
    expect(patch).toHaveBeenNthCalledWith(1, "workspace/profile", expect.objectContaining({ version: 2, operationId: expect.any(String), idempotencyKey: expect.any(String) }), expect.anything())
    expect(patch).toHaveBeenNthCalledWith(2, "workspace/settings", expect.objectContaining({ version: 3, site: expect.objectContaining({ defaultAssigneeId: null }), operationId: expect.any(String), idempotencyKey: expect.any(String) }), expect.anything())
  })
})
