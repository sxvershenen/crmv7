import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { SessionUser } from "@crm/contracts"

import { AuthSessionProvider } from "@app/features/auth-session"
import { useAuthSession } from "@app/features/auth-session-context"
import { ApiClientError, apiClient } from "@app/lib/api-client"

const user: SessionUser = {
  id: "40ec463c-1bf9-4bc0-b6ed-6bbda633bd25",
  name: "Администратор CRM",
  role: "admin",
  capabilities: {
    canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: true,
    canAssign: true, canChangeStatus: true, canAddPayment: true, canRefund: true,
    canOverrideConflict: true, canViewFinance: true, canViewAudit: true,
    canManageUsers: true, canManageSettings: true,
  },
}

function SessionProbe() {
  const session = useAuthSession()
  return <p>{session?.user.name ?? "Нет сессии"}</p>
}

function renderProvider() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><AuthSessionProvider><SessionProbe /></AuthSessionProvider></QueryClientProvider>)
}

describe("AuthSessionProvider", () => {
  afterEach(() => vi.restoreAllMocks())

  it("renders the authenticated application after session bootstrap", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ user })
    renderProvider()
    expect(await screen.findByText("Администратор CRM")).toBeInTheDocument()
  })

  it("offers login after an expired session and resumes without a reload", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValue(new ApiClientError({ code: "AUTHENTICATION_REQUIRED", message: "Требуется вход", details: {} }, 401))
    vi.spyOn(apiClient, "post").mockResolvedValue({ user })
    renderProvider()

    expect(await screen.findByRole("heading", { name: "Вход в CRM" })).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText("Пароль"), "change-me-in-local-env")
    await userEvent.click(screen.getByRole("button", { name: "Войти" }))
    expect(await screen.findByText("Администратор CRM")).toBeInTheDocument()
  })
})
