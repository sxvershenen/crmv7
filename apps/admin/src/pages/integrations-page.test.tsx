import { extractMetrikaCounterId } from "@admin/lib/metrika-settings"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@crm/ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { AdminAuthSessionProvider } from "@admin/features/auth-session"
import { IntegrationsPage } from "./integrations-page"

describe("extractMetrikaCounterId", () => {
  it("accepts a pasted numeric counter ID", () => {
    expect(extractMetrikaCounterId(" 12345678 ")).toBe("12345678")
  })

  it("extracts the ID from the standard Yandex snippet", () => {
    expect(extractMetrikaCounterId(`<script>ym(12345678, "init", { id: 12345678 });</script>`)).toBe("12345678")
    expect(extractMetrikaCounterId(`<noscript><img src="https://mc.yandex.ru/watch/12345678" /></noscript>`)).toBe("12345678")
  })

  it("rejects ambiguous or non-numeric input", () => {
    expect(extractMetrikaCounterId(`<script>ym(12345678, "init", { id: 87654321 });</script>`)).toBeNull()
    expect(extractMetrikaCounterId("<script>alert('nope')</script>")).toBeNull()
  })
})

describe("IntegrationsPage mutation recovery", () => {
  afterEach(() => vi.restoreAllMocks())

  it("keeps a successful save when the following publish fails", async () => {
    const initial = { version: 1, status: "published" as const, updatedLabel: "вчера", metrika: { enabled: false, counterId: null } }
    const saved = { ...initial, version: 2, status: "draft" as const, metrika: { enabled: false, counterId: "12345678" } }
    vi.spyOn(cmsRepository, "getMetrikaSettings").mockResolvedValue(initial)
    const save = vi.spyOn(cmsRepository, "saveMetrikaSettings").mockResolvedValue(saved)
    const publish = vi.spyOn(cmsRepository, "publishMetrikaSettings").mockRejectedValue(new Error("Публикация временно недоступна"))

    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><IntegrationsPage /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    fireEvent.change(await screen.findByLabelText("ID счётчика"), { target: { value: "12345678" } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить и опубликовать" }))
    await screen.findByText("Публикация временно недоступна")

    expect(save).toHaveBeenCalledOnce()
    expect(publish).toHaveBeenLastCalledWith(2)
    expect(screen.getByRole("button", { name: "Опубликовать" })).toBeEnabled()

    fireEvent.click(screen.getByRole("button", { name: "Опубликовать" }))
    await waitFor(() => expect(publish).toHaveBeenCalledTimes(2))
    expect(save).toHaveBeenCalledOnce()
  })

  it("shows an actionable initial load error without an endless loading state", async () => {
    vi.spyOn(cmsRepository, "getMetrikaSettings").mockRejectedValue(new Error("API недоступен"))
    render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter><IntegrationsPage /></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
    expect(await screen.findByText("API недоступен")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Повторить" })).toBeEnabled()
  })
})
