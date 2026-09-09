import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { InternalOfferingEditorSchema } from "@crm/contracts"
import type { OfferingEditorGateway } from "@crm/offering-editor"
import { TooltipProvider } from "@crm/ui"

import { cmsRepository } from "@admin/data/cms-repository"
import { AdminAuthSessionProvider } from "@admin/features/auth-session"
import { editorFixtures } from "@admin/fixtures/cms"
import { AddOnOfferingWorkspacePage } from "@admin/pages/addon-offerings-page"

describe("CMS add-on page compatibility route", () => {
  afterEach(() => vi.restoreAllMocks())

  it("shows the canonical page editor without operational conditions, pricing or usage", async () => {
    const editor = addonEditor()
    const gateway = { getAddOnEditor: vi.fn().mockResolvedValue(editor) } as unknown as OfferingEditorGateway
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue({ ...editorFixtures["house-lesnoy"]!, id: editor.editorial!.node.id, internalName: "Дрова — страница" })

    renderWorkspace(gateway, `/offers/addons/${editor.offering.id}?tab=terms`)

    expect(await screen.findByRole("tab", { name: "Содержимое" })).toHaveAttribute("aria-selected", "true")
    expect(screen.queryByRole("tab", { name: "Условия" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Цены" })).not.toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Использование" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Прайс-лист|Operational|Версии/)).not.toBeInTheDocument()
    expect(screen.getByText("Цена и работа ресурса — в CRM").closest("a")).toHaveAttribute("href", `http://localhost:5173/offers/addons/${editor.offering.id}`)
  })

  it("rejects a locator pointing to another page kind", async () => {
    const editor = InternalOfferingEditorSchema.parse({ ...addonEditor(), editorial: { ...addonEditor().editorial!, node: { ...addonEditor().editorial!.node, kind: "resource_detail" } } })
    const gateway = { getAddOnEditor: vi.fn().mockResolvedValue(editor) } as unknown as OfferingEditorGateway

    renderWorkspace(gateway, `/offers/addons/${editor.offering.id}`)

    expect(await screen.findByText("Связана страница другого типа")).toBeInTheDocument()
  })
})

function renderWorkspace(gateway: OfferingEditorGateway, entry: string) {
  return render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter initialEntries={[entry]}><Routes><Route element={<AddOnOfferingWorkspacePage gateway={gateway} />} path="/offers/addons/:offeringId" /></Routes></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
}

function addonEditor() {
  const offeringId = "11111111-1111-4111-8111-111111111111"
  const nodeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const revisionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  return InternalOfferingEditorSchema.parse({
    offering: { id: offeringId, code: "ADDON-FIREWOOD", version: 3, kind: "addon", state: "active", operationalName: "Дрова", internalComment: "", salesMode: "selectable", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: "22222222-2222-4222-8222-222222222222", fulfillment: { kind: "addon", serviceType: "quantity_service", standalone: true, scope: "reusable", ownerOfferingId: null }, activePriceBookId: null, archivedAt: null, createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z" },
    addOnTerms: { serviceType: "quantity_service", categoryKey: "comfort", applicableOfferingKinds: ["house", "campground"], quantity: { metric: "units", min: 1, max: 10, default: 1, step: 1 } }, addOnUsages: [], bindings: [], bindingTargets: [], priceBooks: [], addOnAssignments: [], addOnCatalog: [],
    editorial: { source: { sourceKind: "catalog_offering", sourceId: offeringId, sourceVersion: 3, createdAt: "2026-09-01T10:00:00.000Z" }, node: { id: nodeId, version: 2, kind: "addon_detail", status: "active" }, currentRevision: { id: revisionId, revision: 2, state: "draft", path: "/addons/firewood", title: "Дрова", contentHash: "b".repeat(64) }, latestPublished: null, publication: { eligible: true, blockers: [] } },
    ownerVersions: { catalog: 3, subject: { aggregateVersion: 2, primary: null }, pricing: 4, draftPriceBook: null, addOnAssignments: 1, editorial: { nodeId, nodeVersion: 2, draftRevisionId: revisionId, contentHash: "b".repeat(64) } },
    capabilities: { catalog: { canEdit: false, canChangeState: false, canArchive: false }, subject: { canEdit: true, canManageBindings: false }, pricing: { canView: true, canEditDraft: true, canActivate: true }, addOns: { canSearch: false, canCreate: false, canAssign: false }, editorial: { canEdit: true, canReview: true, canPublish: true }, canPreviewQuote: false },
  })
}
