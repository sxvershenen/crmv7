import type {
  AddOnOfferingCreateBody,
  AddOnOfferingCreateResult,
  AddOnOfferingListQuery,
  AddOnOfferingListResponse,
  AddOnTermsMutationBody,
  AddOnTermsMutationResult,
  AddOnLibraryQuery,
  AddOnLibraryResponse,
  CampgroundOfferingBindingsReplaceBody,
  HouseOfferingListQuery,
  HouseOfferingListResponse,
  HousePriceBookActivateBody,
  HousePriceBookDraftCreateBody,
  HousePriceBookDraftReplaceBody,
  HousePriceBookScheduleBody,
  InternalCampgroundOfferingQuoteBody,
  InternalHouseOfferingQuoteBody,
  InternalOfferingEditor,
  InternalOfferingQuoteResult,
  StayOfferingListQuery,
  StayOfferingListResponse,
  VenueOfferingListQuery,
  VenueOfferingListResponse,
  HouseOfferingBindingsReplaceBody,
  VenueOfferingBindingsReplaceBody,
  OfferingAddOnAssignmentsReplaceBody,
  OfferingAddOnAssignmentsReplaceResult,
  OfferingBindingTargetLookupQuery,
  OfferingBindingTargetLookupResponse,
  OfferingBindingsReplaceResult,
  OfferingCustomAddOnCreateBody,
  OfferingCustomAddOnCreateResult,
  OfferingPricingMutationResult,
} from "@crm/contracts"

/**
 * The only transport boundary of this package. CRM and admin adapters own URL
 * construction, authentication, error normalization and cache invalidation.
 */
export interface OfferingEditorGateway {
  listHouses(query: HouseOfferingListQuery): Promise<HouseOfferingListResponse>
  listCampgrounds(query: StayOfferingListQuery & { kind: "campground" }): Promise<StayOfferingListResponse>
  listAddOns(query: AddOnOfferingListQuery): Promise<AddOnOfferingListResponse>
  listVenues(query: VenueOfferingListQuery): Promise<VenueOfferingListResponse>
  getHouseEditor(offeringId: string): Promise<InternalOfferingEditor | null>
  getCampgroundEditor(offeringId: string): Promise<InternalOfferingEditor | null>
  getAddOnEditor(offeringId: string): Promise<InternalOfferingEditor | null>
  getVenueEditor(offeringId: string): Promise<InternalOfferingEditor | null>
  createAddOn(body: AddOnOfferingCreateBody): Promise<AddOnOfferingCreateResult>
  replaceAddOnTerms(offeringId: string, body: AddOnTermsMutationBody): Promise<AddOnTermsMutationResult>
  listBindingTargets(query: OfferingBindingTargetLookupQuery): Promise<OfferingBindingTargetLookupResponse>
  listAddOnLibrary(query: AddOnLibraryQuery): Promise<AddOnLibraryResponse>
  replaceHouseBindings(
    offeringId: string,
    body: HouseOfferingBindingsReplaceBody,
  ): Promise<OfferingBindingsReplaceResult>
  replaceCampgroundBindings(
    offeringId: string,
    body: CampgroundOfferingBindingsReplaceBody,
  ): Promise<OfferingBindingsReplaceResult>
  replaceVenueBindings(
    offeringId: string,
    body: VenueOfferingBindingsReplaceBody,
  ): Promise<OfferingBindingsReplaceResult>
  replaceAddOnAssignments(
    offeringId: string,
    body: OfferingAddOnAssignmentsReplaceBody,
  ): Promise<OfferingAddOnAssignmentsReplaceResult>
  createCustomAddOn(
    offeringId: string,
    body: OfferingCustomAddOnCreateBody,
  ): Promise<OfferingCustomAddOnCreateResult>
  createDraftPriceBook(
    offeringId: string,
    body: HousePriceBookDraftCreateBody,
  ): Promise<OfferingPricingMutationResult>
  replaceDraftPriceBook(
    offeringId: string,
    priceBookId: string,
    body: HousePriceBookDraftReplaceBody,
  ): Promise<OfferingPricingMutationResult>
  activatePriceBook(
    offeringId: string,
    priceBookId: string,
    body: HousePriceBookActivateBody,
  ): Promise<OfferingPricingMutationResult>
  schedulePriceBook(
    offeringId: string,
    priceBookId: string,
    body: HousePriceBookScheduleBody,
  ): Promise<OfferingPricingMutationResult>
  previewHouseQuote(
    offeringId: string,
    body: InternalHouseOfferingQuoteBody,
  ): Promise<InternalOfferingQuoteResult>
  previewCampgroundQuote(
    offeringId: string,
    body: InternalCampgroundOfferingQuoteBody,
  ): Promise<InternalOfferingQuoteResult>
}

export type OfferingEditorCommandMeta = Pick<
  HousePriceBookDraftCreateBody,
  "operationId" | "idempotencyKey" | "expectedPricingVersion"
>

export type OfferingEditorCommandMetaFactory = () => OfferingEditorCommandMeta

export interface OfferingEditorTransportError {
  code?: string
  isConflict?: boolean
  message?: string
  status?: number
}

export function isOfferingEditorConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as OfferingEditorTransportError
  return candidate.isConflict === true || candidate.status === 409
}

export function offeringEditorErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
