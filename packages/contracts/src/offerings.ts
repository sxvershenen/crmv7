import { z } from "zod";

import { IdempotencyKeySchema, OperationIdSchema } from "./operations.js";
import {
  CurrencySchema,
  DateSchema,
  DateTimeSchema,
  IdSchema,
  NonNegativeMoneySchema,
  VersionSchema,
} from "./primitives.js";

const NonNegativeMinorAmountSchema = z.number().int().nonnegative().safe();

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
  z.object({ kind: z.literal("venue") }).strict(),
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
export const OfferingListQuerySchema = z.union([StayOfferingListQuerySchema, AddOnOfferingListQuerySchema]);
export type OfferingListQuery = z.infer<typeof OfferingListQuerySchema>;
/** Flat query description for OpenAPI; runtime validation remains the stricter kind-discriminated union above. */
export const OfferingListOpenApiQuerySchema = z.object({
  kind: z.enum(["house", "campground", "addon"]).default("house"),
  q: z.string().trim().min(1).max(200).optional(),
  state: CatalogOfferingStateSchema.optional(),
  serviceType: AddOnServiceTypeSchema.optional(),
  scope: AddOnScopeSchema.optional(),
  categoryKey: AddOnCategoryKeySchema.optional(),
  standalone: z.enum(["true", "false"]).optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export const OfferingListResponseSchema = z.union([StayOfferingListResponseSchema, AddOnOfferingListResponseSchema]);
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

export const AddOnOfferingCreateBodySchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  code: z.string().trim().min(1).max(120).regex(/^[A-Z][A-Z0-9-]*$/).optional(),
  operationalName: z.string().trim().min(1).max(500),
  internalComment: z.string().max(20_000).default(""),
  scope: AddOnScopeSchema.default("reusable"),
  ownerOfferingId: IdSchema.nullable().default(null),
  standalone: z.boolean().default(false),
  salesMode: OfferingSalesModeSchema.default("selectable"),
  priceDisplayMode: PriceDisplayModeSchema.default("request"),
  currency: CurrencySchema.default("RUB"),
  timezone: z.string().trim().min(1).max(100).default("Europe/Moscow"),
  taxMode: OfferingTaxModeSchema.default("tax_included"),
  businessCalendarId: IdSchema,
  terms: AddOnServiceTermsSchema,
}).strict().superRefine((value, context) => {
  if ((value.scope === "reusable") !== (value.ownerOfferingId === null)) {
    context.addIssue({ code: "custom", path: ["ownerOfferingId"], message: value.scope === "reusable" ? "Reusable add-ons cannot have an owner" : "Offering-specific add-ons require an owner" });
  }
  if (value.terms.serviceType === "content_only" && value.salesMode !== "request_only") {
    context.addIssue({ code: "custom", path: ["salesMode"], message: "content_only add-ons must use request_only" });
  }
});
export type AddOnOfferingCreateBody = z.infer<typeof AddOnOfferingCreateBodySchema>;

export const AddOnTermsMutationBodySchema = OfferingSubjectMutationMetaSchema.extend({
  standalone: z.boolean(),
  terms: AddOnServiceTermsSchema,
}).strict();
export type AddOnTermsMutationBody = z.infer<typeof AddOnTermsMutationBodySchema>;

export const AddOnTermsMutationResultSchema = z.object({
  offeringId: IdSchema,
  subjectVersion: VersionSchema,
  standalone: z.boolean(),
  terms: AddOnServiceTermsSchema,
}).strict();
export type AddOnTermsMutationResult = z.infer<typeof AddOnTermsMutationResultSchema>;

export const AddOnUsageSummarySchema = z.object({
  assignmentId: IdSchema,
  parentOffering: z.object({
    id: IdSchema,
    kind: AddOnApplicableOfferingKindSchema,
    code: z.string().min(1).max(120),
    operationalName: z.string().min(1).max(500),
    state: CatalogOfferingStateSchema,
  }).strict(),
  enabled: z.boolean(),
  required: z.boolean(),
  recommended: z.boolean(),
  groupKey: z.string().min(1).max(120).nullable(),
  displayOrder: z.number().int().min(-100_000).max(100_000),
}).strict();
export type AddOnUsageSummary = z.infer<typeof AddOnUsageSummarySchema>;

export const OfferingBindingRoleSchema = z.enum([
  "primary",
  "required",
  "optional",
  "shared_area",
  "inventory_unit",
]);
export type OfferingBindingRole = z.infer<typeof OfferingBindingRoleSchema>;
export const OfferingBindingTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("resource"), id: IdSchema }).strict(),
  z.object({ type: z.literal("resource_group"), id: IdSchema }).strict(),
  z.object({ type: z.literal("program_template"), id: IdSchema }).strict(),
  z.object({ type: z.literal("event_service_template"), id: IdSchema }).strict(),
]);
export type OfferingBindingTarget = z.infer<typeof OfferingBindingTargetSchema>;
export const OfferingBindingSchema = z.object({
  id: IdSchema,
  offeringId: IdSchema,
  version: VersionSchema,
  target: OfferingBindingTargetSchema,
  role: OfferingBindingRoleSchema,
  availabilityRequired: z.boolean(),
  defaultQuantity: z.number().int().positive().max(1_000_000),
  defaultCapacityImpact: z.number().int().nonnegative().max(1_000_000),
  preparationBeforeMinutes: z.number().int().nonnegative().max(10_080),
  preparationAfterMinutes: z.number().int().nonnegative().max(10_080),
}).strict();
export type OfferingBinding = z.infer<typeof OfferingBindingSchema>;
export const OfferingBindingsReplaceSchema = OfferingSubjectMutationMetaSchema.extend({
  offeringId: IdSchema,
  bindings: z.array(OfferingBindingSchema.omit({ id: true, offeringId: true, version: true })).max(1000),
}).strict();
export type OfferingBindingsReplace = z.infer<typeof OfferingBindingsReplaceSchema>;

/** House v1 has exactly one sellable resource; dependencies stay typed resource bindings. */
export const HouseOfferingBindingsReplaceSchema = OfferingSubjectMutationMetaSchema.extend({
  offeringId: IdSchema,
  bindings: z.array(OfferingBindingSchema.omit({ id: true, offeringId: true, version: true })).min(1).max(100),
}).strict().superRefine((value, context) => {
  const primaries = value.bindings.filter((binding) => binding.role === "primary");
  if (primaries.length !== 1) {
    context.addIssue({ code: "custom", path: ["bindings"], message: "A house requires exactly one primary binding" });
    return;
  }
  if (primaries[0]!.target.type !== "resource") {
    context.addIssue({ code: "custom", path: ["bindings"], message: "A house primary binding must target a resource" });
  }
  value.bindings.forEach((binding, index) => {
    if (binding.target.type !== "resource") {
      context.addIssue({ code: "custom", path: ["bindings", index, "target"], message: "House bindings may only target resources" });
    }
  });
});
export type HouseOfferingBindingsReplace = z.infer<typeof HouseOfferingBindingsReplaceSchema>;
export const HouseOfferingBindingsReplaceBodySchema = OfferingSubjectMutationMetaSchema.extend({
  bindings: z.array(OfferingBindingSchema.omit({ id: true, offeringId: true, version: true })).min(1).max(100),
}).strict().superRefine((value, context) => {
  const primaries = value.bindings.filter((binding) => binding.role === "primary");
  if (primaries.length !== 1) {
    context.addIssue({ code: "custom", path: ["bindings"], message: "A house requires exactly one primary binding" });
    return;
  }
  if (primaries[0]!.target.type !== "resource") {
    context.addIssue({ code: "custom", path: ["bindings"], message: "A house primary binding must target a resource" });
  }
  value.bindings.forEach((binding, index) => {
    if (binding.target.type !== "resource") {
      context.addIssue({ code: "custom", path: ["bindings", index, "target"], message: "House bindings may only target resources" });
    }
  });
});
export type HouseOfferingBindingsReplaceBody = z.infer<typeof HouseOfferingBindingsReplaceBodySchema>;

function validateCampgroundBindings(
  value: { bindings: Array<z.infer<typeof OfferingBindingSchema> | Omit<z.infer<typeof OfferingBindingSchema>, "id" | "offeringId" | "version">> },
  context: z.RefinementCtx,
) {
  const primaries = value.bindings.filter((binding) => binding.role === "primary");
  if (primaries.length !== 1 || primaries[0]!.target.type !== "resource") {
    context.addIssue({ code: "custom", path: ["bindings"], message: "A campground offering requires exactly one primary Resource binding" });
  }
  value.bindings.forEach((binding, index) => {
    if (binding.target.type !== "resource") {
      context.addIssue({ code: "custom", path: ["bindings", index, "target"], message: "Campground sellable bindings may only target Resources" });
    }
  });
}

/** The campground group is operational navigation; only an individual inventory/capacity Resource is sellable. */
export const CampgroundOfferingBindingsReplaceSchema = OfferingSubjectMutationMetaSchema.extend({
  offeringId: IdSchema,
  bindings: z.array(OfferingBindingSchema.omit({ id: true, offeringId: true, version: true })).min(1).max(100),
}).strict().superRefine(validateCampgroundBindings);
export type CampgroundOfferingBindingsReplace = z.infer<typeof CampgroundOfferingBindingsReplaceSchema>;
export const CampgroundOfferingBindingsReplaceBodySchema = OfferingSubjectMutationMetaSchema.extend({
  bindings: z.array(OfferingBindingSchema.omit({ id: true, offeringId: true, version: true })).min(1).max(100),
}).strict().superRefine(validateCampgroundBindings);
export type CampgroundOfferingBindingsReplaceBody = z.infer<typeof CampgroundOfferingBindingsReplaceBodySchema>;
export const StayOfferingBindingsReplaceSchema = CampgroundOfferingBindingsReplaceSchema;
export type StayOfferingBindingsReplace = z.infer<typeof StayOfferingBindingsReplaceSchema>;
export const StayOfferingBindingsReplaceBodySchema = CampgroundOfferingBindingsReplaceBodySchema;
export type StayOfferingBindingsReplaceBody = z.infer<typeof StayOfferingBindingsReplaceBodySchema>;

export const OfferingBindingsReplaceResultSchema = z.object({
  offeringId: IdSchema,
  subjectVersion: VersionSchema,
  bindingsHash: z.string().regex(/^[a-f0-9]{64}$/),
  bindings: z.array(OfferingBindingSchema).max(1000),
}).strict();
export type OfferingBindingsReplaceResult = z.infer<typeof OfferingBindingsReplaceResultSchema>;

export const ResourceGroupMemberRoleSchema = z.enum(["owned_tent", "own_tent_area", "common_area"]);
export const ResourceGroupSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  code: z.string().trim().min(1).max(120),
  kind: z.literal("campground"),
  name: z.string().trim().min(1).max(500),
  state: z.enum(["draft", "active", "archived"]),
  updatedAt: DateTimeSchema,
}).strict();
export type ResourceGroup = z.infer<typeof ResourceGroupSchema>;
export const ResourceGroupMemberSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  groupId: IdSchema,
  resourceId: IdSchema,
  role: ResourceGroupMemberRoleSchema,
  displayOrder: z.number().int().min(0).max(100_000),
}).strict();
export type ResourceGroupMember = z.infer<typeof ResourceGroupMemberSchema>;

export const EventServiceFormatSchema = z.enum(["wedding", "corporate", "birthday", "other"]);
export const EventServiceTemplateSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  code: z.string().trim().min(1).max(120),
  format: EventServiceFormatSchema,
  defaultDurationMinutes: z.number().int().positive().max(525_600),
  minimumGuests: z.number().int().nonnegative().max(1_000_000).nullable(),
  maximumGuests: z.number().int().nonnegative().max(1_000_000).nullable(),
  preparationBeforeMinutes: z.number().int().nonnegative().max(10_080),
  preparationAfterMinutes: z.number().int().nonnegative().max(10_080),
  archivedAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).strict().refine(
  (value) => value.minimumGuests === null || value.maximumGuests === null || value.minimumGuests <= value.maximumGuests,
  { path: ["maximumGuests"], message: "maximumGuests must be greater than or equal to minimumGuests" },
);
export type EventServiceTemplate = z.infer<typeof EventServiceTemplateSchema>;

export const BusinessCalendarStateSchema = z.enum(["draft", "active", "retired"]);
export type BusinessCalendarState = z.infer<typeof BusinessCalendarStateSchema>;
export const BusinessCalendarDayClassSchema = z.enum(["weekday", "weekend", "holiday"]);
export type BusinessCalendarDayClass = z.infer<typeof BusinessCalendarDayClassSchema>;
export const BusinessCalendarDaySourceSchema = z.enum(["official_ru", "manual_override"]);
export const BusinessCalendarSchema = z.object({
  id: IdSchema,
  code: z.string().min(1).max(120),
  version: VersionSchema,
  name: z.string().min(1).max(240),
  countryCode: z.literal("RU"),
  timezone: z.string().min(1).max(100),
  state: BusinessCalendarStateSchema,
  sourceVersion: z.string().min(1).max(120),
  importedAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).strict();
export type BusinessCalendar = z.infer<typeof BusinessCalendarSchema>;

export const BusinessCalendarCoverageSchema = z.object({
  from: DateSchema,
  toExclusive: DateSchema,
}).strict().superRefine((value, context) => {
  if (value.from >= value.toExclusive) {
    context.addIssue({ code: "custom", path: ["toExclusive"], message: "toExclusive must be after from" });
  }
});
export type BusinessCalendarCoverage = z.infer<typeof BusinessCalendarCoverageSchema>;

export const BusinessCalendarOverrideSchema = z.object({
  id: IdSchema,
  calendarId: IdSchema,
  date: DateSchema,
  dayClass: BusinessCalendarDayClassSchema,
  label: z.string().trim().min(1).max(240).nullable(),
  reason: z.string().trim().min(1).max(1000),
  version: VersionSchema,
  state: z.enum(["active", "archived"]),
  updatedAt: DateTimeSchema,
}).strict();
export type BusinessCalendarOverride = z.infer<typeof BusinessCalendarOverrideSchema>;

export const BusinessCalendarListQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  state: BusinessCalendarStateSchema.optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type BusinessCalendarListQuery = z.infer<typeof BusinessCalendarListQuerySchema>;
export const BusinessCalendarListResponseSchema = z.object({
  items: z.array(BusinessCalendarSchema.extend({ coverage: BusinessCalendarCoverageSchema.nullable(), contentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable() }).strict()).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
}).strict();
export type BusinessCalendarListResponse = z.infer<typeof BusinessCalendarListResponseSchema>;

export const BusinessCalendarMutationMetaSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedCalendarVersion: VersionSchema,
}).strict();
export const BusinessCalendarCreateSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  code: z.string().trim().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(1).max(240),
  timezone: z.string().trim().min(1).max(100).default("Europe/Moscow"),
}).strict();
export type BusinessCalendarCreate = z.infer<typeof BusinessCalendarCreateSchema>;
export const BusinessCalendarMutationSchema = BusinessCalendarMutationMetaSchema.extend({
  calendarId: IdSchema,
  name: z.string().trim().min(1).max(240).optional(),
}).strict().refine((value) => value.name !== undefined, { message: "At least one calendar field is required" });
export type BusinessCalendarMutation = z.infer<typeof BusinessCalendarMutationSchema>;
export const BusinessCalendarMutationBodySchema = BusinessCalendarMutationMetaSchema.extend({
  name: z.string().trim().min(1).max(240).optional(),
}).strict().refine((value) => value.name !== undefined, { message: "At least one calendar field is required" });
export type BusinessCalendarMutationBody = z.infer<typeof BusinessCalendarMutationBodySchema>;
export const BusinessCalendarImportDaySchema = z.object({
  date: DateSchema,
  dayClass: BusinessCalendarDayClassSchema,
  label: z.string().trim().min(1).max(240).nullable().default(null),
}).strict();
export type BusinessCalendarImportDay = z.infer<typeof BusinessCalendarImportDaySchema>;
export const BusinessCalendarImportSchema = BusinessCalendarMutationMetaSchema.extend({
  calendarId: IdSchema,
  sourceVersion: z.string().trim().min(1).max(120),
  coverage: BusinessCalendarCoverageSchema,
  days: z.array(BusinessCalendarImportDaySchema).min(1).max(2000),
}).strict().superRefine((value, context) => {
  const dates = new Set<string>();
  value.days.forEach((day, index) => {
    if (day.date < value.coverage.from || day.date >= value.coverage.toExclusive) {
      context.addIssue({ code: "custom", path: ["days", index, "date"], message: "Imported day is outside coverage" });
    }
    if (dates.has(day.date)) context.addIssue({ code: "custom", path: ["days", index, "date"], message: "Imported dates must be unique" });
    dates.add(day.date);
  });
});
export type BusinessCalendarImport = z.infer<typeof BusinessCalendarImportSchema>;
export const BusinessCalendarImportBodySchema = BusinessCalendarMutationMetaSchema.extend({
  sourceVersion: z.string().trim().min(1).max(120),
  coverage: BusinessCalendarCoverageSchema,
  days: z.array(BusinessCalendarImportDaySchema).min(1).max(2000),
}).strict().superRefine((value, context) => {
  const dates = new Set<string>();
  value.days.forEach((day, index) => {
    if (day.date < value.coverage.from || day.date >= value.coverage.toExclusive) {
      context.addIssue({ code: "custom", path: ["days", index, "date"], message: "Imported day is outside coverage" });
    }
    if (dates.has(day.date)) context.addIssue({ code: "custom", path: ["days", index, "date"], message: "Imported dates must be unique" });
    dates.add(day.date);
  });
});
export type BusinessCalendarImportBody = z.infer<typeof BusinessCalendarImportBodySchema>;
export const BusinessCalendarOverrideReplaceSchema = BusinessCalendarMutationMetaSchema.extend({
  calendarId: IdSchema,
  date: DateSchema,
  override: z.object({
    dayClass: BusinessCalendarDayClassSchema,
    label: z.string().trim().min(1).max(240).nullable().default(null),
    reason: z.string().trim().min(1).max(1000),
  }).strict().nullable(),
}).strict();
export type BusinessCalendarOverrideReplace = z.infer<typeof BusinessCalendarOverrideReplaceSchema>;
export const BusinessCalendarOverrideReplaceBodySchema = BusinessCalendarOverrideReplaceSchema.omit({ calendarId: true, date: true });
export type BusinessCalendarOverrideReplaceBody = z.infer<typeof BusinessCalendarOverrideReplaceBodySchema>;
export const BusinessCalendarStateTransitionSchema = BusinessCalendarMutationMetaSchema.extend({
  calendarId: IdSchema,
  targetState: z.enum(["active", "retired"]),
  reason: z.string().trim().min(1).max(1000),
}).strict();
export type BusinessCalendarStateTransition = z.infer<typeof BusinessCalendarStateTransitionSchema>;
export const BusinessCalendarStateTransitionBodySchema = BusinessCalendarStateTransitionSchema.omit({ calendarId: true });
export type BusinessCalendarStateTransitionBody = z.infer<typeof BusinessCalendarStateTransitionBodySchema>;
export const BusinessCalendarDaySchema = z.object({
  calendarId: IdSchema,
  date: DateSchema,
  dayClass: BusinessCalendarDayClassSchema,
  label: z.string().min(1).max(240).nullable(),
  source: BusinessCalendarDaySourceSchema,
  sourceVersion: z.string().min(1).max(120),
  version: VersionSchema,
}).strict();
export type BusinessCalendarDay = z.infer<typeof BusinessCalendarDaySchema>;

export const BusinessCalendarDetailSchema = BusinessCalendarSchema.extend({
  coverage: BusinessCalendarCoverageSchema.nullable(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  days: z.array(BusinessCalendarDaySchema).max(2000),
  overrides: z.array(BusinessCalendarOverrideSchema).max(2000),
}).strict();
export type BusinessCalendarDetail = z.infer<typeof BusinessCalendarDetailSchema>;
export const BusinessCalendarMutationResultSchema = z.object({ calendar: BusinessCalendarDetailSchema }).strict();
export type BusinessCalendarMutationResult = z.infer<typeof BusinessCalendarMutationResultSchema>;

export const PriceBookStateSchema = z.enum(["draft", "scheduled", "active", "retired"]);
export type PriceBookState = z.infer<typeof PriceBookStateSchema>;
export const PricingBasisSchema = z.enum([
  "per_night",
  "per_day",
  "per_slot",
  "per_hour",
  "per_person",
  "per_unit",
  "flat_package",
]);
export type PricingBasis = z.infer<typeof PricingBasisSchema>;
export const PriceQuantityMetricSchema = z.enum(["guests", "participants", "units"]);
export type PriceQuantityMetric = z.infer<typeof PriceQuantityMetricSchema>;
export const PriceWeekdaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export type PriceWeekday = z.infer<typeof PriceWeekdaySchema>;

export const PriceDateSelectorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("any_date") }).strict(),
  z.object({
    type: z.literal("day_class"),
    dayClass: z.enum(["weekday", "weekend"]),
  }).strict(),
  z.object({
    type: z.literal("recurring_weekdays"),
    days: z.array(PriceWeekdaySchema).min(1).max(7).refine((days) => new Set(days).size === days.length, { message: "Weekdays must be unique" }),
  }).strict(),
  z.object({ type: z.literal("calendar_holiday") }).strict(),
  z.object({
    type: z.literal("custom_date_override"),
    from: DateSchema,
    toExclusive: DateSchema,
    label: z.string().trim().min(1).max(240),
  }).strict(),
]);
export type PriceDateSelector = z.infer<typeof PriceDateSelectorSchema>;

export const InclusiveIntegerRangeSchema = z.object({
  min: z.number().int().nonnegative().max(1_000_000),
  max: z.number().int().nonnegative().max(1_000_000).nullable(),
}).strict().refine((value) => value.max === null || value.min <= value.max, {
  path: ["max"],
  message: "Invalid range",
});
export type InclusiveIntegerRange = z.infer<typeof InclusiveIntegerRangeSchema>;

const PriceRuleFieldsSchema = z.object({
  dateSelector: PriceDateSelectorSchema,
  quantityRange: InclusiveIntegerRangeSchema.nullable(),
  bookingLeadDays: InclusiveIntegerRangeSchema.nullable(),
  durationMinutes: InclusiveIntegerRangeSchema.nullable(),
  amount: NonNegativeMinorAmountSchema.nullable(),
  extraUnitAmount: NonNegativeMinorAmountSchema.nullable(),
  priority: z.number().int().min(0).max(10_000),
  reason: z.string().max(1000),
  enabled: z.boolean(),
}).strict();

function validatePriceRule(
  value: z.infer<typeof PriceRuleFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (
    value.dateSelector.type === "custom_date_override"
    && value.dateSelector.from >= value.dateSelector.toExclusive
  ) {
    context.addIssue({
      code: "custom",
      path: ["dateSelector", "toExclusive"],
      message: "toExclusive must be after from",
    });
  }
  if (
    value.dateSelector.type === "any_date"
    && value.quantityRange === null
    && value.bookingLeadDays === null
    && value.durationMinutes === null
  ) {
    context.addIssue({ code: "custom", path: [], message: "Base amount belongs to the rate plan" });
  }
  if (value.amount === null && value.extraUnitAmount === null) {
    context.addIssue({
      code: "custom",
      path: ["amount"],
      message: "At least one price override is required",
    });
  }
}

export const PriceRuleSchema = PriceRuleFieldsSchema.extend({
  id: IdSchema,
  ratePlanId: IdSchema,
  version: VersionSchema,
}).strict().superRefine(validatePriceRule);
export type PriceRule = z.infer<typeof PriceRuleSchema>;
export const PriceRuleDraftSchema = PriceRuleFieldsSchema.extend({
  id: IdSchema.optional(),
}).strict().superRefine(validatePriceRule);
export type PriceRuleDraft = z.infer<typeof PriceRuleDraftSchema>;

const RatePlanFieldsSchema = z.object({
  key: z.string().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(1).max(240),
  pricingBasis: PricingBasisSchema,
  quantityMetric: PriceQuantityMetricSchema.nullable(),
  baseAmount: NonNegativeMinorAmountSchema,
  includedQuantity: z.number().int().nonnegative().max(1_000_000).nullable(),
  baseExtraUnitAmount: NonNegativeMinorAmountSchema.nullable(),
  minQuantity: z.number().int().positive().max(1_000_000).nullable(),
  maxQuantity: z.number().int().positive().max(1_000_000).nullable(),
  minDurationMinutes: z.number().int().positive().max(525_600).nullable(),
  maxDurationMinutes: z.number().int().positive().max(525_600).nullable(),
  isDefault: z.boolean(),
  displayOrder: z.number().int().min(-100_000).max(100_000),
}).strict();

function validateRatePlan(
  value: z.infer<typeof RatePlanFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (value.minQuantity !== null && value.maxQuantity !== null && value.minQuantity > value.maxQuantity) {
    context.addIssue({ code: "custom", path: ["maxQuantity"], message: "Invalid quantity range" });
  }
  if (
    value.minDurationMinutes !== null
    && value.maxDurationMinutes !== null
    && value.minDurationMinutes > value.maxDurationMinutes
  ) {
    context.addIssue({ code: "custom", path: ["maxDurationMinutes"], message: "Invalid duration range" });
  }
  if ((value.includedQuantity !== null || value.baseExtraUnitAmount !== null) && value.quantityMetric === null) {
    context.addIssue({
      code: "custom",
      path: ["quantityMetric"],
      message: "A quantity metric is required for included or extra-unit pricing",
    });
  }
}

export const RatePlanSchema = RatePlanFieldsSchema.extend({
  id: IdSchema,
  priceBookId: IdSchema,
  version: VersionSchema,
  rules: z.array(PriceRuleSchema).max(10_000),
}).strict().superRefine(validateRatePlan);
export type RatePlan = z.infer<typeof RatePlanSchema>;
export const RatePlanDraftSchema = RatePlanFieldsSchema.extend({
  id: IdSchema.optional(),
  rules: z.array(PriceRuleDraftSchema).max(10_000).default([]),
}).strict().superRefine(validateRatePlan);
export type RatePlanDraft = z.infer<typeof RatePlanDraftSchema>;

const PriceBookFieldsSchema = z.object({
  name: z.string().trim().min(1).max(240),
  currency: CurrencySchema,
  timezone: z.string().trim().min(1).max(100),
  validFrom: DateSchema,
  validToExclusive: DateSchema.nullable(),
  changeReason: z.string().max(1000),
}).strict();

function validatePriceBook(
  value: z.infer<typeof PriceBookFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (value.validToExclusive !== null && value.validFrom >= value.validToExclusive) {
    context.addIssue({
      code: "custom",
      path: ["validToExclusive"],
      message: "validToExclusive must be after validFrom",
    });
  }
}

export const PriceBookSchema = PriceBookFieldsSchema.extend({
  id: IdSchema,
  offeringId: IdSchema,
  version: VersionSchema,
  revision: z.number().int().positive().safe(),
  state: PriceBookStateSchema,
  scheduledActivationAt: DateTimeSchema.nullable(),
  activatedAt: DateTimeSchema.nullable(),
  retiredAt: DateTimeSchema.nullable(),
  supersedesPriceBookId: IdSchema.nullable(),
  ratePlans: z.array(RatePlanSchema).max(1000),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).strict().superRefine((value, context) => {
  validatePriceBook(value, context);
  if (value.state === "scheduled" && value.scheduledActivationAt === null) {
    context.addIssue({
      code: "custom",
      path: ["scheduledActivationAt"],
      message: "scheduledActivationAt is required for a scheduled price book",
    });
  }
});
export type PriceBook = z.infer<typeof PriceBookSchema>;

export const PriceBookDraftCreateSchema = OfferingPricingMutationMetaSchema.extend({
  offeringId: IdSchema,
  supersedesPriceBookId: IdSchema.nullable().default(null),
  ...PriceBookFieldsSchema.shape,
  changeReason: z.string().max(1000).default(""),
  ratePlans: z.array(RatePlanDraftSchema).max(1000).default([]),
}).strict().superRefine(validatePriceBook);
export type PriceBookDraftCreate = z.infer<typeof PriceBookDraftCreateSchema>;

/** Endpoint body: offering identity, currency and timezone come from the path/aggregate. */
export const HousePriceBookDraftCreateBodySchema = OfferingPricingMutationMetaSchema.extend({
  supersedesPriceBookId: IdSchema.nullable().default(null),
  name: z.string().trim().min(1).max(240),
  validFrom: DateSchema,
  validToExclusive: DateSchema.nullable(),
  changeReason: z.string().max(1000).default(""),
  ratePlans: z.array(RatePlanDraftSchema).max(1000).default([]),
}).strict().superRefine((value, context) => {
  if (value.validToExclusive !== null && value.validFrom >= value.validToExclusive) {
    context.addIssue({ code: "custom", path: ["validToExclusive"], message: "validToExclusive must be after validFrom" });
  }
});
export type HousePriceBookDraftCreateBody = z.infer<typeof HousePriceBookDraftCreateBodySchema>;

export const HousePriceBookDraftReplaceBodySchema = OfferingPricingMutationMetaSchema.extend({
  name: z.string().trim().min(1).max(240),
  validFrom: DateSchema,
  validToExclusive: DateSchema.nullable(),
  changeReason: z.string().max(1000),
  ratePlans: z.array(RatePlanDraftSchema).max(1000),
}).strict().superRefine((value, context) => {
  if (value.validToExclusive !== null && value.validFrom >= value.validToExclusive) {
    context.addIssue({ code: "custom", path: ["validToExclusive"], message: "validToExclusive must be after validFrom" });
  }
});
export type HousePriceBookDraftReplaceBody = z.infer<typeof HousePriceBookDraftReplaceBodySchema>;

export const PriceBookDraftMutationSchema = OfferingPricingMutationMetaSchema.extend({
  priceBookId: IdSchema,
  name: z.string().trim().min(1).max(240).optional(),
  validFrom: DateSchema.optional(),
  validToExclusive: DateSchema.nullable().optional(),
  changeReason: z.string().max(1000).optional(),
  ratePlans: z.array(RatePlanDraftSchema).max(1000).optional(),
}).strict().refine((value) => Object.keys(value).some((key) => ![
  "operationId",
  "idempotencyKey",
  "expectedPricingVersion",
  "priceBookId",
].includes(key)), { message: "At least one pricing field is required" });
export type PriceBookDraftMutation = z.infer<typeof PriceBookDraftMutationSchema>;

export const PriceBookTransitionSchema = OfferingPricingMutationMetaSchema.extend({
  priceBookId: IdSchema,
  action: z.enum(["activate", "schedule", "retire"]),
  scheduledActivationAt: DateTimeSchema.nullable().default(null),
  reason: z.string().trim().min(1).max(1000),
}).strict().superRefine((value, context) => {
  if (value.action === "schedule" && value.scheduledActivationAt === null) {
    context.addIssue({
      code: "custom",
      path: ["scheduledActivationAt"],
      message: "scheduledActivationAt is required when scheduling",
    });
  }
  if (value.action !== "schedule" && value.scheduledActivationAt !== null) {
    context.addIssue({
      code: "custom",
      path: ["scheduledActivationAt"],
      message: "scheduledActivationAt is only allowed when scheduling",
    });
  }
});
export type PriceBookTransition = z.infer<typeof PriceBookTransitionSchema>;

export const HousePriceBookActivateBodySchema = OfferingPricingMutationMetaSchema.extend({
  reason: z.string().trim().min(1).max(1000),
}).strict();
export type HousePriceBookActivateBody = z.infer<typeof HousePriceBookActivateBodySchema>;

export const HousePriceBookScheduleBodySchema = OfferingPricingMutationMetaSchema.extend({
  scheduledActivationAt: DateTimeSchema,
  reason: z.string().trim().min(1).max(1000),
}).strict();
export type HousePriceBookScheduleBody = z.infer<typeof HousePriceBookScheduleBodySchema>;

export const OfferingPricingMutationResultSchema = z.object({
  priceBook: PriceBookSchema,
  pricingVersion: VersionSchema,
}).strict();
export type OfferingPricingMutationResult = z.infer<typeof OfferingPricingMutationResultSchema>;

const OfferingAddOnAssignmentFieldsSchema = z.object({
  addOnOfferingId: IdSchema,
  enabled: z.boolean(),
  required: z.boolean(),
  recommended: z.boolean(),
  groupKey: z.string().trim().min(1).max(120).nullable(),
  ratePlanKeyOverride: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable(),
  labelOverride: z.string().trim().min(1).max(240).nullable(),
  descriptionOverride: z.string().max(2000).nullable(),
  minQuantityOverride: z.number().int().nonnegative().max(1_000_000).nullable(),
  maxQuantityOverride: z.number().int().positive().max(1_000_000).nullable(),
  defaultQuantityOverride: z.number().int().nonnegative().max(1_000_000).nullable(),
  displayOrder: z.number().int().min(-100_000).max(100_000),
}).strict();

function validateAddOnAssignment(
  value: {
    offeringId: string;
    addOnOfferingId: string;
    enabled: boolean;
    required: boolean;
    recommended: boolean;
    minQuantityOverride: number | null;
    maxQuantityOverride: number | null;
    defaultQuantityOverride: number | null;
  },
  context: z.RefinementCtx,
) {
  if (value.offeringId === value.addOnOfferingId) {
    context.addIssue({ code: "custom", path: ["addOnOfferingId"], message: "Self-assignment is forbidden" });
  }
  if (value.required && !value.enabled) {
    context.addIssue({ code: "custom", path: ["enabled"], message: "A required add-on must be enabled" });
  }
  if (value.required && value.recommended) {
    context.addIssue({ code: "custom", path: ["recommended"], message: "A required add-on cannot also be recommended" });
  }
  if (
    value.minQuantityOverride !== null
    && value.maxQuantityOverride !== null
    && value.minQuantityOverride > value.maxQuantityOverride
  ) {
    context.addIssue({ code: "custom", path: ["maxQuantityOverride"], message: "Invalid quantity range" });
  }
  if (
    value.defaultQuantityOverride !== null
    && (
      (value.minQuantityOverride !== null && value.defaultQuantityOverride < value.minQuantityOverride)
      || (value.maxQuantityOverride !== null && value.defaultQuantityOverride > value.maxQuantityOverride)
    )
  ) {
    context.addIssue({ code: "custom", path: ["defaultQuantityOverride"], message: "Default quantity is outside the allowed range" });
  }
}

export const OfferingAddOnAssignmentSchema = OfferingAddOnAssignmentFieldsSchema.extend({
  id: IdSchema,
  offeringId: IdSchema,
  version: VersionSchema,
}).strict().superRefine(validateAddOnAssignment);
export type OfferingAddOnAssignment = z.infer<typeof OfferingAddOnAssignmentSchema>;
export const OfferingAddOnAssignmentCreateSchema = OfferingAddOnsMutationMetaSchema.extend({
  offeringId: IdSchema,
  ...OfferingAddOnAssignmentFieldsSchema.shape,
  enabled: z.boolean().default(true),
  required: z.boolean().default(false),
  recommended: z.boolean().default(false),
  groupKey: z.string().trim().min(1).max(120).nullable().default(null),
  ratePlanKeyOverride: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable().default(null),
  labelOverride: z.string().trim().min(1).max(240).nullable().default(null),
  descriptionOverride: z.string().max(2000).nullable().default(null),
  minQuantityOverride: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  maxQuantityOverride: z.number().int().positive().max(1_000_000).nullable().default(null),
  defaultQuantityOverride: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  displayOrder: z.number().int().min(-100_000).max(100_000).default(0),
}).strict().superRefine(validateAddOnAssignment);
export type OfferingAddOnAssignmentCreate = z.infer<typeof OfferingAddOnAssignmentCreateSchema>;

export const OfferingAddOnAssignmentMutationSchema = OfferingAddOnsMutationMetaSchema.extend({
  assignmentId: IdSchema,
  offeringId: IdSchema,
  enabled: z.boolean().optional(),
  required: z.boolean().optional(),
  recommended: z.boolean().optional(),
  groupKey: z.string().trim().min(1).max(120).nullable().optional(),
  ratePlanKeyOverride: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable().optional(),
  labelOverride: z.string().trim().min(1).max(240).nullable().optional(),
  descriptionOverride: z.string().max(2000).nullable().optional(),
  minQuantityOverride: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
  maxQuantityOverride: z.number().int().positive().max(1_000_000).nullable().optional(),
  defaultQuantityOverride: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
  displayOrder: z.number().int().min(-100_000).max(100_000).optional(),
}).strict().refine((value) => Object.keys(value).some((key) => ![
  "operationId",
  "idempotencyKey",
  "expectedAddOnsVersion",
  "assignmentId",
  "offeringId",
].includes(key)), { message: "At least one add-on assignment field is required" });
export type OfferingAddOnAssignmentMutation = z.infer<typeof OfferingAddOnAssignmentMutationSchema>;

export const OfferingAddOnAssignmentRemoveSchema = OfferingAddOnsMutationMetaSchema.extend({
  offeringId: IdSchema,
  assignmentId: IdSchema,
}).strict();
export type OfferingAddOnAssignmentRemove = z.infer<typeof OfferingAddOnAssignmentRemoveSchema>;

export const AddOnLibraryQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  state: CatalogOfferingStateSchema.optional(),
  serviceType: AddOnServiceTypeSchema.optional(),
  scope: AddOnScopeSchema.optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type AddOnLibraryQuery = z.infer<typeof AddOnLibraryQuerySchema>;
export const AddOnLibraryItemSchema = z.object({
  offering: CatalogOfferingSchema,
  serviceType: AddOnServiceTypeSchema,
  scope: AddOnScopeSchema,
  ownerOfferingId: IdSchema.nullable(),
  categoryKey: AddOnCategoryKeySchema,
  standalone: z.boolean(),
}).strict();
export type AddOnLibraryItem = z.infer<typeof AddOnLibraryItemSchema>;
export const AddOnLibraryResponseSchema = z.object({
  items: z.array(AddOnLibraryItemSchema).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
}).strict();
export type AddOnLibraryResponse = z.infer<typeof AddOnLibraryResponseSchema>;

/** Safe display identity for an add-on already assigned to the composite offering editor. */
export const AddOnCatalogOfferingSummarySchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  code: z.string().min(1).max(120),
  operationalName: z.string().min(1).max(500),
  state: CatalogOfferingStateSchema,
  salesMode: OfferingSalesModeSchema.optional(),
  archived: z.boolean(),
}).strict();
export type AddOnCatalogOfferingSummary = z.infer<typeof AddOnCatalogOfferingSummarySchema>;
export const AddOnCatalogAvailabilitySchema = z.object({
  status: z.enum(["available", "blocked"]),
  blocker: z.enum(["archived", "not_active", "active_price_book_missing"]).nullable(),
}).strict().superRefine((value, context) => {
  if ((value.status === "available") !== (value.blocker === null)) {
    context.addIssue({ code: "custom", path: ["blocker"], message: "Availability status and blocker must agree" });
  }
});
export type AddOnCatalogAvailability = z.infer<typeof AddOnCatalogAvailabilitySchema>;
/** Reuses the typed add-on library terms while removing non-selector CatalogOffering fields. */
export const AddOnCatalogItemSchema = AddOnLibraryItemSchema.pick({
  serviceType: true,
  scope: true,
  ownerOfferingId: true,
  categoryKey: true,
  standalone: true,
}).extend({
  offering: AddOnCatalogOfferingSummarySchema,
  availability: AddOnCatalogAvailabilitySchema,
}).strict();
export type AddOnCatalogItem = z.infer<typeof AddOnCatalogItemSchema>;

export const OfferingAddOnAssignmentDraftSchema = OfferingAddOnAssignmentFieldsSchema.extend({
  enabled: z.boolean().default(true),
  required: z.boolean().default(false),
  recommended: z.boolean().default(false),
  groupKey: z.string().trim().min(1).max(120).nullable().default(null),
  ratePlanKeyOverride: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable().default(null),
  labelOverride: z.string().trim().min(1).max(240).nullable().default(null),
  descriptionOverride: z.string().max(2000).nullable().default(null),
  minQuantityOverride: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  maxQuantityOverride: z.number().int().positive().max(1_000_000).nullable().default(null),
  defaultQuantityOverride: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  displayOrder: z.number().int().min(-100_000).max(100_000).default(0),
}).strict();
export type OfferingAddOnAssignmentDraft = z.infer<typeof OfferingAddOnAssignmentDraftSchema>;
export const OfferingAddOnAssignmentsReplaceSchema = OfferingAddOnsMutationMetaSchema.extend({
  offeringId: IdSchema,
  assignments: z.array(OfferingAddOnAssignmentDraftSchema).max(1000),
}).strict().superRefine((value, context) => {
  const addOnIds = new Set<string>();
  value.assignments.forEach((assignment, index) => {
    if (assignment.addOnOfferingId === value.offeringId) {
      context.addIssue({ code: "custom", path: ["assignments", index, "addOnOfferingId"], message: "Self-assignment is forbidden" });
    }
    if (addOnIds.has(assignment.addOnOfferingId)) {
      context.addIssue({ code: "custom", path: ["assignments", index, "addOnOfferingId"], message: "An add-on may appear once per offering" });
    }
    addOnIds.add(assignment.addOnOfferingId);
    if (assignment.required && !assignment.enabled) {
      context.addIssue({ code: "custom", path: ["assignments", index, "enabled"], message: "A required add-on must be enabled" });
    }
    if (assignment.required && assignment.recommended) {
      context.addIssue({ code: "custom", path: ["assignments", index, "recommended"], message: "A required add-on cannot also be recommended" });
    }
    if (assignment.minQuantityOverride !== null && assignment.maxQuantityOverride !== null && assignment.minQuantityOverride > assignment.maxQuantityOverride) {
      context.addIssue({ code: "custom", path: ["assignments", index, "maxQuantityOverride"], message: "Invalid quantity range" });
    }
    if (assignment.defaultQuantityOverride !== null && ((assignment.minQuantityOverride !== null && assignment.defaultQuantityOverride < assignment.minQuantityOverride) || (assignment.maxQuantityOverride !== null && assignment.defaultQuantityOverride > assignment.maxQuantityOverride))) {
      context.addIssue({ code: "custom", path: ["assignments", index, "defaultQuantityOverride"], message: "Default quantity is outside the allowed range" });
    }
  });
});
export type OfferingAddOnAssignmentsReplace = z.infer<typeof OfferingAddOnAssignmentsReplaceSchema>;
export const OfferingAddOnAssignmentsReplaceBodySchema = OfferingAddOnsMutationMetaSchema.extend({
  assignments: z.array(OfferingAddOnAssignmentDraftSchema).max(1000),
}).strict().superRefine((value, context) => {
  const addOnIds = new Set<string>();
  value.assignments.forEach((assignment, index) => {
    if (addOnIds.has(assignment.addOnOfferingId)) {
      context.addIssue({ code: "custom", path: ["assignments", index, "addOnOfferingId"], message: "An add-on may appear once per offering" });
    }
    addOnIds.add(assignment.addOnOfferingId);
    if (assignment.required && !assignment.enabled) {
      context.addIssue({ code: "custom", path: ["assignments", index, "enabled"], message: "A required add-on must be enabled" });
    }
    if (assignment.required && assignment.recommended) {
      context.addIssue({ code: "custom", path: ["assignments", index, "recommended"], message: "A required add-on cannot also be recommended" });
    }
    if (assignment.minQuantityOverride !== null && assignment.maxQuantityOverride !== null && assignment.minQuantityOverride > assignment.maxQuantityOverride) {
      context.addIssue({ code: "custom", path: ["assignments", index, "maxQuantityOverride"], message: "Invalid quantity range" });
    }
    if (assignment.defaultQuantityOverride !== null && ((assignment.minQuantityOverride !== null && assignment.defaultQuantityOverride < assignment.minQuantityOverride) || (assignment.maxQuantityOverride !== null && assignment.defaultQuantityOverride > assignment.maxQuantityOverride))) {
      context.addIssue({ code: "custom", path: ["assignments", index, "defaultQuantityOverride"], message: "Default quantity is outside the allowed range" });
    }
  });
});
export type OfferingAddOnAssignmentsReplaceBody = z.infer<typeof OfferingAddOnAssignmentsReplaceBodySchema>;
export const OfferingAddOnAssignmentsReplaceResultSchema = z.object({
  offeringId: IdSchema,
  addOnAssignmentsVersion: VersionSchema,
  assignmentsHash: z.string().regex(/^[a-f0-9]{64}$/),
  assignments: z.array(OfferingAddOnAssignmentSchema).max(1000),
}).strict();
export type OfferingAddOnAssignmentsReplaceResult = z.infer<typeof OfferingAddOnAssignmentsReplaceResultSchema>;

export const OfferingCustomAddOnCreateSchema = OfferingAddOnsMutationMetaSchema.extend({
  offeringId: IdSchema,
  addOn: z.object({
    code: z.string().trim().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/).optional(),
    operationalName: z.string().trim().min(1).max(500),
    internalComment: z.string().max(20_000).default(""),
    serviceType: AddOnServiceTypeSchema,
    categoryKey: AddOnCategoryKeySchema,
    standalone: z.boolean().default(false),
    salesMode: OfferingSalesModeSchema.default("request_only"),
    priceDisplayMode: PriceDisplayModeSchema.default("request"),
    taxMode: OfferingTaxModeSchema.optional(),
  }).strict().superRefine((value, context) => {
    if (value.serviceType === "content_only" && value.salesMode !== "request_only") {
      context.addIssue({ code: "custom", path: ["salesMode"], message: "content_only add-ons must use request_only" });
    }
  }),
  // Creation from the library is intentionally non-selling until the parent
  // editor explicitly enables the new assignment.
  assignment: OfferingAddOnAssignmentDraftSchema.omit({ addOnOfferingId: true }).extend({
    enabled: z.boolean().default(false),
  }),
}).strict().superRefine((value, context) => {
  const assignment = value.assignment;
  if (assignment.required && !assignment.enabled) {
    context.addIssue({ code: "custom", path: ["assignment", "enabled"], message: "A required add-on must be enabled" });
  }
  if (assignment.required && assignment.recommended) {
    context.addIssue({ code: "custom", path: ["assignment", "recommended"], message: "A required add-on cannot also be recommended" });
  }
  if (assignment.minQuantityOverride !== null && assignment.maxQuantityOverride !== null && assignment.minQuantityOverride > assignment.maxQuantityOverride) {
    context.addIssue({ code: "custom", path: ["assignment", "maxQuantityOverride"], message: "Invalid quantity range" });
  }
  if (assignment.defaultQuantityOverride !== null && ((assignment.minQuantityOverride !== null && assignment.defaultQuantityOverride < assignment.minQuantityOverride) || (assignment.maxQuantityOverride !== null && assignment.defaultQuantityOverride > assignment.maxQuantityOverride))) {
    context.addIssue({ code: "custom", path: ["assignment", "defaultQuantityOverride"], message: "Default quantity is outside the allowed range" });
  }
});
export type OfferingCustomAddOnCreate = z.infer<typeof OfferingCustomAddOnCreateSchema>;
export const OfferingCustomAddOnCreateBodySchema = OfferingAddOnsMutationMetaSchema.extend({
  addOn: z.object({
    code: z.string().trim().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/).optional(),
    operationalName: z.string().trim().min(1).max(500),
    internalComment: z.string().max(20_000).default(""),
    serviceType: AddOnServiceTypeSchema,
    categoryKey: AddOnCategoryKeySchema,
    standalone: z.boolean().default(false),
    salesMode: OfferingSalesModeSchema.default("request_only"),
    priceDisplayMode: PriceDisplayModeSchema.default("request"),
    taxMode: OfferingTaxModeSchema.optional(),
  }).strict().superRefine((value, context) => {
    if (value.serviceType === "content_only" && value.salesMode !== "request_only") {
      context.addIssue({ code: "custom", path: ["salesMode"], message: "content_only add-ons must use request_only" });
    }
  }),
  assignment: OfferingAddOnAssignmentDraftSchema.omit({ addOnOfferingId: true }).extend({
    enabled: z.boolean().default(false),
  }),
}).strict().superRefine((value, context) => {
  const assignment = value.assignment;
  if (assignment.required && !assignment.enabled) {
    context.addIssue({ code: "custom", path: ["assignment", "enabled"], message: "A required add-on must be enabled" });
  }
  if (assignment.required && assignment.recommended) {
    context.addIssue({ code: "custom", path: ["assignment", "recommended"], message: "A required add-on cannot also be recommended" });
  }
  if (assignment.minQuantityOverride !== null && assignment.maxQuantityOverride !== null && assignment.minQuantityOverride > assignment.maxQuantityOverride) {
    context.addIssue({ code: "custom", path: ["assignment", "maxQuantityOverride"], message: "Invalid quantity range" });
  }
  if (assignment.defaultQuantityOverride !== null && ((assignment.minQuantityOverride !== null && assignment.defaultQuantityOverride < assignment.minQuantityOverride) || (assignment.maxQuantityOverride !== null && assignment.defaultQuantityOverride > assignment.maxQuantityOverride))) {
    context.addIssue({ code: "custom", path: ["assignment", "defaultQuantityOverride"], message: "Default quantity is outside the allowed range" });
  }
});
export type OfferingCustomAddOnCreateBody = z.infer<typeof OfferingCustomAddOnCreateBodySchema>;
export const OfferingCustomAddOnCreateResultSchema = z.object({
  addOn: AddOnLibraryItemSchema,
  assignment: OfferingAddOnAssignmentSchema,
  addOnAssignmentsVersion: VersionSchema,
  assignmentsHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type OfferingCustomAddOnCreateResult = z.infer<typeof OfferingCustomAddOnCreateResultSchema>;

export const OfferingSubjectVersionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("resource"), id: IdSchema, version: VersionSchema }).strict(),
  z.object({ type: z.literal("resource_group"), id: IdSchema, version: VersionSchema }).strict(),
  z.object({ type: z.literal("program_template"), id: IdSchema, version: VersionSchema }).strict(),
  z.object({ type: z.literal("event_service_template"), id: IdSchema, version: VersionSchema }).strict(),
]);
export const OfferingOwnerVersionsSchema = z.object({
  catalog: VersionSchema,
  subject: z.object({
    aggregateVersion: VersionSchema,
    primary: OfferingSubjectVersionSchema.nullable(),
  }).strict(),
  pricing: VersionSchema,
  draftPriceBook: z.object({ id: IdSchema, version: VersionSchema }).strict().nullable(),
  addOnAssignments: VersionSchema,
  editorial: z.object({
    nodeId: IdSchema,
    nodeVersion: VersionSchema,
    draftRevisionId: IdSchema.nullable(),
    contentHash: z.string().min(1).max(256).nullable(),
  }).strict().nullable(),
}).strict();
export type OfferingOwnerVersions = z.infer<typeof OfferingOwnerVersionsSchema>;
export const OfferingEditorCapabilitiesSchema = z.object({
  catalog: z.object({ canEdit: z.boolean(), canChangeState: z.boolean(), canArchive: z.boolean() }).strict(),
  subject: z.object({ canEdit: z.boolean(), canManageBindings: z.boolean() }).strict(),
  pricing: z.object({ canView: z.boolean(), canEditDraft: z.boolean(), canActivate: z.boolean() }).strict(),
  addOns: z.object({ canSearch: z.boolean(), canCreate: z.boolean(), canAssign: z.boolean() }).strict(),
  editorial: z.object({ canEdit: z.boolean(), canReview: z.boolean(), canPublish: z.boolean() }).strict(),
  canPreviewQuote: z.boolean(),
}).strict();
export type OfferingEditorCapabilities = z.infer<typeof OfferingEditorCapabilitiesSchema>;

/**
 * Safe, read-only join between the operational offering editor and its
 * canonical CMS workspace. It is a locator only: publication readiness is
 * reported separately and cannot be inferred from the existence of this DTO.
 */
export const OfferingEditorialPublicationBlockerSchema = z.enum([
  "offering_not_active",
  "cms_node_archived",
  "cms_node_kind_incompatible",
  "public_profile_missing",
  "public_profile_mismatch",
  "revision_relation_missing",
  "revision_relation_mismatch",
  "safe_public_projection_missing",
]);
export type OfferingEditorialPublicationBlocker = z.infer<typeof OfferingEditorialPublicationBlockerSchema>;

const OfferingEditorialRevisionSummarySchema = z.object({
  id: IdSchema,
  revision: VersionSchema,
  state: z.enum(["draft", "review", "approved", "scheduled", "published"]),
  path: z.string().min(1).max(2048),
  title: z.string().min(1).max(500),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export const OfferingEditorialLocatorSchema = z.object({
  source: z.object({
    sourceKind: z.literal("catalog_offering"),
    sourceId: IdSchema,
    sourceVersion: VersionSchema,
    createdAt: DateTimeSchema,
  }).strict(),
  node: z.object({
    id: IdSchema,
    version: VersionSchema,
    kind: z.enum(["resource_detail", "addon_detail", "program_detail"]),
    status: z.enum(["active", "archived"]),
  }).strict(),
  currentRevision: OfferingEditorialRevisionSummarySchema.nullable(),
  latestPublished: OfferingEditorialRevisionSummarySchema.nullable(),
  publication: z.discriminatedUnion("eligible", [
    z.object({ eligible: z.literal(true), blockers: z.tuple([]) }).strict(),
    z.object({
      eligible: z.literal(false),
      blockers: z.array(OfferingEditorialPublicationBlockerSchema).min(1).max(8),
    }).strict(),
  ]),
}).strict();
export type OfferingEditorialLocator = z.infer<typeof OfferingEditorialLocatorSchema>;

export const InternalOfferingEditorSchema = z.object({
  offering: CatalogOfferingSchema,
  addOnTerms: AddOnServiceTermsSchema.nullable(),
  addOnUsages: z.array(AddOnUsageSummarySchema).max(10_000),
  bindings: z.array(OfferingBindingSchema).max(1000),
  bindingTargets: z.array(OfferingBindingTargetSummarySchema).max(1000),
  priceBooks: z.array(PriceBookSchema).max(100),
  addOnAssignments: z.array(OfferingAddOnAssignmentSchema).max(1000),
  addOnCatalog: z.array(AddOnCatalogItemSchema).max(1000),
  editorial: OfferingEditorialLocatorSchema.nullable(),
  ownerVersions: OfferingOwnerVersionsSchema,
  capabilities: OfferingEditorCapabilitiesSchema,
}).strict().superRefine((value, context) => {
  if ((value.offering.kind === "addon") !== (value.addOnTerms !== null)) {
    context.addIssue({ code: "custom", path: ["addOnTerms"], message: value.offering.kind === "addon" ? "Add-on terms are required" : "Only add-ons may expose add-on terms" });
  }
  if (value.offering.kind === "addon" && value.offering.fulfillment.kind === "addon" && value.addOnTerms?.serviceType !== value.offering.fulfillment.serviceType) {
    context.addIssue({ code: "custom", path: ["addOnTerms", "serviceType"], message: "Add-on fulfillment and terms must agree" });
  }
});
export type InternalOfferingEditor = z.infer<typeof InternalOfferingEditorSchema>;

export const AddOnOfferingCreateResultSchema = z.object({
  offering: CatalogOfferingSchema,
  terms: AddOnServiceTermsSchema,
  subjectVersion: VersionSchema,
  editorial: OfferingEditorialLocatorSchema,
}).strict().superRefine((value, context) => {
  if (value.offering.kind !== "addon" || value.offering.fulfillment.kind !== "addon") {
    context.addIssue({ code: "custom", path: ["offering", "kind"], message: "Expected an add-on offering" });
  }
});
export type AddOnOfferingCreateResult = z.infer<typeof AddOnOfferingCreateResultSchema>;

export const OfferingQuotePeriodSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stay"),
    arrivalDate: DateSchema,
    departureDate: DateSchema,
  }).strict(),
  z.object({ type: z.literal("service_date"), serviceDate: DateSchema }).strict(),
  z.object({
    type: z.literal("interval"),
    startsAt: DateTimeSchema,
    endsAt: DateTimeSchema,
  }).strict(),
]).superRefine((value, context) => {
  if (value.type === "stay" && value.arrivalDate >= value.departureDate) {
    context.addIssue({ code: "custom", path: ["departureDate"], message: "Invalid stay interval" });
  }
  if (value.type === "interval" && value.startsAt >= value.endsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Invalid service interval" });
  }
});
export type OfferingQuotePeriod = z.infer<typeof OfferingQuotePeriodSchema>;
export const OfferingQuoteQuantitiesSchema = z.object({
  guests: z.number().int().nonnegative().max(1_000_000).nullable(),
  participants: z.number().int().positive().max(1_000_000).nullable(),
  units: z.number().int().positive().max(1_000_000),
}).strict();

export const InternalOfferingQuoteRequestSchema = z.object({
  offeringId: IdSchema,
  ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable(),
  period: OfferingQuotePeriodSchema,
  quantities: OfferingQuoteQuantitiesSchema,
  currency: CurrencySchema,
  addOns: z.array(z.object({
    assignmentId: IdSchema,
    quantity: z.number().int().positive().max(1_000_000),
  }).strict()).max(100),
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type InternalOfferingQuoteRequest = z.infer<typeof InternalOfferingQuoteRequestSchema>;

export const InternalHouseOfferingQuoteBodySchema = z.object({
  ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable(),
  period: z.object({
    type: z.literal("stay"),
    arrivalDate: DateSchema,
    departureDate: DateSchema,
  }).strict().refine((value) => value.arrivalDate < value.departureDate, {
    path: ["departureDate"],
    message: "Invalid stay interval",
  }),
  quantities: z.object({
    guests: z.number().int().positive().max(1_000_000),
    participants: z.null(),
    units: z.literal(1),
  }).strict(),
  currency: CurrencySchema,
  addOns: z.array(z.object({
    assignmentId: IdSchema,
    quantity: z.number().int().positive().max(1_000_000),
  }).strict()).max(100),
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type InternalHouseOfferingQuoteBody = z.infer<typeof InternalHouseOfferingQuoteBodySchema>;

export const InternalCampgroundOfferingQuoteBodySchema = z.object({
  ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable(),
  period: z.object({
    type: z.literal("stay"),
    arrivalDate: DateSchema,
    departureDate: DateSchema,
  }).strict().refine((value) => value.arrivalDate < value.departureDate, {
    path: ["departureDate"],
    message: "Invalid stay interval",
  }),
  quantities: z.object({
    guests: z.number().int().positive().max(1_000_000).nullable(),
    participants: z.null(),
    units: z.number().int().positive().max(1_000_000),
  }).strict(),
  currency: CurrencySchema,
  addOns: z.array(z.object({
    assignmentId: IdSchema,
    quantity: z.number().int().positive().max(1_000_000),
  }).strict()).max(100),
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type InternalCampgroundOfferingQuoteBody = z.infer<typeof InternalCampgroundOfferingQuoteBodySchema>;

export const InternalStayOfferingQuoteBodySchema = z.union([
  InternalHouseOfferingQuoteBodySchema,
  InternalCampgroundOfferingQuoteBodySchema,
]);
export type InternalStayOfferingQuoteBody = z.infer<typeof InternalStayOfferingQuoteBodySchema>;

/**
 * Intentionally small operational entry point used by bookings: the Resource
 * is the selection authority, while the linked active offering owns price
 * calculation. Rate-plan and campground unit choices stay server-side.
 */
export const ResourceStayOfferingQuotePreviewBodySchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  arrivalDate: DateSchema,
  departureDate: DateSchema,
  quantity: z.number().int().positive().max(1_000_000),
  currency: CurrencySchema,
  addOns: z.array(z.object({
    assignmentId: IdSchema,
    quantity: z.number().int().positive().max(1_000_000),
  }).strict()).max(100).default([]),
}).strict().refine((value) => value.arrivalDate < value.departureDate, {
  path: ["departureDate"],
  message: "Invalid stay interval",
});
export type ResourceStayOfferingQuotePreviewBody = z.infer<typeof ResourceStayOfferingQuotePreviewBodySchema>;

export const InternalOfferingQuoteLineSchema = z.object({
  kind: z.enum(["base", "night", "extra_unit", "addon"]),
  label: z.string().min(1).max(500),
  serviceDate: DateSchema.nullable(),
  quantity: z.number().int().positive(),
  amount: NonNegativeMoneySchema,
  ratePlanId: IdSchema,
  ratePlanVersion: VersionSchema,
  matchedRuleId: IdSchema.nullable(),
  matchedRuleVersion: VersionSchema.nullable(),
  addOnAssignmentId: IdSchema.nullable(),
  addOnOfferingId: IdSchema.nullable().optional(),
  explanation: z.string().max(1000),
}).strict();
export const InternalOfferingQuoteResultSchema = z.object({
  quoteId: IdSchema,
  offeringId: IdSchema,
  calculatedAt: DateTimeSchema,
  validUntil: DateTimeSchema,
  leadDays: z.number().int().nonnegative().nullable(),
  currency: CurrencySchema,
  lines: z.array(InternalOfferingQuoteLineSchema).max(10_000),
  total: NonNegativeMoneySchema,
  provenance: z.object({
    offeringVersion: VersionSchema,
    pricingVersion: VersionSchema,
    addOnsVersion: VersionSchema,
    priceBookId: IdSchema,
    priceBookVersion: VersionSchema,
    businessCalendarId: IdSchema,
    businessCalendarVersion: VersionSchema,
    businessCalendarSourceVersion: z.string().min(1).max(120),
    matchedRuleIds: z.array(IdSchema).max(10_000),
    addOns: z.array(z.object({
      assignmentId: IdSchema,
      addOnOfferingId: IdSchema,
      serviceType: z.enum(["quantity_service", "person_service"]),
      offeringVersion: VersionSchema,
      pricingVersion: VersionSchema,
      priceBookId: IdSchema,
      priceBookVersion: VersionSchema,
      businessCalendarId: IdSchema,
      businessCalendarVersion: VersionSchema,
    }).strict()).max(100).optional(),
  }).strict(),
  immutableSnapshot: z.literal(true),
}).strict();
export type InternalOfferingQuoteResult = z.infer<typeof InternalOfferingQuoteResultSchema>;

export const ProgramQuoteTypeSchema = z.enum(["template_preview", "program_registration"]);
export type ProgramQuoteType = z.infer<typeof ProgramQuoteTypeSchema>;

/** Atomic operational preparation for a ProgramTemplate with a named CAS. */
export const ProgramOfferingPrepareBodySchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedProgramTemplateVersion: VersionSchema,
}).strict();
export type ProgramOfferingPrepareBody = z.infer<typeof ProgramOfferingPrepareBodySchema>;

export const ProgramOfferingPrepareResultSchema = z.object({
  offeringId: IdSchema,
  offeringVersion: VersionSchema,
  subjectVersion: VersionSchema,
  pricingVersion: VersionSchema,
  addOnAssignmentsVersion: VersionSchema,
  programTemplateId: IdSchema,
  programTemplateVersion: VersionSchema,
  cmsReady: z.boolean(),
  publicReady: z.literal(false),
  editorialNodeId: IdSchema.nullable(),
}).strict();
export type ProgramOfferingPrepareResult = z.infer<typeof ProgramOfferingPrepareResultSchema>;

export const ProgramOfferingLookupItemSchema = ProgramOfferingPrepareResultSchema.extend({
  state: CatalogOfferingStateSchema,
}).strict();
export type ProgramOfferingLookupItem = z.infer<typeof ProgramOfferingLookupItemSchema>;

/** Read-only recovery boundary for opening a prepared program dossier after reload. */
export const ProgramOfferingLookupResultSchema = z.discriminatedUnion("resolution", [
  z.object({
    resolution: z.literal("unprepared"),
    programTemplateId: IdSchema,
    programTemplateVersion: VersionSchema,
  }).strict(),
  z.object({
    resolution: z.literal("linked"),
    offering: ProgramOfferingLookupItemSchema,
  }).strict(),
  z.object({
    resolution: z.literal("ambiguous"),
    programTemplateId: IdSchema,
    programTemplateVersion: VersionSchema,
    candidates: z.array(ProgramOfferingLookupItemSchema).min(2).max(100),
  }).strict(),
]);
export type ProgramOfferingLookupResult = z.infer<typeof ProgramOfferingLookupResultSchema>;

export const ProgramOfferingQuotePreviewBodySchema = z.object({
  quoteType: z.literal("template_preview").default("template_preview"),
  ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable(),
  serviceDate: DateSchema,
  participants: z.number().int().positive().max(1_000_000),
  currency: CurrencySchema,
  addOns: z.tuple([]).default([]),
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type ProgramOfferingQuotePreviewBody = z.infer<typeof ProgramOfferingQuotePreviewBodySchema>;

export const ProgramOfferingQuoteLineSchema = z.object({
  kind: z.enum(["base", "extra_unit"]),
  label: z.string().min(1).max(500),
  serviceDate: DateSchema,
  quantity: z.number().int().positive(),
  unitAmount: NonNegativeMoneySchema,
  amount: NonNegativeMoneySchema,
  ratePlanId: IdSchema,
  ratePlanVersion: VersionSchema,
  matchedRuleId: IdSchema.nullable(),
  matchedRuleVersion: VersionSchema.nullable(),
  explanation: z.string().max(1000),
}).strict();

export const ProgramOfferingQuoteResultSchema = z.object({
  quoteType: z.literal("template_preview"),
  acceptanceReady: z.literal(false),
  quoteId: IdSchema,
  offeringId: IdSchema,
  programTemplateId: IdSchema,
  calculatedAt: DateTimeSchema,
  validUntil: DateTimeSchema,
  leadDays: z.number().int().nonnegative(),
  currency: CurrencySchema,
  inputs: z.object({ serviceDate: DateSchema, participants: z.number().int().positive(), durationMinutes: z.number().int().positive() }).strict(),
  lines: z.array(ProgramOfferingQuoteLineSchema).min(1).max(2),
  total: NonNegativeMoneySchema,
  provenance: z.object({
    offeringVersion: VersionSchema,
    subjectVersion: VersionSchema,
    programTemplateVersion: VersionSchema,
    pricingVersion: VersionSchema,
    addOnsVersion: VersionSchema,
    priceBookId: IdSchema,
    priceBookVersion: VersionSchema,
    businessCalendarId: IdSchema,
    businessCalendarVersion: VersionSchema,
    businessCalendarSourceVersion: z.string().min(1).max(120),
    matchedRuleIds: z.array(IdSchema).max(10_000),
  }).strict(),
  immutableSnapshot: z.literal(true),
}).strict();
export type ProgramOfferingQuoteResult = z.infer<typeof ProgramOfferingQuoteResultSchema>;

export const OfferingEntrySurfaceSchema = z.enum(["internal", "admin", "scheduler"]);
export const OfferingPricingOutboxEventSchema = z.object({
  eventId: IdSchema,
  eventType: z.enum([
    "crm.price_book.draft_created",
    "crm.price_book.draft_replaced",
    "crm.price_book.scheduled",
    "crm.price_book.activated",
    "public.offering_projection.invalidated",
  ]),
  occurredAt: DateTimeSchema,
  actorId: IdSchema.nullable(),
  requestId: z.string().min(1).max(500),
  operationId: OperationIdSchema,
  entrySurface: OfferingEntrySurfaceSchema,
  offeringId: IdSchema,
  pricingVersion: VersionSchema,
  priceBookId: IdSchema,
  priceBookVersion: VersionSchema,
}).strict();
export type OfferingPricingOutboxEvent = z.infer<typeof OfferingPricingOutboxEventSchema>;

/**
 * Configuration changes are intentionally distinct from pricing lifecycle
 * events: projectors can invalidate safely without assuming a price-book.
 */
export const OfferingConfigurationOutboxEventSchema = z.object({
  eventId: IdSchema,
  eventType: z.enum([
    "crm.business_calendar.created",
    "crm.business_calendar.updated",
    "crm.business_calendar.imported",
    "crm.business_calendar.override_replaced",
    "crm.business_calendar.state_changed",
    "crm.offering.bindings_replaced",
    "crm.offering.addon_created",
    "crm.offering.addon_terms_replaced",
    "crm.offering.addon_assignments_replaced",
    "crm.offering.custom_addon_created",
    "crm.offering.created_from_resource",
    "crm.offering.program_prepared",
    "public.offering_projection.invalidated",
  ]),
  occurredAt: DateTimeSchema,
  actorId: IdSchema.nullable(),
  requestId: z.string().min(1).max(500),
  operationId: OperationIdSchema,
  entrySurface: OfferingEntrySurfaceSchema,
  aggregate: z.discriminatedUnion("type", [
    z.object({ type: z.literal("business_calendar"), id: IdSchema }).strict(),
    z.object({ type: z.literal("catalog_offering"), id: IdSchema }).strict(),
  ]),
  versions: z.object({
    calendar: VersionSchema.nullable(),
    subject: VersionSchema.nullable(),
    addOns: VersionSchema.nullable(),
  }).strict(),
  configurationHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type OfferingConfigurationOutboxEvent = z.infer<typeof OfferingConfigurationOutboxEventSchema>;

export const PublicOfferingPriceSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("exact"), amount: NonNegativeMoneySchema }).strict(),
  z.object({ mode: z.literal("from"), amount: NonNegativeMoneySchema }).strict(),
  z.object({ mode: z.literal("request") }).strict(),
]);
export type PublicOfferingPrice = z.infer<typeof PublicOfferingPriceSchema>;
export const PublicOfferingSummarySchema = z.object({
  offeringId: IdSchema,
  kind: CatalogOfferingKindSchema,
  title: z.string().min(1).max(500),
  summary: z.string().max(2000).nullable(),
  price: PublicOfferingPriceSchema,
  priceBasisLabel: z.string().min(1).max(240).nullable(),
  quoteAvailable: z.boolean(),
  requestAvailable: z.boolean(),
  capacity: z.object({
    unit: z.enum(["guests", "participants", "tent", "unit"]),
    available: z.number().int().nonnegative().nullable(),
  }).strict().nullable(),
  readiness: z.enum(["ready", "request_only", "temporarily_unavailable"]),
  timezone: z.string().min(1).max(100),
  currency: CurrencySchema,
  sourceVersions: z.object({
    offering: VersionSchema,
    pricing: VersionSchema.nullable(),
    priceBook: VersionSchema.nullable(),
    calendar: VersionSchema,
    contentReleaseId: IdSchema,
    profileRevisionId: IdSchema,
  }).strict(),
  asOf: DateTimeSchema,
}).strict();
export type PublicOfferingSummary = z.infer<typeof PublicOfferingSummarySchema>;

/**
 * The deliberately small operational fragment an add-on may expose publicly.
 * It is a projection, not a copy of the add-on dossier: scope, applicability,
 * bindings, price rules and all availability state remain internal.
 */
export const PublicAddOnQuantitySchema = z.object({
  unit: z.enum(["unit", "participants"]),
  minimum: z.number().int().positive().max(1_000_000),
  maximum: z.number().int().positive().max(1_000_000).nullable(),
  default: z.number().int().positive().max(1_000_000),
  step: z.number().int().positive().max(1_000_000),
}).strict().superRefine((value, context) => {
  if (value.maximum !== null && value.minimum > value.maximum) context.addIssue({ code: "custom", path: ["maximum"], message: "Invalid quantity range" });
  if (value.default < value.minimum || (value.maximum !== null && value.default > value.maximum)) context.addIssue({ code: "custom", path: ["default"], message: "Default quantity is outside the allowed range" });
  if ((value.default - value.minimum) % value.step !== 0) context.addIssue({ code: "custom", path: ["default"], message: "Default quantity must align with the quantity step" });
  if (value.maximum !== null && (value.maximum - value.minimum) % value.step !== 0) context.addIssue({ code: "custom", path: ["maximum"], message: "Maximum quantity must align with the quantity step" });
});
export type PublicAddOnQuantity = z.infer<typeof PublicAddOnQuantitySchema>;

export const PublicAddOnTermsSchema = z.discriminatedUnion("serviceType", [
  z.object({
    serviceType: z.literal("quantity_service"),
    standalone: z.boolean(),
    categoryKey: AddOnCategoryKeySchema,
    quantity: PublicAddOnQuantitySchema.safeExtend({ unit: z.literal("unit") }).strict(),
  }).strict(),
  z.object({
    serviceType: z.literal("person_service"),
    standalone: z.boolean(),
    categoryKey: AddOnCategoryKeySchema,
    quantity: PublicAddOnQuantitySchema.safeExtend({ unit: z.literal("participants"), step: z.literal(1) }).strict(),
  }).strict(),
]);
export type PublicAddOnTerms = z.infer<typeof PublicAddOnTermsSchema>;

export const PublicAddOnSummarySchema = PublicOfferingSummarySchema.safeExtend({
  kind: z.literal("addon"),
  terms: PublicAddOnTermsSchema,
}).strict();
export type PublicAddOnSummary = z.infer<typeof PublicAddOnSummarySchema>;

export const PublicAddOnSummaryParamsSchema = z.object({
  offeringId: IdSchema,
}).strict();
export type PublicAddOnSummaryParams = z.infer<typeof PublicAddOnSummaryParamsSchema>;

/** Public listing allowlist; arbitrary operational filters must never cross this boundary. */
export const PublicAddOnListQuerySchema = z.object({
  categoryKey: AddOnCategoryKeySchema.optional(),
  standalone: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type PublicAddOnListQuery = z.infer<typeof PublicAddOnListQuerySchema>;

export const PublicAddOnListResponseSchema = z.object({
  items: z.array(PublicAddOnSummarySchema).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
  releaseId: IdSchema,
  asOf: DateTimeSchema,
}).strict();
export type PublicAddOnListResponse = z.infer<typeof PublicAddOnListResponseSchema>;

/**
 * Release construction pins these identities before a projection hash is
 * calculated by the publication service. The hash intentionally is not part
 * of this input contract.
 */
export const PublicAddOnProjectionPinSchema = z.object({
  contract: z.literal("public.addon-summary.v1"),
  offeringId: IdSchema,
  kind: z.literal("addon"),
  nodeId: IdSchema,
  profileRevisionId: IdSchema,
}).strict();
export type PublicAddOnProjectionPin = z.infer<typeof PublicAddOnProjectionPinSchema>;

export const PublicOfferingQuoteRequestSchema = z.object({
  requestId: IdSchema,
  offeringId: IdSchema,
  ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable(),
  period: OfferingQuotePeriodSchema,
  quantities: OfferingQuoteQuantitiesSchema,
  currency: CurrencySchema,
  addOns: z.array(z.object({
    publicOptionId: IdSchema,
    quantity: z.number().int().positive().max(1_000_000),
  }).strict()).max(100),
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type PublicOfferingQuoteRequest = z.infer<typeof PublicOfferingQuoteRequestSchema>;

export const PublicOfferingQuoteSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("quoted"),
    quoteId: IdSchema,
    calculatedAt: DateTimeSchema,
    validUntil: DateTimeSchema,
    currency: CurrencySchema,
    lines: z.array(z.object({
      kind: z.enum(["base", "night", "extra_unit", "addon"]),
      label: z.string().min(1).max(500),
      serviceDate: DateSchema.nullable(),
      quantity: z.number().int().positive(),
      amount: NonNegativeMoneySchema,
      explanationCode: z.enum([
        "base",
        "weekday",
        "weekend",
        "calendar_holiday",
        "custom_date_override",
        "quantity_tier",
        "early_booking",
        "addon",
      ]),
    }).strict()).max(10_000),
    total: NonNegativeMoneySchema,
    asOf: DateTimeSchema,
  }).strict(),
  z.object({
    status: z.literal("request_required"),
    message: z.string().min(1).max(1000),
    asOf: DateTimeSchema,
  }).strict(),
  z.object({
    status: z.literal("unavailable"),
    reason: z.enum(["temporarily_unavailable", "not_sold_for_period", "capacity_unavailable", "quote_unavailable"]),
    message: z.string().min(1).max(1000),
    asOf: DateTimeSchema,
  }).strict(),
]);
export type PublicOfferingQuote = z.infer<typeof PublicOfferingQuoteSchema>;
