import { z } from "zod";
import { OperationIdSchema } from "../operations.js";
import { DateTimeSchema, IdSchema, VersionSchema } from "../primitives.js";

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
    "crm.offering.event_service_prepared",
    "crm.offering.event_service_updated",
    "crm.offering.event_service_reopened",
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
