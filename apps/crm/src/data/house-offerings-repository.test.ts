import type { HouseOfferingListResponse, InternalOfferingEditor, InternalOfferingQuoteResult, OfferingPricingMutationResult } from "@crm/contracts"
import { describe, expect, it, vi } from "vitest"

import { ApiHouseOfferingGateway } from "@app/data/house-offerings-repository"

const offeringId = "11111111-1111-4111-8111-111111111111"
const priceBookId = "22222222-2222-4222-8222-222222222222"
const operationId = "33333333-3333-4333-8333-333333333333"

describe("ApiHouseOfferingGateway", () => {
  it("resolves the resource commercial dossier through the reverse binding endpoint", async () => {
    const client = clientMock()
    const lookup = { resolution: "linked", offering: { offeringId, kind: "house", code: "HOUSE-PINE", operationalName: "Дом «Сосна»", state: "active" } } as const
    client.get.mockResolvedValue(lookup)
    const gateway = new ApiHouseOfferingGateway(client as never)

    await expect(gateway.resolvePrimaryStayOffering(priceBookId)).resolves.toEqual(lookup)
    expect(client.get).toHaveBeenCalledWith(`/offerings/by-resource/${priceBookId}`, expect.anything())
  })

  it("creates one stay offering from the resource dossier", async () => {
    const client = clientMock()
    const created = { offeringId, kind: "house", code: "HOUSE-PINE", operationalName: "Дом «Сосна»", state: "draft" } as const
    client.post.mockResolvedValue(created)
    const gateway = new ApiHouseOfferingGateway(client as never)
    const body = { operationId, idempotencyKey: "resource-stay-offering-create" }

    await expect(gateway.createStayOffering(priceBookId, body)).resolves.toEqual(created)
    expect(client.post).toHaveBeenCalledWith(`/offerings/by-resource/${priceBookId}`, body, expect.anything())
  })

  it("previews the authoritative stay price directly from a resource", async () => {
    const client = clientMock()
    const result = { total: { amountMinor: 1_350_000, currency: "RUB" } } as InternalOfferingQuoteResult
    client.post.mockResolvedValue(result)
    const gateway = new ApiHouseOfferingGateway(client as never)
    const body = { operationId, idempotencyKey: "booking-resource-quote", arrivalDate: "2026-09-04", departureDate: "2026-09-06", quantity: 3, currency: "RUB" as const, addOns: [] }

    await expect(gateway.previewResourceStayQuote(priceBookId, body)).resolves.toEqual(result)
    expect(client.post).toHaveBeenCalledWith(`/offerings/by-resource/${priceBookId}/quotes/preview`, body, expect.anything())
  })

  it("uses only Internal offering endpoints", async () => {
    const client = clientMock()
    const response = { items: [], nextCursor: null } satisfies HouseOfferingListResponse
    const houseEditor = { offering: { kind: "house" } } as InternalOfferingEditor
    const campgroundEditor = { offering: { kind: "campground" } } as InternalOfferingEditor
    client.get.mockResolvedValueOnce(response).mockResolvedValueOnce(houseEditor).mockResolvedValueOnce(response).mockResolvedValueOnce(campgroundEditor)
    const gateway = new ApiHouseOfferingGateway(client as never)

    await expect(gateway.listHouses({ kind: "house", limit: 25, q: "Сосна" })).resolves.toEqual(response)
    await expect(gateway.getHouseEditor(offeringId)).resolves.toEqual(houseEditor)
    await expect(gateway.listCampgrounds({ kind: "campground", limit: 25 })).resolves.toEqual(response)
    await expect(gateway.getCampgroundEditor(offeringId)).resolves.toEqual(campgroundEditor)

    expect(client.get).toHaveBeenNthCalledWith(1, "/offerings?kind=house&limit=25&q=%D0%A1%D0%BE%D1%81%D0%BD%D0%B0", expect.anything())
    expect(client.get).toHaveBeenNthCalledWith(2, `/offerings/${offeringId}/editor`, expect.anything())
    expect(client.get).toHaveBeenNthCalledWith(3, "/offerings?kind=campground&limit=25", expect.anything())
    expect(client.get).toHaveBeenNthCalledWith(4, `/offerings/${offeringId}/editor`, expect.anything())
  })

  it("uses the add-on registry, editor, create and subject CAS endpoints", async () => {
    const client = clientMock()
    const list = { items: [], nextCursor: null }
    const editor = { offering: { kind: "addon" } } as InternalOfferingEditor
    client.get.mockResolvedValueOnce(list).mockResolvedValueOnce(editor)
    client.post.mockResolvedValueOnce({})
    client.request.mockResolvedValueOnce({})
    const gateway = new ApiHouseOfferingGateway(client as never)
    const terms = { serviceType: "quantity_service" as const, categoryKey: "comfort", applicableOfferingKinds: ["house" as const], quantity: { min: 1, max: 5, default: 1, step: 1, metric: "units" as const } }
    const create = { operationId, idempotencyKey: "addon-create-0001", operationalName: "Банный чан", internalComment: "", scope: "reusable" as const, ownerOfferingId: null, standalone: true, salesMode: "selectable" as const, priceDisplayMode: "request" as const, currency: "RUB", timezone: "Europe/Moscow", taxMode: "tax_included" as const, businessCalendarId: priceBookId, terms }
    const replace = { operationId, idempotencyKey: "addon-terms-0001", expectedSubjectVersion: 3, standalone: false, terms }

    await gateway.listAddOns({ kind: "addon", q: "чан", state: "active", serviceType: "quantity_service", scope: "reusable", categoryKey: "comfort", standalone: true, limit: 25 })
    await gateway.getAddOnEditor(offeringId)
    await gateway.createAddOn(create)
    await gateway.replaceAddOnTerms(offeringId, replace)

    expect(client.get).toHaveBeenNthCalledWith(1, "/offerings?kind=addon&limit=25&q=%D1%87%D0%B0%D0%BD&state=active&serviceType=quantity_service&scope=reusable&categoryKey=comfort&standalone=true", expect.anything())
    expect(client.get).toHaveBeenNthCalledWith(2, `/offerings/${offeringId}/editor`, expect.anything())
    expect(client.post).toHaveBeenCalledWith("/offerings/addons", create, expect.anything())
    expect(client.request).toHaveBeenCalledWith(`/offerings/${offeringId}/addon-terms`, { body: replace, method: "PUT" }, expect.anything())
  })

  it("rejects a non-add-on editor returned to the add-on route", async () => {
    const client = clientMock()
    client.get.mockResolvedValue({ offering: { kind: "house" } } as InternalOfferingEditor)
    const gateway = new ApiHouseOfferingGateway(client as never)
    await expect(gateway.getAddOnEditor(offeringId)).rejects.toThrow("другого типа")
  })

  it("uses full pricing bodies and PUT for replacement", async () => {
    const client = clientMock()
    client.post
      .mockResolvedValueOnce({} as OfferingPricingMutationResult)
      .mockResolvedValueOnce({} as OfferingPricingMutationResult)
      .mockResolvedValueOnce({} as OfferingPricingMutationResult)
      .mockResolvedValueOnce({} as InternalOfferingQuoteResult)
    client.request.mockResolvedValueOnce({} as OfferingPricingMutationResult)
    const gateway = new ApiHouseOfferingGateway(client as never)
    const meta = { operationId, idempotencyKey: "crm-house-pricing-0001", expectedPricingVersion: 2 }
    const create = { ...meta, supersedesPriceBookId: null, name: "Осень", validFrom: "2026-09-01", validToExclusive: "2027-01-01", changeReason: "Сезон", ratePlans: [] }
    const replace = { ...meta, name: "Осень", validFrom: "2026-09-01", validToExclusive: "2027-01-01", changeReason: "Уточнение", ratePlans: [] }
    const activate = { ...meta, reason: "Цены проверены" }
    const schedule = { ...meta, scheduledActivationAt: "2026-09-05T09:00:00.000Z", reason: "Запуск к выходным" }
    const quote = { operationId, idempotencyKey: "crm-house-quote-0001", ratePlanKey: null, period: { type: "stay" as const, arrivalDate: "2026-09-10", departureDate: "2026-09-12" }, quantities: { guests: 2, participants: null, units: 1 as const }, currency: "RUB", addOns: [] as [] }

    await gateway.createDraftPriceBook(offeringId, create)
    await gateway.replaceDraftPriceBook(offeringId, priceBookId, replace)
    await gateway.activatePriceBook(offeringId, priceBookId, activate)
    await gateway.schedulePriceBook(offeringId, priceBookId, schedule)
    await gateway.previewHouseQuote(offeringId, quote)

    expect(client.post).toHaveBeenNthCalledWith(1, `/offerings/${offeringId}/price-books/drafts`, create, expect.anything())
    expect(client.request).toHaveBeenCalledWith(`/offerings/${offeringId}/price-books/drafts/${priceBookId}`, { body: replace, method: "PUT" }, expect.anything())
    expect(client.post).toHaveBeenNthCalledWith(2, `/offerings/${offeringId}/price-books/${priceBookId}/activate`, activate, expect.anything())
    expect(client.post).toHaveBeenNthCalledWith(3, `/offerings/${offeringId}/price-books/${priceBookId}/schedule`, schedule, expect.anything())
    expect(client.post).toHaveBeenNthCalledWith(4, `/offerings/${offeringId}/quotes/preview`, quote, expect.anything())
  })

  it("uses the shared configuration endpoints with segment-specific CAS bodies", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce({ items: [], nextCursor: null }).mockResolvedValueOnce({ items: [], nextCursor: null })
    client.request.mockResolvedValue({})
    client.post.mockResolvedValueOnce({})
    const gateway = new ApiHouseOfferingGateway(client as never)
    const binding = { target: { type: "resource" as const, id: priceBookId }, role: "primary" as const, availabilityRequired: true, defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 30, preparationAfterMinutes: 15 }
    const bindings = { operationId, idempotencyKey: "crm-house-binding-0001", expectedSubjectVersion: 2, bindings: [binding] }
    const assignments = { operationId, idempotencyKey: "crm-house-addons-0001", expectedAddOnsVersion: 1, assignments: [] }
    const custom = { operationId, idempotencyKey: "crm-house-custom-addon-0001", expectedAddOnsVersion: 1, addOn: { operationalName: "Дрова", internalComment: "", serviceType: "quantity_service" as const, categoryKey: "comfort", standalone: false, salesMode: "request_only" as const, priceDisplayMode: "request" as const }, assignment: { enabled: false, required: false, recommended: true, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minQuantityOverride: null, maxQuantityOverride: null, defaultQuantityOverride: null, displayOrder: 0 } }

    await gateway.listBindingTargets({ targetType: "resource", q: "сосна", kind: "house", limit: 10 })
    await gateway.listAddOnLibrary({ q: "дрова", scope: "reusable", limit: 10 })
    await gateway.replaceHouseBindings(offeringId, bindings)
    await gateway.replaceAddOnAssignments(offeringId, assignments)
    await gateway.createCustomAddOn(offeringId, custom)

    expect(client.get).toHaveBeenCalledWith("/offerings/binding-targets?targetType=resource&limit=10&q=%D1%81%D0%BE%D1%81%D0%BD%D0%B0&kind=house", expect.anything())
    expect(client.get).toHaveBeenCalledWith("/addons?limit=10&q=%D0%B4%D1%80%D0%BE%D0%B2%D0%B0&scope=reusable", expect.anything())
    expect(client.request).toHaveBeenNthCalledWith(1, `/offerings/${offeringId}/bindings`, { body: bindings, method: "PUT" }, expect.anything())
    expect(client.request).toHaveBeenNthCalledWith(2, `/offerings/${offeringId}/add-ons`, { body: assignments, method: "PUT" }, expect.anything())
    expect(client.post).toHaveBeenCalledWith(`/offerings/${offeringId}/add-ons/custom`, custom, expect.anything())
  })
})

function clientMock() { return { get: vi.fn(), post: vi.fn(), request: vi.fn() } }
