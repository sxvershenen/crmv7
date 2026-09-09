import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { EventServiceOfferingWorkspace, type EventServiceEditorData, type EventServiceOfferingGateway } from "./event-service-offering-workspace.js"

const ids = {
  offering: "33333333-3333-4333-8333-333333333333",
  template: "22222222-2222-4222-8222-222222222222",
  priceBook: "77777777-7777-4777-8777-777777777777",
  ratePlan: "88888888-8888-4888-8888-888888888888",
} as const

function data(): EventServiceEditorData {
  const priceBook = {
    id: ids.priceBook, offeringId: ids.offering, version: 1, revision: 1, state: "active" as const, name: "Стандарт", currency: "RUB" as const, timezone: "Europe/Moscow", validFrom: "2026-01-01", validToExclusive: null, changeReason: "Начальная цена", scheduledActivationAt: null, activatedAt: "2026-01-01T00:00:00.000Z", retiredAt: null, supersedesPriceBookId: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ratePlans: [{ id: ids.ratePlan, priceBookId: ids.priceBook, version: 1, key: "standard", label: "Стандарт", pricingBasis: "flat_package" as const, quantityMetric: "guests" as const, baseAmount: 100_000, includedQuantity: 10, baseExtraUnitAmount: 5_000, minQuantity: 1, maxQuantity: null, minDurationMinutes: null, maxDurationMinutes: null, isDefault: true, displayOrder: 0, rules: [] }],
  }
  return {
    dossier: {
      offering: { id: ids.offering, code: "EVENT-WEDDING", version: 1, kind: "event_service", state: "active", operationalName: "Свадебное мероприятие", internalComment: "", salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: "11111111-1111-4111-8111-111111111111", fulfillment: { kind: "event_service" }, activePriceBookId: ids.priceBook, archivedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      template: { id: ids.template, code: "wedding_internal", version: 1, format: "wedding", defaultDurationMinutes: 240, minimumGuests: 10, maximumGuests: 80, preparationBeforeMinutes: 60, preparationAfterMinutes: 30, archivedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      subjectVersion: 1, pricingVersion: 1, addOnAssignmentsVersion: 1, cmsReady: true, publicReady: false, editorial: null,
    },
    editor: { offering: { id: ids.offering, code: "EVENT-WEDDING", version: 1, kind: "event_service", state: "active", operationalName: "Свадебное мероприятие", internalComment: "", salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included", businessCalendarId: "11111111-1111-4111-8111-111111111111", fulfillment: { kind: "event_service" }, activePriceBookId: ids.priceBook, archivedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }, addOnTerms: null, addOnUsages: [], bindings: [], bindingTargets: [], priceBooks: [priceBook], addOnAssignments: [], addOnCatalog: [], editorial: null, ownerVersions: { catalog: 1, subject: { aggregateVersion: 1, primary: { type: "event_service_template", id: ids.template, version: 1 } }, pricing: 1, draftPriceBook: null, addOnAssignments: 1, editorial: null }, capabilities: { catalog: { canEdit: true, canChangeState: true, canArchive: true }, subject: { canEdit: true, canManageBindings: false }, pricing: { canView: true, canEditDraft: true, canActivate: true }, addOns: { canSearch: false, canCreate: false, canAssign: false }, editorial: { canEdit: false, canReview: true, canPublish: false }, canPreviewQuote: true } },
  } as EventServiceEditorData
}

function workspace(initialTab: "terms" | "pricing" | "preview") {
  return <EventServiceOfferingWorkspace data={data()} gateway={{} as EventServiceOfferingGateway} createPreviewCommandMeta={() => ({ operationId: "11111111-1111-4111-8111-111111111111", idempotencyKey: "22222222-2222-4222-8222-222222222222" })} createPricingCommandMeta={() => ({ operationId: "11111111-1111-4111-8111-111111111111", idempotencyKey: "22222222-2222-4222-8222-222222222222", expectedPricingVersion: 1 })} createTemplateCommandMeta={() => ({ operationId: "11111111-1111-4111-8111-111111111111", idempotencyKey: "22222222-2222-4222-8222-222222222222", expectedSubjectVersion: 1 })} initialTab={initialTab} onReload={async () => undefined} />
}

describe("event category shared workspace", () => {
  it("shows one visible commercial identity and hides the technical template code", () => {
    const markup = renderToStaticMarkup(workspace("terms"))
    expect(markup).toContain("Свадебное мероприятие")
    expect(markup).toContain("EVENT-WEDDING")
    expect(markup).not.toContain("wedding_internal")
    expect(markup).toContain("Категория мероприятия")
  })

  it("keeps package shape and price-versus-availability boundary explicit", () => {
    const pricing = renderToStaticMarkup(workspace("pricing"))
    const preview = renderToStaticMarkup(workspace("preview"))
    expect(pricing).toContain("flat_package")
    expect(pricing).toContain("Гостей включено")
    expect(preview).toContain("Цена рассчитана отдельно от доступности и брони")
    expect(preview).toContain("Доступность, ресурсы, бронь и подтверждение не выполняются")
    expect(preview).toContain("Серверный immutable snapshot")
  })
})
