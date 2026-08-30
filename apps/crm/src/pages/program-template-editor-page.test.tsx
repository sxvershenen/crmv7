import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { FixtureProgramsRepository } from "@app/data/programs-repository"

import { ProgramTemplateEditorPage } from "./program-template-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/programs/forest-family") { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><ProgramTemplateEditorPage repository={new FixtureProgramsRepository()} /><LocationProbe /></>} path="programs/:id" /></Routes></TooltipProvider></MemoryRouter>) }

describe("ProgramTemplateEditorPage", () => {
  it("uses shared editor chrome, editable identity and an operational sidebar", async () => {
    renderEditor()

    expect(await screen.findByDisplayValue("Семейный день в лесу")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-frame"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-sidebar"]')).toBeInTheDocument()
    expect(screen.getByText("Операционная сводка")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Иконка программы" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Цвет программы" })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-sidebar"]')).not.toHaveTextContent(/^Статус$/)
  })

  it("tracks dirty and saved states", async () => {
    const user = userEvent.setup()
    renderEditor()
    const name = await screen.findByLabelText("Название")
    await user.clear(name)
    await user.type(name, "Семейный день — обновлён")
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
  })

  it("adds, duplicates and reorders stages on the URL-backed content tab", async () => {
    const user = userEvent.setup()
    renderEditor("/programs/forest-family?tab=content")
    await screen.findByText("Быстрое добавление этапа")

    await user.type(screen.getByLabelText("Название этапа"), "Знакомство")
    await user.type(screen.getByLabelText("Длительность, минут"), "15")
    await user.click(screen.getByRole("button", { name: "Добавить этап" }))
    await user.click(screen.getByRole("button", { name: "Дублировать этап 4" }))
    expect(screen.getByLabelText("Название этапа 5")).toHaveValue("Знакомство — копия")
    await user.click(screen.getByRole("button", { name: "Поднять этап 5" }))
    expect(screen.getByLabelText("Название этапа 4")).toHaveValue("Знакомство — копия")
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=content")
  })

  it("shows related runs and supports the new template route", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByDisplayValue("Семейный день в лесу")
    await user.click(screen.getByRole("tab", { name: "Проведения" }))
    expect(screen.getAllByText(/Семейный день в лесу/).length).toBeGreaterThan(0)
  })

  it("creates a draft template through the same route", async () => {
    renderEditor("/programs/new")
    expect(await screen.findByDisplayValue("Новая программа")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Публикация программы" })).toHaveTextContent("Черновик")
  })
})
