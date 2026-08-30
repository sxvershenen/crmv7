import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { FixtureTaskRepository } from "@app/data/tasks-repository"

import { TaskEditorPage } from "./task-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(
  entry = "/tasks/T-184",
  repository = new FixtureTaskRepository(),
) { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><TaskEditorPage repository={repository} /><LocationProbe /></>} path="tasks/:id" /></Routes></TooltipProvider></MemoryRouter>) }

describe("TaskEditorPage", () => {
  it("uses shared editor fields and exposes task quick actions", async () => {
    renderEditor()
    expect(await screen.findByDisplayValue("Уточнить финальный состав гостей")).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="editor-section"]')).toHaveLength(2)
    expect(screen.getByRole("combobox", { name: "Приоритет задачи" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Завершить задачу" })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Сменить исполнителя задачи/ }).length).toBeGreaterThan(0)
  })

  it("tracks quick changes, saves and keeps related tabs in URL", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByDisplayValue("Уточнить финальный состав гостей")
    await user.click(screen.getByRole("button", { name: "Перенести задачу на завтра" }))
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Связи" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=relations")
    expect(screen.getByLabelText("Название связанной записи")).toBeInTheDocument()
  })

  it("supports task creation route", async () => {
    renderEditor("/tasks/new")
    expect(await screen.findByDisplayValue("Новая задача")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Приоритет задачи" })).toHaveTextContent("Обычный")
  })

  it("blocks saving and explains a missing title", async () => {
    const user = userEvent.setup()
    const repository = new FixtureTaskRepository()
    const save = vi.spyOn(repository, "save")
    renderEditor("/tasks/T-184", repository)
    const title = await screen.findByDisplayValue("Уточнить финальный состав гостей")

    await user.clear(title)
    await user.type(title, "   ")
    await user.click(screen.getByRole("button", { name: "Сохранить" }))

    expect(await screen.findByText("Укажите название задачи")).toBeInTheDocument()
    expect(title).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })
})
