import { z } from "zod";
import { DateSchema, DateTimeSchema, IdSchema } from "./primitives.js";

const PublicIntakeDateSchema = DateSchema.refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Expected a real calendar date");

export const AttributionSchema = z.object({
  source: z.string().trim().max(200).nullable().default(null),
  medium: z.string().trim().max(200).nullable().default(null),
  campaign: z.string().trim().max(200).nullable().default(null),
  content: z.string().trim().max(200).nullable().default(null),
  term: z.string().trim().max(200).nullable().default(null),
  referrer: z.string().url().max(2048).refine((value) => value === null || ["http:", "https:"].includes(new URL(value).protocol), "Referrer must use HTTP(S)").nullable().default(null),
  landingPath: z.string().trim().min(1).max(2048).regex(/^\/(?!\/)/, "Landing path must be local"),
}).strict();

export const PublicConsentSchema = z.object({
  privacyAccepted: z.literal(true),
  marketingAccepted: z.boolean().default(false),
  analyticsAccepted: z.boolean().default(false),
  policyVersion: z.string().trim().min(1).max(100),
}).strict();

export const PublicLeadIntakeSchema = z.object({
  operationId: IdSchema,
  idempotencyKey: z.string().min(16).max(255).regex(/^[A-Za-z0-9._~-]+$/),
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().min(5).max(40).regex(/^[+\d() .-]+$/, "Invalid phone characters").optional(),
  email: z.string().trim().email().max(320).optional(),
  message: z.string().trim().max(3000).optional(),
  intent: z.object({
    kind: z.enum(["general", "resource", "program", "public_event_offering"]),
    publicEntityId: IdSchema.optional(),
    startDate: PublicIntakeDateSchema.optional(),
    endDate: PublicIntakeDateSchema.optional(),
    guests: z.number().int().positive().max(1000).optional(),
  }).strict(),
  attribution: AttributionSchema,
  consent: PublicConsentSchema,
  /** Honeypot. Real clients leave it absent or empty. */
  website: z.string().max(200).optional(),
}).strict().superRefine((value, context) => {
  if (!value.phone && !value.email) context.addIssue({ code: "custom", message: "Phone or email is required", path: ["phone"] });
  if (value.intent.kind !== "general" && !value.intent.publicEntityId) context.addIssue({ code: "custom", message: "Public entity is required for this intent", path: ["intent", "publicEntityId"] });
  if (value.intent.startDate && value.intent.endDate) {
    const start = new Date(`${value.intent.startDate}T00:00:00.000Z`).getTime();
    const end = new Date(`${value.intent.endDate}T00:00:00.000Z`).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && start >= end) context.addIssue({ code: "custom", message: "End date must be after start date", path: ["intent", "endDate"] });
  }
});
export type PublicLeadIntake = z.infer<typeof PublicLeadIntakeSchema>;

export const PublicLeadIntakeResponseSchema = z.object({
  requestId: IdSchema,
  accepted: z.literal(true),
  receivedAt: DateTimeSchema,
}).strict();
export type PublicLeadIntakeResponse = z.infer<typeof PublicLeadIntakeResponseSchema>;
