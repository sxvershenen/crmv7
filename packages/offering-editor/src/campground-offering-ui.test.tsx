import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { InternalOfferingEditor } from "@crm/contracts"

import { CampgroundBindingEditor } from "./house-binding-editor.js"
import { HouseOfferingEditor } from "./house-offering-workspace.js"
import type { OfferingEditorGateway } from "./gateway.js"
import { buildCampgroundQuoteBody } from "./house-offering-helpers.js"

const ids = {
  offering: "11111111-1111-4111-8111-111111111111",
  resource: "22222222-2222-4222-8222-222222222222",
}

function editorFor(salesUnit: "owned_tent" | "own_tent_pitch"): InternalOfferingEditor {
  const shared = salesUnit === "own_tent_pitch"
  return {
    offering: {
      id: ids.offering,
      code: shared ? "camp-guest" : "camp-pine",
      version: 1,
      kind: "campground",
      state: "active",
      operationalName: shared ? "Гостевая зона" : "Наша палатка Pine",
      internalComment: "",
      salesMode: "quoted",
      priceDisplayMode: "from",
      currency: "RUB",
      timezone: "Europe/Moscow",
      taxMode: "tax_included",
      businessCalendarId: ids.resource,
      fulfillment: {
        kind: "campground",
        salesUnit,
        allocationMode: shared ? "shared_capacity" : "discrete_inventory",
        capacityUnit: "tent",
        stayPricing: "sum_each_local_night",
      },
      activePriceBookId: null,
      archivedAt: null,
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-01T10:00:00.000Z",
    },
    addOnTerms: null,
    addOnUsages: [],
    bindings: [{
      id: "33333333-3333-4333-8333-333333333333",
      offeringId: ids.offering,
      version: 1,
      target: { type: "resource", id: ids.resource },
      role: "primary",
      availabilityRequired: true,
      defaultQuantity: 1,
      defaultCapacityImpact: 1,
      preparationBeforeMinutes: 0,
      preparationAfterMinutes: 0,
    }],
    bindingTargets: [{
      type: "resource",
      id: ids.resource,
      version: 1,
      code: shared ? "MEADOW" : "PINE",
      name: shared ? "Лесная поляна" : "Палатка Pine",
      kind: "campground",
      capacity: { mode: shared ? "shared" : "fixed", total: shared ? 15 : 4 },
      archived: false,
    }],
    priceBooks: [],
    addOnAssignments: [],
    addOnCatalog: [],
    editorial: null,
    ownerVersions: { catalog: 1, subject: { aggregateVersion: 1, primary: { type: "resource", id: ids.resource, version: 1 } }, pricing: 1, draftPriceBook: null, addOnAssignments: 1, editorial: null },
    capabilities: {
      catalog: { canEdit: false, canChangeState: false, canArchive: false },
      subject: { canEdit: false, canManageBindings: false },
      pricing: { canView: true, canEditDraft: false, canActivate: false },
      addOns: { canSearch: false, canCreate: false, canAssign: false },
      editorial: { canEdit: false, canReview: false, canPublish: false },
      canPreviewQuote: true,
    },
  }
}

function editorWithPrices(): InternalOfferingEditor {
  const editor = editorFor("owned_tent")
  return {
    ...editor,
    priceBooks: [{
      activatedAt: "2026-09-01T00:00:00.000Z",
      changeReason: "Первичная настройка",
      createdAt: "2026-09-01T00:00:00.000Z",
      currency: "RUB",
      id: "55555555-5555-4555-8555-555555555555",
      name: "Сезон 2026",
      offeringId: ids.offering,
      ratePlans: [{
        baseAmount: 800000,
        baseExtraUnitAmount: 150000,
        displayOrder: 0,
        id: "66666666-6666-4666-8666-666666666666",
        includedQuantity: 4,
        isDefault: true,
        key: "standard",
        label: "Стандарт",
        maxDurationMinutes: null,
        maxQuantity: null,
        minDurationMinutes: null,
        minQuantity: null,
        priceBookId: "55555555-5555-4555-8555-555555555555",
        pricingBasis: "per_night",
        quantityMetric: "guests",
        rules: [{
          amount: 1000000,
          bookingLeadDays: null,
          dateSelector: { days: ["fri", "sat", "sun"], type: "recurring_weekdays" },
          durationMinutes: null,
          enabled: true,
          extraUnitAmount: null,
          id: "77777777-7777-4777-8777-777777777777",
          priority: 0,
          quantityRange: null,
          ratePlanId: "66666666-6666-4666-8666-666666666666",
          reason: "",
          version: 1,
        }],
        version: 1,
      }],
      retiredAt: null,
      revision: 1,
      scheduledActivationAt: null,
      state: "active",
      supersedesPriceBookId: null,
      timezone: "Europe/Moscow",
      updatedAt: "2026-09-01T00:00:00.000Z",
      validFrom: "2026-09-01",
      validToExclusive: null,
      version: 1,
    }],
  }
}

function renderBindingEditor(salesUnit: "owned_tent" | "own_tent_pitch") {
  return renderToStaticMarkup(
    <CampgroundBindingEditor
      createCommandMeta={() => ({ expectedSubjectVersion: 1, idempotencyKey: "editor-test-key", operationId: "44444444-4444-4444-8444-444444444444" })}
      editor={editorFor(salesUnit)}
      gateway={{ listBindingTargets: vi.fn(), replaceCampgroundBindings: vi.fn() }}
      onReload={async () => undefined}
      onSaveState={() => undefined}
    />,
  )
}

describe("campground editor UI semantics", () => {
  it("embeds a compact resource pricing screen without internal offering navigation", () => {
    const markup = renderToStaticMarkup(<HouseOfferingEditor
      createAddOnsCommandMeta={() => ({ expectedAddOnsVersion: 1, idempotencyKey: "embedded-addons", operationId: "44444444-4444-4444-8444-444444444441" })}
      createCommandMeta={() => ({ expectedPricingVersion: 1, idempotencyKey: "embedded-pricing", operationId: "44444444-4444-4444-8444-444444444442" })}
      createSubjectCommandMeta={() => ({ expectedSubjectVersion: 1, idempotencyKey: "embedded-subject", operationId: "44444444-4444-4444-8444-444444444443" })}
      editor={editorFor("owned_tent")}
      gateway={{} as OfferingEditorGateway}
      kind="campground"
      layout="embedded"
      onReload={async () => undefined}
    />)

    expect(markup).toContain('data-slot="embedded-offering-editor"')
    expect(markup).toContain('data-slot="resource-pricing-layout"')
    expect(markup).toContain('data-slot="resource-base-price-formula"')
    expect(markup).toContain('data-slot="resource-pricing-operations"')
    expect(markup).toContain('data-slot="resource-quote-form"')
    expect(markup).toContain('data-slot="resource-site-card"')
    expect(markup).toContain("xl:grid-cols-2")
    expect(markup).toContain("minmax(180px,220px)")
    expect(markup).toContain("minmax(100px,130px)")
    expect(markup).toContain("Основная цена")
    expect(markup).toContain("Особые цены")
    expect(markup).toContain("Проверить стоимость")
    expect(markup).not.toContain("Коммерческое предложение")
    expect(markup).not.toContain("Условия привязки")
    expect(markup).not.toContain("Исполнение")
    expect(markup).not.toContain("Прайс-лист")
    expect(markup).not.toContain("Тариф")
    expect(markup).not.toContain("CMS v")
    expect(markup).not.toContain('data-slot="editor-frame"')
  })

  it("renders special prices as responsive operator rows", () => {
    const markup = renderToStaticMarkup(<HouseOfferingEditor
      createAddOnsCommandMeta={() => ({ expectedAddOnsVersion: 1, idempotencyKey: "embedded-addons", operationId: "44444444-4444-4444-8444-444444444441" })}
      createCommandMeta={() => ({ expectedPricingVersion: 1, idempotencyKey: "embedded-pricing", operationId: "44444444-4444-4444-8444-444444444442" })}
      createSubjectCommandMeta={() => ({ expectedSubjectVersion: 1, idempotencyKey: "embedded-subject", operationId: "44444444-4444-4444-8444-444444444443" })}
      editor={editorWithPrices()}
      gateway={{} as OfferingEditorGateway}
      kind="campground"
      layout="embedded"
      onReload={async () => undefined}
    />)

    expect(markup).toContain('data-slot="resource-special-price-list"')
    expect(markup).toContain('data-slot="resource-special-price-row"')
    expect(markup).toContain("lg:grid-cols-[minmax(110px,0.55fr)_minmax(300px,1.8fr)_minmax(160px,200px)_auto]")
    expect(markup).toContain("Повторяется еженедельно")
    expect(markup).toContain('aria-pressed="true"')
    expect(markup).toContain("Удалить особую цену «Дни недели»")
  })

  it("keeps the standalone offering editor structure", () => {
    const markup = renderToStaticMarkup(<HouseOfferingEditor
      createAddOnsCommandMeta={() => ({ expectedAddOnsVersion: 1, idempotencyKey: "standalone-addons", operationId: "44444444-4444-4444-8444-444444444441" })}
      createCommandMeta={() => ({ expectedPricingVersion: 1, idempotencyKey: "standalone-pricing", operationId: "44444444-4444-4444-8444-444444444442" })}
      createSubjectCommandMeta={() => ({ expectedSubjectVersion: 1, idempotencyKey: "standalone-subject", operationId: "44444444-4444-4444-8444-444444444443" })}
      editor={editorWithPrices()}
      gateway={{} as OfferingEditorGateway}
      initialTab="pricing"
      kind="campground"
      onReload={async () => undefined}
    />)

    expect(markup).toContain('data-slot="editor-frame"')
    expect(markup).toContain("Новый черновик прайс-листа")
    expect(markup).toContain("Тарифы")
    expect(markup).not.toContain('data-slot="resource-pricing-layout"')
  })

  it("labels an owned tent as a separate object and capacity as guests", () => {
    const markup = renderBindingEditor("owned_tent")
    expect(markup).toContain("Наша палатка · отдельный объект")
    expect(markup).toContain("Гостей: 4")
  })

  it("labels an own-tent area as shared and capacity as pitches", () => {
    const markup = renderBindingEditor("own_tent_pitch")
    expect(markup).toContain("Гостевая палатка · общая зона")
    expect(markup).toContain("Палаточных мест: 15")
  })

  it("sends shared-zone quantity as units without guests", () => {
    const body = buildCampgroundQuoteBody({
      arrivalDate: "2026-09-10",
      currency: "RUB",
      departureDate: "2026-09-12",
      meta: { idempotencyKey: "offering-editor-campground-quote-3", operationId: "44444444-4444-4444-8444-444444444444" },
      quantity: 3,
      ratePlanKey: "standard",
      salesUnit: "own_tent_pitch",
    })
    expect(body.quantities).toEqual({ guests: null, participants: null, units: 3 })
  })
})
