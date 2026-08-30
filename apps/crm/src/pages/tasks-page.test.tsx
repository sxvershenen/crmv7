import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { TooltipProvider } from "@crm/ui"

import { FixtureTaskRepository } from "@app/data/tasks-repository"
import { TaskEditorPage } from "./task-editor-page"
import { TasksPage } from "./tasks-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderTasks(initialEntry = "/tasks") {
  const repository = new FixtureTaskRepository()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[initialEntry]}><TooltipProvider><Routes><Route element={<><TasksPage repository={repository} /><LocationProbe /></>} path="tasks" /><Route element={<TaskEditorPage repository={repository} />} path="tasks/:id" /></Routes></TooltipProvider></MemoryRouter></QueryClientProvider>)
}

describe("TasksPage", () => {
  it("defaults to a task dashboard with queue and team workload", async () => {
    renderTasks()
    expect(await screen.findByTestId("task-dashboard")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Дашборд" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("heading", { name: "Фокус очереди" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Нагрузка команды" })).toBeInTheDocument()
    expect(screen.getAllByText(/Срочные ·|В работе ·|Сегодня ·|С итогом ·/)).toHaveLength(4)
    expect(screen.getAllByTestId("task-dashboard")[0]?.querySelectorAll('[data-slot="summary-metric"]')).toHaveLength(4)
    expect(screen.getAllByTestId("task-dashboard")[0]?.querySelectorAll('[data-slot="list-section"]')).toHaveLength(2)
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
  })

  it("switches URL-backed views and renders dedicated mobile cards", async () => {
    const user = userEvent.setup()
    renderTasks()
    await screen.findByTestId("task-dashboard")
    await user.click(screen.getByRole("tab", { name: "Канбан" }))
    expect(await screen.findByTestId("task-kanban")).toBeInTheDocument()
    expect(screen.getByTestId("mobile-task-cards")).toBeInTheDocument()
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("view=kanban")
    expect(screen.getByRole("region", { name: /В работе:/ })).toBeInTheDocument()
  })

  it("sorts the table through URL and expands comments", async () => {
    const user = userEvent.setup()
    renderTasks("/tasks?view=table")
    const table = await screen.findByTestId("task-table")
    await user.click(within(table).getByRole("button", { name: "Приоритет" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("sort=priority&order=asc")
    const sortedTable = screen.getByTestId("task-table")
    await user.click(within(sortedTable).getByRole("button", { name: "Комментарии задачи T-184" }))
    expect(within(sortedTable).getByText("Клиент обещал прислать список утром.")).toBeInTheDocument()
  })

  it("removes a task from the unassigned problems filter after self-assignment", async () => {
    const user = userEvent.setup()
    renderTasks("/tasks?view=problems&assignee=unassigned")
    const list = await screen.findByTestId("task-card-list")
    expect(within(list).getByText("Назначить ответственного за встречу гостя")).toBeInTheDocument()
    await user.click(within(list).getByRole("button", { name: "Назначить исполнителя задаче T-180" }))
    await waitFor(() => expect(within(list).queryByText("Назначить ответственного за встречу гостя")).not.toBeInTheDocument())
    expect(screen.getByText("Вы назначены на задачу T-180")).toBeInTheDocument()
  })

  it("opens a route-driven task detail from a card", async () => {
    const user = userEvent.setup()
    renderTasks("/tasks?view=kanban")
    await screen.findByTestId("task-kanban")
    await user.click(screen.getAllByRole("button", { name: /Открыть задачу T-184/ })[0]!)
    expect(await screen.findByDisplayValue("Уточнить финальный состав гостей")).toBeInTheDocument()
  })
})
