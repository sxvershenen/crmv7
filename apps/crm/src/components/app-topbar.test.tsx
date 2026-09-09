import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { EditorLayoutProvider } from "@app/app/editor-layout-provider"
import { FixtureGlobalSearchRepository } from "@app/data/global-search-repository"
import { FixtureNotificationsRepository } from "@app/data/notifications-repository"

import { AppTopbar } from "./app-topbar"

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="Текущий URL">{location.pathname}</output>
}

function renderTopbar(initialEntry = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[initialEntry]}><TooltipProvider><EditorLayoutProvider><AppTopbar notificationRepository={new FixtureNotificationsRepository()} searchRepository={new FixtureGlobalSearchRepository()} /><LocationProbe /></EditorLayoutProvider></TooltipProvider></MemoryRouter></QueryClientProvider>)
}

describe("AppTopbar", () => {
  it("opens global creation without crashing and navigates to the selected editor", async () => {
    const user = userEvent.setup()
    renderTopbar()

    await user.click(screen.getByRole("button", { name: "Создать" }))
    expect(await screen.findByText("Новая запись")).toBeInTheDocument()
    await user.click(await screen.findByRole("menuitem", { name: "Клиента" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("/customers/new")
  })

  it("searches operational entities by #ID and opens the selected record", async () => {
    const user = userEvent.setup()
    renderTopbar()

    await user.click(screen.getAllByRole("button", { name: "Открыть поиск" })[0]!)
    await user.type(screen.getByPlaceholderText("Найти #ID, телефон, e-mail, имя или ресурс…"), "#2051")
    await user.click(await screen.findByText("Илья Воронцов"))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("/bookings/2051")
  })

  it("loads persisted notifications and opens their entity route", async () => {
    const user = userEvent.setup()
    renderTopbar()

    await user.click(await screen.findByRole("button", { name: "Уведомления: 2 новых" }))
    await user.click(await screen.findByRole("button", { name: /Конфликт в брони #1048/ }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("/bookings/1048")
  })

  it("shows a contextual create action for the active resource section", async () => {
    const user = userEvent.setup()
    renderTopbar("/resources/houses")

    await user.click(screen.getByRole("button", { name: "Создать" }))
    await user.click(await screen.findByRole("menuitem", { name: "Добавить домик" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("/resources/houses/new")
  })

  it("shows creation actions for runs and registrations in programs", async () => {
    const user = userEvent.setup()
    renderTopbar("/programs/runs")

    await user.click(screen.getByRole("button", { name: "Создать" }))
    expect(await screen.findByRole("menuitem", { name: "Добавить проведение" })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: "Добавить регистрацию" })).toBeInTheDocument()
  })

  it("puts promotion creation into the shared create menu", async () => {
    const user = userEvent.setup()
    renderTopbar("/marketing")

    await user.click(screen.getByRole("button", { name: "Создать" }))
    await user.click(await screen.findByRole("menuitem", { name: "Добавить промокод" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("/marketing/promotions/new")
  })
})
