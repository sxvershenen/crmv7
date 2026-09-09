import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { InternalOfferingEditorSchema, type InternalOfferingEditor } from "@crm/contracts"
import type { OfferingEditorGateway } from "@crm/offering-editor"
import { TooltipProvider } from "@crm/ui"

import { AddOnOfferingEditorPage } from "@app/pages/addon-offering-editor-page"
import { AddOnOfferingsPage } from "@app/pages/addon-offerings-page"

Object.defineProperty(window, "PointerEvent", { configurable: true, value: MouseEvent })

describe("CRM add-on offering routes", () => {
  it("persists registry search in the URL and drives the shared query", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    gateway.listAddOns.mockResolvedValue({ items: [], nextCursor: null })
    renderWithRouter(<><AddOnOfferingsPage gateway={gateway} /><LocationProbe /></>, ["/offers/addons"], "/offers/addons/*")

    await user.type(screen.getByLabelText("Поиск"), "чан")
    expect(await screen.findByText("Допы не найдены")).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent("q=%D1%87%D0%B0%D0%BD")
    expect(gateway.listAddOns).toHaveBeenLastCalledWith({ kind: "addon", limit: 25, q: "чан" })
  })

  it("renders a real not-found state", async () => {
    const gateway = gatewayMock()
    gateway.getAddOnEditor.mockResolvedValue(null)
    renderEditor(gateway)
    expect(await screen.findByText("Дополнение не найдено")).toBeInTheDocument()
  })

  it("creates a reusable service from the compact registry form", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    gateway.listAddOns.mockResolvedValue({ items: [], nextCursor: null })
    gateway.listActiveBusinessCalendars.mockResolvedValue({ items: [{ id: "22222222-2222-4222-8222-222222222222" }], nextCursor: null })
    gateway.createAddOn.mockResolvedValue({ offering: { id: "99999999-9999-4999-8999-999999999999" } })
    renderWithRouter(<><AddOnOfferingsPage gateway={gateway} /><LocationProbe /></>, ["/offers/addons"], "/offers/addons/*")

    await user.click(screen.getByRole("button", { name: "Новая услуга" }))
    await user.type(screen.getByLabelText("Название"), "Прокат велосипеда")
    await user.click(screen.getByRole("button", { name: "Создать услугу" }))

    expect(gateway.createAddOn).toHaveBeenCalledWith(expect.objectContaining({ operationalName: "Прокат велосипеда", businessCalendarId: "22222222-2222-4222-8222-222222222222", scope: "reusable", terms: expect.objectContaining({ serviceType: "quantity_service" }) }))
    expect(screen.getByTestId("location")).toHaveTextContent("/offers/addons/99999999-9999-4999-8999-999999999999")
  })

  it("keeps tabs in the URL, exposes typed usage and links the canonical CMS workspace", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = addOnEditor()
    gateway.getAddOnEditor.mockResolvedValue(editor)
    renderEditor(gateway)

    expect(await screen.findByRole("tab", { name: "Основное" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("button", { name: "Открыть в CMS" })).toHaveAttribute("href", `http://localhost:5174/offers/addons/${editor.offering.id}?tab=content&node=${editor.editorial!.node.id}`)
    expect(screen.queryByText(editor.editorial!.node.id)).not.toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Цена" }))
    expect(screen.getByTestId("location")).toHaveTextContent("?tab=pricing")
    expect(screen.getByLabelText("Цена за единицу, ₽")).toBeInTheDocument()
    expect(screen.queryByText("Ввод цен в действие")).not.toBeInTheDocument()
    expect(screen.queryByText("Тарифы")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Рассчитать" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Где используется" }))
    expect(screen.getByText("Дом «Сосна»")).toBeInTheDocument()
    expect(screen.queryByText(editor.addOnUsages[0]!.assignmentId)).not.toBeInTheDocument()
    expect(screen.queryByText(editor.addOnUsages[0]!.parentOffering.id)).not.toBeInTheDocument()
  })

  it("sends a full subject CAS replacement and preserves the exact body for conflict retry", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = addOnEditor()
    gateway.getAddOnEditor.mockResolvedValue(editor)
    gateway.replaceAddOnTerms.mockRejectedValue(Object.assign(new Error("Версия условий изменилась"), { status: 409 }))
    renderEditor(gateway, `?tab=terms`)

    const category = await screen.findByLabelText("Группа в каталоге")
    await user.clear(category)
    await user.type(category, "wellness")
    await user.click(screen.getByRole("button", { name: "Сохранить" }))
    expect(await screen.findByText("Услугу уже изменил другой пользователь")).toBeInTheDocument()
    const firstBody = gateway.replaceAddOnTerms.mock.calls[0]?.[1]
    expect(firstBody).toMatchObject({ expectedSubjectVersion: 3, standalone: true, terms: { categoryKey: "wellness", serviceType: "quantity_service", applicableOfferingKinds: ["house", "campground"], quantity: { min: 1, max: 5, default: 1, step: 1, metric: "units" } } })
    expect(category).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Повторить сохранение" }))
    expect(gateway.replaceAddOnTerms.mock.calls[1]?.[1]).toEqual(firstBody)
  })

  it("keeps terms readable and immutable for a readonly role", async () => {
    const gateway = gatewayMock()
    const editor = addOnEditor()
    gateway.getAddOnEditor.mockResolvedValue(InternalOfferingEditorSchema.parse({ ...editor, capabilities: { ...editor.capabilities, subject: { canEdit: false, canManageBindings: false }, pricing: { canView: true, canEditDraft: false, canActivate: false } } }))
    renderEditor(gateway, "?tab=terms")
    expect((await screen.findAllByText("Только просмотр")).length).toBeGreaterThan(0)
    expect(screen.getByLabelText("Группа в каталоге")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument()
  })

  it("applies the single add-on price immediately after save", async () => {
    const user = userEvent.setup()
    const gateway = gatewayMock()
    const editor = addOnEditor()
    gateway.getAddOnEditor.mockResolvedValue(editor)
    gateway.createDraftPriceBook.mockResolvedValue({ priceBook: { id: "88888888-8888-4888-8888-888888888888" }, pricingVersion: 4 })
    gateway.activatePriceBook.mockResolvedValue({})
    renderEditor(gateway, "?tab=pricing")

    const price = await screen.findByLabelText("Цена за единицу, ₽")
    await user.clear(price)
    await user.type(price, "900")
    await user.click(screen.getByRole("button", { name: "Сохранить цену" }))

    expect(gateway.activatePriceBook).toHaveBeenCalledWith(editor.offering.id, "88888888-8888-4888-8888-888888888888", expect.objectContaining({ expectedPricingVersion: 4, reason: "Цена изменена в CRM" }))
  })
})

function renderEditor(gateway: ReturnType<typeof gatewayMock>, suffix = "") {
  renderWithRouter(<><AddOnOfferingEditorPage gateway={gateway} /><LocationProbe /></>, [`/offers/addons/11111111-1111-4111-8111-111111111111${suffix}`], "/offers/addons/:offeringId")
}
function renderWithRouter(children: React.ReactNode, entries: string[], path = "/offers/addons") { return render(<TooltipProvider><MemoryRouter initialEntries={entries}><Routes><Route element={children} path={path} /></Routes></MemoryRouter></TooltipProvider>) }
function LocationProbe() { const location = useLocation(); return <span data-testid="location">{location.pathname}{location.search}</span> }
function gatewayMock() {
  return { listAddOns: vi.fn(), listActiveBusinessCalendars: vi.fn(), createAddOn: vi.fn(), getAddOnEditor: vi.fn(), replaceAddOnTerms: vi.fn(), createDraftPriceBook: vi.fn(), replaceDraftPriceBook: vi.fn(), activatePriceBook: vi.fn(), schedulePriceBook: vi.fn() } as unknown as OfferingEditorGateway & {
    listAddOns: ReturnType<typeof vi.fn>
    listActiveBusinessCalendars: ReturnType<typeof vi.fn>
    createAddOn: ReturnType<typeof vi.fn>
    getAddOnEditor: ReturnType<typeof vi.fn>
    replaceAddOnTerms: ReturnType<typeof vi.fn>
    createDraftPriceBook: ReturnType<typeof vi.fn>
    activatePriceBook: ReturnType<typeof vi.fn>
  }
}

function addOnEditor(): InternalOfferingEditor {
  const nodeId = "44444444-4444-4444-8444-444444444444"
  return InternalOfferingEditorSchema.parse({
    offering: { id: "11111111-1111-4111-8111-111111111111", code: "ADDON-HOT-TUB", version: 2, kind: "addon", state: "active", operationalName: "Банный чан", internalComment: "", salesMode: "selectable", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: "22222222-2222-4222-8222-222222222222", fulfillment: { kind: "addon", serviceType: "quantity_service", standalone: true, scope: "reusable", ownerOfferingId: null }, activePriceBookId: null, archivedAt: null, createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-02T10:00:00.000Z" },
    addOnTerms: { serviceType: "quantity_service", categoryKey: "comfort", applicableOfferingKinds: ["house", "campground"], quantity: { min: 1, max: 5, default: 1, step: 1, metric: "units" } },
    addOnUsages: [{ assignmentId: "55555555-5555-4555-8555-555555555555", parentOffering: { id: "66666666-6666-4666-8666-666666666666", kind: "house", code: "HOUSE-PINE", operationalName: "Дом «Сосна»", state: "active" }, enabled: true, required: false, recommended: true, groupKey: null, displayOrder: 0 }],
    bindings: [], bindingTargets: [], priceBooks: [], addOnAssignments: [], addOnCatalog: [],
    editorial: { source: { sourceKind: "catalog_offering", sourceId: "11111111-1111-4111-8111-111111111111", sourceVersion: 2, createdAt: "2026-09-02T10:00:00.000Z" }, node: { id: nodeId, version: 1, kind: "addon_detail", status: "active" }, currentRevision: { id: "77777777-7777-4777-8777-777777777777", revision: 1, state: "draft", path: "/drafts/addons/hot-tub", title: "Банный чан — страница", contentHash: "a".repeat(64) }, latestPublished: null, publication: { eligible: false, blockers: ["safe_public_projection_missing"] } },
    ownerVersions: { catalog: 2, subject: { aggregateVersion: 3, primary: null }, pricing: 1, draftPriceBook: null, addOnAssignments: 1, editorial: { nodeId, nodeVersion: 1, draftRevisionId: "77777777-7777-4777-8777-777777777777", contentHash: "a".repeat(64) } },
    capabilities: { catalog: { canEdit: false, canChangeState: false, canArchive: false }, subject: { canEdit: true, canManageBindings: false }, pricing: { canView: true, canEditDraft: true, canActivate: true }, addOns: { canSearch: false, canCreate: false, canAssign: false }, editorial: { canEdit: false, canReview: false, canPublish: false }, canPreviewQuote: false },
  })
}
