import {
  AddOnOfferingCreateBodySchema,
  AddOnOfferingCreateResultSchema,
  AddOnOfferingListQuerySchema,
  AddOnOfferingListResponseSchema,
  AddOnTermsMutationBodySchema,
  AddOnTermsMutationResultSchema,
  AddOnLibraryQuerySchema,
  AddOnLibraryResponseSchema,
  CampgroundOfferingBindingsReplaceBodySchema,
  HouseOfferingBindingsReplaceBodySchema,
  VenueOfferingBindingsReplaceBodySchema,
  HouseOfferingListQuerySchema,
  HouseOfferingListResponseSchema,
  HousePriceBookActivateBodySchema,
  HousePriceBookDraftCreateBodySchema,
  HousePriceBookDraftReplaceBodySchema,
  HousePriceBookScheduleBodySchema,
  InternalHouseOfferingQuoteBodySchema,
  InternalCampgroundOfferingQuoteBodySchema,
  InternalOfferingEditorSchema,
  InternalOfferingQuoteResultSchema,
  OfferingPricingMutationResultSchema,
  OfferingAddOnAssignmentsReplaceBodySchema,
  OfferingAddOnAssignmentsReplaceResultSchema,
  OfferingBindingsReplaceResultSchema,
  OfferingBindingTargetLookupQuerySchema,
  OfferingBindingTargetLookupResponseSchema,
  OfferingCustomAddOnCreateBodySchema,
  OfferingCustomAddOnCreateResultSchema,
  StayOfferingListQuerySchema,
  StayOfferingListResponseSchema,
  VenueOfferingListQuerySchema,
  VenueOfferingListResponseSchema,
  type AddOnLibraryQuery,
  type AddOnLibraryResponse,
  type AddOnOfferingCreateBody,
  type AddOnOfferingCreateResult,
  type AddOnOfferingListQuery,
  type AddOnOfferingListResponse,
  type AddOnTermsMutationBody,
  type AddOnTermsMutationResult,
  type CampgroundOfferingBindingsReplaceBody,
  type VenueOfferingBindingsReplaceBody,
  type HouseOfferingListQuery,
  type HouseOfferingListResponse,
  type HousePriceBookActivateBody,
  type HousePriceBookDraftCreateBody,
  type HousePriceBookDraftReplaceBody,
  type HousePriceBookScheduleBody,
  type HouseOfferingBindingsReplaceBody,
  type InternalHouseOfferingQuoteBody,
  type InternalCampgroundOfferingQuoteBody,
  type InternalOfferingEditor,
  type InternalOfferingQuoteResult,
  type OfferingPricingMutationResult,
  type OfferingAddOnAssignmentsReplaceBody,
  type OfferingAddOnAssignmentsReplaceResult,
  type OfferingBindingsReplaceResult,
  type OfferingBindingTargetLookupQuery,
  type OfferingBindingTargetLookupResponse,
  type OfferingCustomAddOnCreateBody,
  type OfferingCustomAddOnCreateResult,
  type StayOfferingListQuery,
  type VenueOfferingListQuery,
} from "@crm/contracts"
import type { OfferingEditorGateway } from "@crm/offering-editor"

import { AdminApiError, createAdminApiClient, type AdminApiClient } from "@admin/lib/api-client"

/**
 * Admin-only transport adapter for the shared house editor.
 *
 * It deliberately has no fixture implementation: operational offering data stays
 * authoritative in the shared API even when the surrounding CMS is in fixture mode.
 */
export class AdminHouseOfferingGateway implements OfferingEditorGateway {
  constructor(private readonly client: AdminApiClient = createAdminApiClient()) {}

  async listHouses(input: HouseOfferingListQuery): Promise<HouseOfferingListResponse> {
    const query = HouseOfferingListQuerySchema.parse(input)
    return this.call(() => this.client.get(`/offerings?${listParams(query).toString()}`, HouseOfferingListResponseSchema))
  }

  async listCampgrounds(input: StayOfferingListQuery & { kind: "campground" }) {
    const query = StayOfferingListQuerySchema.parse(input)
    return this.call(() => this.client.get(`/offerings?${listParams(query).toString()}`, StayOfferingListResponseSchema))
  }

  async listAddOns(input: AddOnOfferingListQuery): Promise<AddOnOfferingListResponse> {
    const query = AddOnOfferingListQuerySchema.parse(input)
    return this.call(() => this.client.get(`/offerings?${addOnListParams(query).toString()}`, AddOnOfferingListResponseSchema))
  }

  async listVenues(input: VenueOfferingListQuery) {
    const query = VenueOfferingListQuerySchema.parse(input)
    return this.call(() => this.client.get(`/offerings?${listParams(query).toString()}`, VenueOfferingListResponseSchema))
  }

  async getHouseEditor(offeringId: string): Promise<InternalOfferingEditor | null> {
    try {
      const editor = await this.client.get(`/offerings/${encodeURIComponent(offeringId)}/editor`, InternalOfferingEditorSchema)
      if (editor.offering.kind !== "house") throw new Error("Маршрут домика получил предложение другого типа")
      return editor
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 404) return null
      throw normalizeHouseOfferingError(error)
    }
  }

  async getCampgroundEditor(offeringId: string): Promise<InternalOfferingEditor | null> {
    try {
      const editor = await this.client.get(`/offerings/${encodeURIComponent(offeringId)}/editor`, InternalOfferingEditorSchema)
      if (editor.offering.kind !== "campground") throw new Error("Маршрут кемпинга получил предложение другого типа")
      return editor
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 404) return null
      throw normalizeHouseOfferingError(error)
    }
  }

  async getAddOnEditor(offeringId: string): Promise<InternalOfferingEditor | null> {
    try {
      const editor = await this.client.get(`/offerings/${encodeURIComponent(offeringId)}/editor`, InternalOfferingEditorSchema)
      if (editor.offering.kind !== "addon") throw new Error("Маршрут дополнительной услуги получил предложение другого типа")
      return editor
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 404) return null
      throw normalizeHouseOfferingError(error)
    }
  }

  async getVenueEditor(offeringId: string): Promise<InternalOfferingEditor | null> {
    try {
      const editor = await this.client.get(`/offerings/${encodeURIComponent(offeringId)}/editor`, InternalOfferingEditorSchema)
      if (editor.offering.kind !== "venue") throw new Error("Маршрут площадки получил предложение другого типа")
      return editor
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 404) return null
      throw normalizeHouseOfferingError(error)
    }
  }

  async createAddOn(input: AddOnOfferingCreateBody): Promise<AddOnOfferingCreateResult> {
    const body = AddOnOfferingCreateBodySchema.parse(input)
    return this.call(() => this.client.post("/offerings/addons", body, AddOnOfferingCreateResultSchema))
  }

  async replaceAddOnTerms(offeringId: string, input: AddOnTermsMutationBody): Promise<AddOnTermsMutationResult> {
    const body = AddOnTermsMutationBodySchema.parse(input)
    return this.call(() => this.client.put(`/offerings/${encodeURIComponent(offeringId)}/addon-terms`, body, AddOnTermsMutationResultSchema))
  }

  async listAddOnLibrary(input: AddOnLibraryQuery): Promise<AddOnLibraryResponse> {
    const query = AddOnLibraryQuerySchema.parse(input)
    return this.call(() => this.client.get(`/addons?${addOnLibraryParams(query).toString()}`, AddOnLibraryResponseSchema))
  }

  async listBindingTargets(input: OfferingBindingTargetLookupQuery): Promise<OfferingBindingTargetLookupResponse> {
    const query = OfferingBindingTargetLookupQuerySchema.parse(input)
    return this.call(() => this.client.get(`/offerings/binding-targets?${bindingTargetParams(query).toString()}`, OfferingBindingTargetLookupResponseSchema))
  }

  async replaceHouseBindings(offeringId: string, input: HouseOfferingBindingsReplaceBody): Promise<OfferingBindingsReplaceResult> {
    const body = HouseOfferingBindingsReplaceBodySchema.parse(input)
    return this.call(() => this.client.put(`/offerings/${encodeURIComponent(offeringId)}/bindings`, body, OfferingBindingsReplaceResultSchema))
  }

  async replaceCampgroundBindings(offeringId: string, input: CampgroundOfferingBindingsReplaceBody): Promise<OfferingBindingsReplaceResult> {
    const body = CampgroundOfferingBindingsReplaceBodySchema.parse(input)
    return this.call(() => this.client.put(`/offerings/${encodeURIComponent(offeringId)}/bindings`, body, OfferingBindingsReplaceResultSchema))
  }

  async replaceVenueBindings(offeringId: string, input: VenueOfferingBindingsReplaceBody): Promise<OfferingBindingsReplaceResult> {
    const body = VenueOfferingBindingsReplaceBodySchema.parse(input)
    return this.call(() => this.client.put(`/offerings/${encodeURIComponent(offeringId)}/venue-bindings`, body, OfferingBindingsReplaceResultSchema))
  }

  async replaceAddOnAssignments(offeringId: string, input: OfferingAddOnAssignmentsReplaceBody): Promise<OfferingAddOnAssignmentsReplaceResult> {
    const body = OfferingAddOnAssignmentsReplaceBodySchema.parse(input)
    return this.call(() => this.client.put(`/offerings/${encodeURIComponent(offeringId)}/add-ons`, body, OfferingAddOnAssignmentsReplaceResultSchema))
  }

  async createCustomAddOn(offeringId: string, input: OfferingCustomAddOnCreateBody): Promise<OfferingCustomAddOnCreateResult> {
    const body = OfferingCustomAddOnCreateBodySchema.parse(input)
    return this.call(() => this.client.post(`/offerings/${encodeURIComponent(offeringId)}/add-ons/custom`, body, OfferingCustomAddOnCreateResultSchema))
  }

  async createDraftPriceBook(offeringId: string, input: HousePriceBookDraftCreateBody): Promise<OfferingPricingMutationResult> {
    const body = HousePriceBookDraftCreateBodySchema.parse(input)
    return this.call(() => this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/drafts`, body, OfferingPricingMutationResultSchema))
  }

  async replaceDraftPriceBook(offeringId: string, priceBookId: string, input: HousePriceBookDraftReplaceBody): Promise<OfferingPricingMutationResult> {
    const body = HousePriceBookDraftReplaceBodySchema.parse(input)
    return this.call(() => this.client.put(`/offerings/${encodeURIComponent(offeringId)}/price-books/drafts/${encodeURIComponent(priceBookId)}`, body, OfferingPricingMutationResultSchema))
  }

  async activatePriceBook(offeringId: string, priceBookId: string, input: HousePriceBookActivateBody): Promise<OfferingPricingMutationResult> {
    const body = HousePriceBookActivateBodySchema.parse(input)
    return this.call(() => this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/${encodeURIComponent(priceBookId)}/activate`, body, OfferingPricingMutationResultSchema))
  }

  async schedulePriceBook(offeringId: string, priceBookId: string, input: HousePriceBookScheduleBody): Promise<OfferingPricingMutationResult> {
    const body = HousePriceBookScheduleBodySchema.parse(input)
    return this.call(() => this.client.post(`/offerings/${encodeURIComponent(offeringId)}/price-books/${encodeURIComponent(priceBookId)}/schedule`, body, OfferingPricingMutationResultSchema))
  }

  async previewHouseQuote(offeringId: string, input: InternalHouseOfferingQuoteBody): Promise<InternalOfferingQuoteResult> {
    const body = InternalHouseOfferingQuoteBodySchema.parse(input)
    return this.call(() => this.client.post(`/offerings/${encodeURIComponent(offeringId)}/quotes/preview`, body, InternalOfferingQuoteResultSchema))
  }

  async previewCampgroundQuote(offeringId: string, input: InternalCampgroundOfferingQuoteBody): Promise<InternalOfferingQuoteResult> {
    const body = InternalCampgroundOfferingQuoteBodySchema.parse(input)
    return this.call(() => this.client.post(`/offerings/${encodeURIComponent(offeringId)}/quotes/preview`, body, InternalOfferingQuoteResultSchema))
  }

  private async call<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      throw normalizeHouseOfferingError(error)
    }
  }
}

export class HouseOfferingGatewayError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId: string | undefined
  readonly details: Record<string, unknown>
  readonly fieldErrors: Record<string, string[]> | undefined
  readonly isConflict: boolean
  readonly isPermissionDenied: boolean

  constructor(error: AdminApiError) {
    super(error.message)
    this.name = "HouseOfferingGatewayError"
    this.status = error.status
    this.code = error.rawCode ?? error.code
    this.requestId = error.requestId
    this.details = error.details
    this.fieldErrors = error.fieldErrors
    this.isConflict = error.isConflict
    this.isPermissionDenied = error.isPermissionDenied
  }
}

export function normalizeHouseOfferingError(error: unknown): unknown {
  return error instanceof AdminApiError ? new HouseOfferingGatewayError(error) : error
}

export const houseOfferingGateway = new AdminHouseOfferingGateway()

function listParams(query: HouseOfferingListQuery | StayOfferingListQuery | VenueOfferingListQuery) {
  const params = new URLSearchParams({ kind: query.kind, limit: String(query.limit) })
  if (query.q) params.set("q", query.q)
  if (query.state) params.set("state", query.state)
  if (query.cursor) params.set("cursor", query.cursor)
  return params
}

function addOnListParams(query: AddOnOfferingListQuery) {
  const params = new URLSearchParams({ kind: query.kind, limit: String(query.limit) })
  if (query.q) params.set("q", query.q)
  if (query.state) params.set("state", query.state)
  if (query.serviceType) params.set("serviceType", query.serviceType)
  if (query.scope) params.set("scope", query.scope)
  if (query.categoryKey) params.set("categoryKey", query.categoryKey)
  if (query.standalone !== undefined) params.set("standalone", String(query.standalone))
  if (query.cursor) params.set("cursor", query.cursor)
  return params
}

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
