import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import type { SessionUser } from "@crm/contracts"
import { AuthSessionContext } from "@app/features/auth-session-context"
import type { WorkspaceRepository } from "@app/data/workspace-repository"
import { TeamPage } from "./team-page"

const invitation = {
  token: "a".repeat(43), expiresAt: "2026-10-01T12:00:00.000Z",
  member: { id: "11111111-1111-4111-8111-111111111111", version: 1, name: "Тестовый менеджер", email: "manager@example.invalid", phone: "", initials: "ТМ", role: "Менеджер", status: "invited" as const, openItems: 0, lastActiveAt: null, schedule: { status: "unconfigured" as const }, leave: { status: "unconfigured" as const } },
}

function renderTeam(canManageUsers: boolean) {
  const repository = { listTeam: vi.fn().mockResolvedValue([]), createTeamInvitation: vi.fn().mockResolvedValue(invitation) } as unknown as WorkspaceRepository
  const user = { capabilities: { canManageUsers } } as SessionUser
  render(<AuthSessionContext.Provider value={{ user, logout: async () => undefined }}><MemoryRouter><TeamPage repository={repository} /></MemoryRouter></AuthSessionContext.Provider>)
  return repository
}

describe("team invitations", () => {
  it("creates a link only through the repository and shows it to the administrator", async () => {
    const repository = renderTeam(true)
    const actor = userEvent.setup()
    await actor.click(await screen.findByRole("button", { name: "Пригласить" }))
    await actor.type(screen.getByLabelText("Имя сотрудника"), "Тестовый менеджер")
    await actor.type(screen.getByLabelText("E-mail"), "manager@example.invalid")
    await actor.click(screen.getByRole("button", { name: "Создать ссылку" }))
    expect(repository.createTeamInvitation).toHaveBeenCalledWith({ name: "Тестовый менеджер", email: "manager@example.invalid", role: "manager" })
    expect(await screen.findByRole("textbox", { name: "Ссылка-приглашение" })).toHaveValue(`${window.location.origin}/invite#${invitation.token}`)
  })

  it("does not offer creation without user-management permission", async () => {
    renderTeam(false)
    expect(await screen.findByRole("button", { name: "Пригласить" })).toBeDisabled()
  })
})
