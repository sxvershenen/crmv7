import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"
import { FixtureLeadRepository } from "@app/data/leads-repository"
import { FixtureDirectoryRepository } from "@app/data/directory-repository"
import { DirectoryRepositoryProvider } from "@app/features/use-directory-data"
import { LeadEditorPage } from "./lead-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/leads/1284") { return render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><LeadEditorPage repository={new FixtureLeadRepository()} /><LocationProbe /></>} path="leads/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>) }

describe("LeadEditorPage", () => {
  it("uses route-driven editor chrome with editable fields and operational sidebar", async () => {
    renderEditor()
    expect(await screen.findByRole("combobox", { name: "Клиент заявки" })).toHaveTextContent("Анна Ковалёва")
    expect(document.querySelector('[data-slot="editor-frame"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-sidebar"]')).toBeInTheDocument()
    expect(screen.getByText("Операционная сводка")).toBeInTheDocument()
  })

  it("tracks dirty and saved states and adds a manager comment", async () => {
    const user = userEvent.setup()
    renderEditor()
    const phone = await screen.findByLabelText("Телефон")
    await user.clear(phone)
    await user.type(phone, "+7 900 222-33-44")
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Новый комментарий"), "Уточнить состав гостей")
    await user.click(screen.getByRole("button", { name: "Отправить комментарий" }))
    expect(screen.getByText("Уточнить состав гостей")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
  })

  it("keeps editor tabs in URL and supports the new-lead route", async () => {
    const user = userEvent.setup()
    renderEditor("/leads/new")
    expect(await screen.findByRole("combobox", { name: "Клиент заявки" })).toHaveTextContent("Новый клиент")
    await user.click(screen.getByRole("tab", { name: "Маркетинг" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=marketing")
    expect(screen.getByText("UTM-метки")).toBeInTheDocument()
    expect(screen.getByLabelText("utm_campaign")).toBeInTheDocument()
  })
})
