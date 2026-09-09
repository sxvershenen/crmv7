import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { FixtureProgramsRepository } from "@app/data/programs-repository"

import { ProgramTemplateEditorPage } from "./program-template-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/programs/forest-family", repository = new FixtureProgramsRepository()) { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><ProgramTemplateEditorPage repository={repository} /><LocationProbe /></>} path="programs/:id" /></Routes></TooltipProvider></MemoryRouter>) }

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

  it("prepares the commercial dossier without losing unsaved operational fields", async () => {
    const user = userEvent.setup()
    renderEditor()
    const name = await screen.findByLabelText("Название")
    await user.clear(name)
    await user.type(name, "Несохранённая программа")
    await user.click(screen.getByRole("tab", { name: "Продажи и цены" }))
    await user.click(await screen.findByRole("button", { name: "Подготовить продажи и CMS-страницу" }))

    expect(await screen.findByText("Нужен активный тариф")).toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Публикация программы" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Основное" }))
    expect(screen.getByLabelText("Название")).toHaveValue("Несохранённая программа")
    expect(screen.queryByLabelText("Legacy стоимость")).not.toBeInTheDocument()
    expect(screen.getByText(/Legacy стоимость сохранена только для совместимости/)).toBeInTheDocument()
  })

  it("creates and activates an explicit participant tariff, then shows a non-acceptance quote", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByDisplayValue("Семейный день в лесу")
    await user.click(screen.getByRole("tab", { name: "Продажи и цены" }))
    await user.click(await screen.findByRole("button", { name: "Подготовить продажи и CMS-страницу" }))

    const amount = await screen.findByLabelText("Цена за участника, ₽")
    await user.clear(amount)
    await user.type(amount, "1500")
    await user.click(screen.getByRole("button", { name: "Создать черновик тарифа" }))
    await user.click(await screen.findByRole("button", { name: "Активировать тариф" }))
    await user.click(await screen.findByRole("button", { name: "Рассчитать" }))

    expect(await screen.findByText("Не для подтверждения")).toBeInTheDocument()
    expect(screen.getByLabelText("Результат пробного расчёта")).toHaveTextContent(/₽/)
    expect(screen.getByText(/не цена регистрации и не резерв мест/i)).toBeInTheDocument()
    await user.clear(screen.getByLabelText("Участники"))
    await user.type(screen.getByLabelText("Участники"), "6")
    expect(screen.queryByLabelText("Результат пробного расчёта")).not.toBeInTheDocument()
  })

  it("fails closed when the current offering state cannot be read", async () => {
    const repository = new FixtureProgramsRepository()
    vi.spyOn(repository, "resolveProgramOffering").mockRejectedValue(new Error("API недоступен"))
    renderEditor("/programs/forest-family?tab=commercial", repository)

    expect(await screen.findByText("Состояние предложения не подтверждено")).toBeInTheDocument()
    expect(screen.getByText("API недоступен")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Подготовить продажи и CMS-страницу" })).not.toBeInTheDocument()
  })
})
