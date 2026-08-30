import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { CustomersPage } from "./customers-page"
import { FixtureCustomerRepository } from "@app/data/customers-repository"

function LocationProbe() {
  return <output aria-label="Текущий URL">{useLocation().search}</output>
}

function renderCustomers(initialEntry = "/customers") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <TooltipProvider><CustomersPage repository={new FixtureCustomerRepository()} /><LocationProbe /></TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("CustomersPage", () => {
  it("renders sortable desktop rows and dedicated compact mobile cards", async () => {
    renderCustomers()

    const table = await screen.findByTestId("desktop-customers-table")
    const cards = screen.getByTestId("mobile-customers-list")
    expect(within(table).getByRole("table")).toBeInTheDocument()
    expect(cards).toHaveAttribute("aria-label", "Список клиентов")
    expect(within(cards).getAllByRole("button", { name: /Позвонить/ }).length).toBeGreaterThan(0)
    expect(within(cards).queryByText("Оборот")).not.toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Клиенты" })).not.toBeInTheDocument()
  })

  it("keeps useful sorting in URL state", async () => {
    const user = userEvent.setup()
    renderCustomers()

    const table = await screen.findByTestId("desktop-customers-table")
    await user.click(within(table).getByRole("button", { name: "Долг" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("sort=debt")
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("order=asc")
    await waitFor(() => expect(within(screen.getByTestId("desktop-customers-table")).getByRole("columnheader", { name: "Долг" })).toHaveAttribute("aria-sort", "ascending"))
  })

  it("offers a useful reset from an empty filter combination", async () => {
    const user = userEvent.setup()
    renderCustomers("/customers?flags=active,archive")

    expect(await screen.findByText("Клиенты не найдены")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }))
    expect(await screen.findByTestId("desktop-customers-table")).toBeInTheDocument()
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("")
  })

  it("assigns a responsible person from the active dashed control", async () => {
    const user = userEvent.setup()
    renderCustomers()

    const table = await screen.findByTestId("desktop-customers-table")
    const assignButtons = within(table).getAllByRole("button", { name: "+ Назначить" })
    await user.click(assignButtons[0]!)

    expect(within(table).getAllByRole("button", { name: "+ Назначить" })).toHaveLength(assignButtons.length - 1)
    expect(screen.getByText("Марина Кириллова назначена клиенту #1024")).toBeInTheDocument()
  })
})
