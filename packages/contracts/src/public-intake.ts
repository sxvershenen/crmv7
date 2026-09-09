import { z } from "zod";
import { DateSchema, DateTimeSchema, IdSchema } from "./primitives.js";

export const AttributionSchema = z.object({
  source: z.string().max(200).nullable(),
  medium: z.string().max(200).nullable(),
  campaign: z.string().max(200).nullable(),
  content: z.string().max(200).nullable(),
  term: z.string().max(200).nullable(),
  referrer: z.string().url().max(2048).nullable(),
  landingPath: z.string().min(1).max(2048),
}).strict();

export const PublicConsentSchema = z.object({
  privacyAccepted: z.literal(true),
  marketingAccepted: z.boolean().default(false),
  analyticsAccepted: z.boolean().default(false),
  policyVersion: z.string().min(1).max(100),
  capturedAt: DateTimeSchema,
}).strict();

export const PublicLeadIntakeSchema = z.object({
  requestId: IdSchema,
  idempotencyKey: z.string().min(16).max(255).regex(/^[A-Za-z0-9._~-]+$/),
  name: z.string().min(1).max(200),
  phone: z.string().min(5).max(40).optional(),
  email: z.string().email().max(320).optional(),
  message: z.string().max(3000).optional(),
  intent: z.object({
    kind: z.enum(["general", "resource", "program", "public_event_offering"]),
    publicEntityId: IdSchema.optional(),
    startDate: DateSchema.optional(),
    endDate: DateSchema.optional(),
    guests: z.number().int().positive().max(1000).optional(),
  }).strict(),
  attribution: AttributionSchema,
  consent: PublicConsentSchema,
  website: z.string().max(0).optional(),
}).strict().refine((value) => Boolean(value.phone || value.email), {
  message: "Phone or email is required",
  path: ["phone"],
});

export const PublicLeadIntakeResponseSchema = z.object({
  requestId: IdSchema,
  leadId: IdSchema,
  status: z.literal("accepted"),
  createdAt: DateTimeSchema,
}).strict();
