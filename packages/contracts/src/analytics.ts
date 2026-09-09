import { z } from "zod";
import { DateTimeSchema, IdSchema } from "./primitives.js";

export const AnalyticsConsentStateSchema = z.enum(["unknown", "denied", "analytics", "analytics_and_marketing"]);
export const AnalyticsPurposeSchema = z.enum(["essential", "analytics", "marketing"]);

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

export const ClientAnalyticsEventSchema = z.object({
  eventId: IdSchema,
  occurredAt: DateTimeSchema,
  visitorToken: z.string().min(32).max(2048),
  sessionId: IdSchema,
  consent: AnalyticsConsentStateSchema,
  purpose: AnalyticsPurposeSchema,
  context: AnalyticsContextSchema,
  payload: AnalyticsClientPayloadSchema,
}).strict();
export type ClientAnalyticsEvent = z.infer<typeof ClientAnalyticsEventSchema>;

export const AnalyticsEventBatchSchema = z.object({
  events: z.array(ClientAnalyticsEventSchema).min(1).max(50),
}).strict();

export const StoredAnalyticsEventSchema = z.object({
  id: IdSchema,
  eventId: IdSchema,
  receivedAt: DateTimeSchema,
  occurredAt: DateTimeSchema,
  anonymousVisitorId: IdSchema.nullable(),
  sessionId: IdSchema,
  consent: AnalyticsConsentStateSchema,
  purpose: AnalyticsPurposeSchema,
  context: AnalyticsContextSchema,
  payload: AnalyticsClientPayloadSchema,
  attribution: z.object({ source: z.string().max(200).nullable(), medium: z.string().max(200).nullable(), campaign: z.string().max(200).nullable() }).strict(),
  networkPseudonym: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  userAgentFamily: z.string().max(120).nullable(),
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
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  interval: z.enum(["day", "month"]),
  pageNodeId: IdSchema.optional(),
  sectionKey: z.string().min(1).max(120).optional(),
}).strict();

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
