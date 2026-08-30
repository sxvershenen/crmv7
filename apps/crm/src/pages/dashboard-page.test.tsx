import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { TooltipProvider } from "@crm/ui"

import { fixtureDashboardRepository } from "@app/data/dashboard-repository"
import { DashboardPage } from "./dashboard-page"

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TooltipProvider>
          <DashboardPage repository={fixtureDashboardRepository} />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe("DashboardPage", () => {
  it("renders Today before Attention in document order for mobile accessibility", async () => {
    renderDashboard()

    const today = await screen.findByRole("heading", { name: "Сегодня" })
    const attention = screen.getByRole("heading", { name: "Внимание" })

    expect(today.compareDocumentPosition(attention) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("supports the URL-backed mine filter", async () => {
    const user = userEvent.setup()
    renderDashboard()

    const scope = screen.getByRole("combobox", { name: "Область обзора" })
    expect(scope).toHaveClass("bg-background", "font-normal")
    await user.click(scope)
    await user.click(await screen.findByRole("option", { name: "Мои" }))

    expect(scope).toHaveTextContent("Мои")
  })

  it("shows booked objects directly and keeps lead intent calm", async () => {
    renderDashboard()

    expect(await screen.findByText("Время парилки пересекается с другой бронью")).toHaveClass("text-xs", "font-normal")
    expect(screen.getByText("Нужна проверка интервала и подготовки")).toHaveClass("text-[10px]", "leading-[14px]", "font-normal")
    expect(await screen.findAllByText("Дом «Берёза»")).not.toHaveLength(0)
    expect(screen.queryByText(/бронировали/iu)).not.toBeInTheDocument()
    expect(screen.queryByText("Участники:", { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText("Мероприятие:", { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText("Программа:", { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText("Мероприятие", { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText("Программа", { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText("Хотят:", { exact: true })).not.toBeInTheDocument()
    const people = screen.getByLabelText("5 человек")
    expect(people).toBeVisible()
    expect(people.previousElementSibling).toHaveTextContent("·")
    expect(screen.queryByText(/гост/iu)).not.toBeInTheDocument()
  })

  it("renders compact accessible payment progress", async () => {
    renderDashboard()

    const progress = await screen.findAllByRole("progressbar", { name: /оплачено.*12.*из.*28/iu })

    expect(progress).toHaveLength(1)
    expect(progress[0]).toHaveAttribute("aria-valuenow", "12000")
    expect(progress[0]).toHaveAttribute("aria-valuemax", "28000")
    expect(progress[0]).toHaveClass("text-[10px]", "font-normal")
    expect(progress[0]).toHaveClass("gap-0")
    expect(progress[0]?.querySelector('[data-slot="progress-track"]')).toHaveClass("bg-muted")
    expect(progress[0]?.querySelector('[data-slot="progress-indicator"]')).toHaveClass("bg-primary")
    expect(screen.queryByText(/осталось/iu)).not.toBeInTheDocument()
  })
})
