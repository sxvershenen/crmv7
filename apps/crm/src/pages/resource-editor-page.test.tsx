import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { FixtureResourceRepository, type ResourceEditorRepository } from "@app/data/resources-repository"

import { ResourceEditorPage } from "./resource-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/resources/houses/house-pine") { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><ResourceEditorPage repository={new FixtureResourceRepository()} /><LocationProbe /></>} path="resources/:kind/:resourceId" /></Routes></TooltipProvider></MemoryRouter>) }

describe("ResourceEditorPage", () => {
  it("uses the shared editor chrome and editable resource fields", async () => {
    renderEditor()

    expect(await screen.findByDisplayValue("Дом «Сосна»")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-frame"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-sidebar"]')).toBeInTheDocument()
    expect(screen.getByText("Операционная сводка")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Иконка ресурса" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Цвет ресурса" })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-sidebar"]')).not.toHaveTextContent(/^Статус$/)
  })

  it("tracks dirty and saved states", async () => {
    const user = userEvent.setup()
    renderEditor()
    const name = await screen.findByLabelText("Название")
    await user.clear(name)
    await user.type(name, "Дом «Сосна» — обновлён")
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
  })

  it("creates and cancels a block on the URL-backed tab", async () => {
    const user = userEvent.setup()
    renderEditor("/resources/houses/house-pine?tab=blocks")
    await screen.findByText("Новая блокировка")
    fireEvent.change(screen.getByLabelText("С даты"), { target: { value: "2026-09-01T10:00" } })
    fireEvent.change(screen.getByLabelText("По дату"), { target: { value: "2026-09-01T14:00" } })
    await user.type(screen.getByLabelText("Причина"), "Техническое окно")
    await user.click(screen.getByRole("button", { name: "Добавить блокировку" }))
    expect(screen.getByText("Техническое окно")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Отменить блокировку: Техническое окно" }))
    expect(screen.getAllByText("Отменена").length).toBeGreaterThan(0)
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=blocks")
  })

  it("edits rules and supports a new venue with its specific field", async () => {
    const user = userEvent.setup()
    renderEditor("/resources/venues/new?tab=rules")
    expect(await screen.findByText("Длительность и шаг")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Шаг бронирования, мин"), "30")
    await user.click(screen.getByText("Пн"))
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Основное" }))
    expect(screen.getByRole("combobox", { name: "Тип пространства" })).toBeInTheDocument()
  })

  it("disables resource saving when the record does not grant canEdit", async () => {
    const source = new FixtureResourceRepository()
    const repository: ResourceEditorRepository = {
      get: async (id) => {
        const resource = await source.get(id)
        return resource ? { ...resource, permissions: { ...resource.permissions, canEdit: false } } : null
      },
      save: vi.fn(async (resource) => resource),
    }
    render(<MemoryRouter initialEntries={["/resources/houses/house-pine"]}><TooltipProvider><Routes><Route element={<ResourceEditorPage repository={repository} />} path="resources/:kind/:resourceId" /></Routes></TooltipProvider></MemoryRouter>)

    expect(await screen.findByDisplayValue("Дом «Сосна»")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled()
    expect(screen.getByText(/нет прав на изменение этого ресурса/i)).toBeInTheDocument()
  })

  it("disables block creation and cancellation when canManageBlocks is false", async () => {
    const source = new FixtureResourceRepository()
    const repository: ResourceEditorRepository = {
      get: async (id) => {
        const resource = await source.get(id)
        return resource ? { ...resource, permissions: { ...resource.permissions, canManageBlocks: false } } : null
      },
      save: vi.fn(async (resource) => resource),
    }
    render(<MemoryRouter initialEntries={["/resources/houses/house-lake?tab=blocks"]}><TooltipProvider><Routes><Route element={<ResourceEditorPage repository={repository} />} path="resources/:kind/:resourceId" /></Routes></TooltipProvider></MemoryRouter>)

    await screen.findByText("Новая блокировка")
    expect(screen.getByRole("button", { name: "Добавить блокировку" })).toBeDisabled()
    expect(screen.getByRole("button", { name: /Отменить блокировку: Плановое техническое обслуживание/ })).toBeDisabled()
    expect(screen.getByText(/нет прав на управление блокировками/i)).toBeInTheDocument()
  })
})
