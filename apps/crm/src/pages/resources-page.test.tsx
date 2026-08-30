import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"
import { ResourcesPage } from "./resources-page"
import { FixtureResourceRepository } from "@app/data/resources-repository"

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}{useLocation().search}</output>
}

function renderResources(initialEntry = "/resources/houses") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TooltipProvider>
          <Routes>
            <Route path="resources/:kind" element={<><ResourcesPage repository={new FixtureResourceRepository()} /><LocationProbe /></>} />
            <Route path="resources/:kind/:resourceId" element={<><p>Resource detail placeholder</p><LocationProbe /></>} />
          </Routes>
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("ResourcesPage", () => {
  it("uses titleless line navigation and generated selects", async () => {
    renderResources()
    const list = await screen.findByRole("region", { name: "Список ресурсов" })
    expect(list).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Домики" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Домики" }).closest('[data-slot="tabs-list"]')).toHaveAttribute("data-variant", "line")
    expect(screen.getAllByRole("combobox", { name: "Блокировка" })).toHaveLength(2)
    expect(screen.queryByRole("button", { name: /создать ресурс/iu })).not.toBeInTheDocument()
  })

  it("keeps monitoring sections compact and exposes the implemented block flow", async () => {
    renderResources()
    const list = await screen.findByRole("region", { name: "Список ресурсов" })
    const card = within(list).getByText("Дом «Сосна»").closest('[data-slot="actionable-card"]')
    expect(card).not.toBeNull()
    expect(within(card as HTMLElement).getByText("Вместимость")).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText("Будущие брони")).toBeInTheDocument()
    expect(within(card as HTMLElement).getByRole("button", { name: "Установить блокировку" })).toBeEnabled()
    expect(within(card as HTMLElement).queryByText(/(^|\s)гостей(\s|$)/iu)).not.toBeInTheDocument()
  })

  it("renders shared capacity progress only for the explicit camping variant", async () => {
    renderResources("/resources/camping")
    const list = await screen.findByRole("region", { name: "Список ресурсов" })
    expect(within(list).getByRole("progressbar", { name: "Занято 9 из 16" })).toBeInTheDocument()
    expect(within(list).getAllByRole("progressbar")).toHaveLength(1)
  })

  it("stores filters in URL and opens a card route without nested actions", async () => {
    const user = userEvent.setup()
    renderResources()
    await screen.findByRole("region", { name: "Список ресурсов" })
    const desktopBlockSelect = screen.getAllByRole("combobox", { name: "Блокировка" })[1]!
    await user.click(desktopBlockSelect)
    await user.click(await screen.findByRole("option", { name: "Есть блокировка" }))
    expect(screen.getByTestId("location")).toHaveTextContent("/resources/houses?block=active")
    await user.click(await screen.findByRole("button", { name: /Открыть ресурс: Дом у озера/ }))
    expect(screen.getByTestId("location")).toHaveTextContent("/resources/houses/house-lake")
  })

  it("opens the block action directly on the editor tab", async () => {
    const user = userEvent.setup()
    renderResources()
    const list = await screen.findByRole("region", { name: "Список ресурсов" })
    const card = within(list).getByText("Дом «Сосна»").closest('[data-slot="actionable-card"]') as HTMLElement
    await user.click(within(card).getByRole("button", { name: "Установить блокировку" }))
    expect(screen.getByTestId("location")).toHaveTextContent("/resources/houses/house-pine?tab=blocks")
  })

  it("redirects an invalid kind to houses and preserves filters", async () => {
    renderResources("/resources/unknown?warning=with")
    expect(await screen.findByTestId("location")).toHaveTextContent("/resources/houses?warning=with")
  })
})
