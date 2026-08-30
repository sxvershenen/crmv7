import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { TooltipProvider } from "@crm/ui"
import { FixtureEventsRepository } from "@app/data/events-repository"
import { EventCategoriesPage } from "./event-categories-page"
import { EventCategoryEditorPage } from "./event-category-editor-page"
import { EventsPage } from "./events-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEvents(initialEntry = "/events") {
  const repository = new FixtureEventsRepository()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<MemoryRouter initialEntries={[initialEntry]}><QueryClientProvider client={queryClient}><TooltipProvider><Routes><Route element={<><EventsPage repository={repository} /><LocationProbe /></>} path="events" /><Route element={<><EventCategoriesPage repository={repository} /><LocationProbe /></>} path="events/categories" /><Route element={<><EventCategoryEditorPage repository={repository} /><LocationProbe /></>} path="events/categories/new" /></Routes></TooltipProvider></QueryClientProvider></MemoryRouter>)
}

describe("EventsPage", () => {
  it("renders sortable desktop table, mobile cards and the renamed offsite event type", async () => {
    renderEvents()
    const table = await screen.findByTestId("desktop-events")
    expect(screen.getByTestId("mobile-events")).toHaveAttribute("aria-label", "Мероприятия")
    expect(within(table).getAllByText(/Выездное мероприятие/).length).toBeGreaterThan(0)
    expect(screen.queryByText("Выездная программа")).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Все" })).toHaveAttribute("aria-selected", "true")
  })

  it("keeps status, view and period in URL and renders scheduler even when period is empty", async () => {
    const user = userEvent.setup()
    renderEvents()
    await screen.findByTestId("desktop-events")
    await user.click(screen.getByRole("tab", { name: "Бронь · 2" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("status=booked")
    await user.click(screen.getAllByRole("tab", { name: "Scheduler" })[0]!)
    expect(await screen.findByTestId("event-scheduler")).toBeInTheDocument()
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("view=scheduler")
  })

  it("places a working circular assignee control immediately before fast status", async () => {
    const user = userEvent.setup()
    renderEvents()
    const table = await screen.findByTestId("desktop-events")
    const assign = within(table).getByRole("button", { name: /Назначить ответственного мероприятию Выездной тимбилдинг/ })
    expect(assign).toHaveClass("rounded-full", "size-6")
    const status = within(table).getByRole("combobox", { name: "Статус мероприятия #E-3114" })
    expect(assign.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(assign)
    expect((await screen.findAllByLabelText("Ответственные: Марина Кириллова")).length).toBeGreaterThan(0)
  })

  it("opens standalone event categories and create editor", async () => {
    const user = userEvent.setup()
    renderEvents()
    await screen.findByTestId("desktop-events")
    await user.click(screen.getByRole("button", { name: "Управление категориями мероприятий" }))
    expect(await screen.findByRole("region", { name: "Категории мероприятий" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Новая категория" }))
    expect(await screen.findByDisplayValue("Новая категория")).toBeInTheDocument()
  })

  it("keeps empty scheduler day columns instead of replacing them with a page state", async () => {
    renderEvents("/events?view=scheduler&status=archived&date=2026-08-24")
    expect(await screen.findByTestId("event-scheduler")).toBeInTheDocument()
    expect(screen.queryByText("Ничего не найдено")).not.toBeInTheDocument()
    expect(screen.getAllByText("На этот день ничего не запланировано").length).toBeGreaterThan(0)
  })
})
