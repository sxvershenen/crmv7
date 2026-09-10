import { z } from "zod";
import { IdempotencyKeySchema, OperationIdSchema } from "../operations.js";
import { CurrencySchema, DateSchema, DateTimeSchema, IdSchema, NonNegativeMoneySchema, VersionSchema } from "../primitives.js";
import { CatalogOfferingStateSchema } from "./catalog.js";

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

export const EventServiceQuoteTypeSchema = z.literal("event_service_preview");
export type EventServiceQuoteType = z.infer<typeof EventServiceQuoteTypeSchema>;

/** Private server-authoritative interval preview; no acceptance payload is accepted here. */
export const EventServiceOfferingQuotePreviewBodySchema = z.object({
  quoteType: EventServiceQuoteTypeSchema.default("event_service_preview"),
  ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120),
  startsAt: DateTimeSchema,
  endsAt: DateTimeSchema,
  guests: z.number().int().positive().max(1_000_000),
  currency: CurrencySchema,
  addOns: z.tuple([]).default([]),
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict().superRefine((value, context) => {
  if (value.startsAt >= value.endsAt) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "Invalid event-service interval" });
  }
});
export type EventServiceOfferingQuotePreviewBody = z.infer<typeof EventServiceOfferingQuotePreviewBodySchema>;

export const EventServiceOfferingQuoteLineSchema = z.object({
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
export type EventServiceOfferingQuoteLine = z.infer<typeof EventServiceOfferingQuoteLineSchema>;

export const EventServiceOfferingQuoteResultSchema = z.object({
  quoteType: EventServiceQuoteTypeSchema,
  acceptanceReady: z.literal(false),
  quoteId: IdSchema,
  offeringId: IdSchema,
  eventServiceTemplateId: IdSchema,
  calculatedAt: DateTimeSchema,
  validUntil: DateTimeSchema,
  leadDays: z.number().int().nonnegative().nullable(),
  currency: CurrencySchema,
  inputs: z.object({
    startsAt: DateTimeSchema,
    endsAt: DateTimeSchema,
    serviceDate: DateSchema,
    durationMinutes: z.number().int().positive(),
    guests: z.number().int().positive(),
    timezone: z.string().min(1).max(100),
    ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120),
  }).strict(),
  lines: z.array(EventServiceOfferingQuoteLineSchema).min(1).max(2),
  total: NonNegativeMoneySchema,
  provenance: z.object({
    offeringVersion: VersionSchema,
    subjectVersion: VersionSchema,
    eventServiceTemplateVersion: VersionSchema,
    offeringBindingId: IdSchema,
    offeringBindingVersion: VersionSchema,
    pricingVersion: VersionSchema,
    addOnsVersion: VersionSchema,
    priceBookId: IdSchema,
    priceBookVersion: VersionSchema,
    businessCalendarId: IdSchema,
    businessCalendarVersion: VersionSchema,
    businessCalendarSourceVersion: z.string().min(1).max(120),
    businessCalendarDateId: IdSchema,
    businessCalendarDateVersion: VersionSchema,
    businessCalendarDateOverrideId: IdSchema.nullable(),
    businessCalendarDateOverrideVersion: VersionSchema.nullable(),
    preparationBeforeMinutes: z.number().int().nonnegative().max(10_080),
    preparationAfterMinutes: z.number().int().nonnegative().max(10_080),
    preparationStartsAt: DateTimeSchema,
    preparationEndsAt: DateTimeSchema,
    matchedRuleIds: z.array(IdSchema).max(10_000),
  }).strict(),
  immutableSnapshot: z.literal(true),
}).strict();
export type EventServiceOfferingQuoteResult = z.infer<typeof EventServiceOfferingQuoteResultSchema>;

/** Reload returns the same immutable representation and never recalculates it. */
export const EventServiceOfferingQuoteSnapshotSchema = EventServiceOfferingQuoteResultSchema;
export type EventServiceOfferingQuoteSnapshot = z.infer<typeof EventServiceOfferingQuoteSnapshotSchema>;

export const EventOrderQuoteTypeSchema = z.literal("event_order");
export type EventOrderQuoteType = z.infer<typeof EventOrderQuoteTypeSchema>;
export const EventOrderAddOnSelectionSchema = z.object({
  assignmentId: IdSchema,
  quantity: z.number().int().positive().max(1_000_000),
}).strict();
export type EventOrderAddOnSelection = z.infer<typeof EventOrderAddOnSelectionSchema>;
export const EventOrderResourceSelectionSchema = z.object({
  resourceId: IdSchema,
  version: VersionSchema,
}).strict();
export type EventOrderResourceSelection = z.infer<typeof EventOrderResourceSelectionSchema>;
export const EventOrderQuoteBodySchema = z.object({
  quoteType: EventOrderQuoteTypeSchema.default("event_order"),
  eventId: IdSchema,
  expectedEventVersion: VersionSchema,
  ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120),
  currency: CurrencySchema,
  addOns: z.array(EventOrderAddOnSelectionSchema).max(100).default([]),
  resourceSelections: z.array(z.object({ resourceId: IdSchema }).strict()).max(100).default([]),
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict().superRefine((value, context) => {
  const addOnIds = new Set<string>();
  value.addOns.forEach((selection, index) => {
    if (addOnIds.has(selection.assignmentId)) context.addIssue({ code: "custom", path: ["addOns", index, "assignmentId"], message: "An add-on assignment may be selected once" });
    addOnIds.add(selection.assignmentId);
  });
  const resourceIds = new Set<string>();
  value.resourceSelections.forEach((selection, index) => {
    if (resourceIds.has(selection.resourceId)) context.addIssue({ code: "custom", path: ["resourceSelections", index, "resourceId"], message: "A resource may be selected once" });
    resourceIds.add(selection.resourceId);
  });
});
export type EventOrderQuoteBody = z.infer<typeof EventOrderQuoteBodySchema>;

export const EventOrderQuoteAddOnLineSchema = z.object({
  kind: z.literal("addon"),
  label: z.string().min(1).max(500),
  serviceDate: DateSchema,
  quantity: z.number().int().positive(),
  unitAmount: NonNegativeMoneySchema,
  amount: NonNegativeMoneySchema,
  ratePlanId: IdSchema,
  ratePlanVersion: VersionSchema,
  matchedRuleId: IdSchema.nullable(),
  matchedRuleVersion: VersionSchema.nullable(),
  addOnAssignmentId: IdSchema,
  addOnOfferingId: IdSchema,
  explanation: z.string().max(1000),
}).strict();

export const EventOrderQuoteResultSchema = EventServiceOfferingQuoteResultSchema.omit({ quoteType: true, acceptanceReady: true, inputs: true, lines: true, provenance: true }).extend({
  quoteType: EventOrderQuoteTypeSchema,
  acceptanceReady: z.literal(true),
  eventId: IdSchema,
  eventVersion: VersionSchema,
  inputs: EventServiceOfferingQuoteResultSchema.shape.inputs.extend({
    addOns: z.array(EventOrderAddOnSelectionSchema).max(100),
    resourceSelections: z.array(z.object({ resourceId: IdSchema }).strict()).max(100),
  }).strict(),
  lines: z.array(z.union([EventServiceOfferingQuoteLineSchema, EventOrderQuoteAddOnLineSchema])).min(1).max(102),
  provenance: EventServiceOfferingQuoteResultSchema.shape.provenance.extend({
    addOns: z.array(z.object({
      assignmentId: IdSchema,
      addOnOfferingId: IdSchema,
      serviceType: z.enum(["quantity_service", "person_service"]),
      offeringVersion: VersionSchema,
      pricingVersion: VersionSchema,
      assignmentVersion: VersionSchema,
      priceBookId: IdSchema,
      priceBookVersion: VersionSchema,
      businessCalendarId: IdSchema,
      businessCalendarVersion: VersionSchema,
    }).strict()).max(100),
    resourceSelections: z.array(EventOrderResourceSelectionSchema).max(100),
  }).strict(),
}).strict();
export type EventOrderQuoteResult = z.infer<typeof EventOrderQuoteResultSchema>;

const ProgramRegistrationAddOnSelectionSchema = z.object({
  assignmentId: IdSchema,
  quantity: z.number().int().positive().max(1_000_000),
}).strict();

export const ProgramRegistrationQuoteBodySchema = z.object({
  quoteType: z.literal("program_registration").default("program_registration"),
  expectedOccurrenceVersion: VersionSchema,
  ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable(),
  participants: z.number().int().positive().max(1_000_000),
  currency: CurrencySchema,
  addOns: z.array(ProgramRegistrationAddOnSelectionSchema).max(100).default([]),
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict().superRefine((value, context) => {
  const ids = new Set<string>();
  value.addOns.forEach((selection, index) => {
    if (ids.has(selection.assignmentId)) context.addIssue({ code: "custom", path: ["addOns", index, "assignmentId"], message: "An add-on assignment may be selected once" });
    ids.add(selection.assignmentId);
  });
});
export type ProgramRegistrationQuoteBody = z.infer<typeof ProgramRegistrationQuoteBodySchema>;

const ProgramRegistrationQuoteAddOnLineSchema = z.object({
  kind: z.literal("addon"),
  label: z.string().min(1).max(500),
  serviceDate: DateSchema,
  quantity: z.number().int().positive(),
  unitAmount: NonNegativeMoneySchema,
  amount: NonNegativeMoneySchema,
  ratePlanId: IdSchema,
  ratePlanVersion: VersionSchema,
  matchedRuleId: IdSchema.nullable(),
  matchedRuleVersion: VersionSchema.nullable(),
  addOnAssignmentId: IdSchema,
  addOnOfferingId: IdSchema,
  explanation: z.string().max(1000),
}).strict();

export const ProgramRegistrationQuoteResultSchema = z.object({
  quoteType: z.literal("program_registration"),
  acceptanceReady: z.literal(true),
  quoteId: IdSchema,
  offeringId: IdSchema,
  programTemplateId: IdSchema,
  programOccurrenceId: IdSchema,
  programOccurrenceVersion: VersionSchema,
  calculatedAt: DateTimeSchema,
  validUntil: DateTimeSchema,
  leadDays: z.number().int().nonnegative(),
  currency: CurrencySchema,
  inputs: z.object({
    serviceDate: DateSchema,
    startsAt: DateTimeSchema,
    endsAt: DateTimeSchema,
    participants: z.number().int().positive(),
    durationMinutes: z.number().int().positive(),
    addOns: z.array(ProgramRegistrationAddOnSelectionSchema).max(100),
  }).strict(),
  lines: z.array(z.union([ProgramOfferingQuoteLineSchema, ProgramRegistrationQuoteAddOnLineSchema])).min(1).max(102),
  total: NonNegativeMoneySchema,
  provenance: ProgramOfferingQuoteResultSchema.shape.provenance.extend({
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
    }).strict()).max(100),
  }).strict(),
  immutableSnapshot: z.literal(true),
}).strict();
export type ProgramRegistrationQuoteResult = z.infer<typeof ProgramRegistrationQuoteResultSchema>;
