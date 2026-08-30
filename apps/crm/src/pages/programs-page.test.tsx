import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { TooltipProvider } from "@crm/ui"

import { FixtureProgramsRepository } from "@app/data/programs-repository"
import { ProgramCategoriesPage } from "./program-categories-page"
import { ProgramCategoryEditorPage } from "./program-category-editor-page"
import { ProgramsPage } from "./programs-page"

function LocationProbe() {
  const location = useLocation()
  return <output aria-label="Текущий URL">{location.pathname}{location.search}</output>
}

function renderPrograms(initialEntry = "/programs") {
  const repository = new FixtureProgramsRepository()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Routes>
            <Route path="programs" element={<><ProgramsPage repository={repository} /><LocationProbe /></>} />
            <Route path="programs/categories" element={<><ProgramCategoriesPage repository={repository} /><LocationProbe /></>} />
            <Route path="programs/categories/new" element={<><ProgramCategoryEditorPage repository={repository} /><LocationProbe /></>} />
          </Routes>
        </TooltipProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe("ProgramsPage", () => {
  it("defaults to template base with sortable desktop table and dedicated mobile cards", async () => {
    renderPrograms()
    expect(await screen.findByTestId("desktop-program-templates")).toBeInTheDocument()
    expect(screen.getByTestId("mobile-program-templates")).toHaveAttribute("aria-label", "Шаблоны программ")
    expect(screen.getByRole("tab", { name: "Шаблоны" })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()

    const identity = within(screen.getByTestId("desktop-program-templates")).getByText("Семейный день в лесу").closest('[data-slot="program-identity"]')
    const identityStack = identity?.querySelector('[data-slot="program-identity-stack"]')
    expect(identity?.firstElementChild).not.toBe(identityStack)
    expect(within(identityStack as HTMLElement).getByText(/Версия 4/)).toBeInTheDocument()
  })

  it("stores section, view, period and sorting in URL", async () => {
    const user = userEvent.setup()
    renderPrograms()
    await screen.findByTestId("desktop-program-templates")
    await user.click(screen.getByRole("tab", { name: "Проведения" }))
    expect(await screen.findByTestId("desktop-program-runs")).toBeInTheDocument()
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("section=runs")
    await user.click(screen.getAllByRole("tab", { name: "Scheduler" })[0]!)
    expect(await screen.findByTestId("program-scheduler")).toBeInTheDocument()
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("view=scheduler")
    expect(within(screen.getByTestId("program-scheduler")).getAllByText(/Семейный день в лесу/).length).toBeGreaterThan(0)
  })

  it("changes run status through the generated select without backend authority", async () => {
    const user = userEvent.setup()
    renderPrograms("/programs?section=runs")
    const table = await screen.findByTestId("desktop-program-runs")
    const status = within(table).getByRole("combobox", { name: "Статус проведения #24081" })
    await user.click(status)
    await user.click(await screen.findByRole("option", { name: "Завершено" }))
    expect(within(table).getByRole("combobox", { name: "Статус проведения #24081" })).toHaveTextContent("Завершено")
    expect(screen.getByText("Статус проведения #24081 изменён локально")).toBeInTheDocument()
  })

  it("renders revenue as paid progress in the runs table", async () => {
    renderPrograms("/programs?section=runs")

    const table = await screen.findByTestId("desktop-program-runs")
    const progress = within(table).getByRole("progressbar", { name: /оплачено.*58\s*800.*из.*71\s*400/iu })

    expect(progress).toHaveAttribute("aria-valuenow", "58800")
    expect(progress).toHaveAttribute("aria-valuemax", "71400")
    expect(progress.querySelector('[data-slot="progress-track"]')).toBeInTheDocument()
  })

  it("cycles revenue sorting through total and paid amounts", async () => {
    const user = userEvent.setup()
    renderPrograms("/programs?section=runs")

    await screen.findByTestId("desktop-program-runs")
    await user.click(screen.getByRole("button", { name: /Выручка/iu }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("sort=revenue&order=desc")
    await user.click(screen.getByRole("button", { name: /Выручка/iu }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("sort=revenue&order=asc")
    await user.click(screen.getByRole("button", { name: /Выручка/iu }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("sort=paid&order=desc")
    await user.click(screen.getByRole("button", { name: /Выручка/iu }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("sort=paid&order=asc")
  })

  it("assigns an owner locally from the compact control next to status", async () => {
    const user = userEvent.setup()
    renderPrograms()
    const table = await screen.findByTestId("desktop-program-templates")
    const assign = within(table).getByRole("button", { name: "Назначить ответственного шаблону Зимняя сказка в Свистоплясово" })
    const row = assign.closest("tr")
    const status = within(row as HTMLElement).getByText("Черновик")
    expect(assign.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(assign)
    expect(within(row as HTMLElement).queryByRole("button", { name: "Назначить ответственного шаблону Зимняя сказка в Свистоплясово" })).not.toBeInTheDocument()
    expect(screen.getByText("Марина Кириллова назначена шаблону winter-tale")).toBeInTheDocument()
  })

  it("opens standalone category management and its create editor", async () => {
    const user = userEvent.setup()
    renderPrograms()
    await screen.findByTestId("desktop-program-templates")
    await user.click(screen.getByRole("button", { name: "Управление категориями программ" }))
    expect(await screen.findByRole("region", { name: "Категории программ" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Новая категория" }))
    expect(await screen.findByDisplayValue("Новая категория")).toBeInTheDocument()
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("/programs/categories/new")
  })
})
