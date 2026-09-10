import { z } from "zod";

import { OperationIdSchema } from "./operations.js";
import { CurrencySchema, DateTimeSchema, IdSchema, NonNegativeMoneySchema, VersionSchema } from "./primitives.js";

/** Reference supplied only at the lifecycle acceptance boundary. */
export const QuoteAcceptanceReferenceSchema = z.object({
  quoteSnapshotId: IdSchema,
}).strict();
export type QuoteAcceptanceReference = z.infer<typeof QuoteAcceptanceReferenceSchema>;

/** A booking can have several items; each accepted quote is bound to one item. */
export const BookingItemQuoteAcceptanceSchema = QuoteAcceptanceReferenceSchema.extend({
  bookingItemId: IdSchema,
}).strict();
export type BookingItemQuoteAcceptance = z.infer<typeof BookingItemQuoteAcceptanceSchema>;

/**
 * Persisted with a quote snapshot by the pricing service. Null legacy contexts
 * are deliberately not eligible for operational acceptance.
 */
export const HouseStayQuoteOperationalContextSchema = z.object({
  kind: z.literal("house_stay"),
  subjectVersion: VersionSchema,
  primaryResourceId: IdSchema,
  primaryResourceVersion: VersionSchema,
}).strict();
export const ProgramRegistrationQuoteOperationalContextSchema = z.object({
  kind: z.literal("program_registration"),
  subjectVersion: VersionSchema,
  programTemplateId: IdSchema,
  programTemplateVersion: VersionSchema,
  programOccurrenceId: IdSchema,
  programOccurrenceVersion: VersionSchema,
}).strict();
export const EventOrderQuoteOperationalContextSchema = z.object({
  kind: z.literal("event_order"),
  eventId: IdSchema,
  eventVersion: VersionSchema,
  subjectVersion: VersionSchema,
  eventServiceTemplateId: IdSchema,
  eventServiceTemplateVersion: VersionSchema,
  offeringBindingId: IdSchema,
  offeringBindingVersion: VersionSchema,
  resourcePins: z.array(z.object({ resourceId: IdSchema, version: VersionSchema }).strict()).max(100),
}).strict();
export const OfferingQuoteOperationalContextSchema = z.discriminatedUnion("kind", [
  HouseStayQuoteOperationalContextSchema,
  ProgramRegistrationQuoteOperationalContextSchema,
  EventOrderQuoteOperationalContextSchema,
]);
export type OfferingQuoteOperationalContext = z.infer<typeof OfferingQuoteOperationalContextSchema>;

export const OperationalQuoteAcceptanceTargetSchema = z.discriminatedUnion("type", [
  // For a booking item, `version` is the owning Booking aggregate version.
  z.object({ type: z.literal("booking_item"), id: IdSchema, aggregateId: IdSchema, version: VersionSchema }).strict(),
  z.object({ type: z.literal("event"), id: IdSchema, aggregateId: IdSchema, version: VersionSchema }).strict(),
  z.object({ type: z.literal("program_registration"), id: IdSchema, aggregateId: IdSchema, version: VersionSchema }).strict(),
]);
export type OperationalQuoteAcceptanceTarget = z.infer<typeof OperationalQuoteAcceptanceTargetSchema>;

/** Safe read shape: source versions and totals, never request/result payload or customer data. */
export const AcceptedOfferingQuoteSchema = z.object({
  quoteSnapshotId: IdSchema,
  offeringId: IdSchema,
  acceptedAt: DateTimeSchema,
  acceptedBy: IdSchema.nullable(),
  calculatedAt: DateTimeSchema,
  validUntil: DateTimeSchema,
  total: NonNegativeMoneySchema,
  sourceVersions: z.object({
    offering: VersionSchema,
    pricing: VersionSchema,
    addOns: VersionSchema,
    priceBook: VersionSchema,
    calendar: VersionSchema,
  }).strict(),
}).strict();
export type AcceptedOfferingQuote = z.infer<typeof AcceptedOfferingQuoteSchema>;

export const AcceptedOfferingQuoteLinkSchema = z.object({
  id: IdSchema,
  quoteSnapshotId: IdSchema,
  target: OperationalQuoteAcceptanceTargetSchema,
  acceptedAt: DateTimeSchema,
  acceptedBy: IdSchema.nullable(),
  operationId: OperationIdSchema,
  requestId: z.string().min(1).max(500),
  entrySurface: z.literal("internal"),
}).strict();
export type AcceptedOfferingQuoteLink = z.infer<typeof AcceptedOfferingQuoteLinkSchema>;

/**
 * The acceptance event deliberately has only operational IDs and source
 * versions. Quote request/result payloads can contain commercial detail and
 * must never be published into generic Outbox/SSE consumers.
 */
export const OperationalQuoteAcceptanceOutboxEventSchema = z.object({
  schemaVersion: z.literal(1),
  eventId: IdSchema,
  eventType: z.literal("crm.operational_quote.accepted"),
  occurredAt: DateTimeSchema,
  actorId: IdSchema.nullable(),
  requestId: z.string().min(1).max(500),
  operationId: OperationIdSchema,
  entrySurface: z.literal("internal"),
  target: OperationalQuoteAcceptanceTargetSchema,
  quote: z.object({
    quoteSnapshotId: IdSchema,
    offeringId: IdSchema,
    offeringVersion: VersionSchema,
    pricingVersion: VersionSchema,
    addOnsVersion: VersionSchema,
    priceBookVersion: VersionSchema,
    calendarVersion: VersionSchema,
    currency: CurrencySchema,
  }).strict(),
}).strict();
export type OperationalQuoteAcceptanceOutboxEvent = z.infer<typeof OperationalQuoteAcceptanceOutboxEventSchema>;
