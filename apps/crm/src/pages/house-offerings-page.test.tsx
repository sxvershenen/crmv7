import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"

import { InternalOfferingEditorSchema, type HouseOfferingListResponse } from "@crm/contracts"
import type { OfferingEditorGateway } from "@crm/offering-editor"
import { TooltipProvider } from "@crm/ui"
import { describe, expect, it, vi } from "vitest"

import { HouseOfferingEditorPage } from "@app/pages/house-offering-editor-page"
import { HouseOfferingsPage } from "@app/pages/house-offerings-page"

// Base UI's Switch dispatches a PointerEvent; jsdom in this focused route test
// only provides MouseEvent by default.
Object.defineProperty(window, "PointerEvent", { configurable: true, value: MouseEvent })

describe("CRM house offering routes", () => {
  it("renders the real empty state", async () => {
    const gateway = gatewayMock()
    gateway.listHouses.mockResolvedValue({ items: [], nextCursor: null } satisfies HouseOfferingListResponse)
    render(<TooltipProvider><MemoryRouter><HouseOfferingsPage gateway={gateway} /></MemoryRouter></TooltipProvider>)
    expect(await screen.findByText("Домиков пока нет")).toBeInTheDocument()
    expect(gateway.listHouses).toHaveBeenCalledWith({ kind: "house", limit: 25 })
  })

  it("keeps the active tab in the URL and returns to the host list", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    gateway.getHouseEditor.mockResolvedValue(editorFixture())
    render(<TooltipProvider><MemoryRouter initialEntries={["/offers/houses/11111111-1111-4111-8111-111111111111"]}><Routes>
      <Route element={<><HouseOfferingEditorPage gateway={gateway} /><LocationProbe /></>} path="/offers/houses/:offeringId" />
      <Route element={<p>Список предложений</p>} path="/offers/houses" />
    </Routes></MemoryRouter></TooltipProvider>)

    expect(await screen.findByText("Готовность цены")).toBeInTheDocument()
    expect(screen.getByText("Предложение")).toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Состав" }))
    expect(screen.getByTestId("location")).toHaveTextContent("?tab=composition")
    expect(screen.getByText("Основной ресурс")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Закрыть" }))
    expect(await screen.findByText("Список предложений")).toBeInTheDocument()
  })

  it("shows the canonical CMS locator without exposing its technical identifier", async () => {
    const gateway = gatewayMock()
    const editor = editorWithEditorialLocator()
    gateway.getHouseEditor.mockResolvedValue(editor)

    render(<TooltipProvider><MemoryRouter initialEntries={[`/offers/houses/${editor.offering.id}`]}><Routes>
      <Route element={<HouseOfferingEditorPage gateway={gateway} />} path="/offers/houses/:offeringId" />
    </Routes></MemoryRouter></TooltipProvider>)

    expect(await screen.findByText("Дом «Сосна» — страница")).toBeInTheDocument()
    expect(screen.getByText("/drafts/houses/house_pine")).toBeInTheDocument()
    expect(screen.getByText("Нужно дозаполнить")).toBeInTheDocument()
    expect(screen.getByText("Данные для сайта ещё не подготовлены")).toBeInTheDocument()
    expect(screen.queryByText(editor.editorial!.node.id)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Редактировать страницу" })).toHaveAttribute(
      "href",
      `http://localhost:5174/offers/houses/${editor.offering.id}?tab=content`,
    )
  })

  it("shows a resolved primary resource, selects a lookup result and sends the full subject replacement", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = editorFixture()
    expect(editor.capabilities.subject.canManageBindings).toBe(true)
    const selected = resourceTarget("22222222-2222-4222-8222-222222222222", "Дом «Берёза»", "house_birch")
    gateway.getHouseEditor.mockResolvedValue(editor)
    gateway.listBindingTargets.mockResolvedValue({ items: [selected], nextCursor: null })
    gateway.replaceHouseBindings.mockResolvedValue({})

    render(<TooltipProvider><MemoryRouter initialEntries={[`/offers/houses/${editor.offering.id}?tab=composition`]}><Routes>
      <Route element={<HouseOfferingEditorPage gateway={gateway} />} path="/offers/houses/:offeringId" />
    </Routes></MemoryRouter></TooltipProvider>)

    expect((await screen.findAllByText("Дом «Сосна»")).length).toBeGreaterThan(0)
    expect(screen.queryByText("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).not.toBeInTheDocument()
    expect(screen.getByLabelText("Подготовка до, мин")).toBeEnabled()
    await user.clear(screen.getByLabelText("Найти ресурс по названию или коду"))
    await user.type(screen.getByLabelText("Найти ресурс по названию или коду"), "бер")
    await user.click(await screen.findByRole("button", { name: /Дом «Берёза»/ }))
    await user.clear(screen.getByLabelText("Подготовка до, мин"))
    await user.type(screen.getByLabelText("Подготовка до, мин"), "30")
    expect(screen.getByLabelText("Подготовка до, мин")).toHaveValue(30)
    expect(screen.getByText("Выбран")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Сохранить состав" }))

    expect(gateway.listBindingTargets).toHaveBeenLastCalledWith({ targetType: "resource", kind: "house", limit: 12, q: "бер" })
    expect(gateway.replaceHouseBindings).toHaveBeenCalledWith(editor.offering.id, expect.objectContaining({
      expectedSubjectVersion: 2,
      bindings: [{
        target: { type: "resource", id: selected.id }, role: "primary", availabilityRequired: true,
        defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 30, preparationAfterMinutes: 0,
      }],
    }))
  })

  it("keeps a local binding draft after a subject conflict and retries the exact same command", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = editorFixture()
    gateway.getHouseEditor.mockResolvedValue(editor)
    gateway.listBindingTargets.mockResolvedValue({ items: [], nextCursor: null })

    render(<TooltipProvider><MemoryRouter initialEntries={[`/offers/houses/${editor.offering.id}?tab=composition`]}><Routes>
      <Route element={<HouseOfferingEditorPage gateway={gateway} />} path="/offers/houses/:offeringId" />
    </Routes></MemoryRouter></TooltipProvider>)

    expect(screen.queryByText("Только просмотр состава")).not.toBeInTheDocument()
    const quantity = await screen.findByLabelText("Количество")
    expect(quantity).toBeEnabled()
    await user.clear(quantity)
    await user.type(quantity, "2")
    gateway.replaceHouseBindings.mockRejectedValue(Object.assign(new Error("Версия состава изменилась"), { status: 409 }))
    await user.click(screen.getByRole("button", { name: "Сохранить состав" }))
    expect(await screen.findByText("Состав изменился на сервере")).toBeInTheDocument()
    expect(screen.getByLabelText("Количество")).toHaveValue(2)
    const firstBody = gateway.replaceHouseBindings.mock.calls[0]?.[1]
    await user.click(screen.getByRole("button", { name: "Повторить запрос" }))
    expect(gateway.replaceHouseBindings.mock.calls[1]?.[1]).toEqual(firstBody)
  })

  it("keeps lookup readable but prevents a readonly user from selecting or changing a resource", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = InternalOfferingEditorSchema.parse({ ...editorFixture(), capabilities: { ...editorFixture().capabilities, subject: { canEdit: false, canManageBindings: false } } })
    gateway.getHouseEditor.mockResolvedValue(editor)
    gateway.listBindingTargets.mockResolvedValue({ items: [resourceTarget("22222222-2222-4222-8222-222222222222", "Дом «Берёза»", "house_birch")], nextCursor: null })

    render(<TooltipProvider><MemoryRouter initialEntries={[`/offers/houses/${editor.offering.id}?tab=composition`]}><Routes>
      <Route element={<HouseOfferingEditorPage gateway={gateway} />} path="/offers/houses/:offeringId" />
    </Routes></MemoryRouter></TooltipProvider>)

    const search = await screen.findByLabelText("Найти ресурс по названию или коду")
    expect(search).toBeEnabled()
    await user.type(search, "бер")
    expect(await screen.findByRole("button", { name: /Дом «Берёза»/ })).toBeDisabled()
    expect(gateway.listBindingTargets).toHaveBeenLastCalledWith({ targetType: "resource", kind: "house", limit: 12, q: "бер" })
    expect(screen.getByLabelText("Количество")).toBeDisabled()
  })

  it("shows resolved add-ons without IDs, adds a reusable library item and replaces the complete add-on set", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = editorWithAddOns()
    const firewood = libraryAddOn("55555555-5555-4555-8555-555555555555", "Дрова", "addon_firewood")
    gateway.getHouseEditor.mockResolvedValue(editor)
    gateway.listAddOnLibrary.mockResolvedValue({ items: [firewood], nextCursor: null })
    gateway.replaceAddOnAssignments.mockResolvedValue({})
    render(<TooltipProvider><MemoryRouter initialEntries={[`/offers/houses/${editor.offering.id}?tab=composition`]}><Routes><Route element={<HouseOfferingEditorPage gateway={gateway} />} path="/offers/houses/:offeringId" /></Routes></MemoryRouter></TooltipProvider>)

    expect(await screen.findByText("Банный чан")).toBeInTheDocument()
    expect(screen.getByText(/addon_hot_tub · comfort/)).toBeInTheDocument()
    expect(screen.queryByText("44444444-4444-4444-8444-444444444444")).not.toBeInTheDocument()
    expect(gateway.listAddOnLibrary).toHaveBeenLastCalledWith({ limit: 12, scope: "reusable" })
    await user.type(screen.getByLabelText("Добавить из библиотеки"), "дров")
    expect(gateway.listAddOnLibrary).toHaveBeenLastCalledWith({ limit: 12, scope: "reusable", q: "дров" })
    await user.click(await screen.findByRole("button", { name: "Добавить Дрова" }))
    expect(screen.getAllByText("Дрова").length).toBeGreaterThan(1)
    expect(screen.getAllByText(/addon_firewood · comfort/).length).toBeGreaterThan(1)
    await user.click(screen.getByRole("button", { name: "Сохранить услуги" }))

    expect(gateway.replaceAddOnAssignments).toHaveBeenCalledWith(editor.offering.id, expect.objectContaining({
      expectedAddOnsVersion: 1,
      assignments: expect.arrayContaining([
        expect.objectContaining({ addOnOfferingId: "44444444-4444-4444-8444-444444444444", enabled: true, required: false, recommended: true, minQuantityOverride: 1, maxQuantityOverride: 2, defaultQuantityOverride: 1 }),
        expect.objectContaining({ addOnOfferingId: firewood.offering.id, enabled: true, required: false, recommended: false, minQuantityOverride: null, maxQuantityOverride: null, defaultQuantityOverride: null }),
      ]),
    }))
  })

  it("keeps add-on CAS separate, normalizes required/enabled and retries the exact conflict body", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = editorWithAddOns()
    gateway.getHouseEditor.mockResolvedValue(editor)
    gateway.listAddOnLibrary.mockResolvedValue({ items: [], nextCursor: null })
    render(<TooltipProvider><MemoryRouter initialEntries={[`/offers/houses/${editor.offering.id}?tab=composition`]}><Routes><Route element={<HouseOfferingEditorPage gateway={gateway} />} path="/offers/houses/:offeringId" /></Routes></MemoryRouter></TooltipProvider>)

    const required = await screen.findByRole("switch", { name: "Обязателен" })
    await user.click(required)
    expect(required).toHaveAttribute("aria-checked", "true")
    const enabled = screen.getByRole("switch", { name: "Включён" })
    await user.click(enabled)
    expect(required).toHaveAttribute("aria-checked", "false")
    gateway.replaceAddOnAssignments.mockRejectedValue(Object.assign(new Error("Версия услуг изменилась"), { status: 409 }))
    await user.click(screen.getByRole("button", { name: "Сохранить услуги" }))
    expect(await screen.findByText("Дополнительные услуги изменились на сервере")).toBeInTheDocument()
    const firstBody = gateway.replaceAddOnAssignments.mock.calls[0]?.[1]
    expect(firstBody).toMatchObject({ expectedAddOnsVersion: 1, assignments: [expect.objectContaining({ enabled: false, required: false })] })
    await user.click(screen.getByRole("button", { name: "Повторить запрос" }))
    expect(gateway.replaceAddOnAssignments.mock.calls[1]?.[1]).toEqual(firstBody)
  })

  it("creates an offering-specific add-on as a disabled draft, then reloads its authoritative readiness", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = InternalOfferingEditorSchema.parse({ ...editorWithAddOns(), capabilities: { ...editorWithAddOns().capabilities, addOns: { canSearch: false, canCreate: true, canAssign: true } } })
    const created = InternalOfferingEditorSchema.parse({
      ...editor,
      addOnAssignments: [...editor.addOnAssignments, { id: "66666666-6666-4666-8666-666666666666", offeringId: editor.offering.id, version: 1, addOnOfferingId: "55555555-5555-4555-8555-555555555555", enabled: false, required: false, recommended: false, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minQuantityOverride: null, maxQuantityOverride: null, defaultQuantityOverride: null, displayOrder: 1 }],
      addOnCatalog: [...editor.addOnCatalog, { offering: { id: "55555555-5555-4555-8555-555555555555", version: 1, code: "addon_romantic_set", operationalName: "Романтический набор", state: "draft", archived: false }, serviceType: "quantity_service", scope: "offering_specific", ownerOfferingId: editor.offering.id, categoryKey: "custom", standalone: false, availability: { status: "blocked", blocker: "not_active" } }],
      ownerVersions: { ...editor.ownerVersions, addOnAssignments: 2 },
    })
    let authoritative = editor
    gateway.getHouseEditor.mockImplementation(async () => authoritative)
    gateway.createCustomAddOn.mockImplementation(async () => {
      authoritative = created
      return {} as never
    })

    render(<TooltipProvider><MemoryRouter initialEntries={[`/offers/houses/${editor.offering.id}?tab=composition`]}><Routes><Route element={<HouseOfferingEditorPage gateway={gateway} />} path="/offers/houses/:offeringId" /></Routes></MemoryRouter></TooltipProvider>)

    await user.click(await screen.findByRole("button", { name: "Создать свой доп" }))
    await user.type(screen.getByLabelText("Название допа"), "Романтический набор")
    expect(screen.getByText("Нужна отдельная цена")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Создать черновик" }))

    expect(gateway.createCustomAddOn).toHaveBeenCalledWith(editor.offering.id, expect.objectContaining({
      expectedAddOnsVersion: 1,
      addOn: expect.objectContaining({ operationalName: "Романтический набор", categoryKey: "custom", serviceType: "quantity_service", salesMode: "request_only", priceDisplayMode: "request" }),
      assignment: expect.objectContaining({ enabled: false, required: false, recommended: false, displayOrder: 1 }),
    }))
    expect(await screen.findByText("Романтический набор")).toBeInTheDocument()
    expect(screen.getByText("Не активен")).toBeInTheDocument()
  })

  it("keeps the exact custom add-on command for a 409 retry", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = InternalOfferingEditorSchema.parse({ ...editorWithAddOns(), capabilities: { ...editorWithAddOns().capabilities, addOns: { canSearch: false, canCreate: true, canAssign: true } } })
    gateway.getHouseEditor.mockResolvedValue(editor)
    gateway.createCustomAddOn.mockRejectedValue(Object.assign(new Error("Версия услуг изменилась"), { status: 409 }))

    render(<TooltipProvider><MemoryRouter initialEntries={[`/offers/houses/${editor.offering.id}?tab=composition`]}><Routes><Route element={<HouseOfferingEditorPage gateway={gateway} />} path="/offers/houses/:offeringId" /></Routes></MemoryRouter></TooltipProvider>)

    await user.click(await screen.findByRole("button", { name: "Создать свой доп" }))
    await user.type(screen.getByLabelText("Название допа"), "Поздний выезд")
    await user.click(screen.getByRole("button", { name: "Создать черновик" }))
    expect(await screen.findByText("Версия услуг изменилась. Повторный запрос отправит те же данные.")).toBeInTheDocument()
    const firstBody = gateway.createCustomAddOn.mock.calls[0]?.[1]
    await user.click(screen.getByRole("button", { name: "Повторить запрос" }))
    expect(gateway.createCustomAddOn.mock.calls[1]?.[1]).toEqual(firstBody)
  })

  it("allows library search but not add-on assignment for a search-only role", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = InternalOfferingEditorSchema.parse({ ...editorWithAddOns(), capabilities: { ...editorWithAddOns().capabilities, addOns: { canSearch: true, canCreate: false, canAssign: false } } })
    const firewood = libraryAddOn("55555555-5555-4555-8555-555555555555", "Дрова", "addon_firewood")
    gateway.getHouseEditor.mockResolvedValue(editor)
    gateway.listAddOnLibrary.mockResolvedValue({ items: [firewood], nextCursor: null })
    render(<TooltipProvider><MemoryRouter initialEntries={[`/offers/houses/${editor.offering.id}?tab=composition`]}><Routes><Route element={<HouseOfferingEditorPage gateway={gateway} />} path="/offers/houses/:offeringId" /></Routes></MemoryRouter></TooltipProvider>)

    const search = await screen.findByLabelText("Добавить из библиотеки")
    expect(search).toBeEnabled()
    await user.type(search, "дров")
    expect(await screen.findByRole("button", { name: "Добавить Дрова" })).toBeDisabled()
    expect(gateway.listAddOnLibrary).toHaveBeenLastCalledWith({ limit: 12, scope: "reusable", q: "дров" })
    expect(screen.queryByRole("button", { name: "Сохранить услуги" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Создать свой доп" })).not.toBeInTheDocument()
  })
})

function LocationProbe() { const location = useLocation(); return <span data-testid="location">{location.search}</span> }
function gatewayMock() { return { listHouses: vi.fn(), getHouseEditor: vi.fn(), listBindingTargets: vi.fn().mockResolvedValue({ items: [], nextCursor: null }), listAddOnLibrary: vi.fn().mockResolvedValue({ items: [], nextCursor: null }), replaceHouseBindings: vi.fn(), replaceAddOnAssignments: vi.fn(), createCustomAddOn: vi.fn(), createDraftPriceBook: vi.fn(), replaceDraftPriceBook: vi.fn(), previewHouseQuote: vi.fn() } as unknown as OfferingEditorGateway & { listHouses: ReturnType<typeof vi.fn>; getHouseEditor: ReturnType<typeof vi.fn>; listBindingTargets: ReturnType<typeof vi.fn>; replaceHouseBindings: ReturnType<typeof vi.fn>; listAddOnLibrary: ReturnType<typeof vi.fn>; replaceAddOnAssignments: ReturnType<typeof vi.fn>; createCustomAddOn: ReturnType<typeof vi.fn> } }
function resourceTarget(id: string, name: string, code: string) { return { type: "resource" as const, id, version: 5, name, code, kind: "house", capacity: { mode: "fixed" as const, total: 4 }, archived: false as const } }
function editorFixture() {
  return InternalOfferingEditorSchema.parse({
    offering: {
      id: "11111111-1111-4111-8111-111111111111", code: "house_pine", version: 3, kind: "house", state: "active",
      operationalName: "Дом «Сосна»", internalComment: "", salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included",
      businessCalendarId: "22222222-2222-4222-8222-222222222222", fulfillment: { kind: "house", stayPricing: "sum_each_local_night" }, activePriceBookId: null,
      archivedAt: null, createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z",
    },
    addOnTerms: null,
    addOnUsages: [],
    bindings: [{ id: "33333333-3333-4333-8333-333333333333", offeringId: "11111111-1111-4111-8111-111111111111", version: 1, target: { type: "resource", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, role: "primary", availabilityRequired: true, defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0 }],
    bindingTargets: [resourceTarget("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Дом «Сосна»", "house_pine")], priceBooks: [], addOnAssignments: [], addOnCatalog: [], editorial: null,
    ownerVersions: { catalog: 3, subject: { aggregateVersion: 2, primary: null }, pricing: 4, draftPriceBook: null, addOnAssignments: 1, editorial: null },
    capabilities: {
      catalog: { canEdit: false, canChangeState: false, canArchive: false }, subject: { canEdit: true, canManageBindings: true },
      pricing: { canView: true, canEditDraft: true, canActivate: false }, addOns: { canSearch: false, canCreate: false, canAssign: false },
      editorial: { canEdit: false, canReview: false, canPublish: false }, canPreviewQuote: false,
    },
  })
}

function editorWithEditorialLocator() {
  const editor = editorFixture()
  const nodeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const revisionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  const contentHash = "a".repeat(64)
  return InternalOfferingEditorSchema.parse({
    ...editor,
    editorial: {
      source: { sourceKind: "catalog_offering", sourceId: editor.offering.id, sourceVersion: 3, createdAt: "2026-09-01T10:00:00.000Z" },
      node: { id: nodeId, version: 2, kind: "resource_detail", status: "active" },
      currentRevision: { id: revisionId, revision: 2, state: "draft", path: "/drafts/houses/house_pine", title: "Дом «Сосна» — страница", contentHash },
      latestPublished: null,
      publication: { eligible: false, blockers: ["public_profile_missing", "revision_relation_missing", "safe_public_projection_missing"] },
    },
    ownerVersions: { ...editor.ownerVersions, editorial: { nodeId, nodeVersion: 2, draftRevisionId: revisionId, contentHash } },
  })
}

function editorWithAddOns() {
  const editor = editorFixture()
  return InternalOfferingEditorSchema.parse({
    ...editor,
    addOnAssignments: [{ id: "33333333-3333-4333-8333-333333333334", offeringId: editor.offering.id, version: 1, addOnOfferingId: "44444444-4444-4444-8444-444444444444", enabled: true, required: false, recommended: true, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minQuantityOverride: 1, maxQuantityOverride: 2, defaultQuantityOverride: 1, displayOrder: 0 }],
    addOnCatalog: [{ offering: { id: "44444444-4444-4444-8444-444444444444", version: 2, code: "addon_hot_tub", operationalName: "Банный чан", state: "active", archived: false }, serviceType: "scheduled_resource", scope: "reusable", ownerOfferingId: null, categoryKey: "comfort", standalone: true, availability: { status: "available", blocker: null } }],
    capabilities: { ...editor.capabilities, addOns: { canSearch: true, canCreate: false, canAssign: true } },
  })
}

function libraryAddOn(id: string, operationalName: string, code: string) {
  return { offering: { ...editorFixture().offering, id, version: 2, kind: "addon", operationalName, code, fulfillment: { kind: "addon", serviceType: "quantity_service", scope: "reusable", ownerOfferingId: null, standalone: true }, activePriceBookId: "66666666-6666-4666-8666-666666666666" }, serviceType: "quantity_service", scope: "reusable", ownerOfferingId: null, categoryKey: "comfort", standalone: true }
}
