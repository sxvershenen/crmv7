import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { FixtureCustomerRepository } from "@app/data/customers-repository"

import { CustomerEditorPage } from "./customer-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/customers/1042") { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><CustomerEditorPage repository={new FixtureCustomerRepository()} /><LocationProbe /></>} path="customers/:id" /></Routes></TooltipProvider></MemoryRouter>) }

describe("CustomerEditorPage", () => {
  it("uses the shared editor sections and editable form controls", async () => {
    renderEditor()
    expect(await screen.findByDisplayValue("Анна Ковалёва")).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-frame"]')).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="editor-section"]')).toHaveLength(2)
    expect(screen.getByRole("combobox", { name: "Тип клиента" })).toBeInTheDocument()
    expect(screen.getByText("Операционная сводка")).toBeInTheDocument()
  })

  it("tracks dirty/save state and keeps tabs in the URL", async () => {
    const user = userEvent.setup()
    renderEditor()
    const name = await screen.findByLabelText("Имя или название")
    await user.clear(name)
    await user.type(name, "Анна Ковалёва — обновлено")
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Оплаты" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=payments")
    expect(screen.getByText("Финансовая сводка")).toBeInTheDocument()
  })

  it("supports the new-customer route", async () => {
    renderEditor("/customers/new")
    expect(await screen.findByDisplayValue("Новый клиент")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
  })

  it("keeps risk and debt visible while mobile summary details are collapsible", async () => {
    const user = userEvent.setup()
    renderEditor("/customers/1037")
    expect(await screen.findByText("Возможный дубль")).toBeInTheDocument()
    expect(screen.getByText(/126\s*000\s*₽/)).toBeInTheDocument()
    const disclosure = screen.getByRole("button", { name: "Показать детали · 3" })
    expect(disclosure).toHaveAttribute("aria-expanded", "false")
    await user.click(disclosure)
    expect(disclosure).toHaveAttribute("aria-expanded", "true")
  })
})
