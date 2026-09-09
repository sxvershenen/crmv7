import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { FixtureProgramsRepository } from "@app/data/programs-repository"
import { FixtureDirectoryRepository } from "@app/data/directory-repository"
import { DirectoryRepositoryProvider } from "@app/features/use-directory-data"

import { ProgramRunEditorPage } from "./program-run-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/programs/runs/24081") { return render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><ProgramRunEditorPage repository={new FixtureProgramsRepository()} /><LocationProbe /></>} path="programs/runs/:id" /><Route element={<LocationProbe />} path="bookings/:id" /><Route element={<LocationProbe />} path="customers/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>) }

describe("ProgramRunEditorPage", () => {
  it("uses shared editor chrome and keeps status out of the operational sidebar", async () => {
    renderEditor()

    expect(await screen.findByDisplayValue("Семейный день в лесу")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-frame"]')).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Статус проведения" })).toHaveTextContent("Идёт регистрация")
    expect(document.querySelector('[data-slot="editor-sidebar"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-sidebar"]')).not.toHaveTextContent(/^Статус$/)
    expect(screen.getByText("17 из 24")).toBeInTheDocument()
  })

  it("tracks changes and persists through the editor repository", async () => {
    const user = userEvent.setup()
    renderEditor()
    const comment = await screen.findByLabelText("Комментарий")
    await user.type(comment, "Подготовить костровую площадку")
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
  })

  it("adds a detailed registration and updates the local operational snapshot", async () => {
    const user = userEvent.setup()
    renderEditor("/programs/runs/24081?tab=registrations")
    await screen.findByText("Новая регистрация")
    await user.click(screen.getByRole("combobox", { name: "Клиент регистрации" }))
    await user.click(await screen.findByRole("option", { name: /Михаил Белов/ }))
    await user.clear(screen.getByLabelText("Участников"))
    await user.type(screen.getByLabelText("Участников"), "2")
    await user.type(screen.getByLabelText("Стоимость"), "8000")
    await user.type(screen.getByLabelText("Оплачено"), "4000")
    await user.click(screen.getByRole("button", { name: "Добавить регистрацию" }))

    expect(screen.getByText("Михаил Белов")).toBeInTheDocument()
    expect(screen.getByText("19 из 24")).toBeInTheDocument()
    expect(screen.getByText("8 из 10")).toBeInTheDocument()
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=registrations")
  })

  it("creates a linked resource booking from the resources tab", async () => {
    const user = userEvent.setup()
    renderEditor("/programs/runs/24081?tab=resources")
    await screen.findByText("Быстрое бронирование ресурса")
    await user.click(screen.getByRole("button", { name: "Добавить бронь" }))
    expect(screen.getAllByText("Дом «Сосна»").length).toBeGreaterThan(0)
    const openBookingButtons = screen.getAllByRole("button", { name: "Открыть бронь Дом «Сосна»" })
    await user.click(openBookingButtons.at(-1)!)
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("/bookings/new?resource=house-pine")
  })

  it("supports a new draft run through the same route", async () => {
    renderEditor("/programs/runs/new")
    expect(await screen.findByDisplayValue("Семейный день в лесу")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Статус проведения" })).toHaveTextContent("Черновик")
  })
})
