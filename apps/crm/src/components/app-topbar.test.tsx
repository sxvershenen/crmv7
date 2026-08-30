import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { EditorLayoutProvider } from "@app/app/editor-layout-provider"
import { FixtureGlobalSearchRepository } from "@app/data/global-search-repository"

import { AppTopbar } from "./app-topbar"

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="Текущий URL">{location.pathname}</output>
}

describe("AppTopbar", () => {
  it("opens global creation without crashing and navigates to the selected editor", async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><TooltipProvider><EditorLayoutProvider><AppTopbar searchRepository={new FixtureGlobalSearchRepository()} /><LocationProbe /></EditorLayoutProvider></TooltipProvider></MemoryRouter>)

    await user.click(screen.getByRole("button", { name: "Создать" }))
    expect(await screen.findByText("Новая запись")).toBeInTheDocument()
    await user.click(await screen.findByRole("menuitem", { name: "Клиента" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("/customers/new")
  })

  it("searches operational entities by #ID and opens the selected record", async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><TooltipProvider><EditorLayoutProvider><AppTopbar searchRepository={new FixtureGlobalSearchRepository()} /><LocationProbe /></EditorLayoutProvider></TooltipProvider></MemoryRouter>)

    await user.click(screen.getAllByRole("button", { name: "Открыть поиск" })[0]!)
    await user.type(screen.getByPlaceholderText("Найти #ID, телефон, e-mail, имя или ресурс…"), "#2051")
    await user.click(await screen.findByText("Илья Воронцов"))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("/bookings/2051")
  })
})
