import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode } from "react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"

import { FixtureBookingRepository } from "@app/data/bookings-repository"
import { FixtureDirectoryRepository } from "@app/data/directory-repository"
import { houseOfferingGateway } from "@app/data/house-offerings-repository"
import { DirectoryRepositoryProvider } from "@app/features/use-directory-data"
import { ApiClientError } from "@app/lib/api-client"

import { BookingEditorPage } from "./booking-editor-page"
import { bookingPriceKey } from "@app/lib/booking-pricing"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/bookings/2048") { return render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><BookingEditorPage repository={new FixtureBookingRepository()} /><LocationProbe /></>} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>) }

describe("BookingEditorPage", () => {
  it("preserves a saved composite quote on opening the composition tab", async () => {
    const fixture = new FixtureBookingRepository()
    const saved = (await fixture.get("2048"))!
    const position = saved.positions[0]!
    position.resourceId = "11111111-1111-4111-8111-111111111111"
    position.startAt = "2026-09-10T09:00:00Z"; position.endAt = "2026-09-11T09:00:00Z"
    position.quoteSnapshotId = "22222222-2222-4222-8222-222222222222"
    position.addOns = [{ assignmentId: "33333333-3333-4333-8333-333333333333", addOnOfferingId: "44444444-4444-4444-8444-444444444444", label: "Завтрак", serviceType: "person_service", quantity: 1, price: 500 }]
    position.calculatedInputKey = bookingPriceKey(position)
    const previewResourceStayQuote = vi.fn()
    const repository = { get: vi.fn().mockResolvedValue(saved), save: vi.fn().mockResolvedValue(saved) }
    render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={["/bookings/2048?tab=composition"]}><TooltipProvider><Routes><Route element={<BookingEditorPage pricingGateway={{ previewResourceStayQuote }} repository={repository} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)
    await screen.findByLabelText("Стоимость, ₽")
    await userEvent.setup().click(screen.getByRole("button", { name: "Сохранить" }))
    await waitFor(() => expect(repository.save).toHaveBeenCalled())
    expect(previewResourceStayQuote).not.toHaveBeenCalled()
    expect(repository.save.mock.calls[0]![0].positions[0].quoteSnapshotId).toBe(position.quoteSnapshotId)
  })
  it("uses kopeck rounding consistently for manual discount", async () => {
    const user = userEvent.setup()
    renderEditor("/bookings/2048?tab=composition")
    const cost = await screen.findByLabelText("Стоимость, ₽")
    await user.clear(cost); await user.type(cost, "10.99")
    const discount = screen.getByLabelText("Скидка, %")
    await user.clear(discount); await user.type(discount, "10")
    expect(screen.getByLabelText("Итого позиции 1")).toHaveTextContent(/9[,.]89/)
  })

  it("applies server promotion and invalidates it after changing composition", async () => {
    const user = userEvent.setup()
    const fixture = new FixtureBookingRepository()
    const previewPromotion = vi.fn().mockResolvedValue({ promotion: { promotionId: "10000000-0000-4000-8000-000000000001", version: 1, code: "AUTUMN10", discountType: "percent", value: 10, eligibleAmountMinor: 1400000, discountAmountMinor: 140000, appliedAt: "2026-09-04T10:00:00Z" }, total: { amountMinor: 1260000, currency: "RUB" } })
    const repository = { get: fixture.get.bind(fixture), save: vi.fn(fixture.save.bind(fixture)), previewPromotion }
    render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={["/bookings/2048?tab=composition"]}><TooltipProvider><Routes><Route element={<BookingEditorPage repository={repository} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)
    const promo = await screen.findByLabelText("Промокод бронирования")
    await user.clear(promo); await user.type(promo, "AUTUMN10")
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Применить" }))
    await waitFor(() => expect(screen.getByText(/Скидка по коду:/)).toHaveTextContent(/1\s*400/))
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Добавить позицию" }))
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled()
    expect(screen.getByText(/Проверьте код для текущего состава/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Убрать код" }))
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
  })
  it("shows promotion field errors instead of a generic validation message", async () => {
    const user = userEvent.setup()
    const fixture = new FixtureBookingRepository()
    const previewPromotion = vi.fn().mockRejectedValue(new ApiClientError({
      code: "VALIDATION_ERROR",
      message: "Проверьте заполнение полей",
      fieldErrors: { promoCode: ["Код должен содержать от 3 до 64 символов"] },
      details: {},
    }, 400))
    const repository = { get: fixture.get.bind(fixture), save: vi.fn(fixture.save.bind(fixture)), previewPromotion }
    render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={["/bookings/2048"]}><TooltipProvider><Routes><Route element={<BookingEditorPage repository={repository} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)

    const promo = await screen.findByLabelText("Промокод бронирования")
    await user.type(promo, "X")
    await user.click(screen.getByRole("button", { name: "Применить" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Промокод: Код должен содержать от 3 до 64 символов")
    expect(screen.getByRole("alert")).not.toHaveTextContent("Проверьте заполнение полей")
  })

  it("explains pending pricing only after save and opens composition", async () => {
    const resourceId = "11111111-1111-4111-8111-111111111111"
    const directory = new FixtureDirectoryRepository()
    vi.spyOn(directory, "listResources").mockResolvedValue([{ id: resourceId, name: "Дом «Сосна»", category: "houses" }])
    const previewResourceStayQuote = vi.fn(() => new Promise<never>(() => {}))
    render(<DirectoryRepositoryProvider repository={directory}><MemoryRouter initialEntries={["/bookings/new"]}><TooltipProvider><Routes><Route element={<><BookingEditorPage pricingGateway={{ previewResourceStayQuote }} repository={new FixtureBookingRepository()} /><LocationProbe /></>} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)

    const save = await screen.findByRole("button", { name: "Сохранить" })
    await waitFor(() => expect(save).toBeEnabled())
    expect(screen.queryByText(/Для сохранения откройте/i)).not.toBeInTheDocument()
    await userEvent.setup().click(save)

    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=composition")
    expect(screen.getByRole("alert")).toHaveTextContent("Стоимость ещё рассчитывается")
    await waitFor(() => expect(previewResourceStayQuote).toHaveBeenCalled())
  })
  it("uses the shared editor chrome, editable fields and payment sidebar", async () => {
    renderEditor()

    expect(await screen.findByRole("combobox", { name: "Клиент бронирования" })).toHaveTextContent("Анна Смирнова")
    expect(document.querySelector('[data-slot="editor-frame"]')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="editor-sidebar"]')).toBeInTheDocument()
    expect(screen.getByText("Операционная сводка")).toBeInTheDocument()
    expect(screen.getByText("Оплата")).toBeInTheDocument()
    expect(screen.getAllByText(/14\s*000\s*₽/).length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('[data-slot="editor-sidebar"]')).not.toHaveTextContent(/^Статус$/)
  })

  it("tracks comments, payments and saved state", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByRole("combobox", { name: "Клиент бронирования" })

    await user.type(screen.getByLabelText("Новый комментарий"), "Проверить поздний заезд")
    await user.click(screen.getByRole("button", { name: "Отправить комментарий" }))
    expect(screen.getByText("Проверить поздний заезд")).toBeInTheDocument()
    await user.type(screen.getByLabelText("Сумма"), "3000")
    await user.click(screen.getByRole("button", { name: "Добавить оплату" }))
    expect(screen.getByText(/3\s*000\s*₽/)).toBeInTheDocument()
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Сохранено")).toBeInTheDocument()
  })

  it("keeps composition in the URL and supports position actions", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByRole("combobox", { name: "Клиент бронирования" })

    await user.click(screen.getByRole("tab", { name: "Состав" }))
    expect(screen.getByLabelText("Текущий URL")).toHaveTextContent("?tab=composition")
    expect(screen.getByText("Позиция 1")).toBeInTheDocument()
    const originalPrice = screen.getByLabelText("Стоимость, ₽")
    expect(document.querySelector('[data-slot="booking-composition"] [data-slot="editor-section"] [data-slot="editor-section"]')).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Дублировать позицию 1" }))
    expect(screen.getByText("Позиция 2")).toBeInTheDocument()
    expect(screen.getAllByLabelText("Стоимость, ₽")[0]).toBe(originalPrice)
    await user.click(screen.getByRole("button", { name: "Добавить позицию" }))
    expect(screen.getByText("Позиция 3")).toBeInTheDocument()
    expect(screen.getAllByLabelText("Стоимость, ₽")[0]).toBe(originalPrice)
    expect(screen.getAllByLabelText("Стоимость, ₽")[2]).toHaveValue(0)
  })

  it("uses scheduler presets for a new booking", async () => {
    renderEditor("/bookings/new?date=2026-09-10&resource=tent-meadow&start=16")

    expect(await screen.findByRole("combobox", { name: "Клиент бронирования" })).toHaveTextContent("Новый клиент")
    const user = userEvent.setup()
    await user.click(screen.getByRole("tab", { name: "Состав" }))
    expect(screen.getByRole("combobox", { name: "Ресурс позиции 1" })).toHaveTextContent("Палаточное место «Луг»")
    expect(screen.getByRole("button", { name: "Период позиции 1" })).toHaveTextContent("16:00")
  })

  it("automatically fills a new stay position from authoritative resource pricing", async () => {
    const resourceId = "11111111-1111-4111-8111-111111111111"
    const directory = new FixtureDirectoryRepository()
    vi.spyOn(directory, "listResources").mockResolvedValue([{ id: resourceId, name: "Дом «Сосна»", category: "houses" }])
    const previewResourceStayQuote = vi.fn().mockResolvedValue({ total: { amountMinor: 1_350_000, currency: "RUB" } })

    render(<StrictMode><DirectoryRepositoryProvider repository={directory}><MemoryRouter initialEntries={["/bookings/new?tab=composition"]}><TooltipProvider><Routes><Route element={<BookingEditorPage pricingGateway={{ previewResourceStayQuote }} repository={new FixtureBookingRepository()} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider></StrictMode>)

    const price = await screen.findByLabelText("Стоимость, ₽")
    await waitFor(() => expect(price).toHaveValue(13_500))
    expect(screen.getByText("Рассчитано по ценам ресурса")).toBeInTheDocument()
    const arrivalDate = new Date().toISOString().slice(0, 10)
    const departureDate = new Date(`${arrivalDate}T12:00:00Z`); departureDate.setUTCDate(departureDate.getUTCDate() + 1)
    expect(previewResourceStayQuote).toHaveBeenCalledWith(resourceId, expect.objectContaining({ arrivalDate, departureDate: departureDate.toISOString().slice(0, 10), quantity: 1, currency: "RUB" }))
  })

  it("adds an assigned transfer to the stay quote", async () => {
    const resourceId = "11111111-1111-4111-8111-111111111111"
    const assignmentId = "22222222-2222-4222-8222-222222222222"
    const directory = new FixtureDirectoryRepository()
    vi.spyOn(directory, "listResources").mockResolvedValue([{ id: resourceId, name: "Дом «Сосна»", category: "houses" }])
    vi.spyOn(houseOfferingGateway, "resolvePrimaryStayOffering").mockResolvedValue({ resolution: "linked", offering: { offeringId: "33333333-3333-4333-8333-333333333333", kind: "house", code: "house_pine", operationalName: "Дом «Сосна»", state: "active" } })
    vi.spyOn(houseOfferingGateway, "getHouseEditor").mockResolvedValue({ addOnAssignments: [{ id: assignmentId, offeringId: "33333333-3333-4333-8333-333333333333", version: 1, addOnOfferingId: "44444444-4444-4444-8444-444444444444", enabled: true, required: false, recommended: true, groupKey: null, ratePlanKeyOverride: null, labelOverride: "Трансфер от станции", descriptionOverride: null, minQuantityOverride: 1, maxQuantityOverride: 2, defaultQuantityOverride: 1, displayOrder: 0 }], addOnCatalog: [{ offering: { id: "44444444-4444-4444-8444-444444444444", version: 1, code: "addon_transfer", operationalName: "Трансфер", state: "active", archived: false }, serviceType: "quantity_service", scope: "reusable", ownerOfferingId: null, categoryKey: "comfort", standalone: true, availability: { status: "available", blocker: null } }] } as never)
    const previewResourceStayQuote = vi.fn().mockResolvedValue({ quoteId: "55555555-5555-4555-8555-555555555555", total: { amountMinor: 1_505_000, currency: "RUB" }, lines: [{ kind: "addon", label: "Трансфер от станции", serviceDate: null, quantity: 1, amount: { amountMinor: 5_000, currency: "RUB" }, ratePlanId: "66666666-6666-4666-8666-666666666666", ratePlanVersion: 1, matchedRuleId: null, matchedRuleVersion: null, addOnAssignmentId: assignmentId, addOnOfferingId: "44444444-4444-4444-8444-444444444444", explanation: "" }] })

    render(<DirectoryRepositoryProvider repository={directory}><MemoryRouter initialEntries={["/bookings/new?tab=composition"]}><TooltipProvider><Routes><Route element={<BookingEditorPage pricingGateway={{ previewResourceStayQuote }} repository={new FixtureBookingRepository()} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)

    expect(await screen.findByText("Трансфер от станции")).toBeInTheDocument()
    const user = userEvent.setup()
    const discount = screen.getByLabelText("Скидка, %")
    await user.clear(discount)
    await user.type(discount, "10")
    await user.click(screen.getByRole("button", { name: "Добавить" }))
    expect(discount).toBeDisabled()
    expect(discount).toHaveValue(10)
    expect(screen.getByRole("alert")).toHaveTextContent("скидка должна быть 0%")
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Убрать скидку" }))
    expect(discount).toHaveValue(0)
    await waitFor(() => expect(previewResourceStayQuote).toHaveBeenCalledWith(resourceId, expect.objectContaining({ addOns: [{ assignmentId, quantity: 1 }] })))
    await waitFor(() => expect(screen.getByLabelText("Стоимость, ₽")).toHaveValue(15_050))
    expect(screen.getByLabelText("Итого позиции 1")).toHaveTextContent(/15\s*050\s*₽/)
    expect(screen.getByText("Допуслуги включены в стоимость")).toBeInTheDocument()
    expect(screen.getByText("Ручная скидка недоступна для позиции с допуслугами.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
    const addons = document.querySelector('[data-slot="booking-addons"]')!
    expect(addons.compareDocumentPosition(screen.getByLabelText("Стоимость, ₽")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("shows the authoritative quote failure and retries the same position", async () => {
    const resourceId = "11111111-1111-4111-8111-111111111111"
    const directory = new FixtureDirectoryRepository()
    vi.spyOn(directory, "listResources").mockResolvedValue([{ id: resourceId, name: "Дом «Сосна»", category: "houses" }])
    const previewResourceStayQuote = vi.fn().mockRejectedValueOnce(new Error("Нет активного тарифного плана на выбранные даты")).mockResolvedValue({ total: { amountMinor: 1_350_000, currency: "RUB" } })
    render(<DirectoryRepositoryProvider repository={directory}><MemoryRouter initialEntries={["/bookings/new?tab=composition"]}><TooltipProvider><Routes><Route element={<BookingEditorPage pricingGateway={{ previewResourceStayQuote }} repository={new FixtureBookingRepository()} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)

    expect(await screen.findByText(/Нет активного тарифного плана на выбранные даты/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
    await userEvent.setup().click(screen.getByRole("button", { name: "Повторить расчёт позиции 1" }))
    await waitFor(() => expect(screen.getByLabelText("Стоимость, ₽")).toHaveValue(13_500))
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeEnabled()
    expect(previewResourceStayQuote).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("button", { name: "Повторить расчёт позиции 1" })).not.toBeInTheDocument()
  })

  it("does not strand an in-flight quote when unrelated position data changes", async () => {
    const resourceId = "11111111-1111-4111-8111-111111111111"
    const directory = new FixtureDirectoryRepository()
    vi.spyOn(directory, "listResources").mockResolvedValue([{ id: resourceId, name: "Дом «Сосна»", category: "houses" }])
    const previewResourceStayQuote = vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue({ total: { amountMinor: 1_350_000, currency: "RUB" } })
    render(<DirectoryRepositoryProvider repository={directory}><MemoryRouter initialEntries={["/bookings/new?tab=composition"]}><TooltipProvider><Routes><Route element={<BookingEditorPage pricingGateway={{ previewResourceStayQuote }} repository={new FixtureBookingRepository()} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)
    await waitFor(() => expect(previewResourceStayQuote).toHaveBeenCalledTimes(1))
    await userEvent.setup().type(screen.getByLabelText("Скидка, %"), "5")
    await waitFor(() => expect(screen.getByLabelText("Стоимость, ₽")).toHaveValue(13_500))
    expect(screen.getByText("Рассчитано по ценам ресурса")).toBeInTheDocument()
  })

  it("links a lead through search by phone using the explicit relation command", async () => {
    const user = userEvent.setup()
    renderEditor()
    await screen.findByRole("combobox", { name: "Клиент бронирования" })

    expect(screen.getAllByRole("button", { name: "Найти и связать заявку" })).toHaveLength(1)
    expect(screen.getByLabelText("Клиент бронирования").closest("div.sm\\:col-span-4")).toBeInTheDocument()
    expect(screen.getByLabelText("Телефон").closest("div.sm\\:col-span-2")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Найти и связать заявку" }))
    await user.type(screen.getByPlaceholderText("#ID, телефон или имя…"), "9211077763")
    await user.click(screen.getByText("Заявка #1279 · Сергей Лебедев"))

    expect(screen.getAllByText("Заявка #1279 · Сергей Лебедев").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Сохранено")).toBeInTheDocument()
  })

  it("preserves dirty editor fields while an explicit relation command updates the version", async () => {
    const fixture = new FixtureBookingRepository()
    const booking = (await fixture.get("2048"))!
    booking.version = 4
    booking.sourceLeadId = null
    let resolveLink!: (value: { link: { id: string; bookingId: string; leadId: string; method: "manual"; linkedAt: string; linkedBy: null; unlinkedAt: null; unlinkedBy: null }; bookingVersion: number }) => void
    const linkLead = vi.fn().mockReturnValue(new Promise((resolve) => { resolveLink = resolve }))
    const repository = { get: vi.fn().mockResolvedValue(booking), save: vi.fn(), linkLead, unlinkLead: vi.fn(), leadLinkHistory: vi.fn().mockResolvedValue({ items: [] }) }
    render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={["/bookings/2048"]}><TooltipProvider><Routes><Route element={<BookingEditorPage repository={repository} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)
    const user = userEvent.setup()
    const message = await screen.findByLabelText("Сообщение от клиента")
    await user.type(message, " Несохранённая правка")
    await user.click(screen.getByRole("button", { name: "Найти и связать заявку" }))
    await user.type(screen.getByPlaceholderText("#ID, телефон или имя…"), "9211077763")
    await user.click(screen.getByText("Заявка #1279 · Сергей Лебедев"))

    expect(linkLead).toHaveBeenCalledWith("2048", "1279", 4, "manual")
    expect(screen.getByRole("button", { name: "Найти и связать заявку" })).toBeDisabled()
    resolveLink({ link: { id: "30000000-0000-4000-8000-000000000001", bookingId: "2048", leadId: "1279", method: "manual", linkedAt: "2026-09-09T10:00:00.000Z", linkedBy: null, unlinkedAt: null, unlinkedBy: null }, bookingVersion: 5 })

    await waitFor(() => expect(screen.getAllByText("Заявка #1279 · Сергей Лебедев").length).toBeGreaterThanOrEqual(1))
    expect((screen.getByLabelText("Сообщение от клиента") as HTMLTextAreaElement).value).toContain("Несохранённая правка")
    expect(screen.getByText("Есть изменения")).toBeInTheDocument()
  })

  it("renders the authoritative lead-link history on the history tab", async () => {
    const fixture = new FixtureBookingRepository()
    const booking = (await fixture.get("2048"))!
    const leadLinkHistory = vi.fn().mockResolvedValue({ items: [{ id: "30000000-0000-4000-8000-000000000001", bookingId: "2048", leadId: "1279", method: "from_lead", linkedAt: "2026-09-09T10:00:00.000Z", linkedBy: null, unlinkedAt: null, unlinkedBy: null }] })
    const repository = { get: vi.fn().mockResolvedValue(booking), save: vi.fn(), linkLead: vi.fn(), unlinkLead: vi.fn(), leadLinkHistory }
    render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={["/bookings/2048?tab=history"]}><TooltipProvider><Routes><Route element={<BookingEditorPage repository={repository} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)

    expect(await screen.findByText("Заявка #1279 · создание из заявки")).toBeInTheDocument()
    expect(screen.getByText(/активна/)).toBeInTheDocument()
    expect(leadLinkHistory).toHaveBeenCalledWith("2048")
  })

  it("refetches lead-link history after changing the relation on an open history tab", async () => {
    const fixture = new FixtureBookingRepository()
    const booking = (await fixture.get("2048"))!
    booking.version = 4
    booking.sourceLeadId = null
    const historyItem = { id: "30000000-0000-4000-8000-000000000001", bookingId: "2048", leadId: "1279", method: "manual" as const, linkedAt: "2026-09-09T10:00:00.000Z", linkedBy: null, unlinkedAt: null, unlinkedBy: null }
    const leadLinkHistory = vi.fn().mockResolvedValueOnce({ items: [] }).mockResolvedValueOnce({ items: [historyItem] })
    const linkLead = vi.fn().mockResolvedValue({ link: historyItem, bookingVersion: 5 })
    const repository = { get: vi.fn().mockResolvedValue(booking), save: vi.fn(), linkLead, unlinkLead: vi.fn(), leadLinkHistory }
    render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={["/bookings/2048?tab=history"]}><TooltipProvider><Routes><Route element={<BookingEditorPage repository={repository} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)
    const user = userEvent.setup()
    expect(await screen.findByText("Связей с заявками ещё не было.")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Найти и связать заявку" }))
    await user.type(screen.getByPlaceholderText("#ID, телефон или имя…"), "9211077763")
    await user.click(screen.getByText("Заявка #1279 · Сергей Лебедев"))

    expect(await screen.findByText("Заявка #1279 · ручная связь")).toBeInTheDocument()
    expect(leadLinkHistory).toHaveBeenCalledTimes(2)
  })

  it("keeps the draft intact and exposes a relation version conflict", async () => {
    const fixture = new FixtureBookingRepository()
    const booking = (await fixture.get("2048"))!
    booking.version = 4
    booking.sourceLeadId = null
    const linkLead = vi.fn().mockRejectedValue(new ApiClientError({ code: "STALE_VERSION", message: "Бронь уже изменена", details: {} }, 409))
    const repository = { get: vi.fn().mockResolvedValue(booking), save: vi.fn(), linkLead, unlinkLead: vi.fn() }
    render(<DirectoryRepositoryProvider repository={new FixtureDirectoryRepository()}><MemoryRouter initialEntries={["/bookings/2048"]}><TooltipProvider><Routes><Route element={<BookingEditorPage repository={repository} />} path="bookings/:id" /></Routes></TooltipProvider></MemoryRouter></DirectoryRepositoryProvider>)
    const user = userEvent.setup()
    const phone = await screen.findByLabelText("Телефон")
    await user.type(phone, "1")
    await user.click(screen.getByRole("button", { name: "Найти и связать заявку" }))
    await user.type(screen.getByPlaceholderText("#ID, телефон или имя…"), "9211077763")
    await user.click(screen.getByText("Заявка #1279 · Сергей Лебедев"))

    expect(await screen.findByText("Бронь уже изменена")).toBeInTheDocument()
    expect((screen.getByLabelText("Телефон") as HTMLInputElement).value).toMatch(/1$/)
    expect(screen.getByText("Конфликт версий")).toBeInTheDocument()
    expect(screen.getByText("Не привязана")).toBeInTheDocument()
  })
})
