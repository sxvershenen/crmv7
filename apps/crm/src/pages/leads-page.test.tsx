import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"
import { LeadsPage } from "./leads-page"
import { FixtureLeadRepository } from "@app/data/leads-repository"

function renderLeads(initialEntry = "/leads") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[initialEntry]}><TooltipProvider><LeadsPage repository={new FixtureLeadRepository()} /></TooltipProvider></MemoryRouter></QueryClientProvider>)
}

describe("LeadsPage", () => {
  it("uses shared titleless navigation, an explicit All stage and compact default view tabs", async () => {
    renderLeads()
    await screen.findByTestId("desktop-leads-view")
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByText(/Pipeline на typed fixtures/iu)).not.toBeInTheDocument()
    expect(screen.queryByText("Все активные", { exact: true })).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Все" })).toHaveAttribute("data-active")
    const stageTab = screen.getByRole("tab", { name: "Новое" })
    expect(stageTab.closest('[data-slot="tabs-list"]')).toHaveAttribute("data-variant", "line")
    expect(screen.getByRole("tab", { name: "Карточки" }).closest('[data-slot="tabs-list"]')).toHaveAttribute("data-variant", "default")
    expect(screen.getByRole("tab", { name: "Карточки" })).toHaveTextContent("")
    expect(screen.getByRole("tab", { name: "Таблица" })).toHaveTextContent("")
    expect(screen.getAllByRole("combobox", { name: "Область заявок" })).toHaveLength(2)
  })

  it("uses an honest content and vertical-rail grid for desktop and mobile cards", async () => {
    renderLeads()
    const desktop = await screen.findByTestId("desktop-leads-view")
    const mobile = screen.getByTestId("mobile-leads-list")
    expect(within(desktop).getByRole("heading", { name: "Новое" })).toBeInTheDocument()
    expect(within(mobile).getByRole("region", { name: "Список заявок" })).toBeInTheDocument()
    expect(within(mobile).queryByText(/гост/iu)).not.toBeInTheDocument()
    expect(within(desktop).queryByText(/Хотят/iu)).not.toBeInTheDocument()
    expect(within(desktop).queryByRole("button", { name: /Переместить заявку/iu })).not.toBeInTheDocument()
    const resource = within(desktop).getByText("Домик «Сосна» и баня")
    expect(resource.parentElement).toHaveTextContent(/Домик «Сосна» и баня·6/u)
    const newColumn = within(desktop).getByRole("heading", { name: "Новое" }).closest("section")
    expect(newColumn).not.toHaveClass("border-t-2")
    expect(newColumn?.querySelector("header > span.rounded-full")).toHaveClass("bg-sky-400")
    const info = within(desktop).getByText("+7 921 450-12-40").parentElement
    expect(info).toHaveClass("text-muted-foreground")
    expect(info?.parentElement).not.toHaveClass("bg-muted/45", "p-2")
    const leadCard = within(desktop).getByRole("button", { name: "Открыть заявку 1284: Анна Ковалёва" }).parentElement
    const layout = leadCard?.querySelector('[data-slot="lead-card-layout"]')
    const rail = leadCard?.querySelector('[data-slot="lead-card-rail"]')
    expect(layout).toHaveClass("grid", "grid-cols-[minmax(0,1fr)_2rem]")
    expect(layout?.children).toHaveLength(2)
    expect(rail).toHaveClass("flex-col", "w-8")
    const assignees = within(leadCard!).getByLabelText(/Ответственные:/)
    const attention = within(leadCard!).getByLabelText("Просрочен следующий контакт")
    expect(assignees.compareDocumentPosition(attention) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(assignees.querySelector('[data-slot="avatar"]')).toHaveClass("size-6")
    expect(attention).toHaveClass("bg-amber-100", "text-amber-700")
    expect(within(leadCard!).queryByText("Внимание")).not.toBeInTheDocument()
    expect(within(leadCard!).getByRole("button", { name: "Действия заявки 1284" })).toHaveClass("size-8")
    const mobileCard = within(mobile).getByRole("button", { name: "Открыть заявку 1284: Анна Ковалёва" }).parentElement
    expect(mobileCard?.querySelector('[data-slot="lead-card-layout"]')).toHaveClass("grid-cols-[minmax(0,1fr)_2rem]")
    const multiAssigneeCard = within(desktop).getByRole("button", { name: "Открыть заявку 1279: Сергей Лебедев" }).parentElement
    const multiAssignees = multiAssigneeCard?.querySelector('[data-slot="lead-card-assignees"]')
    expect(multiAssignees).toHaveClass("flex-col", "-space-y-1.5")
    expect(multiAssignees?.querySelectorAll('[data-slot="avatar"]')).toHaveLength(2)
    expect(within(desktop).queryByText(/demo rollback/iu)).not.toBeInTheDocument()
  })

  it("assigns the current user from the circular plus control", async () => {
    const user = userEvent.setup()
    renderLeads()
    const desktop = await screen.findByTestId("desktop-leads-view")
    const leadCard = within(desktop).getByRole("button", { name: "Открыть заявку 1283: Михаил Белов" }).parentElement
    const assign = within(leadCard!).getByRole("button", { name: "Назначить ответственного заявке 1283" })
    expect(assign).toHaveClass("size-6", "rounded-full")
    expect(assign).toHaveTextContent("")

    await user.click(assign)

    expect(within(leadCard!).queryByRole("button", { name: "Назначить ответственного заявке 1283" })).not.toBeInTheDocument()
    expect(within(leadCard!).getByLabelText("Ответственные: Марина Кириллова")).toBeInTheDocument()
    expect(screen.getByText("Марина Кириллова назначена заявке #1283.", { selector: ".sr-only" })).toBeInTheDocument()
  })

  it("uses shared neutral table pieces with sortable URL state", async () => {
    const user = userEvent.setup()
    renderLeads()
    await screen.findByTestId("desktop-leads-view")
    await user.click(screen.getByRole("tab", { name: "Таблица" }))
    const table = await screen.findByRole("table")
    expect(table.closest('[data-slot="data-table-shell"]')).toBeInTheDocument()
    const classes = Array.from(table.querySelectorAll("tr, td"), (element) => element.getAttribute("class") ?? "").join(" ")
    expect(classes).not.toMatch(/(?:text|bg|border)-(?:danger|destructive|red|rose)/u)
    expect(within(table).getAllByLabelText("Просрочено").length).toBeGreaterThan(0)
    await user.click(within(table).getByRole("button", { name: "Клиент" }))
    await waitFor(() => expect(within(screen.getByRole("table")).getByRole("columnheader", { name: "Клиент" })).toHaveAttribute("aria-sort", "ascending"))
  })

  it("provides a keyboard-accessible action alternative for changing stage", async () => {
    const user = userEvent.setup()
    renderLeads("/leads?stage=new")
    const actions = await screen.findAllByRole("button", { name: /Действия заявки 1284/ })
    await user.click(actions[0]!)
    await user.click(await screen.findByRole("menuitem", { name: "Ожидание" }))
    expect(await screen.findByText(/перенесена в/iu, { selector: ".sr-only" })).toBeInTheDocument()
  })
})
