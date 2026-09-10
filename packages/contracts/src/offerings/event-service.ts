import { z } from "zod";
import { IdempotencyKeySchema, OperationIdSchema } from "../operations.js";
import { CurrencySchema, DateTimeSchema, IdSchema, VersionSchema } from "../primitives.js";
import { CatalogOfferingStateSchema, OfferingSalesModeSchema, OfferingSubjectMutationMetaSchema, OfferingTaxModeSchema, PriceDisplayModeSchema } from "./catalog.js";

export const EventServiceFormatSchema = z.enum(["wedding", "corporate", "birthday", "other"]);
/** Presentation-only category markers owned by the event-service template. */
export const EventServiceTemplateIconSchema = z.enum(["heart", "building", "cake", "bus"]);
export type EventServiceTemplateIcon = z.infer<typeof EventServiceTemplateIconSchema>;
export const EventServiceTemplateToneSchema = z.enum(["rose", "violet", "amber", "sky"]);
export type EventServiceTemplateTone = z.infer<typeof EventServiceTemplateToneSchema>;
const EventServiceTemplateEditableFieldsSchema = z.object({
  code: z.string().trim().min(1).max(120),
  format: EventServiceFormatSchema,
  icon: EventServiceTemplateIconSchema,
  tone: EventServiceTemplateToneSchema,
  defaultDurationMinutes: z.number().int().positive().max(525_600),
  minimumGuests: z.number().int().nonnegative().max(1_000_000).nullable(),
  maximumGuests: z.number().int().nonnegative().max(1_000_000).nullable(),
  preparationBeforeMinutes: z.number().int().nonnegative().max(10_080),
  preparationAfterMinutes: z.number().int().nonnegative().max(10_080),
}).strict();

export const EventServiceTemplateSchema = EventServiceTemplateEditableFieldsSchema.extend({
  id: IdSchema,
  version: VersionSchema,
  archivedAt: DateTimeSchema.nullable(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).strict().refine(
  (value) => value.minimumGuests === null || value.maximumGuests === null || value.minimumGuests <= value.maximumGuests,
  { path: ["maximumGuests"], message: "maximumGuests must be greater than or equal to minimumGuests" },
);
export type EventServiceTemplate = z.infer<typeof EventServiceTemplateSchema>;

/**
 * Event-service templates keep a technical code of their own. It is not a
 * second user-facing name and is deliberately separate from the commercial
 * CatalogOffering code; the create command may receive equal values but no
 * synchronization invariant exists between them.
 */
export const EventServiceTemplateCreateBodySchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  templateCode: z.string().trim().min(1).max(120),
  offeringCode: z.string().trim().min(1).max(120),
  operationalName: z.string().trim().min(1).max(500),
  internalComment: z.string().max(20_000).default(""),
  salesMode: OfferingSalesModeSchema.default("quoted"),
  priceDisplayMode: PriceDisplayModeSchema.default("from"),
  currency: CurrencySchema.default("RUB"),
  timezone: z.string().trim().min(1).max(100),
  taxMode: OfferingTaxModeSchema.default("tax_included"),
  businessCalendarId: IdSchema,
  format: EventServiceFormatSchema,
  defaultDurationMinutes: z.number().int().positive().max(525_600),
  minimumGuests: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  maximumGuests: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  preparationBeforeMinutes: z.number().int().nonnegative().max(10_080).default(0),
  preparationAfterMinutes: z.number().int().nonnegative().max(10_080).default(0),
  icon: EventServiceTemplateIconSchema.default("heart"),
  tone: EventServiceTemplateToneSchema.default("rose"),
}).strict().superRefine((value, context) => {
  if (value.minimumGuests !== null && value.maximumGuests !== null && value.minimumGuests > value.maximumGuests) {
    context.addIssue({ code: "custom", path: ["maximumGuests"], message: "maximumGuests must be greater than or equal to minimumGuests" });
  }
});
export type EventServiceTemplateCreateBody = z.infer<typeof EventServiceTemplateCreateBodySchema>;

export const EventServiceTemplateMutationBodySchema = OfferingSubjectMutationMetaSchema.extend({
  expectedOfferingVersion: VersionSchema.optional(),
  operationalName: z.string().trim().min(1).max(500).optional(),
  internalComment: z.string().max(20_000).optional(),
  format: EventServiceFormatSchema,
  icon: EventServiceTemplateIconSchema.optional(),
  tone: EventServiceTemplateToneSchema.optional(),
  defaultDurationMinutes: z.number().int().positive().max(525_600),
  minimumGuests: z.number().int().nonnegative().max(1_000_000).nullable(),
  maximumGuests: z.number().int().nonnegative().max(1_000_000).nullable(),
  preparationBeforeMinutes: z.number().int().nonnegative().max(10_080),
  preparationAfterMinutes: z.number().int().nonnegative().max(10_080),
}).strict().superRefine((value, context) => {
  if (value.minimumGuests !== null && value.maximumGuests !== null && value.minimumGuests > value.maximumGuests) {
    context.addIssue({ code: "custom", path: ["maximumGuests"], message: "maximumGuests must be greater than or equal to minimumGuests" });
  }
  if ((value.operationalName !== undefined || value.internalComment !== undefined) && value.expectedOfferingVersion === undefined) {
    context.addIssue({ code: "custom", path: ["expectedOfferingVersion"], message: "expectedOfferingVersion is required when offering fields change" });
  }
});
export type EventServiceTemplateMutationBody = z.infer<typeof EventServiceTemplateMutationBodySchema>;

export const EventServiceTemplateMutationResultSchema = z.object({
  template: EventServiceTemplateSchema,
  subjectVersion: VersionSchema,
}).strict();
export type EventServiceTemplateMutationResult = z.infer<typeof EventServiceTemplateMutationResultSchema>;

export const EventServiceTemplateReopenBodySchema = OfferingSubjectMutationMetaSchema;
export type EventServiceTemplateReopenBody = z.infer<typeof EventServiceTemplateReopenBodySchema>;

export const EventServiceTemplateReopenResultSchema = EventServiceTemplateMutationResultSchema;
export type EventServiceTemplateReopenResult = z.infer<typeof EventServiceTemplateReopenResultSchema>;

export const EventServiceOfferingSummarySchema = z.object({
  offeringId: IdSchema,
  operationalName: z.string().min(1).max(500),
  offeringVersion: VersionSchema,
  state: CatalogOfferingStateSchema,
  subjectVersion: VersionSchema,
  pricingVersion: VersionSchema,
  addOnAssignmentsVersion: VersionSchema,
  eventServiceTemplateId: IdSchema,
  eventServiceTemplateVersion: VersionSchema,
  cmsReady: z.boolean(),
  publicReady: z.literal(false),
  editorialNodeId: IdSchema.nullable(),
}).strict();
export type EventServiceOfferingSummary = z.infer<typeof EventServiceOfferingSummarySchema>;

export const EventServiceTemplateRegistryItemSchema = z.object({
  template: EventServiceTemplateSchema,
  offering: EventServiceOfferingSummarySchema.nullable(),
}).strict();
export type EventServiceTemplateRegistryItem = z.infer<typeof EventServiceTemplateRegistryItemSchema>;

export const EventServiceTemplateRegistryQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  format: EventServiceFormatSchema.optional(),
  state: CatalogOfferingStateSchema.optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type EventServiceTemplateRegistryQuery = z.infer<typeof EventServiceTemplateRegistryQuerySchema>;

export const EventServiceTemplateRegistryResponseSchema = z.object({
  items: z.array(EventServiceTemplateRegistryItemSchema).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
}).strict();
export type EventServiceTemplateRegistryResponse = z.infer<typeof EventServiceTemplateRegistryResponseSchema>;
