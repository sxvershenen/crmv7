import { z } from "zod";
import { DateTimeSchema, IdSchema } from "./primitives.js";

export const AnalyticsConsentStateSchema = z.enum(["unknown", "denied", "analytics", "analytics_and_marketing"]);
export const AnalyticsPurposeSchema = z.enum(["essential", "analytics", "marketing"]);
export const AnalyticsEventNameSchema = z.enum([
  "page_view", "section_impression", "navigation_click", "outbound_click", "file_download",
  "resource_card_opened", "resource_viewed", "category_viewed", "program_viewed", "event_viewed", "faq_opened", "map_point_opened",
  "filter_applied", "filter_cleared", "sort_changed", "pagination_changed", "zero_results_seen",
  "cta_clicked", "phone_revealed", "phone_clicked", "messenger_clicked", "promo_copied",
  "calculator_started", "calculator_step_viewed", "calculator_option_changed", "calculator_quote_updated", "calculator_completed",
  "form_started", "form_step_completed", "form_validation_failed", "form_submit_attempted", "form_succeeded", "form_failed",
  "consent_changed",
]);
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>;

const AnalyticsPathSchema = z.string().min(1).max(2048).regex(/^\/(?!\/)[^?#]*$/, "Path must not contain query or hash");
const AnalyticsSectionKeySchema = z.string().min(1).max(120).regex(/^[a-z][a-z0-9._-]*$/);

export const AnalyticsContextSchema = z.object({
  path: z.string().min(1).max(2048),
  pageNodeId: IdSchema.nullable(),
  releaseId: IdSchema.nullable(),
  referrer: z.string().url().max(2048).nullable(),
  viewport: z.object({ width: z.number().int().positive().max(20000), height: z.number().int().positive().max(20000) }).strict().optional(),
}).strict();

const PageViewPayloadSchema = z.object({
  kind: z.literal("page_view"),
  title: z.string().max(240).optional(),
}).strict();

const ActionPayloadSchema = z.object({
  kind: z.literal("action"),
  actionId: z.string().min(1).max(120).regex(/^[a-z][a-z0-9_.-]*$/),
  component: z.string().min(1).max(120),
}).strict();

const FunnelPayloadSchema = z.object({
  kind: z.literal("funnel"),
  funnel: z.enum(["calculator", "lead_form", "booking_request"]),
  step: z.string().min(1).max(120),
  outcome: z.enum(["viewed", "started", "completed", "failed"]),
  errorCode: z.string().min(1).max(120).optional(),
}).strict();

const ConsentPayloadSchema = z.object({
  kind: z.literal("consent"),
  state: AnalyticsConsentStateSchema,
  policyVersion: z.string().min(1).max(100),
}).strict();

export const AnalyticsClientPayloadSchema = z.discriminatedUnion("kind", [
  PageViewPayloadSchema, ActionPayloadSchema, FunnelPayloadSchema, ConsentPayloadSchema,
]);

export const PublicAnalyticsEventSchema = z.object({
  eventId: IdSchema,
  schemaVersion: z.literal(1),
  occurredAt: DateTimeSchema,
  eventName: AnalyticsEventNameSchema,
  consent: AnalyticsConsentStateSchema,
  purpose: AnalyticsPurposeSchema,
  context: AnalyticsContextSchema.extend({
    path: AnalyticsPathSchema,
    sectionKey: AnalyticsSectionKeySchema.optional(),
    contentVersion: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  }).strict(),
  properties: AnalyticsClientPayloadSchema,
}).strict();
export type PublicAnalyticsEvent = z.infer<typeof PublicAnalyticsEventSchema>;
export const ClientAnalyticsEventSchema = PublicAnalyticsEventSchema;
export type ClientAnalyticsEvent = PublicAnalyticsEvent;

export const AnalyticsEventBatchSchema = z.object({
  events: z.array(PublicAnalyticsEventSchema).min(1).max(50),
}).strict();
export type AnalyticsEventBatch = z.infer<typeof AnalyticsEventBatchSchema>;

export const AnalyticsEventBatchResponseSchema = z.object({
  requestId: IdSchema,
  accepted: z.number().int().nonnegative().max(50),
  duplicates: z.number().int().nonnegative().max(50),
  dropped: z.number().int().nonnegative().max(50),
}).strict();
export type AnalyticsEventBatchResponse = z.infer<typeof AnalyticsEventBatchResponseSchema>;

export const StoredAnalyticsEventSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  schemaVersion: z.literal(1),
  eventName: AnalyticsEventNameSchema,
  receivedAt: DateTimeSchema,
  occurredAt: DateTimeSchema,
  visitorId: IdSchema,
  sessionId: IdSchema,
  consent: AnalyticsConsentStateSchema,
  purpose: AnalyticsPurposeSchema,
  context: AnalyticsContextSchema,
  properties: AnalyticsClientPayloadSchema,
  attribution: z.object({ source: z.string().max(200).nullable(), medium: z.string().max(200).nullable(), campaign: z.string().max(200).nullable() }).strict(),
  networkPseudonym: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  userAgentFamily: z.string().max(120).nullable(),
  deviceClass: z.enum(["mobile", "desktop", "unknown"]),
  trafficClass: z.enum(["human", "bot", "unknown"]),
}).strict();

export const DomainConversionFactSchema = z.object({
  id: IdSchema,
  kind: z.enum(["lead_created", "booking_created", "payment_recorded"]),
  occurredAt: DateTimeSchema,
  entityId: IdSchema,
  leadId: IdSchema.nullable(),
  bookingId: IdSchema.nullable(),
  anonymousVisitorId: IdSchema.nullable(),
  sessionId: IdSchema.nullable(),
  releaseId: IdSchema.nullable(),
  pageNodeId: IdSchema.nullable(),
  attributionModel: z.enum(["first_touch", "last_touch", "direct", "unattributed"]),
}).strict();

export const AnalyticsAggregateQuerySchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  interval: z.enum(["day", "month"]),
  pageNodeId: IdSchema.optional(),
  sectionKey: AnalyticsSectionKeySchema.optional(),
}).strict();
export type AnalyticsAggregateQuery = z.infer<typeof AnalyticsAggregateQuerySchema>;

export const AnalyticsAggregatePointSchema = z.object({
  period: z.string().min(7).max(10),
  pageNodeId: IdSchema.nullable(),
  sectionKey: z.string().max(120).nullable(),
  pageViews: z.number().int().nonnegative().safe(),
  uniqueVisitors: z.number().int().nonnegative().safe(),
  actions: z.number().int().nonnegative().safe(),
  leads: z.number().int().nonnegative().safe(),
  bookings: z.number().int().nonnegative().safe(),
}).strict();
export type AnalyticsAggregatePoint = z.infer<typeof AnalyticsAggregatePointSchema>;

export const AnalyticsAggregateResponseSchema = z.object({
  items: z.array(AnalyticsAggregatePointSchema).max(366),
}).strict();
export type AnalyticsAggregateResponse = z.infer<typeof AnalyticsAggregateResponseSchema>;
