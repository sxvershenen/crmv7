import { z } from "zod";
import { IdempotencyKeySchema, OperationIdSchema } from "../operations.js";
import { DateTimeSchema, IdSchema, VersionSchema } from "../primitives.js";
import { AddOnServiceTermsSchema, CatalogOfferingSchema, OfferingBindingTargetSummarySchema } from "./catalog.js";
import { AddOnUsageSummarySchema, OfferingBindingSchema } from "./bindings.js";
import { EventServiceOfferingSummarySchema, EventServiceTemplateSchema } from "./event-service.js";
import { PriceBookSchema } from "./pricing.js";
import { AddOnCatalogItemSchema, OfferingAddOnAssignmentSchema } from "./addons.js";

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
    kind: z.enum(["resource_detail", "addon_detail", "program_detail", "event_detail"]),
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

/**
 * CRM-only operational dossier. It joins the one commercial identity to its
 * EventServiceTemplate and editorial locator without exposing internal binding
 * rows as ordinary form fields. `publicReady` is deliberately fail-closed.
 */
export const EventServiceOfferingDossierSchema = z.object({
  offering: CatalogOfferingSchema,
  template: EventServiceTemplateSchema,
  subjectVersion: VersionSchema,
  pricingVersion: VersionSchema,
  addOnAssignmentsVersion: VersionSchema,
  cmsReady: z.boolean(),
  publicReady: z.literal(false),
  editorial: OfferingEditorialLocatorSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.offering.kind !== "event_service" || value.offering.fulfillment.kind !== "event_service") {
    context.addIssue({ code: "custom", path: ["offering", "kind"], message: "Expected an event-service offering" });
  }
});
export type EventServiceOfferingDossier = z.infer<typeof EventServiceOfferingDossierSchema>;

export const EventServiceOfferingCreateResultSchema = EventServiceOfferingDossierSchema;
export type EventServiceOfferingCreateResult = z.infer<typeof EventServiceOfferingCreateResultSchema>;

export const EventServiceOfferingPrepareBodySchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedEventServiceTemplateVersion: VersionSchema,
}).strict();
export type EventServiceOfferingPrepareBody = z.infer<typeof EventServiceOfferingPrepareBodySchema>;

export const EventServiceOfferingPrepareResultSchema = EventServiceOfferingDossierSchema;
export type EventServiceOfferingPrepareResult = z.infer<typeof EventServiceOfferingPrepareResultSchema>;

export const EventServiceOfferingLookupItemSchema = EventServiceOfferingSummarySchema.extend({
  operationalName: z.string().min(1).max(500),
  code: z.string().min(1).max(120),
}).strict();
export type EventServiceOfferingLookupItem = z.infer<typeof EventServiceOfferingLookupItemSchema>;

/** Explicitly reports legacy ambiguity; callers must not choose the first row. */
export const EventServiceOfferingLookupResultSchema = z.discriminatedUnion("resolution", [
  z.object({
    resolution: z.literal("unprepared"),
    eventServiceTemplateId: IdSchema,
    eventServiceTemplateVersion: VersionSchema,
  }).strict(),
  z.object({
    resolution: z.literal("linked"),
    offering: EventServiceOfferingLookupItemSchema,
  }).strict(),
  z.object({
    resolution: z.literal("ambiguous"),
    eventServiceTemplateId: IdSchema,
    eventServiceTemplateVersion: VersionSchema,
    candidates: z.array(EventServiceOfferingLookupItemSchema).min(2).max(100),
  }).strict(),
]);
export type EventServiceOfferingLookupResult = z.infer<typeof EventServiceOfferingLookupResultSchema>;
