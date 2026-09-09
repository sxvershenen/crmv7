import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

import { InternalOfferingEditorSchema } from "@crm/contracts"
import type { OfferingEditorGateway } from "@crm/offering-editor"
import { TooltipProvider } from "@crm/ui"

import { cmsRepository } from "@admin/data/cms-repository"
import { AdminAuthSessionProvider } from "@admin/features/auth-session"
import { editorFixtures } from "@admin/fixtures/cms"
import { HouseOfferingWorkspacePage } from "@admin/pages/house-offerings-page"

describe("CMS house page compatibility route", () => {
  afterEach(() => vi.restoreAllMocks())

  it("opens only the canonical editorial editor and ignores legacy operational tabs", async () => {
    const editor = houseEditor()
    const gateway = { getHouseEditor: vi.fn().mockResolvedValue(editor) } as unknown as OfferingEditorGateway
    vi.spyOn(cmsRepository, "getEditor").mockResolvedValue({ ...editorFixtures["house-lesnoy"]!, id: editor.editorial!.node.id })

    renderWorkspace(gateway, `/offers/houses/${editor.offering.id}?tab=pricing`)

    expect(await screen.findByRole("tab", { name: "Содержимое" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Блоки страницы" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Медиа" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "SEO" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Публикация и история" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "Цены" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Прайс-лист|Условия привязки|Исполнение/)).not.toBeInTheDocument()
    expect(screen.getByText("Цена и работа ресурса — в CRM").closest("a")).toHaveAttribute("href", `http://localhost:5173/offers/houses/${editor.offering.id}`)
  })

  it("fails closed when the CRM-created draft locator is missing", async () => {
    const editor = InternalOfferingEditorSchema.parse({ ...houseEditor(), editorial: null, ownerVersions: { ...houseEditor().ownerVersions, editorial: null } })
    const gateway = { getHouseEditor: vi.fn().mockResolvedValue(editor) } as unknown as OfferingEditorGateway

    renderWorkspace(gateway, `/offers/houses/${editor.offering.id}`)

    expect(await screen.findByText("Черновик страницы не подготовлен")).toBeInTheDocument()
  })
})

function renderWorkspace(gateway: OfferingEditorGateway, entry: string) {
  return render(<TooltipProvider><AdminAuthSessionProvider><MemoryRouter initialEntries={[entry]}><Routes><Route element={<HouseOfferingWorkspacePage gateway={gateway} />} path="/offers/houses/:offeringId" /></Routes></MemoryRouter></AdminAuthSessionProvider></TooltipProvider>)
}

function houseEditor() {
  const offeringId = "11111111-1111-4111-8111-111111111111"
  const nodeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
  const revisionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
  return InternalOfferingEditorSchema.parse({
    offering: { id: offeringId, code: "HOUSE-FOREST", version: 3, kind: "house", state: "active", operationalName: "Лесной", internalComment: "", salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: "22222222-2222-4222-8222-222222222222", fulfillment: { kind: "house", stayPricing: "sum_each_local_night" }, activePriceBookId: null, archivedAt: null, createdAt: "2026-09-01T10:00:00.000Z", updatedAt: "2026-09-01T10:00:00.000Z" },
    addOnTerms: null, addOnUsages: [], bindings: [], bindingTargets: [], priceBooks: [], addOnAssignments: [], addOnCatalog: [],
    editorial: { source: { sourceKind: "catalog_offering", sourceId: offeringId, sourceVersion: 3, createdAt: "2026-09-01T10:00:00.000Z" }, node: { id: nodeId, version: 2, kind: "resource_detail", status: "active" }, currentRevision: { id: revisionId, revision: 2, state: "draft", path: "/houses/forest", title: "Лесной", contentHash: "b".repeat(64) }, latestPublished: null, publication: { eligible: true, blockers: [] } },
    ownerVersions: { catalog: 3, subject: { aggregateVersion: 2, primary: null }, pricing: 4, draftPriceBook: null, addOnAssignments: 1, editorial: { nodeId, nodeVersion: 2, draftRevisionId: revisionId, contentHash: "b".repeat(64) } },
    capabilities: { catalog: { canEdit: false, canChangeState: false, canArchive: false }, subject: { canEdit: false, canManageBindings: false }, pricing: { canView: true, canEditDraft: true, canActivate: true }, addOns: { canSearch: false, canCreate: false, canAssign: false }, editorial: { canEdit: true, canReview: true, canPublish: true }, canPreviewQuote: false },
  })
}
