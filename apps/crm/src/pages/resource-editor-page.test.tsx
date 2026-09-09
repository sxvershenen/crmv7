import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@crm/ui"
import type { OfferingEditorGateway } from "@crm/offering-editor"
import type { InternalOfferingEditor } from "@crm/contracts"

import { FixtureResourceRepository, type ResourceEditorRepository } from "@app/data/resources-repository"

import { ResourceEditorPage, type ResourceOfferingLookupGateway } from "./resource-editor-page"

function LocationProbe() { const location = useLocation(); return <output aria-label="Текущий URL">{location.pathname}{location.search}</output> }
function renderEditor(entry = "/resources/houses/house-pine") { return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><ResourceEditorPage repository={new FixtureResourceRepository()} /><LocationProbe /></>} path="resources/:kind/:resourceId" /></Routes></TooltipProvider></MemoryRouter>) }

function renderEditorWithOfferingGateway(gateway: OfferingEditorGateway & ResourceOfferingLookupGateway, entry = "/resources/houses/house-pine?tab=offering") {
  return render(<MemoryRouter initialEntries={[entry]}><TooltipProvider><Routes><Route element={<><ResourceEditorPage offeringGateway={gateway} repository={new FixtureResourceRepository()} /><LocationProbe /></>} path="resources/:kind/:resourceId" /></Routes></TooltipProvider></MemoryRouter>)
}

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
    await user.click(screen.getByRole("button", { name: "Период блокировки" }))
    await user.click(screen.getByRole("button", { name: /^вторник, 1 сентября 2026 г\.$/ }))
    await user.click(screen.getByRole("button", { name: /^среда, 2 сентября 2026 г\.$/ }))
    fireEvent.change(screen.getByLabelText("Период блокировки: время начала"), { target: { value: "10:00" } })
    fireEvent.change(screen.getByLabelText("Период блокировки: время окончания"), { target: { value: "14:00" } })
    await user.click(screen.getByRole("button", { name: "Готово" }))
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

  it("keeps sale terms inside the resource dossier and shows an explicit unlinked state", async () => {
    const resolvePrimaryStayOffering = vi.fn().mockResolvedValue({ resolution: "none" })
    renderEditorWithOfferingGateway({ resolvePrimaryStayOffering, createStayOffering: vi.fn() } as unknown as OfferingEditorGateway & ResourceOfferingLookupGateway)

    expect(await screen.findByText("Цена и страница ещё не настроены")).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Цена и сайт" })).toHaveAttribute("aria-selected", "true")
    expect(resolvePrimaryStayOffering).toHaveBeenCalledWith("house-pine")
    expect(document.querySelectorAll('[data-slot="editor-frame"]')).toHaveLength(1)
  })

  it("fails closed when legacy data links several offerings to one resource", async () => {
    const resolvePrimaryStayOffering = vi.fn().mockResolvedValue({
      resolution: "ambiguous",
      candidates: [
        { offeringId: "11111111-1111-4111-8111-111111111111", kind: "house", code: "HOUSE-PINE-A", operationalName: "Дом «Сосна» A", state: "active" },
        { offeringId: "22222222-2222-4222-8222-222222222222", kind: "house", code: "HOUSE-PINE-B", operationalName: "Дом «Сосна» B", state: "draft" },
      ],
    })
    renderEditorWithOfferingGateway({ resolvePrimaryStayOffering, createStayOffering: vi.fn() } as unknown as OfferingEditorGateway & ResourceOfferingLookupGateway)

    expect(await screen.findByText("Нужна проверка данных")).toBeInTheDocument()
    expect(screen.getAllByText("Дубль")).toHaveLength(2)
    expect(screen.getByText("HOUSE-PINE-A")).toBeInTheDocument()
    expect(screen.getByText("HOUSE-PINE-B")).toBeInTheDocument()
  })

  it("opens the canonical business dossier for website content", async () => {
    const offeringId = "11111111-1111-4111-8111-111111111111"
    const gateway = {
      resolvePrimaryStayOffering: vi.fn().mockResolvedValue({ resolution: "linked", offering: { offeringId, kind: "house", code: "HOUSE-PINE", operationalName: "Дом «Сосна»", state: "active" } }),
      getHouseEditor: vi.fn().mockResolvedValue(linkedHouseEditor(offeringId)),
    } as unknown as OfferingEditorGateway & ResourceOfferingLookupGateway
    renderEditorWithOfferingGateway(gateway)

    expect(await screen.findByText("Дом «Сосна» — страница")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Редактировать страницу" })).toHaveAttribute("href", `http://localhost:5174/offers/houses/${offeringId}?tab=content`)
    expect(document.querySelectorAll('[data-slot="editor-frame"]')).toHaveLength(1)
  })

  it("adds and removes additional services from the embedded resource offering tab", async () => {
    const user = userEvent.setup()
    const offeringId = "11111111-1111-4111-8111-111111111111"
    const breakfastId = "33333333-3333-4333-8333-333333333333"
    const firewoodId = "44444444-4444-4444-8444-444444444444"
    const transferId = "77777777-7777-4777-8777-777777777777"
    const editor = linkedHouseEditor(offeringId)
    editor.addOnAssignments = [assignment(offeringId, breakfastId)]
    editor.addOnCatalog = [catalogItem(breakfastId, "ADDON-BREAKFAST", "Завтрак в корзине")]
    editor.capabilities.addOns = { canSearch: true, canCreate: true, canAssign: true }
    const requestOnlyFirewood = libraryItem(firewoodId, "ADDON-FIREWOOD", "Дрова для костра")
    requestOnlyFirewood.offering = { ...requestOnlyFirewood.offering, salesMode: "request_only", activePriceBookId: null }
    const draftTransfer = libraryItem(transferId, "ADDON-TRANSFER", "Трансфер от станции")
    draftTransfer.offering = { ...draftTransfer.offering, state: "draft" }
    const gateway = {
      resolvePrimaryStayOffering: vi.fn().mockResolvedValue({ resolution: "linked", offering: { offeringId, kind: "house", code: "HOUSE-PINE", operationalName: "Дом «Сосна»", state: "active" } }),
      getHouseEditor: vi.fn().mockResolvedValue(editor),
      listAddOnLibrary: vi.fn().mockResolvedValue({ items: [draftTransfer, requestOnlyFirewood], nextCursor: null }),
      replaceAddOnAssignments: vi.fn().mockResolvedValue({ assignments: [], addOnsVersion: 2 }),
    } as unknown as OfferingEditorGateway & ResourceOfferingLookupGateway
    renderEditorWithOfferingGateway(gateway)

    expect(await screen.findByText("Завтрак в корзине")).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Добавить Трансфер от станции" })).toBeDisabled()
    expect(screen.getByText("Не готов в CRM")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Обновить библиотеку услуг" })).toBeEnabled()
    await user.click(screen.getByRole("button", { name: "Убрать Завтрак в корзине" }))
    await user.click(await screen.findByRole("button", { name: "Добавить Дрова для костра" }))
    await user.click(screen.getByRole("button", { name: "Сохранить услуги" }))

    expect(gateway.replaceAddOnAssignments).toHaveBeenCalledWith(offeringId, expect.objectContaining({
      expectedAddOnsVersion: 1,
      assignments: [expect.objectContaining({ addOnOfferingId: firewoodId, enabled: true })],
    }))
  })

  it("creates the commercial dossier from the resource tab and opens it in place", async () => {
    const user = userEvent.setup()
    const offeringId = "11111111-1111-4111-8111-111111111111"
    const gateway = {
      resolvePrimaryStayOffering: vi.fn().mockResolvedValue({ resolution: "none" }),
      createStayOffering: vi.fn().mockResolvedValue({ offeringId, kind: "house", code: "HOUSE-PINE", operationalName: "Дом «Сосна»", state: "draft" }),
      getHouseEditor: vi.fn().mockResolvedValue(null),
    } as unknown as OfferingEditorGateway & ResourceOfferingLookupGateway
    renderEditorWithOfferingGateway(gateway)

    await user.click(await screen.findByRole("button", { name: "Подготовить цену и страницу" }))
    expect(gateway.createStayOffering).toHaveBeenCalledWith("house-pine", expect.objectContaining({ operationId: expect.any(String), idempotencyKey: expect.any(String) }))
    expect(gateway.getHouseEditor).toHaveBeenCalledWith(offeringId)
    expect(await screen.findByText("Домик не найден")).toBeInTheDocument()
  })

  it("prepares stay pricing and the CMS draft as part of the first resource save", async () => {
    const user = userEvent.setup()
    const resourceId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    let savedRecord: Awaited<ReturnType<ResourceEditorRepository["save"]>> | null = null
    const repository: ResourceEditorRepository = {
      get: vi.fn(async () => savedRecord),
      save: vi.fn(async (resource) => {
        const saved = { ...resource, id: resourceId }
        savedRecord = saved
        return saved
      }),
    }
    const gateway = {
      createStayOffering: vi.fn().mockResolvedValue({ offeringId: "11111111-1111-4111-8111-111111111111", kind: "house", code: "HOUSE-NEW", operationalName: "Новый ресурс", state: "draft" }),
      resolvePrimaryStayOffering: vi.fn().mockResolvedValue({ resolution: "none" }),
    } as unknown as OfferingEditorGateway & ResourceOfferingLookupGateway

    render(<MemoryRouter initialEntries={["/resources/houses/new"]}><TooltipProvider><Routes><Route element={<><ResourceEditorPage offeringGateway={gateway} repository={repository} /><LocationProbe /></>} path="resources/:kind/:resourceId" /></Routes></TooltipProvider></MemoryRouter>)

    await user.click(await screen.findByRole("button", { name: "Сохранить" }))
    expect(gateway.createStayOffering).toHaveBeenCalledWith(resourceId, expect.objectContaining({ operationId: expect.any(String), idempotencyKey: expect.any(String) }))
    expect(await screen.findByLabelText("Текущий URL")).toHaveTextContent(`/resources/houses/${resourceId}?tab=offering`)
  })
})

function linkedHouseEditor(offeringId: string): InternalOfferingEditor {
  const nodeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const revisionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  const contentHash = "a".repeat(64)
  return {
    offering: {
      id: offeringId, code: "HOUSE-PINE", version: 2, kind: "house", state: "active", operationalName: "Дом «Сосна»", internalComment: "", salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: "22222222-2222-4222-8222-222222222222", fulfillment: { kind: "house", stayPricing: "sum_each_local_night" }, activePriceBookId: null, archivedAt: null, createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z",
    },
    addOnTerms: null, addOnUsages: [], bindings: [], bindingTargets: [], priceBooks: [], addOnAssignments: [], addOnCatalog: [],
    editorial: {
      source: { sourceKind: "catalog_offering", sourceId: offeringId, sourceVersion: 2, createdAt: "2026-09-01T10:00:00.000Z" },
      node: { id: nodeId, version: 1, kind: "resource_detail", status: "active" },
      currentRevision: { id: revisionId, revision: 1, state: "draft", path: "/houses/sosna", title: "Дом «Сосна» — страница", contentHash },
      latestPublished: null,
      publication: { eligible: false, blockers: ["public_profile_missing"] },
    },
    ownerVersions: { catalog: 2, subject: { aggregateVersion: 1, primary: null }, pricing: 1, draftPriceBook: null, addOnAssignments: 1, editorial: { nodeId, nodeVersion: 1, draftRevisionId: revisionId, contentHash } },
    capabilities: { catalog: { canEdit: false, canChangeState: false, canArchive: false }, subject: { canEdit: false, canManageBindings: false }, pricing: { canView: true, canEditDraft: true, canActivate: true }, addOns: { canSearch: false, canCreate: false, canAssign: false }, editorial: { canEdit: true, canReview: true, canPublish: true }, canPreviewQuote: false },
  }
}

function assignment(offeringId: string, addOnOfferingId: string): InternalOfferingEditor["addOnAssignments"][number] {
  return { id: "55555555-5555-4555-8555-555555555555", offeringId, addOnOfferingId, version: 1, enabled: true, required: false, recommended: false, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minQuantityOverride: null, maxQuantityOverride: null, defaultQuantityOverride: null, displayOrder: 0 }
}

function catalogItem(id: string, code: string, operationalName: string): InternalOfferingEditor["addOnCatalog"][number] {
  return { offering: { id, version: 1, code, operationalName, state: "active", archived: false }, serviceType: "quantity_service", scope: "reusable", ownerOfferingId: null, categoryKey: "comfort", standalone: true, availability: { status: "available", blocker: null } }
}

function libraryItem(id: string, code: string, operationalName: string): Awaited<ReturnType<OfferingEditorGateway["listAddOnLibrary"]>>["items"][number] {
  return {
    offering: { id, code, version: 1, kind: "addon", state: "active", operationalName, internalComment: "", salesMode: "selectable", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: "22222222-2222-4222-8222-222222222222", fulfillment: { kind: "addon", serviceType: "quantity_service", standalone: true, scope: "reusable", ownerOfferingId: null }, activePriceBookId: "66666666-6666-4666-8666-666666666666", archivedAt: null, createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z" },
    serviceType: "quantity_service", scope: "reusable", ownerOfferingId: null, categoryKey: "comfort", standalone: true,
  }
}
