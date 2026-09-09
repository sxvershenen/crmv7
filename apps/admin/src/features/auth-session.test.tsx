import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AdminAuthSessionProvider } from "@admin/features/auth-session"
import { useAdminAuthSession } from "@admin/features/auth-session-context"
import { ADMIN_AUTH_REQUIRED_EVENT } from "@admin/lib/api-client"

vi.mock("@admin/lib/data-mode", () => ({ cmsDataMode: "api", useFixtureData: false }))

const adminUser = {
  id: "40ec463c-1bf9-4bc0-b6ed-6bbda633bd25",
  name: "Администратор CRM",
  email: "admin@svistoplyasovo.local",
  role: "admin" as const,
  capabilities: {
    canView: true, canCreate: true, canEdit: true, canDelete: true, canArchive: true,
    canAssign: true, canChangeStatus: true, canAddPayment: true, canRefund: true,
    canOverrideConflict: true, canViewFinance: true, canViewAudit: true,
    canManageUsers: true, canManageSettings: true,
    canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true,
    canManageSeo: true, canManageMedia: true, canViewAnalytics: true, canViewRawAnalytics: true,
    canManageSiteCode: true, canManageIntegrations: true, canManageRedirects: true, canManageSiteSettings: true,
  },
}

describe("AdminAuthSessionProvider", () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("keeps invalid credentials in the initial login flow", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ code: "UNAUTHENTICATED", message: "session required" }, 401))
      .mockResolvedValueOnce(jsonResponse({ code: "INVALID_CREDENTIALS", message: "invalid" }, 401))
    vi.stubGlobal("fetch", fetcher)
    render(<AdminAuthSessionProvider><div>CMS app</div></AdminAuthSessionProvider>)
    fireEvent.change(await screen.findByLabelText("E-mail"), { target: { value: "admin@svistoplyasovo.local" } })
    fireEvent.change(screen.getByLabelText("Пароль"), { target: { value: "wrong-password" } })
    fireEvent.click(screen.getByRole("button", { name: "Войти" }))

    expect(await screen.findByText("Неверный e-mail или пароль.")).toBeInTheDocument()
    expect(screen.queryByText("CMS app")).not.toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/admin/v1/auth/session",
      "/api/admin/v1/auth/login",
    ])
  })

  it("keeps the mounted editor state behind mandatory reauthentication", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: adminUser })))
    render(<AdminAuthSessionProvider><label>Черновик<input aria-label="Черновик" defaultValue="" /></label></AdminAuthSessionProvider>)
    const draft = await screen.findByLabelText("Черновик")
    fireEvent.change(draft, { target: { value: "несохранённый текст" } })
    await act(async () => {
      window.dispatchEvent(new Event(ADMIN_AUTH_REQUIRED_EVENT))
      await Promise.resolve()
    })

    expect(await screen.findByRole("dialog")).toHaveTextContent("Сессия CMS завершилась")
    expect(screen.getByLabelText("Черновик")).toHaveValue("несохранённый текст")
  })

  it("shows a dedicated access-denied screen without mounting CMS", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ user: { ...adminUser, capabilities: { ...adminUser.capabilities, canViewContent: false } } })))
    render(<AdminAuthSessionProvider><div>CMS app</div></AdminAuthSessionProvider>)

    expect(await screen.findByRole("heading", { name: "Нет доступа к CMS" })).toBeInTheDocument()
    expect(screen.queryByText("CMS app")).not.toBeInTheDocument()
  })

  it("treats an already-expired session as logged out", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ user: adminUser }))
      .mockResolvedValueOnce(jsonResponse({ code: "UNAUTHENTICATED", message: "expired" }, 401))
    vi.stubGlobal("fetch", fetcher)
    const user = userEvent.setup()
    function LogoutButton() {
      const auth = useAdminAuthSession()
      return <button onClick={() => { void auth.logout() }}>Выйти из теста</button>
    }

    render(<AdminAuthSessionProvider><LogoutButton /></AdminAuthSessionProvider>)
    await user.click(await screen.findByRole("button", { name: "Выйти из теста" }))

    expect(await screen.findByRole("heading", { name: "Вход в CMS" })).toBeInTheDocument()
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "/api/admin/v1/auth/session",
      "/api/admin/v1/auth/logout",
    ])
  })
})

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "x-request-id": "req-auth-test" } })
}
