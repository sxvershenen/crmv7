import { z } from "zod";
import { IdSchema, VersionSchema } from "../primitives.js";
import { AddOnCategoryKeySchema, AddOnScopeSchema, AddOnServiceTypeSchema, CatalogOfferingSchema, CatalogOfferingStateSchema, OfferingAddOnsMutationMetaSchema, OfferingSalesModeSchema, OfferingTaxModeSchema, PriceDisplayModeSchema } from "./catalog.js";

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
