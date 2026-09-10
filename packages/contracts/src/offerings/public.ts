import { z } from "zod";
import { CmsPathSchema } from "../content.js";
import { CurrencySchema, DateTimeSchema, IdSchema, NonNegativeMoneySchema, VersionSchema } from "../primitives.js";
import { ResourceSpaceTypeSchema } from "../resources.js";
import { AddOnCategoryKeySchema, CatalogOfferingKindSchema } from "./catalog.js";

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

/** Public venue projection: availability is a readiness mode, never an interval count. */
export const PublicVenueFulfillmentSchema = z.object({
  allocationMode: z.literal("exclusive_resource"),
  capacityUnit: z.literal("guests"),
  capacityTotal: z.number().int().nonnegative().max(1_000_000),
  pricingMode: z.literal("rate_plan"),
  spaceType: ResourceSpaceTypeSchema.nullable(),
  availabilityMode: z.enum(["resource", "request_only"]),
}).strict();
export type PublicVenueFulfillment = z.infer<typeof PublicVenueFulfillmentSchema>;
export const PublicVenueSummarySchema = PublicOfferingSummarySchema.safeExtend({
  kind: z.literal("venue"),
  fulfillment: PublicVenueFulfillmentSchema,
}).strict();
export type PublicVenueSummary = z.infer<typeof PublicVenueSummarySchema>;
export const PublicVenueSummaryParamsSchema = z.object({ offeringId: IdSchema }).strict();
export type PublicVenueSummaryParams = z.infer<typeof PublicVenueSummaryParamsSchema>;
export const PublicVenueListQuerySchema = z.object({
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type PublicVenueListQuery = z.infer<typeof PublicVenueListQuerySchema>;
export const PublicVenueListResponseSchema = z.object({
  items: z.array(PublicVenueSummarySchema).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
  releaseId: IdSchema,
  asOf: DateTimeSchema,
}).strict();
export type PublicVenueListResponse = z.infer<typeof PublicVenueListResponseSchema>;
export const PublicVenueProjectionPinSchema = z.object({
  contract: z.literal("public.venue-summary.v1"),
  offeringId: IdSchema,
  kind: z.literal("venue"),
  nodeId: IdSchema,
  profileRevisionId: IdSchema,
}).strict();
export type PublicVenueProjectionPin = z.infer<typeof PublicVenueProjectionPinSchema>;

/** Public house projection: the Resource supplies capacity, while pricing and readiness remain operational facts. */
export const PublicHouseFulfillmentSchema = z.object({
  allocationMode: z.literal("exclusive_resource"),
  capacityUnit: z.literal("guests"),
  capacityTotal: z.number().int().positive().max(1_000_000),
  pricingMode: z.literal("rate_plan"),
  spaceType: ResourceSpaceTypeSchema.nullable(),
  availabilityMode: z.enum(["resource", "request_only"]),
}).strict();
export type PublicHouseFulfillment = z.infer<typeof PublicHouseFulfillmentSchema>;

export const PublicHouseSummarySchema = PublicOfferingSummarySchema.safeExtend({
  kind: z.literal("house"),
  path: CmsPathSchema,
  releaseId: IdSchema,
  fulfillment: PublicHouseFulfillmentSchema,
}).strict();
export type PublicHouseSummary = z.infer<typeof PublicHouseSummarySchema>;
export const PublicHouseDetailQuerySchema = z.object({ path: CmsPathSchema }).strict();
export type PublicHouseDetailQuery = z.infer<typeof PublicHouseDetailQuerySchema>;
export const PublicHouseListQuerySchema = z.object({
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type PublicHouseListQuery = z.infer<typeof PublicHouseListQuerySchema>;
export const PublicHouseListResponseSchema = z.object({
  items: z.array(PublicHouseSummarySchema).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
  releaseId: IdSchema,
  asOf: DateTimeSchema,
}).strict();
export type PublicHouseListResponse = z.infer<typeof PublicHouseListResponseSchema>;
export const PublicHouseProjectionPinSchema = z.object({
  contract: z.literal("public.house-summary.v1"),
  offeringId: IdSchema,
  kind: z.literal("house"),
  nodeId: IdSchema,
  profileRevisionId: IdSchema,
}).strict();
export type PublicHouseProjectionPin = z.infer<typeof PublicHouseProjectionPinSchema>;

/** Public campground projection: one sellable tent/pitch Resource, never a whole-camp group. */
export const PublicCampgroundFulfillmentSchema = z.object({
  salesUnit: z.enum(["owned_tent", "own_tent_pitch"]),
  allocationMode: z.enum(["discrete_inventory", "shared_capacity"]),
  capacityUnit: z.literal("tent"),
  capacityTotal: z.number().int().positive().max(1_000_000),
  guestCapacityTotal: z.number().int().positive().max(1_000_000).nullable(),
  pricingMode: z.literal("rate_plan"),
  availabilityMode: z.enum(["resource", "request_only"]),
}).strict().superRefine((value, context) => {
  if (value.salesUnit === "owned_tent" && (value.allocationMode !== "discrete_inventory" || value.capacityTotal !== 1 || value.guestCapacityTotal === null)) {
    context.addIssue({ code: "custom", path: ["capacityTotal"], message: "An owned tent must expose one sellable unit and a guest capacity" });
  }
  if (value.salesUnit === "own_tent_pitch" && (value.allocationMode !== "shared_capacity" || value.guestCapacityTotal !== null)) {
    context.addIssue({ code: "custom", path: ["guestCapacityTotal"], message: "An own-tent pitch must expose shared tent capacity without a fixed guest capacity" });
  }
});
export type PublicCampgroundFulfillment = z.infer<typeof PublicCampgroundFulfillmentSchema>;

export const PublicCampgroundSummarySchema = PublicOfferingSummarySchema.safeExtend({
  kind: z.literal("campground"),
  path: CmsPathSchema,
  releaseId: IdSchema,
  fulfillment: PublicCampgroundFulfillmentSchema,
}).strict();
export type PublicCampgroundSummary = z.infer<typeof PublicCampgroundSummarySchema>;
export const PublicCampgroundDetailQuerySchema = z.object({ path: CmsPathSchema }).strict();
export type PublicCampgroundDetailQuery = z.infer<typeof PublicCampgroundDetailQuerySchema>;
export const PublicCampgroundListQuerySchema = z.object({
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type PublicCampgroundListQuery = z.infer<typeof PublicCampgroundListQuerySchema>;
export const PublicCampgroundListResponseSchema = z.object({
  items: z.array(PublicCampgroundSummarySchema).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
  releaseId: IdSchema,
  asOf: DateTimeSchema,
}).strict();
export type PublicCampgroundListResponse = z.infer<typeof PublicCampgroundListResponseSchema>;
export const PublicCampgroundProjectionPinSchema = z.object({
  contract: z.literal("public.campground-summary.v1"),
  offeringId: IdSchema,
  kind: z.literal("campground"),
  nodeId: IdSchema,
  profileRevisionId: IdSchema,
}).strict();
export type PublicCampgroundProjectionPin = z.infer<typeof PublicCampgroundProjectionPinSchema>;

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
