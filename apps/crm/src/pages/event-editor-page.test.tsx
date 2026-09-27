import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"
import { FixtureEventsRepository } from "@app/data/events-repository"
import { EventEditorPage } from "./event-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/events/E-3108") { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><EventEditorPage repository={new FixtureEventsRepository()} /><LocationProbe /></>} path="events/:id" /><Route element={<LocationProbe />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter>) }

describe("EventEditorPage", () => {
  it("uses shared editor chrome and keeps status out of the operational sidebar", async () => {
    renderEditor()
    expect(await screen.findByDisplayValue("Свадьба Анны и Михаила")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-frame"]')).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Статус мероприятия" })).toHaveTextContent("Бронь")
    const sidebar = document.querySelector('[data-slot="editor-sidebar"]')!
    expect(sidebar).toHaveTextContent("Операционная сводка")
    expect(sidebar).not.toHaveTextContent("Статус")
    expect(within(sidebar as HTMLElement).getByRole("progressbar", { name: /180.*000.*280.*000/ })).toBeInTheDocument()
  })

  it("tracks edits, preserves them across URL-backed tabs and saves", async () => {
    const user = userEvent.setup(); renderEditor()
    const name = await screen.findByLabelText("Название")
    await user.clear(name); await user.type(name, "Свадьба у озера")
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Ресурсы" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=resources")
    await user.click(screen.getByRole("tab", { name: "Основное" }))
    expect(screen.getByDisplayValue("Свадьба у озера")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
  })

  it("adds a linked resource booking", async () => {
    const user = userEvent.setup(); renderEditor("/events/E-3108?tab=resources")
    await screen.findByText("Новая бронь ресурса")
    await user.click(screen.getByRole("button", { name: "Добавить бронь" }))
    expect(screen.getAllByText("Дом «Сосна»").length).toBeGreaterThan(0)
    expect(screen.getAllByRole("button", { name: /Дом «Сосна»/ }).length).toBeGreaterThan(0)
  })

  it("asks before removing a booked resource", async () => {
    const user = userEvent.setup(); renderEditor("/events/E-3108?tab=resources")
    const remove = (await screen.findAllByRole("button", { name: /Снять бронь/ }))[0]!
    await user.click(remove)
    expect(screen.getByRole("dialog")).toHaveTextContent("техническим администратором")
    await user.click(screen.getByRole("button", { name: "Отмена" }))
    expect(remove).toBeInTheDocument()
    await user.click(remove)
    await user.click(screen.getByRole("button", { name: /^Снять бронь$/ }))
    expect(remove).not.toBeInTheDocument()
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
  })

  it("archives a saved event only after confirmation", async () => {
    const user = userEvent.setup(); const repository = new FixtureEventsRepository()
    render(<MemoryRouter initialEntries={["/events/E-3108"]}><TooltipProvider><Routes><Route element={<EventEditorPage repository={repository} />} path="events/:id" /><Route element={<LocationProbe />} path="events" /></Routes></TooltipProvider></MemoryRouter>)
    await screen.findByDisplayValue("Свадьба Анны и Михаила")
    await user.click(screen.getAllByRole("button", { name: "Дополнительные действия мероприятия" })[0]!)
    await user.click(await screen.findByRole("menuitem", { name: "В архив" }))
    expect(screen.getByRole("dialog")).toHaveTextContent("техническим администратором")
    await user.click(screen.getByRole("button", { name: "Отмена" }))
    expect((await repository.get("E-3108"))?.status).not.toBe("archived")
    await user.click(screen.getAllByRole("button", { name: "Дополнительные действия мероприятия" })[0]!)
    await user.click(await screen.findByRole("menuitem", { name: "В архив" }))
    await user.click(screen.getByRole("button", { name: "Архивировать" }))
    expect(await screen.findByLabelText("Текущий URL")).toHaveTextContent("/events?status=archived")
    expect((await repository.get("E-3108"))?.status).toBe("archived")
  })

  it("builds, duplicates and reorders a scenario through the shared list", async () => {
    const user = userEvent.setup(); renderEditor("/events/E-3108?tab=scenario")
    await screen.findByText("Сценарий мероприятия")
    const name = screen.getByLabelText("Название этапа")
    await user.type(name, "Встреча гостей"); await user.click(screen.getByRole("button", { name: "Добавить этап" }))
    await user.type(name, "Ужин"); await user.click(screen.getByRole("button", { name: "Добавить этап" }))
    await user.click(screen.getByRole("button", { name: "Поднять этап 5" }))
    const rows = screen.getByTestId("event-scenario-list").querySelectorAll("[data-stage-index]")
    expect(within(rows[3] as HTMLElement).getByDisplayValue("Ужин")).toBeInTheDocument()
    await user.click(within(rows[3] as HTMLElement).getByRole("button", { name: "Дублировать этап 4" }))
    expect(screen.getAllByDisplayValue(/Ужин/)).toHaveLength(2)
  })

  it("adds internal comments and creates a draft in a requested category", async () => {
    const user = userEvent.setup(); const view = renderEditor("/events/E-3108?tab=communications")
    await screen.findByText("Добавить коммуникацию")
    await user.type(screen.getByLabelText("Содержание коммуникации"), "Проверить рассадку")
    await user.click(screen.getByRole("button", { name: "Отправить" }))
    expect(screen.getByText("Проверить рассадку")).toBeInTheDocument()
    view.unmount()

    renderEditor("/events/new?category=corporate")
    expect(await screen.findByDisplayValue("Новое мероприятие")).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Категория мероприятия" })).toHaveTextContent("Корпоратив")
  })
})
