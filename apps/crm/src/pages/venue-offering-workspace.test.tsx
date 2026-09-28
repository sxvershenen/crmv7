import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { InternalOfferingEditor } from "@crm/contracts"
import type { OfferingEditorGateway } from "@crm/offering-editor"
import { VenueOfferingWorkspace } from "@crm/offering-editor"

const offeringId = "11111111-1111-4111-8111-111111111111"
const resourceId = "22222222-2222-4222-8222-222222222222"

function editor(overrides: Partial<InternalOfferingEditor> = {}): InternalOfferingEditor {
  return {
    offering: {
      id: offeringId,
      code: "VENUE-MEADOW",
      version: 2,
      kind: "venue",
      state: "active",
      operationalName: "Поляна",
      internalComment: "Внутренняя заметка",
      salesMode: "selectable",
      priceDisplayMode: "from",
      currency: "RUB",
      timezone: "Europe/Moscow",
      taxMode: "tax_included",
      businessCalendarId: "33333333-3333-4333-8333-333333333333",
      fulfillment: { kind: "venue", allocationMode: "exclusive_resource", capacityUnit: "guests", pricingMode: "rate_plan" },
      activePriceBookId: null,
      archivedAt: null,
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-01T10:00:00.000Z",
    },
    addOnTerms: null,
    addOnUsages: [],
    bindings: [{ id: "44444444-4444-4444-8444-444444444444", offeringId, version: 1, target: { type: "resource", id: resourceId }, role: "primary", availabilityRequired: true, defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0 }],
    bindingTargets: [{ type: "resource", id: resourceId, version: 3, code: "MEADOW", name: "Поляна", kind: "venue", capacity: { mode: "fixed", total: 40 }, archived: false }],
    priceBooks: [],
    addOnAssignments: [],
    addOnCatalog: [],
    editorial: null,
    ownerVersions: { catalog: 2, subject: { aggregateVersion: 3, primary: { type: "resource", id: resourceId, version: 3 } }, pricing: 1, draftPriceBook: null, addOnAssignments: 1, editorial: null },
    capabilities: {
      catalog: { canEdit: false, canChangeState: false, canArchive: false },
      subject: { canEdit: false, canManageBindings: false },
      pricing: { canView: true, canEditDraft: false, canActivate: false },
      addOns: { canSearch: false, canCreate: false, canAssign: false },
      editorial: { canEdit: false, canReview: false, canPublish: false },
      canPreviewQuote: false,
    },
    ...overrides,
  }
}

function gateway(getVenueEditor: OfferingEditorGateway["getVenueEditor"]): OfferingEditorGateway {
  return { getVenueEditor } as OfferingEditorGateway
}

describe("VenueOfferingWorkspace", () => {
  it("renders the loading state before the editor request resolves", () => {
    let resolve!: (value: InternalOfferingEditor | null) => void
    const pending = new Promise<InternalOfferingEditor | null>((nextResolve) => { resolve = nextResolve })
    render(<VenueOfferingWorkspace gateway={gateway(vi.fn(() => pending))} offeringId={offeringId} />)
    expect(screen.getByRole("status", { name: "Загрузка досье площадки" })).toBeInTheDocument()
    resolve(null)
  })

  it("renders a conflict-specific error state", async () => {
    const failure = Object.assign(new Error("Версия уже изменилась"), { status: 409 })
    render(<VenueOfferingWorkspace gateway={gateway(vi.fn().mockRejectedValue(failure))} offeringId={offeringId} />)
    expect(await screen.findByText("Версия досье изменилась")).toBeInTheDocument()
    expect(screen.getByText("Версия уже изменилась")).toBeInTheDocument()
  })

  it("fails closed when the editor returns a non-venue offering", async () => {
    const wrongKind = editor({ offering: { ...editor().offering, kind: "house", fulfillment: { kind: "house", stayPricing: "sum_each_local_night" } } as InternalOfferingEditor["offering"] })
    render(<VenueOfferingWorkspace gateway={gateway(vi.fn().mockResolvedValue(wrongKind))} offeringId={offeringId} />)
    expect(await screen.findByText("Получен другой тип предложения")).toBeInTheDocument()
    expect(screen.getByText("Публичная площадка не может быть показана как домик.")).toBeInTheDocument()
  })

  it("shows the venue dossier and keeps operational editing read-only when capability is absent", async () => {
    render(<VenueOfferingWorkspace gateway={gateway(vi.fn().mockResolvedValue(editor()))} offeringId={offeringId} />)
    expect(await screen.findByText("Досье площадки")).toBeInTheDocument()
    expect(screen.getByText("Только чтение")).toBeInTheDocument()
    expect(screen.getByText("Только просмотр")).toBeInTheDocument()
    expect(screen.getByLabelText("Цена за час, ₽")).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Сохранить цены" })).not.toBeInTheDocument()
    expect(screen.getByText("Operational Resource")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("status", { name: "Загрузка досье площадки" })).not.toBeInTheDocument())
  })

  it("saves and applies a venue price with the refreshed pricing version", async () => {
    const activeBook: InternalOfferingEditor["priceBooks"][number] = {
      id: "55555555-5555-4555-8555-555555555555",
      offeringId,
      version: 1,
      revision: 1,
      state: "active",
      name: "Основной тариф",
      currency: "RUB",
      timezone: "Europe/Moscow",
      validFrom: "2026-09-01",
      validToExclusive: null,
      changeReason: "Начальная цена",
      scheduledActivationAt: null,
      activatedAt: "2026-09-01T00:00:00.000Z",
      retiredAt: null,
      supersedesPriceBookId: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      ratePlans: [{ id: "66666666-6666-4666-8666-666666666666", priceBookId: "55555555-5555-4555-8555-555555555555", version: 1, key: "standard", label: "Стандарт", pricingBasis: "per_hour", quantityMetric: "guests", baseAmount: 200000, includedQuantity: 40, baseExtraUnitAmount: 0, minQuantity: null, maxQuantity: null, minDurationMinutes: null, maxDurationMinutes: null, isDefault: true, displayOrder: 0, rules: [] }],
    }
    const draftBook: InternalOfferingEditor["priceBooks"][number] = { ...activeBook, id: "77777777-7777-4777-8777-777777777777", revision: 2, state: "draft", ratePlans: [{ ...activeBook.ratePlans[0]!, id: "88888888-8888-4888-8888-888888888888", priceBookId: "77777777-7777-4777-8777-777777777777", baseAmount: 220000 }] }
    const writable = editor({ offering: { ...editor().offering, activePriceBookId: activeBook.id }, priceBooks: [activeBook], capabilities: { ...editor().capabilities, pricing: { canView: true, canEditDraft: true, canActivate: true } } })
    const withDraft = editor({ ...writable, ownerVersions: { ...writable.ownerVersions, pricing: 2 }, priceBooks: [activeBook, draftBook] })
    const applied = editor({ ...withDraft, offering: { ...writable.offering, activePriceBookId: draftBook.id }, ownerVersions: { ...writable.ownerVersions, pricing: 3 }, priceBooks: [{ ...activeBook, state: "retired" }, { ...draftBook, state: "active" }] })
    const getVenueEditor = vi.fn().mockResolvedValueOnce(writable).mockResolvedValue(applied)
    const createDraftPriceBook = vi.fn().mockResolvedValue({ priceBook: draftBook, pricingVersion: 2 })
    const activatePriceBook = vi.fn().mockResolvedValue({ priceBook: { ...draftBook, state: "active" }, pricingVersion: 3 })
    render(<VenueOfferingWorkspace gateway={{ getVenueEditor, createDraftPriceBook, activatePriceBook } as unknown as OfferingEditorGateway} offeringId={offeringId} />)

    fireEvent.change(await screen.findByLabelText("Цена за час, ₽"), { target: { value: "2200" } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить и применить" }))
    await waitFor(() => expect(createDraftPriceBook).toHaveBeenCalledOnce())
    expect(createDraftPriceBook).toHaveBeenCalledWith(offeringId, expect.objectContaining({
      expectedPricingVersion: 1,
      supersedesPriceBookId: activeBook.id,
      ratePlans: [expect.objectContaining({ pricingBasis: "per_hour", baseAmount: 220000, includedQuantity: 40 })],
    }))

    await waitFor(() => expect(activatePriceBook).toHaveBeenCalledOnce())
    expect(activatePriceBook).toHaveBeenCalledWith(offeringId, draftBook.id, expect.objectContaining({ expectedPricingVersion: 2, reason: "Цена изменена в CRM" }))
    expect(await screen.findByText("Цена сохранена и уже действует")).toBeInTheDocument()
    expect(screen.queryByText("Когда применить изменения")).not.toBeInTheDocument()
  })

  it("keeps a saved draft visible when venue price activation fails", async () => {
    const writable = editor({ capabilities: { ...editor().capabilities, pricing: { canView: true, canEditDraft: true, canActivate: true } } })
    const draftBook: InternalOfferingEditor["priceBooks"][number] = {
      id: "77777777-7777-4777-8777-777777777777", offeringId, version: 1, revision: 1, state: "draft", name: "Новый прайс-лист", currency: "RUB", timezone: "Europe/Moscow", validFrom: "2026-09-28", validToExclusive: null, changeReason: "", scheduledActivationAt: null, activatedAt: null, retiredAt: null, supersedesPriceBookId: null, createdAt: "2026-09-28T00:00:00.000Z", updatedAt: "2026-09-28T00:00:00.000Z",
      ratePlans: [{ id: "88888888-8888-4888-8888-888888888888", priceBookId: "77777777-7777-4777-8777-777777777777", version: 1, key: "standard", label: "Стандарт", pricingBasis: "per_hour", quantityMetric: "guests", baseAmount: 100000, includedQuantity: null, baseExtraUnitAmount: null, minQuantity: null, maxQuantity: null, minDurationMinutes: null, maxDurationMinutes: null, isDefault: true, displayOrder: 0, rules: [] }],
    }
    const withDraft = editor({ ...writable, ownerVersions: { ...writable.ownerVersions, pricing: 2 }, priceBooks: [draftBook] })
    const getVenueEditor = vi.fn().mockResolvedValueOnce(writable).mockResolvedValue(withDraft)
    const createDraftPriceBook = vi.fn().mockResolvedValue({ priceBook: draftBook, pricingVersion: 2 })
    const activatePriceBook = vi.fn().mockRejectedValue(new Error("Период тарифа не подходит"))
    render(<VenueOfferingWorkspace gateway={{ getVenueEditor, createDraftPriceBook, activatePriceBook } as unknown as OfferingEditorGateway} offeringId={offeringId} />)

    fireEvent.change(await screen.findByLabelText("Цена за час, ₽"), { target: { value: "1000" } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить и применить" }))
    expect(await screen.findByText("Цена не применена")).toBeInTheDocument()
    expect(screen.getByText(/цена на сайте не изменилась/)).toBeInTheDocument()
    expect(screen.getByText("Подготовлены новые цены")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Причина"), { target: { value: "Повторить после исправления периода" } })
    expect(screen.getByRole("button", { name: "Применить сейчас" })).toBeEnabled()
    expect(screen.getByRole("button", { name: "Сохранить и применить" })).toBeDisabled()
  })

  it("recognizes an applied venue price when only the activation response is lost", async () => {
    const writable = editor({ capabilities: { ...editor().capabilities, pricing: { canView: true, canEditDraft: true, canActivate: true } } })
    const draftBook: InternalOfferingEditor["priceBooks"][number] = {
      id: "77777777-7777-4777-8777-777777777777", offeringId, version: 1, revision: 1, state: "draft", name: "Новый прайс-лист", currency: "RUB", timezone: "Europe/Moscow", validFrom: "2026-09-28", validToExclusive: null, changeReason: "", scheduledActivationAt: null, activatedAt: null, retiredAt: null, supersedesPriceBookId: null, createdAt: "2026-09-28T00:00:00.000Z", updatedAt: "2026-09-28T00:00:00.000Z",
      ratePlans: [{ id: "88888888-8888-4888-8888-888888888888", priceBookId: "77777777-7777-4777-8777-777777777777", version: 1, key: "standard", label: "Стандарт", pricingBasis: "per_hour", quantityMetric: "guests", baseAmount: 100000, includedQuantity: null, baseExtraUnitAmount: null, minQuantity: null, maxQuantity: null, minDurationMinutes: null, maxDurationMinutes: null, isDefault: true, displayOrder: 0, rules: [] }],
    }
    const applied = editor({ ...writable, offering: { ...writable.offering, activePriceBookId: draftBook.id }, ownerVersions: { ...writable.ownerVersions, pricing: 3 }, priceBooks: [{ ...draftBook, state: "active" }] })
    const getVenueEditor = vi.fn().mockResolvedValueOnce(writable).mockResolvedValue(applied)
    const createDraftPriceBook = vi.fn().mockResolvedValue({ priceBook: draftBook, pricingVersion: 2 })
    const activatePriceBook = vi.fn().mockRejectedValue(new Error("Ответ сервера потерян"))
    render(<VenueOfferingWorkspace gateway={{ getVenueEditor, createDraftPriceBook, activatePriceBook } as unknown as OfferingEditorGateway} offeringId={offeringId} />)

    fireEvent.change(await screen.findByLabelText("Цена за час, ₽"), { target: { value: "1000" } })
    fireEvent.click(screen.getByRole("button", { name: "Сохранить и применить" }))
    expect(await screen.findByText("Цена сохранена и уже действует")).toBeInTheDocument()
    expect(screen.queryByText("Цена не применена")).not.toBeInTheDocument()
  })
})
