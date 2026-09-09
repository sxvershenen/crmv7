import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import type { Promotion } from "@crm/contracts"
import { TooltipProvider } from "@crm/ui"
import { FixtureDirectoryRepository } from "@app/data/directory-repository"
import { DirectoryRepositoryProvider } from "@app/features/use-directory-data"
import { ApiClientError } from "@app/lib/api-client"
import { PromotionEditorPage } from "./promotion-editor-page"

const item: Promotion = { id: "11111111-1111-4111-8111-111111111111", version: 2, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z", terms: { code: "SUMMER", name: "Лето", active: true, discountType: "fixed", value: 150_025, minimumAmountMinor: 50_000, startsAt: null, endsAt: null, scope: "all", resourceIds: [], offeringIds: [] } }
function repository(canManage = true) { return { list: vi.fn().mockResolvedValue({ items: [item], canManage }), get: vi.fn().mockResolvedValue(item), update: vi.fn().mockResolvedValue(item), create: vi.fn().mockResolvedValue(item), report: vi.fn() } }
function renderEditor(gateway = repository(), entry = `/marketing/promotions/${item.id}`) {
  const options = vi.fn().mockResolvedValue([{ value: "22222222-2222-4222-8222-222222222222", label: "Допуслуги · Трансфер" }])
  render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route path="marketing/promotions/:id" element={<PromotionEditorPage offeringOptionsLoader={options} repository={gateway} />} /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)
  return gateway
}

describe("PromotionEditorPage", () => {
  it("creates a normalized percentage promotion and prevents duplicate pending submissions", async () => {
    const gateway = repository()
    gateway.create.mockImplementation(() => new Promise(() => {}))
    renderEditor(gateway, "/marketing/promotions/new")
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText("Название"), "Осенний визит")
    await user.type(screen.getByLabelText("Код"), "autumn")
    fireEvent.change(screen.getByLabelText("Скидка, %"), { target: { value: "15" } })
    await user.dblClick(screen.getByRole("button", { name: "Сохранить" }))
    expect(gateway.create).toHaveBeenCalledTimes(1)
    expect(gateway.create).toHaveBeenCalledWith(expect.objectContaining({ terms: expect.objectContaining({ code: "AUTUMN", discountType: "percent", value: 15, scope: "all" }) }))
    expect(screen.getByRole("button", { name: "Сохраняем…" })).toBeDisabled()
    expect(screen.getByLabelText("Название")).toBeDisabled()
  })

  it("edits ruble amounts as integer kopecks and sends the loaded version", async () => {
    const gateway = renderEditor()
    expect(await screen.findByLabelText("Скидка, ₽")).toHaveValue(1500.25)
    expect(screen.getByLabelText("Минимальная сумма, ₽")).toHaveValue(500)
    fireEvent.change(screen.getByLabelText("Скидка, ₽"), { target: { value: "1200.55" } })
    fireEvent.change(screen.getByLabelText("Минимальная сумма, ₽"), { target: { value: "2500.75" } })
    await userEvent.setup().click(screen.getByRole("button", { name: "Сохранить" }))
    await waitFor(() => expect(gateway.update).toHaveBeenCalledWith(item.id, expect.objectContaining({ expectedVersion: 2, terms: expect.objectContaining({ value: 120_055, minimumAmountMinor: 250_075 }), operationId: expect.any(String), idempotencyKey: expect.any(String) })))
  })

  it("retries an uncertain write with the same operation and never overwrites conflicts", async () => {
    const gateway = repository()
    gateway.update.mockRejectedValueOnce(new Error("Сеть недоступна")).mockRejectedValueOnce(new ApiClientError({ code: "STALE_VERSION", message: "Версия изменилась", details: {} }, 409))
    renderEditor(gateway)
    await screen.findByLabelText("Название")
    const user = userEvent.setup()
    await user.type(screen.getByLabelText("Название"), " — правка")
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Сеть недоступна")
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Версия изменилась")).toBeInTheDocument()
    expect(gateway.update.mock.calls[0]).toEqual(gateway.update.mock.calls[1])
    expect(screen.getByLabelText("Название")).toHaveValue("Лето — правка")
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Загрузить актуальную версию" })).toBeInTheDocument()
  })

  it("honors readonly capability and loads human names for selected offerings", async () => {
    const gateway = repository(false)
    gateway.get.mockResolvedValue({ ...item, terms: { ...item.terms, scope: "selected", offeringIds: ["22222222-2222-4222-8222-222222222222"] } })
    renderEditor(gateway)
    expect(await screen.findByText("Допуслуги · Трансфер")).toBeInTheDocument()
    expect(screen.getByLabelText("Название")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled()
    expect(screen.getByText(/Только просмотр/)).toBeInTheDocument()
    expect(screen.queryByText("22222222-2222-4222-8222-222222222222")).not.toBeInTheDocument()
  })

  it("uses one picker for resources and offerings and keeps their contract fields separate", async () => {
    const gateway = repository()
    gateway.get.mockResolvedValue({ ...item, terms: { ...item.terms, scope: "selected", resourceIds: ["house-pine"], offeringIds: ["22222222-2222-4222-8222-222222222222"] } })
    renderEditor(gateway)

    expect(await screen.findByText("Ресурс · Дом «Сосна»")).toBeInTheDocument()
    expect(screen.getByText("Допуслуги · Трансфер")).toBeInTheDocument()
    expect(screen.getAllByRole("combobox", { name: "Добавить ресурс или услугу" })).toHaveLength(1)
    expect(screen.queryByText("Как применяется")).not.toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole("button", { name: "Убрать Ресурс · Дом «Сосна»" }))
    await userEvent.setup().click(screen.getByRole("button", { name: "Сохранить" }))
    await waitFor(() => expect(gateway.update).toHaveBeenCalledWith(item.id, expect.objectContaining({ terms: expect.objectContaining({ resourceIds: [], offeringIds: ["22222222-2222-4222-8222-222222222222"] }) })))
  })
})
