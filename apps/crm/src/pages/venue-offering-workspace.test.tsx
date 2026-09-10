import { render, screen, waitFor } from "@testing-library/react"
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
    expect(screen.getByText("Прайс-лист доступен только для чтения: нет права изменять цены.")).toBeInTheDocument()
    expect(screen.getByText("Operational Resource")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("status", { name: "Загрузка досье площадки" })).not.toBeInTheDocument())
  })
})
