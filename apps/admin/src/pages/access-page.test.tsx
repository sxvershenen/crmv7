import { render, screen, within } from "@testing-library/react"
import { SessionUserSchema } from "@crm/contracts/auth"

import { AdminAuthSessionContext } from "@admin/features/auth-session-context"
import { AccessPage } from "./access-page"

it("shows assigned session capabilities without invented staff counts or user management", () => {
  const user = SessionUserSchema.parse({
    id: "00000000-0000-4000-8000-000000000001", name: "Технический администратор", role: "technical_admin",
    capabilities: {
      canView: true, canCreate: false, canEdit: false, canDelete: false, canArchive: false, canAssign: false,
      canChangeStatus: false, canAddPayment: false, canRefund: false, canOverrideConflict: false,
      canViewFinance: false, canViewAudit: true, canManageUsers: true, canManageSettings: true,
      canViewContent: true, canEditContent: false, canReviewContent: false, canPublishContent: false,
      canManageSeo: false, canManageMedia: false, canViewAnalytics: false, canViewRawAnalytics: false,
      canManageSiteCode: true, canManageIntegrations: true, canManageRedirects: false, canManageSiteSettings: true,
    },
  })
  render(<AdminAuthSessionContext.Provider value={{ user, logout: async () => undefined }}><AccessPage /></AdminAuthSessionContext.Provider>)

  expect(screen.getByRole("heading", { name: "Технический администратор" })).toBeInTheDocument()
  expect(within(screen.getByText("Редактирование черновиков").parentElement!).getByText("Не назначено")).toBeInTheDocument()
  expect(within(screen.getByText("Код сайта").parentElement!).getByText("Назначено")).toBeInTheDocument()
  expect(screen.getByText(/Изменение прав и приглашения пока не подключены/)).toBeInTheDocument()
  expect(screen.queryByText(/\d+ users/)).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Открыть роли команды в CRM" })).toBeEnabled()
})
