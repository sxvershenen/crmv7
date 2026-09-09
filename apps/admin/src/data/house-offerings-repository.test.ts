import type { HouseOfferingListResponse, InternalOfferingEditor, InternalOfferingQuoteResult, OfferingPricingMutationResult } from "@crm/contracts"

import { AdminHouseOfferingGateway } from "@admin/data/house-offerings-repository"
import { AdminApiError } from "@admin/lib/api-client"

const offeringId = "11111111-1111-4111-8111-111111111111"
const priceBookId = "22222222-2222-4222-8222-222222222222"
const operationId = "33333333-3333-4333-8333-333333333333"
const idempotencyKey = "cms-house-pricing-0001"

describe("AdminHouseOfferingGateway", () => {
  it("uses the Admin offering paths and never the CMS revision API", async () => {
    const client = clientMock()
    const response = { items: [], nextCursor: null } satisfies HouseOfferingListResponse
    const houseEditor = { offering: { kind: "house" } } as InternalOfferingEditor
    const campgroundEditor = { offering: { kind: "campground" } } as InternalOfferingEditor
    client.get.mockResolvedValueOnce(response).mockResolvedValueOnce(houseEditor).mockResolvedValueOnce(response).mockResolvedValueOnce(campgroundEditor)
    const gateway = new AdminHouseOfferingGateway(client as never)

    await expect(gateway.listHouses({ kind: "house", limit: 25, q: "Лесной" })).resolves.toEqual(response)
    await expect(gateway.getHouseEditor(offeringId)).resolves.toEqual(houseEditor)
    await expect(gateway.listCampgrounds({ kind: "campground", limit: 25 })).resolves.toEqual(response)
    await expect(gateway.getCampgroundEditor(offeringId)).resolves.toEqual(campgroundEditor)

    expect(client.get).toHaveBeenNthCalledWith(1, "/offerings?kind=house&limit=25&q=%D0%9B%D0%B5%D1%81%D0%BD%D0%BE%D0%B9", expect.anything())
    expect(client.get).toHaveBeenNthCalledWith(2, `/offerings/${offeringId}/editor`, expect.anything())
    expect(client.get).toHaveBeenNthCalledWith(3, "/offerings?kind=campground&limit=25", expect.anything())
    expect(client.get).toHaveBeenNthCalledWith(4, `/offerings/${offeringId}/editor`, expect.anything())
    expect(client.get.mock.calls.flat().filter((value) => typeof value === "string")).not.toContain(expect.stringContaining("/content/nodes"))
  })

  it("validates command bodies and calls the shared price-book and quote endpoints", async () => {
    const client = clientMock()
    client.post
      .mockResolvedValueOnce({} as OfferingPricingMutationResult)
      .mockResolvedValueOnce({} as OfferingPricingMutationResult)
      .mockResolvedValueOnce({} as OfferingPricingMutationResult)
      .mockResolvedValueOnce({} as InternalOfferingQuoteResult)
    client.put.mockResolvedValueOnce({} as OfferingPricingMutationResult)
    const gateway = new AdminHouseOfferingGateway(client as never)
    const create = { ...pricingMeta(), supersedesPriceBookId: null, name: "Осенний", validFrom: "2026-09-01", validToExclusive: null, changeReason: "Сезон", ratePlans: [] }
    const replace = { ...pricingMeta(), name: "Осенний", validFrom: "2026-09-01", validToExclusive: null, changeReason: "Уточнение", ratePlans: [] }
    const activate = { ...pricingMeta(), reason: "Цены проверены" }
    const schedule = { ...pricingMeta(), scheduledActivationAt: "2026-09-05T09:00:00.000Z", reason: "Запуск к выходным" }
    const quote = { ratePlanKey: null, period: { type: "stay" as const, arrivalDate: "2026-09-10", departureDate: "2026-09-12" }, quantities: { guests: 2, participants: null, units: 1 as const }, currency: "RUB", addOns: [] as [], operationId, idempotencyKey }

    await gateway.createDraftPriceBook(offeringId, create)
    await gateway.replaceDraftPriceBook(offeringId, priceBookId, replace)
    await gateway.activatePriceBook(offeringId, priceBookId, activate)
    await gateway.schedulePriceBook(offeringId, priceBookId, schedule)
    await gateway.previewHouseQuote(offeringId, quote)

    expect(client.post).toHaveBeenNthCalledWith(1, `/offerings/${offeringId}/price-books/drafts`, expect.objectContaining(create), expect.anything())
    expect(client.put).toHaveBeenCalledWith(`/offerings/${offeringId}/price-books/drafts/${priceBookId}`, expect.objectContaining(replace), expect.anything())
    expect(client.post).toHaveBeenNthCalledWith(2, `/offerings/${offeringId}/price-books/${priceBookId}/activate`, activate, expect.anything())
    expect(client.post).toHaveBeenNthCalledWith(3, `/offerings/${offeringId}/price-books/${priceBookId}/schedule`, schedule, expect.anything())
    expect(client.post).toHaveBeenNthCalledWith(4, `/offerings/${offeringId}/quotes/preview`, quote, expect.anything())

    await expect(gateway.createDraftPriceBook(offeringId, { ...create, name: "" })).rejects.toThrow()
    expect(client.post).toHaveBeenCalledTimes(4)
  })

  it("normalizes API conflicts without hiding request metadata", async () => {
    const client = clientMock()
    client.get.mockRejectedValueOnce(new AdminApiError({ code: "STALE_VERSION", message: "Прайс-лист изменён", details: { pricingVersion: 7 }, requestId: "req-house" }, 409, "VERSION_CONFLICT"))
    const gateway = new AdminHouseOfferingGateway(client as never)

    await expect(gateway.getHouseEditor(offeringId)).rejects.toMatchObject({
      name: "HouseOfferingGatewayError", code: "VERSION_CONFLICT", status: 409, requestId: "req-house", isConflict: true,
    })
  })

  it("adapts bindings and add-ons through Admin without a CMS copy", async () => {
    const client = clientMock()
    client.get.mockResolvedValueOnce({ items: [], nextCursor: null }).mockResolvedValueOnce({ items: [], nextCursor: null })
    client.put.mockResolvedValue({})
    client.post.mockResolvedValueOnce({})
    const gateway = new AdminHouseOfferingGateway(client as never)
    const binding = { target: { type: "resource" as const, id: priceBookId }, role: "primary" as const, availabilityRequired: true, defaultQuantity: 1, defaultCapacityImpact: 1, preparationBeforeMinutes: 30, preparationAfterMinutes: 15 }
    const bindings = { operationId, idempotencyKey: "cms-house-binding-0001", expectedSubjectVersion: 2, bindings: [binding] }
    const assignments = { operationId, idempotencyKey: "cms-house-addons-0001", expectedAddOnsVersion: 1, assignments: [] }
    const custom = { operationId, idempotencyKey: "cms-house-custom-addon-0001", expectedAddOnsVersion: 1, addOn: { operationalName: "Дрова", internalComment: "", serviceType: "quantity_service" as const, categoryKey: "comfort", standalone: false, salesMode: "request_only" as const, priceDisplayMode: "request" as const }, assignment: { enabled: false, required: false, recommended: true, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minQuantityOverride: null, maxQuantityOverride: null, defaultQuantityOverride: null, displayOrder: 0 } }

    await gateway.listBindingTargets({ targetType: "resource", q: "сосна", kind: "house", limit: 10 })
    await gateway.listAddOnLibrary({ q: "дрова", scope: "reusable", limit: 10 })
    await gateway.replaceHouseBindings(offeringId, bindings)
    await gateway.replaceAddOnAssignments(offeringId, assignments)
    await gateway.createCustomAddOn(offeringId, custom)

    expect(client.get).toHaveBeenCalledWith("/offerings/binding-targets?targetType=resource&limit=10&q=%D1%81%D0%BE%D1%81%D0%BD%D0%B0&kind=house", expect.anything())
    expect(client.get).toHaveBeenCalledWith("/addons?limit=10&q=%D0%B4%D1%80%D0%BE%D0%B2%D0%B0&scope=reusable", expect.anything())
    expect(client.put).toHaveBeenNthCalledWith(1, `/offerings/${offeringId}/bindings`, bindings, expect.anything())
    expect(client.put).toHaveBeenNthCalledWith(2, `/offerings/${offeringId}/add-ons`, assignments, expect.anything())
    expect(client.post).toHaveBeenCalledWith(`/offerings/${offeringId}/add-ons/custom`, custom, expect.anything())
  })

  it("uses the canonical add-on list, create, editor and terms endpoints", async () => {
    const client = clientMock()
    const response = { items: [], nextCursor: null }
    const editor = { offering: { kind: "addon" } } as InternalOfferingEditor
    client.get.mockResolvedValueOnce(response).mockResolvedValueOnce(editor)
    client.post.mockResolvedValueOnce({})
    client.put.mockResolvedValueOnce({})
    const gateway = new AdminHouseOfferingGateway(client as never)
    const terms = {
      serviceType: "quantity_service" as const,
      categoryKey: "comfort",
      applicableOfferingKinds: ["house", "campground"] as ("house" | "campground")[],
      quantity: { metric: "units" as const, min: 1, max: 10, default: 1, step: 1 },
    }
    const create = {
      operationId,
      idempotencyKey: "cms-addon-create-0001",
      operationalName: "Дрова",
      internalComment: "",
      scope: "reusable" as const,
      ownerOfferingId: null,
      standalone: true,
      salesMode: "selectable" as const,
      priceDisplayMode: "request" as const,
      currency: "RUB",
      timezone: "Europe/Moscow",
      taxMode: "tax_included" as const,
      businessCalendarId: priceBookId,
      terms,
    }
    const replace = { operationId, idempotencyKey: "cms-addon-terms-0001", expectedSubjectVersion: 3, standalone: false, terms }

    await expect(gateway.listAddOns({ kind: "addon", q: "дрова", serviceType: "quantity_service", scope: "reusable", categoryKey: "comfort", standalone: true, limit: 10 })).resolves.toEqual(response)
    await expect(gateway.getAddOnEditor(offeringId)).resolves.toEqual(editor)
    await gateway.createAddOn(create)
    await gateway.replaceAddOnTerms(offeringId, replace)

    expect(client.get).toHaveBeenNthCalledWith(1, "/offerings?kind=addon&limit=10&q=%D0%B4%D1%80%D0%BE%D0%B2%D0%B0&serviceType=quantity_service&scope=reusable&categoryKey=comfort&standalone=true", expect.anything())
    expect(client.get).toHaveBeenNthCalledWith(2, `/offerings/${offeringId}/editor`, expect.anything())
    expect(client.post).toHaveBeenCalledWith("/offerings/addons", create, expect.anything())
    expect(client.put).toHaveBeenCalledWith(`/offerings/${offeringId}/addon-terms`, replace, expect.anything())
  })
})

function pricingMeta() { return { operationId, idempotencyKey, expectedPricingVersion: 1 } }
function clientMock() { return { get: vi.fn(), post: vi.fn(), put: vi.fn() } }
