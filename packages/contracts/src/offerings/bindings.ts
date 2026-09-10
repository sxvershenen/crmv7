import { z } from "zod";
import { IdempotencyKeySchema, OperationIdSchema } from "../operations.js";
import { CurrencySchema, DateTimeSchema, IdSchema, VersionSchema } from "../primitives.js";
import { AddOnApplicableOfferingKindSchema, AddOnScopeSchema, AddOnServiceTermsSchema, CatalogOfferingStateSchema, OfferingSalesModeSchema, OfferingSubjectMutationMetaSchema, OfferingTaxModeSchema, PriceDisplayModeSchema } from "./catalog.js";

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

function validateVenueBindings(
  value: { bindings: Array<z.infer<typeof OfferingBindingSchema> | Omit<z.infer<typeof OfferingBindingSchema>, "id" | "offeringId" | "version">> },
  context: z.RefinementCtx,
) {
  const primaries = value.bindings.filter((binding) => binding.role === "primary");
  if (primaries.length !== 1 || primaries[0]!.target.type !== "resource") {
    context.addIssue({ code: "custom", path: ["bindings"], message: "A venue requires exactly one primary Resource binding" });
  }
  value.bindings.forEach((binding, index) => {
    if (binding.target.type !== "resource") context.addIssue({ code: "custom", path: ["bindings", index, "target"], message: "Venue bindings may only target Resources" });
    if (binding.role === "primary" && (binding.defaultQuantity !== 1 || binding.defaultCapacityImpact !== 1 || !binding.availabilityRequired)) {
      context.addIssue({ code: "custom", path: ["bindings", index], message: "A venue primary binding must reserve one available Resource" });
    }
  });
}

export const VenueOfferingBindingsReplaceSchema = OfferingSubjectMutationMetaSchema.extend({
  offeringId: IdSchema,
  bindings: z.array(OfferingBindingSchema.omit({ id: true, offeringId: true, version: true })).min(1).max(100),
}).strict().superRefine(validateVenueBindings);
export type VenueOfferingBindingsReplace = z.infer<typeof VenueOfferingBindingsReplaceSchema>;
export const VenueOfferingBindingsReplaceBodySchema = OfferingSubjectMutationMetaSchema.extend({
  bindings: z.array(OfferingBindingSchema.omit({ id: true, offeringId: true, version: true })).min(1).max(100),
}).strict().superRefine(validateVenueBindings);
export type VenueOfferingBindingsReplaceBody = z.infer<typeof VenueOfferingBindingsReplaceBodySchema>;

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

