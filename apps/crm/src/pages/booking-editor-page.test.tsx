import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { FixtureBookingRepository } from "@app/data/bookings-repository"

import { BookingEditorPage } from "./booking-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/bookings/2048") { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><BookingEditorPage repository={new FixtureBookingRepository()} /><LocationProbe /></>} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter>) }

describe("BookingEditorPage", () => {
  it("uses the shared editor chrome, editable fields and payment sidebar", async () => {
    renderEditor()

    expect(await screen.findByRole("combobox", { name: "Клиент бронирования" })).toHaveTextContent("Анна Смирнова")
    expect(document.querySelector('[data-slot="editor-frame"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-sidebar"]')).toBeInTheDocument()
    expect(screen.getByText("Операционная сводка")).toBeInTheDocument()
    expect(screen.getByText("Оплата")).toBeInTheDocument()
    expect(screen.getAllByText(/14\s*000\s*₽/).length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('[data-slot="editor-sidebar"]')).not.toHaveTextContent(/^Статус$/)
  })

  it("tracks comments, payments and saved state", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByRole("combobox", { name: "Клиент бронирования" })

    await user.type(screen.getByLabelText("Новый комментарий"), "Проверить поздний заезд")
    await user.click(screen.getByRole("button", { name: "Отправить комментарий" }))
    expect(screen.getByText("Проверить поздний заезд")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Сумма"), "3000")
    await user.click(screen.getByRole("button", { name: "Добавить оплату" }))
    expect(screen.getByText(/3\s*000\s*₽/)).toBeInTheDocument()
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
  })

  it("keeps composition in the URL and supports position actions", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByRole("combobox", { name: "Клиент бронирования" })

    await user.click(screen.getByRole("tab", { name: "Состав" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=composition")
    expect(screen.getByText("Позиция 1")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Дублировать позицию 1" }))
    expect(screen.getByText("Позиция 2")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Добавить сверху" }))
    expect(screen.getByText("Позиция 3")).toBeInTheDocument()
  })

  it("uses scheduler presets for a new booking", async () => {
    renderEditor("/bookings/new?date=2026-09-10&resource=tent-meadow&start=16")

    expect(await screen.findByRole("combobox", { name: "Клиент бронирования" })).toHaveTextContent("Новый клиент")
    const user = userEvent.setup()
    await user.click(screen.getByRole("tab", { name: "Состав" }))
    expect(screen.getByRole("combobox", { name: "Ресурс позиции 1" })).toHaveTextContent("Палаточное место «Луг»")
    expect(screen.getByLabelText("Начало позиции 1: время")).toHaveValue("16:00")
  })

  it("links a lead through search by phone and keeps a typed relation", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByRole("combobox", { name: "Клиент бронирования" })

    await user.click(screen.getAllByRole("button", { name: "Найти и связать заявку" })[0]!)
    await user.type(screen.getByPlaceholderText("#ID, телефон или имя…"), "9211077763")
    await user.click(screen.getByText("Заявка #1279 · Сергей Лебедев"))

    expect(screen.getAllByText("Заявка #1279 · Сергей Лебедев").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
  })
})
