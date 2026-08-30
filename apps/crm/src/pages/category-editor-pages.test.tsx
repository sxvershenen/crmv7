import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"
import { FixtureEventsRepository } from "@app/data/events-repository"
import { FixtureProgramsRepository } from "@app/data/programs-repository"
import { EventCategoryEditorPage } from "./event-category-editor-page"
import { ProgramCategoryEditorPage } from "./program-category-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderProgram(entry = "/programs/categories/family", repository = new FixtureProgramsRepository()) { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><ProgramCategoryEditorPage repository={repository} /><LocationProbe /></>} path="programs/categories/:id" /><Route element={<LocationProbe />} path="programs/:id" /></Routes></TooltipProvider></MemoryRouter>) }
function renderEvent(entry = "/events/categories/wedding") { const repository = new FixtureEventsRepository(); return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><EventCategoryEditorPage repository={repository} /><LocationProbe /></>} path="events/categories/:id" /><Route element={<LocationProbe />} path="events/:id" /></Routes></TooltipProvider></MemoryRouter>) }

describe("category editor pages", () => {
  it("edits and saves a program category through shared editor chrome", async () => {
    const user = userEvent.setup(); renderProgram()
    const name = await screen.findByLabelText("Название")
    expect(name).toHaveValue("Семейные")
    expect(document.querySelector('[data-slot="editor-actionbar"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-sidebar"]')).not.toHaveTextContent("Статус")
    await user.clear(name); await user.type(name, "Семейный отдых")
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
  })

  it("keeps the program related list in URL and opens a template", async () => {
    const user = userEvent.setup(); renderProgram()
    await screen.findByDisplayValue("Семейные")
    await user.click(screen.getByRole("tab", { name: "Шаблоны" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=related")
    await user.click(screen.getByRole("button", { name: /Семейный день в лесу/ }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("/programs/forest-family")
  })

  it("validates a whitespace-only name before calling the repository", async () => {
    const user = userEvent.setup()
    const repository = new FixtureProgramsRepository()
    const save = vi.spyOn(repository, "saveCategory")
    renderProgram("/programs/categories/family", repository)
    const name = await screen.findByLabelText("Название")

    await user.clear(name)
    await user.type(name, "   ")
    await user.click(screen.getByRole("button", { name: "Сохранить" }))

    expect(await screen.findByText("Укажите название")).toBeInTheDocument()
    expect(name).toHaveAttribute("aria-invalid", "true")
    expect(save).not.toHaveBeenCalled()
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
  })

  it("uses the same category anatomy for events and shows related entities", async () => {
    const user = userEvent.setup(); renderEvent()
    expect(await screen.findByDisplayValue("Свадьба")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Иконка: Категория мероприятий" })).toHaveTextContent("Сердце")
    await user.click(screen.getByRole("tab", { name: "Мероприятия" }))
    expect(screen.getByRole("button", { name: /Свадьба Анны и Михаила/ })).toBeInTheDocument()
  })

  it("creates clean drafts for both category domains", async () => {
    const first = renderProgram("/programs/categories/new")
    expect(await screen.findByDisplayValue("Новая категория")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Цвет: Категория программ" })).toHaveTextContent("Янтарный")
    first.unmount()
    renderEvent("/events/categories/new")
    expect(await screen.findByDisplayValue("Новая категория")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Цвет: Категория мероприятий" })).toHaveTextContent("Розовый")
  })
})
