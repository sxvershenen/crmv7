import {
  AddOnOfferingCreateBodySchema,
  AddOnOfferingCreateResultSchema,
  AddOnOfferingListQuerySchema,
  AddOnOfferingListResponseSchema,
  AddOnTermsMutationBodySchema,
  AddOnTermsMutationResultSchema,
  BusinessCalendarListResponseSchema,
  AddOnLibraryQuerySchema,
  AddOnLibraryResponseSchema,
  CampgroundOfferingBindingsReplaceBodySchema,
  HouseOfferingBindingsReplaceBodySchema,
  HouseOfferingListQuerySchema,
  HouseOfferingListResponseSchema,
  HousePriceBookActivateBodySchema,
  InternalOfferingEditorSchema,
  InternalOfferingQuoteResultSchema,
  InternalCampgroundOfferingQuoteBodySchema,
  HousePriceBookScheduleBodySchema,
  OfferingPricingMutationResultSchema,
  ResourcePrimaryStayOfferingLookupResponseSchema,
  ResourceStayOfferingQuotePreviewBodySchema,
  ResourceStayOfferingCreateBodySchema,
  ResourceStayOfferingCreateResultSchema,
  OfferingAddOnAssignmentsReplaceBodySchema,
  OfferingAddOnAssignmentsReplaceResultSchema,
  OfferingBindingsReplaceResultSchema,
  OfferingBindingTargetLookupQuerySchema,
  OfferingBindingTargetLookupResponseSchema,
  OfferingCustomAddOnCreateBodySchema,
  OfferingCustomAddOnCreateResultSchema,
  StayOfferingListQuerySchema,
  StayOfferingListResponseSchema,
  type AddOnLibraryQuery,
  type AddOnOfferingCreateBody,
  type AddOnOfferingListQuery,
  type AddOnTermsMutationBody,
  type CampgroundOfferingBindingsReplaceBody,
  type HouseOfferingBindingsReplaceBody,
  type HouseOfferingListQuery,
  type HousePriceBookActivateBody,
  type HousePriceBookDraftCreateBody,
  type HousePriceBookDraftReplaceBody,
  type HousePriceBookScheduleBody,
  type InternalHouseOfferingQuoteBody,
  type InternalCampgroundOfferingQuoteBody,
  type OfferingAddOnAssignmentsReplaceBody,
  type OfferingBindingTargetLookupQuery,
  type OfferingCustomAddOnCreateBody,
  type ResourceStayOfferingCreateBody,
  type ResourceStayOfferingQuotePreviewBody,
  type StayOfferingListQuery,
} from "@crm/contracts"
import type { OfferingEditorGateway } from "@crm/offering-editor"

import { ApiClientError, apiClient } from "@app/lib/api-client"

type OfferingApiClient = Pick<typeof apiClient, "get" | "post" | "request">

export class ApiHouseOfferingGateway implements OfferingEditorGateway {
  constructor(private readonly client: OfferingApiClient = apiClient) {}

  listHouses(query: HouseOfferingListQuery) {
    const parsed = HouseOfferingListQuerySchema.parse(query)
    const params = new URLSearchParams({ kind: "house", limit: String(parsed.limit) })
    if (parsed.q) params.set("q", parsed.q)
    if (parsed.state) params.set("state", parsed.state)
    if (parsed.cursor) params.set("cursor", parsed.cursor)
    return this.client.get(`/offerings?${params.toString()}`, HouseOfferingListResponseSchema)
  }

  listCampgrounds(query: StayOfferingListQuery & { kind: "campground" }) {
    const parsed = StayOfferingListQuerySchema.parse(query)
    const params = new URLSearchParams({ kind: "campground", limit: String(parsed.limit) })
    if (parsed.q) params.set("q", parsed.q)
    if (parsed.state) params.set("state", parsed.state)
    if (parsed.cursor) params.set("cursor", parsed.cursor)
    return this.client.get(`/offerings?${params.toString()}`, StayOfferingListResponseSchema)
  }

  listAddOns(input: AddOnOfferingListQuery) {
    const query = AddOnOfferingListQuerySchema.parse(input)
    const params = new URLSearchParams({ kind: "addon", limit: String(query.limit) })
    if (query.q) params.set("q", query.q)
    if (query.state) params.set("state", query.state)
    if (query.serviceType) params.set("serviceType", query.serviceType)
    if (query.scope) params.set("scope", query.scope)
    if (query.categoryKey) params.set("categoryKey", query.categoryKey)
    if (query.standalone !== undefined) params.set("standalone", String(query.standalone))
    if (query.cursor) params.set("cursor", query.cursor)
    return this.client.get(`/offerings?${params.toString()}`, AddOnOfferingListResponseSchema)
  }

  listActiveBusinessCalendars() {
    return this.client.get("/business-calendars?state=active&limit=25", BusinessCalendarListResponseSchema)
  }

  async getHouseEditor(offeringId: string) {
    try {
      const editor = await this.client.get(`/offerings/${encodeURIComponent(offeringId)}/editor`, InternalOfferingEditorSchema)
      if (editor.offering.kind !== "house") throw new Error("Маршрут домика получил предложение другого типа")
      return editor
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) return null
      throw error
    }
  }

  async getCampgroundEditor(offeringId: string) {
    try {
      const editor = await this.client.get(`/offerings/${encodeURIComponent(offeringId)}/editor`, InternalOfferingEditorSchema)
      if (editor.offering.kind !== "campground") throw new Error("Маршрут кемпинга получил предложение другого типа")
      return editor
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) return null
      throw error
    }
  }

  async getAddOnEditor(offeringId: string) {
    try {
      const editor = await this.client.get(`/offerings/${encodeURIComponent(offeringId)}/editor`, InternalOfferingEditorSchema)
      if (editor.offering.kind !== "addon") throw new Error("Маршрут дополнения получил предложение другого типа")
      return editor
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) return null
      throw error
    }
  }

  resolvePrimaryStayOffering(resourceId: string) {
    return this.client.get(`/offerings/by-resource/${encodeURIComponent(resourceId)}`, ResourcePrimaryStayOfferingLookupResponseSchema)
  }

  createStayOffering(resourceId: string, input: ResourceStayOfferingCreateBody) {
    const body = ResourceStayOfferingCreateBodySchema.parse(input)
    return this.client.post(`/offerings/by-resource/${encodeURIComponent(resourceId)}`, body, ResourceStayOfferingCreateResultSchema)
  }

  previewResourceStayQuote(resourceId: string, input: ResourceStayOfferingQuotePreviewBody) {
    const body = ResourceStayOfferingQuotePreviewBodySchema.parse(input)
    return this.client.post(`/offerings/by-resource/${encodeURIComponent(resourceId)}/quotes/preview`, body, InternalOfferingQuoteResultSchema)
  }

  createAddOn(input: AddOnOfferingCreateBody) {
    const body = AddOnOfferingCreateBodySchema.parse(input)
    return this.client.post("/offerings/addons", body, AddOnOfferingCreateResultSchema)
  }

  replaceAddOnTerms(offeringId: string, input: AddOnTermsMutationBody) {
    const body = AddOnTermsMutationBodySchema.parse(input)
    return this.client.request(`/offerings/${encodeURIComponent(offeringId)}/addon-terms`, { body, method: "PUT" }, AddOnTermsMutationResultSchema)
  }

  listAddOnLibrary(input: AddOnLibraryQuery) {
    const query = AddOnLibraryQuerySchema.parse(input)
    return this.client.get(`/addons?${addOnLibraryParams(query).toString()}`, AddOnLibraryResponseSchema)
  }

  listBindingTargets(input: OfferingBindingTargetLookupQuery) {
    const query = OfferingBindingTargetLookupQuerySchema.parse(input)
    return this.client.get(`/offerings/binding-targets?${bindingTargetParams(query).toString()}`, OfferingBindingTargetLookupResponseSchema)
  }

  replaceHouseBindings(offeringId: string, input: HouseOfferingBindingsReplaceBody) {
    const body = HouseOfferingBindingsReplaceBodySchema.parse(input)
    return this.client.request(`/offerings/${encodeURIComponent(offeringId)}/bindings`, { body, method: "PUT" }, OfferingBindingsReplaceResultSchema)
  }

  replaceCampgroundBindings(offeringId: string, input: CampgroundOfferingBindingsReplaceBody) {
    const body = CampgroundOfferingBindingsReplaceBodySchema.parse(input)
    return this.client.request(`/offerings/${encodeURIComponent(offeringId)}/bindings`, { body, method: "PUT" }, OfferingBindingsReplaceResultSchema)
  }

  replaceAddOnAssignments(offeringId: string, input: OfferingAddOnAssignmentsReplaceBody) {
    const body = OfferingAddOnAssignmentsReplaceBodySchema.parse(input)
    return this.client.request(`/offerings/${encodeURIComponent(offeringId)}/add-ons`, { body, method: "PUT" }, OfferingAddOnAssignmentsReplaceResultSchema)
  }

  createCustomAddOn(offeringId: string, input: OfferingCustomAddOnCreateBody) {
    const body = OfferingCustomAddOnCreateBodySchema.parse(input)
    return this.client.post(`/offerings/${encodeURIComponent(offeringId)}/add-ons/custom`, body, OfferingCustomAddOnCreateResultSchema)
  }

  createDraftPriceBook(offeringId: string, body: HousePriceBookDraftCreateBody) {
    return this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/drafts`, body, OfferingPricingMutationResultSchema)
  }

  replaceDraftPriceBook(offeringId: string, priceBookId: string, body: HousePriceBookDraftReplaceBody) {
    return this.client.request(`/offerings/${encodeURIComponent(offeringId)}/price-books/drafts/${encodeURIComponent(priceBookId)}`, { body, method: "PUT" }, OfferingPricingMutationResultSchema)
  }

  activatePriceBook(offeringId: string, priceBookId: string, input: HousePriceBookActivateBody) {
    const body = HousePriceBookActivateBodySchema.parse(input)
    return this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/${encodeURIComponent(priceBookId)}/activate`, body, OfferingPricingMutationResultSchema)
  }

  schedulePriceBook(offeringId: string, priceBookId: string, input: HousePriceBookScheduleBody) {
    const body = HousePriceBookScheduleBodySchema.parse(input)
    return this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/${encodeURIComponent(priceBookId)}/schedule`, body, OfferingPricingMutationResultSchema)
  }

  previewHouseQuote(offeringId: string, body: InternalHouseOfferingQuoteBody) {
    return this.client.post(`/offerings/${encodeURIComponent(offeringId)}/quotes/preview`, body, InternalOfferingQuoteResultSchema)
  }

  previewCampgroundQuote(offeringId: string, input: InternalCampgroundOfferingQuoteBody) {
    const body = InternalCampgroundOfferingQuoteBodySchema.parse(input)
    return this.client.post(`/offerings/${encodeURIComponent(offeringId)}/quotes/preview`, body, InternalOfferingQuoteResultSchema)
  }
}

export const houseOfferingGateway = new ApiHouseOfferingGateway()

function addOnLibraryParams(query: AddOnLibraryQuery) {
  const params = new URLSearchParams({ limit: String(query.limit) })
  if (query.q) params.set("q", query.q)
  if (query.state) params.set("state", query.state)
  if (query.serviceType) params.set("serviceType", query.serviceType)
  if (query.scope) params.set("scope", query.scope)
  if (query.cursor) params.set("cursor", query.cursor)
  return params
}

function bindingTargetParams(query: OfferingBindingTargetLookupQuery) {
  const params = new URLSearchParams({ targetType: query.targetType, limit: String(query.limit) })
  if (query.q) params.set("q", query.q)
  if (query.kind) params.set("kind", query.kind)
  if (query.cursor) params.set("cursor", query.cursor)
  return params
}
