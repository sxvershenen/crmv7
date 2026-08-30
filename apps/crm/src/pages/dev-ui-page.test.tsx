import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { DevUiPage } from "./dev-ui-page"

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class {
    disconnect() {}
    observe() {}
    unobserve() {}
  })
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

function renderDevUi() {
  return render(
    <TooltipProvider>
      <DevUiPage />
    </TooltipProvider>,
  )
}

describe("DevUiPage", () => {
  it("shows the refined editor and scheduler states", () => {
    renderDevUi()

    expect(screen.getAllByText("Есть изменения")).not.toHaveLength(0)
    expect(screen.getByText("Запись изменил другой сотрудник")).toBeVisible()
    expect(screen.getByText("Ожидает подтверждения")).toBeVisible()
    expect(screen.getAllByText("Оплачено", { selector: "span" })).not.toHaveLength(0)
    expect(document.querySelector('[data-payment-state="unpaid"]')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-payment-state="partial"]')).toHaveLength(3)
    expect(document.querySelector('[data-payment-state="full"]')).toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: /^оплачено 5\s*000.*из 100/iu })).toHaveAttribute("aria-valuenow", "5000")
    expect(screen.getByRole("progressbar", { name: /^оплачено 95\s*000.*из 100/iu })).toHaveAttribute("aria-valuenow", "95000")
    expect(document.querySelector('[data-slot="page-frame"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="data-table-shell"]')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="scheduler-booking-block"]')).toHaveLength(4)
    expect(document.querySelectorAll('[data-slot="preparation-block"]')).toHaveLength(4)
  })

  it("keeps the editor back control icon-only and functional", async () => {
    const user = userEvent.setup()
    renderDevUi()

    const back = screen.getByRole("button", { name: "Назад" })
    expect(back).toHaveTextContent("")

    await user.click(back)

    expect(screen.getByText("Возврат в предыдущий контекст")).toBeVisible()
  })

  it("gives active scheduler cards a real demo action", async () => {
    const user = userEvent.setup()
    renderDevUi()

    await user.click(screen.getByRole("button", { name: /открыть бронь #1052/iu }))

    expect(screen.getByText("Открыта ожидающая бронь #1052")).toBeVisible()
  })

  it("uses controlled shared navigation components", async () => {
    const user = userEvent.setup()
    renderDevUi()

    await user.click(screen.getByRole("tab", { name: /Дома/iu }))
    expect(screen.getByText("Выбран раздел: houses")).toBeVisible()

    await user.click(screen.getByRole("tab", { name: "Таблица" }))
    expect(screen.getByRole("tab", { name: "Таблица" })).toHaveAttribute("data-active")
  })
})
