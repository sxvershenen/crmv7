import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { TooltipProvider } from "@crm/ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { navigationFixture } from "@admin/fixtures/cms"
import { AdminAuthSessionProvider } from "@admin/features/auth-session"
import { NavigationPage } from "./navigation-page"

describe("NavigationPage mutation recovery", () => {
  afterEach(() => vi.restoreAllMocks())

  it("retains the persisted menu version when publish fails", async () => {
    const initial = structuredClone(navigationFixture)
    const saved = { ...initial, version: initial.version + 1, status: "draft" as const, header: initial.header.map((item, index) => index === 0 ? { ...item, label: "Новое меню" } : item) }
    vi.spyOn(cmsRepository, "getNavigation").mockResolvedValue(initial)
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    const save = vi.spyOn(cmsRepository, "saveNavigation").mockResolvedValue(saved)
    const publish = vi.spyOn(cmsRepository, "publishNavigation").mockRejectedValue(new Error("Publish timeout"))

    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><NavigationPage /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    const names = await screen.findAllByLabelText("Название")
    fireEvent.change(names[0]!, { target: { value: "Новое меню" } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить и опубликовать" }))
    await screen.findByText("Publish timeout")

    expect(save).toHaveBeenCalledOnce()
    expect(publish).toHaveBeenLastCalledWith(saved.version)
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled()

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2))
    expect(save).toHaveBeenCalledOnce()
  })

  it("shows the initial repository error before checking for a draft", async () => {
    vi.spyOn(cmsRepository, "getNavigation").mockRejectedValue(new Error("Site settings offline"))
    vi.spyOn(cmsRepository, "getAccess").mockResolvedValue({ canViewContent: true, canEditContent: true, canReviewContent: true, canPublishContent: true })
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><NavigationPage /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    expect(await screen.findByText("Site settings offline")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Повторить" })).toBeEnabled()
  })
})
