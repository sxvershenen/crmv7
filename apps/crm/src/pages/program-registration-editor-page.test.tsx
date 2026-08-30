import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { FixtureProgramsRepository } from "@app/data/programs-repository"

import { ProgramRegistrationEditorPage } from "./program-registration-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/programs/registrations/5012") { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><ProgramRegistrationEditorPage repository={new FixtureProgramsRepository()} /><LocationProbe /></>} path="programs/registrations/:id" /><Route element={<LocationProbe />} path="programs/runs/:id" /></Routes></TooltipProvider></MemoryRouter>) }

describe("ProgramRegistrationEditorPage", () => {
  it("uses shared editor chrome and an operational sidebar without duplicate status", async () => {
    const user = userEvent.setup()
    renderEditor()

    expect(await screen.findByRole("combobox", { name: "Клиент регистрации" })).toHaveTextContent("Анна Ковалёва")
    expect(document.querySelector('[data-slot="editor-frame"]')).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Статус регистрации" })).toHaveTextContent("Оплачена")
    expect(document.querySelector('[data-slot="editor-sidebar"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-sidebar"]')).not.toHaveTextContent(/^Статус$/)
    expect(screen.getByRole("tab", { name: "Участники" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Оплата" })).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Оплата" }))
    expect(screen.getAllByRole("progressbar", { name: /12.*600/ }).length).toBeGreaterThan(0)
  })

  it("tracks edits, saves and keeps participants in the main tab", async () => {
    const user = userEvent.setup()
    renderEditor()
    const phone = await screen.findByLabelText("Телефон")
    await user.clear(phone)
    await user.type(phone, "+7 900 222-33-44")
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Участники" }))
    expect(screen.getByText("Состав группы")).toBeInTheDocument()
    expect(screen.getByLabelText("Количество участников")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
  })

  it("adds and refunds a payment without forcing a status transition", async () => {
    const user = userEvent.setup()
    renderEditor("/programs/registrations/5011?tab=payment")
    await screen.findByText("Операции оплаты")
    await user.type(screen.getByLabelText("Сумма"), "1000")
    await user.click(screen.getByRole("button", { name: "Добавить оплату" }))

    expect(screen.getAllByRole("progressbar", { name: /3.*800.*5.*600/ }).length).toBeGreaterThan(0)
    expect(screen.getByRole("combobox", { name: "Статус регистрации" })).toHaveTextContent("Подтверждена")
    await user.click(screen.getByRole("button", { name: /Оформить возврат 1.*000/ }))
    expect(screen.getAllByRole("progressbar", { name: /2.*800.*5.*600/ }).length).toBeGreaterThan(0)
  })

  it("adds internal comments through the shared thread", async () => {
    const user = userEvent.setup()
    renderEditor("/programs/registrations/5012?tab=communications")
    await screen.findByText("Добавить коммуникацию")
    await user.type(screen.getByLabelText("Содержание коммуникации"), "Уточнить питание ребёнка")
    await user.click(screen.getByRole("button", { name: "Отправить" }))
    expect(screen.getByText("Уточнить питание ребёнка")).toBeInTheDocument()
  })

  it("creates a draft registration for a requested run", async () => {
    renderEditor("/programs/registrations/new?run=25081")
    expect(await screen.findByRole("combobox", { name: "Клиент регистрации" })).toHaveTextContent("Новый клиент")
    expect(screen.getByRole("combobox", { name: "Проведение программы" })).toHaveTextContent("Глиняная лаборатория")
    expect(screen.getByRole("combobox", { name: "Статус регистрации" })).toHaveTextContent("Новая")
  })
})
