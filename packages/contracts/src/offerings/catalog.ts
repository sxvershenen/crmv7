import { z } from "zod";

import { IdempotencyKeySchema, OperationIdSchema } from "../operations.js";
import {
  CurrencySchema,
  DateTimeSchema,
  IdSchema,
  VersionSchema,
} from "../primitives.js";

export const CatalogOfferingKindSchema = z.enum([
  "house",
  "campground",
  "addon",
  "venue",
  "event_service",
  "program",
]);
export type CatalogOfferingKind = z.infer<typeof CatalogOfferingKindSchema>;

export const CatalogOfferingStateSchema = z.enum(["draft", "active", "paused", "archived"]);
export type CatalogOfferingState = z.infer<typeof CatalogOfferingStateSchema>;
export const OfferingSalesModeSchema = z.enum(["request_only", "quoted", "selectable"]);
export type OfferingSalesMode = z.infer<typeof OfferingSalesModeSchema>;
export const PriceDisplayModeSchema = z.enum(["exact", "from", "request"]);
export type PriceDisplayMode = z.infer<typeof PriceDisplayModeSchema>;
export const OfferingTaxModeSchema = z.enum(["tax_included", "tax_excluded", "not_taxable"]);
export type OfferingTaxMode = z.infer<typeof OfferingTaxModeSchema>;

export const AddOnServiceTypeSchema = z.enum([
  "scheduled_resource",
  "quantity_service",
  "person_service",
  "package_service",
  "content_only",
]);
export type AddOnServiceType = z.infer<typeof AddOnServiceTypeSchema>;
export const AddOnScopeSchema = z.enum(["reusable", "offering_specific"]);
export type AddOnScope = z.infer<typeof AddOnScopeSchema>;
/** Stable operational taxonomy key used for library filtering, never public copy. */
export const AddOnCategoryKeySchema = z.string().trim().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/);
export type AddOnCategoryKey = z.infer<typeof AddOnCategoryKeySchema>;
export const AddOnApplicableOfferingKindSchema = z.enum(["house", "campground", "venue", "event_service", "program"]);
export type AddOnApplicableOfferingKind = z.infer<typeof AddOnApplicableOfferingKindSchema>;

const AddOnServiceTermsBaseSchema = z.object({
  categoryKey: AddOnCategoryKeySchema,
  applicableOfferingKinds: z.array(AddOnApplicableOfferingKindSchema).min(1).max(5)
    .refine((items) => new Set(items).size === items.length, "Applicable offering kinds must be unique"),
}).strict();

const AddOnQuantityTermsFieldsSchema = z.object({
  min: z.number().int().positive().max(1_000_000),
  max: z.number().int().positive().max(1_000_000).nullable(),
  default: z.number().int().positive().max(1_000_000),
  step: z.number().int().positive().max(1_000_000),
}).strict().superRefine((value, context) => {
  if (value.max !== null && value.min > value.max) context.addIssue({ code: "custom", path: ["max"], message: "Invalid quantity range" });
  if (value.default < value.min || (value.max !== null && value.default > value.max)) context.addIssue({ code: "custom", path: ["default"], message: "Default quantity is outside the allowed range" });
  if ((value.default - value.min) % value.step !== 0) context.addIssue({ code: "custom", path: ["default"], message: "Default quantity must align with the quantity step" });
  if (value.max !== null && (value.max - value.min) % value.step !== 0) context.addIssue({ code: "custom", path: ["max"], message: "Maximum quantity must align with the quantity step" });
});

export const AddOnServiceTermsSchema = z.discriminatedUnion("serviceType", [
  AddOnServiceTermsBaseSchema.extend({
    serviceType: z.literal("quantity_service"),
    quantity: AddOnQuantityTermsFieldsSchema.safeExtend({ metric: z.literal("units") }).strict(),
  }).strict(),
  AddOnServiceTermsBaseSchema.extend({
    serviceType: z.literal("person_service"),
    quantity: AddOnQuantityTermsFieldsSchema.safeExtend({ metric: z.literal("participants"), step: z.literal(1) }).strict(),
  }).strict(),
  AddOnServiceTermsBaseSchema.extend({ serviceType: z.literal("scheduled_resource"), quantity: z.null() }).strict(),
  AddOnServiceTermsBaseSchema.extend({ serviceType: z.literal("package_service"), quantity: z.null() }).strict(),
  AddOnServiceTermsBaseSchema.extend({ serviceType: z.literal("content_only"), quantity: z.null() }).strict(),
]);
export type AddOnServiceTerms = z.infer<typeof AddOnServiceTermsSchema>;

/**
 * This policy contains only commercial semantics. Capacity remains owned by a
 * Resource and program duration remains owned by a ProgramTemplate.
 */
export const OfferingFulfillmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("house"),
    stayPricing: z.literal("sum_each_local_night"),
  }).strict(),
  z.object({
    kind: z.literal("campground"),
    salesUnit: z.enum(["owned_tent", "own_tent_pitch"]),
    allocationMode: z.enum(["discrete_inventory", "shared_capacity"]),
    capacityUnit: z.literal("tent"),
    stayPricing: z.literal("sum_each_local_night"),
  }).strict().superRefine((value, context) => {
    if (value.salesUnit === "owned_tent" && value.allocationMode !== "discrete_inventory") {
      context.addIssue({
        code: "custom",
        path: ["allocationMode"],
        message: "owned_tent requires discrete_inventory",
      });
    }
    if (value.salesUnit === "own_tent_pitch" && value.allocationMode !== "shared_capacity") {
      context.addIssue({
        code: "custom",
        path: ["allocationMode"],
        message: "own_tent_pitch requires shared_capacity",
      });
    }
  }),
  z.object({
    kind: z.literal("addon"),
    serviceType: AddOnServiceTypeSchema,
    standalone: z.boolean(),
    scope: AddOnScopeSchema,
    ownerOfferingId: IdSchema.nullable(),
  }).strict().superRefine((value, context) => {
    if (value.scope === "reusable" && value.ownerOfferingId !== null) {
      context.addIssue({
        code: "custom",
        path: ["ownerOfferingId"],
        message: "Reusable add-ons cannot have an owner offering",
      });
    }
    if (value.scope === "offering_specific" && value.ownerOfferingId === null) {
      context.addIssue({
        code: "custom",
        path: ["ownerOfferingId"],
        message: "Offering-specific add-ons require an owner offering",
      });
    }
  }),
  /** A venue is one exclusive operational Resource; pricing is resolved by its active RatePlan. */
  z.object({
    kind: z.literal("venue"),
    allocationMode: z.literal("exclusive_resource"),
    capacityUnit: z.literal("guests"),
    pricingMode: z.literal("rate_plan"),
  }).strict(),
  z.object({ kind: z.literal("event_service") }).strict(),
  z.object({ kind: z.literal("program") }).strict(),
]);
export type OfferingFulfillment = z.infer<typeof OfferingFulfillmentSchema>;

const OfferingBusinessFieldsSchema = z.object({
  operationalName: z.string().trim().min(1).max(500),
  internalComment: z.string().max(20_000),
  salesMode: OfferingSalesModeSchema,
  priceDisplayMode: PriceDisplayModeSchema,
  currency: CurrencySchema,
  timezone: z.string().trim().min(1).max(100),
  taxMode: OfferingTaxModeSchema,
  businessCalendarId: IdSchema,
  fulfillment: OfferingFulfillmentSchema,
}).strict();

function validateOfferingKind(
  value: { kind: CatalogOfferingKind; fulfillment: OfferingFulfillment; salesMode: OfferingSalesMode },
  context: z.RefinementCtx,
) {
  if (value.kind !== value.fulfillment.kind) {
    context.addIssue({ code: "custom", path: ["fulfillment"], message: "Fulfillment kind mismatch" });
  }
  if (
    value.fulfillment.kind === "addon"
    && value.fulfillment.serviceType === "content_only"
    && value.salesMode !== "request_only"
  ) {
    context.addIssue({
      code: "custom",
      path: ["salesMode"],
      message: "content_only add-ons must use request_only",
    });
  }
}

export const CatalogOfferingSchema = OfferingBusinessFieldsSchema.extend({
  id: IdSchema,
  code: z.string().min(1).max(120),
  version: VersionSchema,
  kind: CatalogOfferingKindSchema,
  state: CatalogOfferingStateSchema,
  activePriceBookId: IdSchema.nullable(),
  archivedAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).strict().superRefine(validateOfferingKind);
export type CatalogOffering = z.infer<typeof CatalogOfferingSchema>;

export const HouseOfferingListQuerySchema = z.object({
  kind: z.literal("house").default("house"),
  q: z.string().trim().min(1).max(200).optional(),
  state: CatalogOfferingStateSchema.optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type HouseOfferingListQuery = z.infer<typeof HouseOfferingListQuerySchema>;
export const StayOfferingListQuerySchema = z.object({
  kind: z.enum(["house", "campground"]).default("house"),
  q: z.string().trim().min(1).max(200).optional(),
  state: CatalogOfferingStateSchema.optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type StayOfferingListQuery = z.infer<typeof StayOfferingListQuerySchema>;
export const HouseOfferingListResponseSchema = z.object({
  items: z.array(CatalogOfferingSchema).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
}).strict();
export type HouseOfferingListResponse = z.infer<typeof HouseOfferingListResponseSchema>;
export const StayOfferingListResponseSchema = HouseOfferingListResponseSchema;
export type StayOfferingListResponse = z.infer<typeof StayOfferingListResponseSchema>;

export const VenueOfferingListQuerySchema = z.object({
  kind: z.literal("venue").default("venue"),
  q: z.string().trim().min(1).max(200).optional(),
  state: CatalogOfferingStateSchema.optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type VenueOfferingListQuery = z.infer<typeof VenueOfferingListQuerySchema>;
export const VenueOfferingListResponseSchema = HouseOfferingListResponseSchema;
export type VenueOfferingListResponse = z.infer<typeof VenueOfferingListResponseSchema>;

export const AddOnOfferingListQuerySchema = z.object({
  kind: z.literal("addon").default("addon"),
  q: z.string().trim().min(1).max(200).optional(),
  state: CatalogOfferingStateSchema.optional(),
  serviceType: AddOnServiceTypeSchema.optional(),
  scope: AddOnScopeSchema.optional(),
  categoryKey: AddOnCategoryKeySchema.optional(),
  standalone: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type AddOnOfferingListQuery = z.infer<typeof AddOnOfferingListQuerySchema>;

export const AddOnPriceReadinessSchema = z.enum(["ready", "draft_only", "missing", "not_sellable"]);
export const AddOnOfferingListItemSchema = z.object({
  offering: CatalogOfferingSchema,
  terms: AddOnServiceTermsSchema,
  usageCount: z.number().int().nonnegative().max(1_000_000),
  priceReadiness: AddOnPriceReadinessSchema,
  editorialNodeId: IdSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.offering.kind !== "addon") context.addIssue({ code: "custom", path: ["offering", "kind"], message: "Expected an add-on offering" });
  if (value.offering.fulfillment.kind !== "addon" || value.offering.fulfillment.serviceType !== value.terms.serviceType) {
    context.addIssue({ code: "custom", path: ["terms", "serviceType"], message: "Add-on fulfillment and terms must agree" });
  }
});
export const AddOnOfferingListResponseSchema = z.object({
  items: z.array(AddOnOfferingListItemSchema).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
}).strict();
export type AddOnOfferingListItem = z.infer<typeof AddOnOfferingListItemSchema>;
export type AddOnOfferingListResponse = z.infer<typeof AddOnOfferingListResponseSchema>;
export const OfferingListQuerySchema = z.union([StayOfferingListQuerySchema, VenueOfferingListQuerySchema, AddOnOfferingListQuerySchema]);
export type OfferingListQuery = z.infer<typeof OfferingListQuerySchema>;
/** Flat query description for OpenAPI; runtime validation remains the stricter kind-discriminated union above. */
export const OfferingListOpenApiQuerySchema = z.object({
  kind: z.enum(["house", "campground", "venue", "addon"]).default("house"),
  q: z.string().trim().min(1).max(200).optional(),
  state: CatalogOfferingStateSchema.optional(),
  serviceType: AddOnServiceTypeSchema.optional(),
  scope: AddOnScopeSchema.optional(),
  categoryKey: AddOnCategoryKeySchema.optional(),
  standalone: z.enum(["true", "false"]).optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export const OfferingListResponseSchema = z.union([StayOfferingListResponseSchema, VenueOfferingListResponseSchema, AddOnOfferingListResponseSchema]);
export type OfferingListResponse = z.infer<typeof OfferingListResponseSchema>;

/**
 * Compact commercial identity for a Resource dossier. It deliberately omits
 * pricing, fulfillment, bindings and editorial data: the caller opens the
 * full offering editor only after this resolver has established a single
 * primary association.
 */
export const ResourcePrimaryStayOfferingSummarySchema = z.object({
  offeringId: IdSchema,
  kind: z.enum(["house", "campground"]),
  code: z.string().min(1).max(120),
  operationalName: z.string().min(1).max(500),
  state: CatalogOfferingStateSchema,
}).strict();
export type ResourcePrimaryStayOfferingSummary = z.infer<typeof ResourcePrimaryStayOfferingSummarySchema>;

/**
 * A Resource may have no commercial identity yet, or legacy data may contain
 * more than one primary stay offering. Consumers must never select a
 * candidate implicitly in the latter case.
 */
export const ResourcePrimaryStayOfferingLookupResponseSchema = z.discriminatedUnion("resolution", [
  z.object({ resolution: z.literal("none") }).strict(),
  z.object({ resolution: z.literal("linked"), offering: ResourcePrimaryStayOfferingSummarySchema }).strict(),
  z.object({ resolution: z.literal("ambiguous"), candidates: z.array(ResourcePrimaryStayOfferingSummarySchema).min(2).max(100) }).strict(),
]);
export type ResourcePrimaryStayOfferingLookupResponse = z.infer<typeof ResourcePrimaryStayOfferingLookupResponseSchema>;

/** Guided command: the Resource is the sole input identity; all commercial defaults are derived server-side. */
export const ResourceStayOfferingCreateBodySchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type ResourceStayOfferingCreateBody = z.infer<typeof ResourceStayOfferingCreateBodySchema>;
export const ResourceStayOfferingCreateResultSchema = ResourcePrimaryStayOfferingSummarySchema;
export type ResourceStayOfferingCreateResult = z.infer<typeof ResourceStayOfferingCreateResultSchema>;

export const ResourcePrimaryVenueOfferingSummarySchema = z.object({
  offeringId: IdSchema,
  kind: z.literal("venue"),
  code: z.string().min(1).max(120),
  operationalName: z.string().min(1).max(500),
  state: CatalogOfferingStateSchema,
}).strict();
export type ResourcePrimaryVenueOfferingSummary = z.infer<typeof ResourcePrimaryVenueOfferingSummarySchema>;
export const ResourcePrimaryVenueOfferingLookupResponseSchema = z.discriminatedUnion("resolution", [
  z.object({ resolution: z.literal("none") }).strict(),
  z.object({ resolution: z.literal("linked"), offering: ResourcePrimaryVenueOfferingSummarySchema }).strict(),
  z.object({ resolution: z.literal("ambiguous"), candidates: z.array(ResourcePrimaryVenueOfferingSummarySchema).min(2).max(100) }).strict(),
]);
export type ResourcePrimaryVenueOfferingLookupResponse = z.infer<typeof ResourcePrimaryVenueOfferingLookupResponseSchema>;
export const ResourceVenueOfferingCreateBodySchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type ResourceVenueOfferingCreateBody = z.infer<typeof ResourceVenueOfferingCreateBodySchema>;
export const ResourceVenueOfferingCreateResultSchema = ResourcePrimaryVenueOfferingSummarySchema;
export type ResourceVenueOfferingCreateResult = z.infer<typeof ResourceVenueOfferingCreateResultSchema>;

/**
 * Read-only selector for typed fulfillment targets. The first delivery slice
 * intentionally supports only CRM Resources; adding another target type must
 * add both an explicit query literal and a separately allowlisted DTO.
 */
export const OfferingBindingTargetLookupQuerySchema = z.object({
  targetType: z.literal("resource"),
  q: z.string().trim().min(1).max(200).optional(),
  kind: z.string().trim().min(1).max(64).optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type OfferingBindingTargetLookupQuery = z.infer<typeof OfferingBindingTargetLookupQuerySchema>;

/** Safe operational identity only; Resource.settings and audit fields never leave this projection. */
export const OfferingBindingTargetSummarySchema = z.object({
  type: z.literal("resource"),
  id: IdSchema,
  version: VersionSchema,
  code: z.string().min(1).max(120),
  name: z.string().min(1).max(500),
  kind: z.string().min(1).max(64),
  capacity: z.object({
    mode: z.enum(["fixed", "shared"]),
    total: z.number().int().nonnegative().max(1_000_000),
  }).strict(),
  /** Editor summaries retain an already-bound archived identity instead of hiding it. */
  archived: z.boolean(),
}).strict();
export type OfferingBindingTargetSummary = z.infer<typeof OfferingBindingTargetSummarySchema>;
/** Search never returns archived targets, unlike an editor's already-bound target summaries. */
export const OfferingBindingTargetLookupItemSchema = OfferingBindingTargetSummarySchema.extend({
  archived: z.literal(false),
}).strict();
export type OfferingBindingTargetLookupItem = z.infer<typeof OfferingBindingTargetLookupItemSchema>;
export const OfferingBindingTargetLookupResponseSchema = z.object({
  items: z.array(OfferingBindingTargetLookupItemSchema).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
}).strict();
export type OfferingBindingTargetLookupResponse = z.infer<typeof OfferingBindingTargetLookupResponseSchema>;

export const CatalogOfferingCreateSchema = OfferingBusinessFieldsSchema.extend({
  code: z.string().trim().min(1).max(120).optional(),
  kind: CatalogOfferingKindSchema,
  state: CatalogOfferingStateSchema.default("draft"),
  internalComment: z.string().max(20_000).default(""),
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict().superRefine(validateOfferingKind);
export type CatalogOfferingCreate = z.infer<typeof CatalogOfferingCreateSchema>;

export const OfferingCatalogMutationMetaSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedCatalogVersion: VersionSchema,
}).strict();
export const OfferingSubjectMutationMetaSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedSubjectVersion: VersionSchema,
}).strict();
export const OfferingPricingMutationMetaSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedPricingVersion: VersionSchema,
}).strict();
export const OfferingAddOnsMutationMetaSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedAddOnsVersion: VersionSchema,
}).strict();

export const CatalogOfferingOperationalMutationSchema = OfferingCatalogMutationMetaSchema.extend({
  operationalName: z.string().trim().min(1).max(500).optional(),
  internalComment: z.string().max(20_000).optional(),
  state: CatalogOfferingStateSchema.optional(),
  salesMode: OfferingSalesModeSchema.optional(),
  priceDisplayMode: PriceDisplayModeSchema.optional(),
  taxMode: OfferingTaxModeSchema.optional(),
  businessCalendarId: IdSchema.optional(),
  fulfillment: OfferingFulfillmentSchema.optional(),
}).strict().refine((value) => Object.keys(value).some((key) => ![
  "operationId",
  "idempotencyKey",
  "expectedCatalogVersion",
].includes(key)), { message: "At least one operational field is required" });
export type CatalogOfferingOperationalMutation = z.infer<typeof CatalogOfferingOperationalMutationSchema>;
