import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { AddOnOfferingListItem, InternalOfferingEditor } from "@crm/contracts"

import { AddOnOfferingListView } from "./addon-offering-list.js"
import { OfferingPricingWorkspace } from "./house-offering-workspace.js"
import type { OfferingEditorGateway } from "./gateway.js"

const offeringId = "11111111-1111-4111-8111-111111111111"

describe("add-on shared registry", () => {
  it("renders loading, retryable error, empty and filtered no-results states", () => {
    const common = { onOpenOffering: vi.fn(), onRetry: vi.fn() }
    expect(renderToStaticMarkup(<AddOnOfferingListView error={null} items={null} {...common} />)).toContain("animate-pulse")
    const failed = renderToStaticMarkup(<AddOnOfferingListView error="Сеть недоступна" items={[]} {...common} />)
    expect(failed).toContain("Допы не загрузились")
    expect(failed).toContain("Повторить")
    expect(renderToStaticMarkup(<AddOnOfferingListView error={null} items={[]} {...common} />)).toContain("Допов пока нет")
    expect(renderToStaticMarkup(<AddOnOfferingListView error={null} filters={{ usage: "unused" }} items={[listItem()]} {...common} />)).toContain("Нет результатов по готовности или использованию")
  })

  it("shows operational facts without exposing identifiers", () => {
    const item = listItem()
    const markup = renderToStaticMarkup(<AddOnOfferingListView error={null} items={[item]} onOpenOffering={vi.fn()} onRetry={vi.fn()} />)
    expect(markup).toContain("Банный чан")
    expect(markup).toContain("В заказах: 2")
    expect(markup).toContain("Цена готова")
    expect(markup).not.toContain(item.offering.id)
  })
})

describe("add-on shared pricing", () => {
  it("renders one immediately applied price without technical lifecycle controls", () => {
    const editor = addOnEditor()
    const markup = renderToStaticMarkup(<OfferingPricingWorkspace
      createCommandMeta={() => ({ expectedPricingVersion: 1, idempotencyKey: "addon-price-test", operationId: "33333333-3333-4333-8333-333333333333" })}
      editor={editor}
      gateway={{} as OfferingEditorGateway}
      kind="addon"
      onReload={async () => undefined}
      onSaveState={() => undefined}
    />)
    expect(markup).toContain("После сохранения новая цена сразу начинает действовать")
    expect(markup).toContain("Цена за единицу")
    expect(markup).not.toContain("Прайс-лист")
    expect(markup).not.toContain("Ввод цен в действие")
    expect(markup).not.toContain("Тарифы")
    expect(markup).not.toContain("Рассчитать")
  })
})

function listItem(): AddOnOfferingListItem {
  const editor = addOnEditor()
  return { offering: editor.offering, terms: editor.addOnTerms!, usageCount: 2, priceReadiness: "ready", editorialNodeId: null }
}

function addOnEditor(): InternalOfferingEditor {
  return {
    offering: {
      id: offeringId, code: "ADDON-HOT-TUB", version: 2, kind: "addon", state: "active", operationalName: "Банный чан", internalComment: "", salesMode: "selectable", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: "22222222-2222-4222-8222-222222222222",
      fulfillment: { kind: "addon", serviceType: "quantity_service", standalone: true, scope: "reusable", ownerOfferingId: null }, activePriceBookId: null, archivedAt: null, createdAt: "2026-09-02T10:00:00.000Z", updatedAt: "2026-09-02T10:00:00.000Z",
    },
    addOnTerms: { serviceType: "quantity_service", categoryKey: "comfort", applicableOfferingKinds: ["house", "campground"], quantity: { min: 1, max: 5, default: 1, step: 1, metric: "units" } },
    addOnUsages: [], bindings: [], bindingTargets: [], priceBooks: [], addOnAssignments: [], addOnCatalog: [], editorial: null,
    ownerVersions: { catalog: 2, subject: { aggregateVersion: 3, primary: null }, pricing: 1, draftPriceBook: null, addOnAssignments: 1, editorial: null },
    capabilities: { catalog: { canEdit: false, canChangeState: false, canArchive: false }, subject: { canEdit: true, canManageBindings: false }, pricing: { canView: true, canEditDraft: true, canActivate: true }, addOns: { canSearch: false, canCreate: false, canAssign: false }, editorial: { canEdit: false, canReview: false, canPublish: false }, canPreviewQuote: false },
  }
}
