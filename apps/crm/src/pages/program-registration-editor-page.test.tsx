import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { FixtureProgramsRepository, type ProgramRegistrationEditorRepository } from "@app/data/programs-repository"

import { ProgramRegistrationEditorPage } from "./program-registration-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/programs/registrations/5012", repository: ProgramRegistrationEditorRepository = new FixtureProgramsRepository()) { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><ProgramRegistrationEditorPage repository={repository} /><LocationProbe /></>} path="programs/registrations/:id" /><Route element={<LocationProbe />} path="programs/runs/:id" /></Routes></TooltipProvider></MemoryRouter>) }

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
    await user.click(screen.getByRole("button", { name: "Сохранить черновик" }))
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

  it("keeps priced registration server-owned and confirms only a current saved quote", async () => {
    const user = userEvent.setup()
    const repository = new FixtureProgramsRepository()
    const originalGet = repository.getRegistration.bind(repository)
    vi.spyOn(repository, "getRegistration").mockImplementation(async (id) => {
      const record = await originalGet(id)
      return record ? {
        ...record,
        status: "new",
        participantCount: 2,
        paid: 0,
        debt: 0,
        total: 0,
        pricingMode: "quote_required",
        availableAddOns: [{ assignmentId: "assignment-breakfast", label: "Завтрак", serviceType: "person_service", required: false, minQuantity: 1, maxQuantity: 10, defaultQuantity: 1 }],
      } : null
    })
    const quoteSpy = vi.spyOn(repository, "quoteRegistration")
    const confirmSpy = vi.spyOn(repository, "confirmRegistration")
    renderEditor("/programs/registrations/5011?tab=payment", repository)

    await screen.findByText("Цену фиксирует серверный расчёт")
    expect(screen.queryByLabelText("Стоимость")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Скидка, %")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Подтвердить по расчёту" })).toBeDisabled()

    await user.clear(screen.getByLabelText("Завтрак"))
    await user.type(screen.getByLabelText("Завтрак"), "2")
    await user.click(screen.getByRole("button", { name: "Рассчитать" }))
    expect(await screen.findByText("Рассчитанная стоимость")).toBeInTheDocument()
    expect(quoteSpy).toHaveBeenCalledWith(expect.objectContaining({ id: "5011", participantCount: 2 }), [{ assignmentId: "assignment-breakfast", quantity: 2 }])
    expect(screen.getByRole("button", { name: "Подтвердить по расчёту" })).toBeEnabled()

    await user.clear(screen.getByLabelText("Завтрак"))
    await user.type(screen.getByLabelText("Завтрак"), "3")
    expect(screen.getByText(/Расчёт устарел/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Подтвердить по расчёту" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Пересчитать" }))
    await user.click(screen.getByRole("button", { name: "Подтвердить по расчёту" }))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(await screen.findByText("Принятая стоимость")).toBeInTheDocument()
  })

  it("renders an accepted quote snapshot as immutable after load", async () => {
    const repository = new FixtureProgramsRepository()
    const originalGet = repository.getRegistration.bind(repository)
    vi.spyOn(repository, "getRegistration").mockImplementation(async (id) => {
      const record = await originalGet(id)
      return record ? {
        ...record,
        pricingMode: "quote_required",
        acceptedQuote: { quoteId: "accepted-1", acceptedAt: "2026-09-09T10:00:00.000Z", total: 6400, currency: "RUB", addOns: [{ assignmentId: "private-id", quantity: 2 }], lines: [{ kind: "base", label: "Участники", quantity: 2, amount: 5000 }, { kind: "addon", label: "Завтрак", quantity: 2, amount: 1400 }] },
        availableAddOns: [{ assignmentId: "private-id", label: "Завтрак", serviceType: "person_service", required: false, minQuantity: 1, maxQuantity: 10, defaultQuantity: 1 }],
      } : null
    })
    renderEditor("/programs/registrations/5011?tab=payment", repository)
    expect(await screen.findByText("Принятая стоимость")).toBeInTheDocument()
    expect(screen.getByText("Завтрак × 2")).toBeInTheDocument()
    expect(screen.queryByLabelText("Завтрак")).not.toBeInTheDocument()
    expect(document.body).not.toHaveTextContent("private-id")
    await userEvent.click(screen.getByRole("tab", { name: "Участники" }))
    expect(screen.getByLabelText("Количество участников")).toBeDisabled()
  })
})
