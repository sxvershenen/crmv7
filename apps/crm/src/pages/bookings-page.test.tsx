import { readFileSync } from "node:fs"

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { SchedulerBookingBlock, TooltipProvider, type SchedulerBookingTone } from "@crm/ui"

import { BookingsPage } from "./bookings-page"

function renderBookings(initialEntry = "/bookings") {
  return render(<MemoryRouter initialEntries={[initialEntry]}><TooltipProvider><BookingsPage /></TooltipProvider></MemoryRouter>)
}

function renderSchedule(initialEntry = "/schedule") { return render(<MemoryRouter initialEntries={[initialEntry]}><TooltipProvider><BookingsPage defaultView="scheduler" /></TooltipProvider></MemoryRouter>) }

describe("BookingsPage shared UI contract", () => {
  it("reuses the scheduler as the default representation for the dedicated schedule route", async () => {
    const user = userEvent.setup()
    renderSchedule()
    expect(await screen.findByTestId("vertical-scheduler")).toBeInTheDocument()
    expect(screen.getAllByRole("tab", { name: "Scheduler" })[0]).toHaveAttribute("aria-selected", "true")
    await user.click(screen.getAllByRole("tab", { name: "Agenda" })[0]!)
    expect(await screen.findByRole("region", { name: /Agenda/ })).toBeInTheDocument()
  })
  it("uses the shell title, line category tabs and icon-only view tabs", async () => {
    renderBookings()
    await screen.findByRole("region", { name: /Agenda/ })
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByText(/Ограниченное demo-окно/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Новая бронь|Быстрая бронь/ })).not.toBeInTheDocument()

    const categoryTabs = screen.getByRole("tablist", { name: "Категория ресурсов" })
    expect(categoryTabs).toHaveAttribute("data-variant", "line")
    const viewTabs = screen.getAllByRole("tablist", { name: "Вид бронирований" })[0]!
    expect(viewTabs).toHaveAttribute("data-variant", "default")
    for (const label of ["Agenda", "Scheduler", "Таблица"]) {
      const tab = within(viewTabs).getByRole("tab", { name: label })
      expect(tab).toHaveTextContent("")
    }
  })

  it("keeps Agenda resource headers distinct, compact and free of capacity counters", async () => {
    const { container } = renderBookings()
    await screen.findByRole("region", { name: /Agenda/ })

    expect(screen.queryByText(/занято \d+ \/ \d+/i)).not.toBeInTheDocument()
    const resourceHeader = container.querySelector<HTMLElement>('[data-slot="agenda-resource-header"]')
    const operationRow = container.querySelector<HTMLElement>('[data-slot="agenda-operation-row"]')
    expect(resourceHeader).toHaveClass("bg-muted/45", "min-w-0")
    expect(resourceHeader?.querySelector("h2")).toHaveClass("truncate", "font-medium")
    expect(operationRow).not.toHaveClass("min-h-16")
    expect(operationRow?.lastElementChild).toHaveClass("py-2")
  })

  it("opens the generated Calendar and renders the shared sortable table without raw red fields", async () => {
    const user = userEvent.setup()
    const { container } = renderBookings()
    await screen.findByRole("region", { name: /Agenda/ })
    await user.click(screen.getAllByRole("button", { name: "Дата бронирований" })[0]!)
    expect(container.ownerDocument.querySelector('[data-slot="calendar"]')).toBeInTheDocument()
    await user.keyboard("{Escape}")

    await user.click(screen.getAllByRole("tab", { name: "Таблица" })[0]!)
    const table = await screen.findByRole("table")
    expect(table.closest('[data-slot="data-table-shell"]')).toBeInTheDocument()
    await user.click(within(table).getByRole("button", { name: "Клиент" }))
    expect(within(table).getByRole("columnheader", { name: /Клиент/ })).toHaveAttribute("aria-sort", "ascending")
    expect(table.querySelector('[class*="bg-red"], [class*="text-red"]')).not.toBeInTheDocument()
  })
})

describe("VerticalScheduler", () => {
  it("keeps an explicitly selected mobile-compatible scheduler with Y geometry and separate preparation", async () => {
    const { container } = renderBookings("/bookings?view=scheduler")
    const scheduler = await screen.findByTestId("vertical-scheduler")
    expect(scheduler).toHaveAttribute("data-orientation", "vertical")
    expect(screen.queryByRole("region", { name: /Мобильная agenda/ })).not.toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Изменить начало бронирования/ }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Изменить окончание бронирования/ }).length).toBeGreaterThan(0)
    expect(container.querySelector('[data-slot="preparation-block"]')).toBeInTheDocument()
    expect(container.querySelectorAll("[data-day]")).toHaveLength(5)
    expect(screen.queryByRole("button", { name: /\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0431\u043e\u043b\u0435\u0435 (\u0440\u0430\u043d\u043d\u0438\u0439|\u043f\u043e\u0437\u0434\u043d\u0438\u0439) \u0434\u0435\u043d\u044c/ })).not.toBeInTheDocument()
    expect(screen.queryByText(/\u0437\u0430\u043d\u044f\u0442\u043e \d+ \/ \d+/i)).not.toBeInTheDocument()
    expect(container.querySelector('[data-resource-lane]')).toHaveStyle({ height: "768px" })
    expect(container.querySelector('[data-slot="scheduler-booking-block"]')?.parentElement).toHaveStyle({ top: "48px" })
    expect(container.querySelector('[data-slot="scheduler-booking-actions"]')).toBeInTheDocument()

    const categoryTabs = screen.getByRole("tablist", { name: "Категория ресурсов" })
    const resourceSelect = within(categoryTabs.parentElement!.parentElement!).getByRole("combobox", { name: "Ресурс scheduler" })
    expect(resourceSelect).toHaveClass("bg-background", "min-w-0")
    expect(within(scheduler).queryByRole("combobox", { name: "Ресурс scheduler" })).not.toBeInTheDocument()

    const selectedDivider = container.querySelector<HTMLElement>('[data-day-divider="true"][data-selected="true"]')
    const otherDivider = container.querySelector<HTMLElement>('[data-day-divider="true"]:not([data-selected])')
    expect(selectedDivider).toHaveClass("bg-muted", "text-foreground")
    expect(otherDivider).toHaveClass("bg-muted", "text-foreground")
    expect(within(selectedDivider!).getByText("выбранный день")).toHaveClass("bg-info-subtle")

    const action = screen.getByRole("button", { name: "Изменить бронь #2048" })
    expect(action).toHaveClass("bg-transparent", "text-current", "shadow-none")
    expect(action).not.toHaveClass("bg-background/85")
    expect(screen.getByRole("button", { name: "Изменить начало бронирования #2048" }).firstElementChild).toHaveClass("bg-current/70")
  })

  it("keeps resource create slots on a day without bookings", async () => {
    renderBookings("/bookings?view=scheduler&date=2026-09-10")
    await screen.findByTestId("vertical-scheduler")
    expect(screen.queryByText("\u0411\u0440\u043e\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0439 \u043d\u0435\u0442")).not.toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0431\u0440\u043e\u043d\u044c:/ }).length).toBeGreaterThan(0)
  })

  it("provides keyboard/touch exact editing and preserves the one-time rollback", async () => {
    const user = userEvent.setup()
    renderBookings("/bookings?view=scheduler")
    await screen.findByTestId("vertical-scheduler")
    await user.click(screen.getByRole("button", { name: "Изменить бронь #2051" }))
    await user.click(await screen.findByRole("menuitem", { name: "Время и ресурс" }))
    expect(await screen.findByRole("dialog")).toHaveTextContent(/Начало|Изменить бронь/)
    expect(screen.getByRole("combobox", { name: "Начало" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Окончание" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Ресурс" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Отмена" }))

    await user.click(screen.getByRole("button", { name: "Изменить бронь #2051" }))
    await user.click(await screen.findByRole("menuitem", { name: "Позже" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/прежний интервал восстановлен/iu)
  })

  it("implements DnD from delta.y with top/height preview and blocks invalid commits", () => {
    const source = readFileSync("src/components/bookings/vertical-scheduler.tsx", "utf8")
    expect(source).toContain("calculate(delta.y)")
    expect(source).toContain("const style: CSSProperties = { height, top }")
    expect(source).toContain("data-preview-invalid")
    expect(source).toContain("if (!next.valid)")
    expect(source).toContain('data-raw-control="resize-hitzone"')
    expect(source).toContain("data-preparation-preview")
  })
})

describe("SchedulerBookingBlock tones", () => {
  it("uses the same semantic surface as its status badge for every tone", () => {
    const toneClasses: Record<SchedulerBookingTone, string> = {
      confirmed: "bg-info-subtle",
      conflict: "bg-danger-subtle",
      neutral: "bg-muted",
      paid: "bg-success-subtle",
      pending: "bg-warning-subtle",
    }
    const { container } = render(
      <TooltipProvider>
        {Object.entries(toneClasses).map(([tone]) => (
          <SchedulerBookingBlock key={tone} onClick={() => undefined} statusLabel={tone} title={tone} tone={tone as SchedulerBookingTone} />
        ))}
      </TooltipProvider>,
    )

    for (const [tone, toneClass] of Object.entries(toneClasses)) {
      const block = container.querySelector<HTMLElement>(`[data-slot="scheduler-booking-block"][data-tone="${tone}"]`)!
      expect(block.querySelector('button[aria-label]') ?? block.querySelector("button")).toHaveClass(toneClass)
      expect(block.querySelector('[data-slot="badge"]')).toHaveClass(toneClass)
    }
  })
})
