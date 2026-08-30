import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"
import { FixtureFinanceRepository } from "@app/data/finance-repository"
import { FinancePage } from "./finance-page"

function Probe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderFinance(entry = "/finance") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[entry]}><TooltipProvider><FinancePage repository={new FixtureFinanceRepository()} /><Probe /></TooltipProvider></MemoryRouter></QueryClientProvider>)
}

describe("FinancePage", () => {
  it("uses shared metrics, list sections and payment progress", async () => {
    renderFinance()
    const content = await screen.findByTestId("finance-content")
    expect(content.querySelectorAll('[data-slot="summary-metric"]')).toHaveLength(7)
    expect(content.querySelectorAll('[data-slot="summary-metric-strip"]')).toHaveLength(1)
    expect(content.querySelectorAll('[data-slot="list-section"]')).toHaveLength(3)
    expect(screen.getByTestId("finance-chart")).toBeInTheDocument()
    expect(screen.getAllByRole("progressbar").length).toBeGreaterThan(3)
  })

  it("filters a category and stores it in URL", async () => {
    const user = userEvent.setup()
    renderFinance()
    await screen.findByTestId("finance-table")
    await user.click(screen.getByRole("tab", { name: "Мероприятия" }))
    const table = await screen.findByTestId("finance-table")
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("section=events")
    expect(within(table).getAllByText(/Свадьба|Репетиция/)).toHaveLength(2)
  })

  it("sorts the registry and exposes mobile cards", async () => {
    const user = userEvent.setup()
    renderFinance()
    const table = await screen.findByTestId("finance-table")
    await user.click(within(table).getByRole("button", { name: "Сумма" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("sort=amount&order=asc")
    expect(screen.getByTestId("mobile-finance-operations")).toBeInTheDocument()
  })

  it("keeps filters and sorting while paginating the operation registry", async () => {
    const user = userEvent.setup()
    renderFinance("/finance?period=week&sort=amount&order=asc")
    await screen.findByTestId("finance-table")
    const pagination = await screen.findByTestId("finance-pagination")
    await user.click(within(pagination).getByRole("button", { name: "2" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("period=week&sort=amount&order=asc&page=2")
  })

  it("shows dedicated dynamics charts and concrete resource breakdowns", async () => {
    const user = userEvent.setup()
    renderFinance()
    await screen.findByTestId("finance-content")
    await user.click(screen.getByRole("tab", { name: "Динамика" }))
    const dynamics = await screen.findByTestId("finance-dynamics")
    expect(dynamics.querySelectorAll('[data-slot="chart"]')).toHaveLength(4)
    await user.click(screen.getByRole("tab", { name: "Домики" }))
    expect(await screen.findByText("По ресурсам")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Дом «Сосна»" })).toBeInTheDocument()
  })
})
