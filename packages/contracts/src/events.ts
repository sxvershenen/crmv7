import { z } from "zod"

import { CapabilitiesSchema } from "./capabilities.js"
import { CurrencySchema, DateTimeSchema, IdSchema, NonNegativeMoneySchema, VersionSchema } from "./primitives.js"
import { IdempotencyKeySchema, OperationIdSchema } from "./operations.js"
import { QuoteAcceptanceReferenceSchema } from "./operational-quote-acceptance.js"
import { EventOrderQuoteResultSchema } from "./offerings.js"

export const EventStatusSchema = z.enum(["inquiry", "planning", "booked", "completed", "cancelled"])
export type EventStatus = z.infer<typeof EventStatusSchema>
export const EventPricingModeSchema = z.enum(["legacy_manual", "quote_required"])
export type EventPricingMode = z.infer<typeof EventPricingModeSchema>
export const EventAddOnSelectionSchema = z.object({ assignmentId: IdSchema, quantity: z.number().int().positive().max(1_000_000) }).strict()
export type EventAddOnSelection = z.infer<typeof EventAddOnSelectionSchema>
export const EventResourceSelectionSchema = z.object({ resourceId: IdSchema }).strict()
export type EventResourceSelection = z.infer<typeof EventResourceSelectionSchema>
const EventAcceptedQuoteSchema = EventOrderQuoteResultSchema
export const EventCapabilitiesSchema = CapabilitiesSchema.pick({ canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true, canOverrideConflict: true }).strict()
export const EventSchema = z.object({
  id: IdSchema, version: VersionSchema, code: z.string().min(1).max(120), name: z.string().min(1).max(500), categoryId: IdSchema.nullable(), commercialOfferingId: IdSchema.nullable().default(null), pricingMode: EventPricingModeSchema.default("legacy_manual"), ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable().default(null), addOnSelections: z.array(EventAddOnSelectionSchema).max(100).default([]), resourceSelections: z.array(EventResourceSelectionSchema).max(100).default([]), acceptedQuote: EventAcceptedQuoteSchema.nullable().default(null), customerId: IdSchema.nullable(),
  phone: z.string(), startsAt: DateTimeSchema, endsAt: DateTimeSchema, guestCount: z.number().int().nonnegative(), total: NonNegativeMoneySchema, paid: NonNegativeMoneySchema,
  status: EventStatusSchema, comment: z.string(), requiresAction: z.boolean(), hasConflict: z.boolean(), assigneeIds: z.array(IdSchema), scenario: z.array(z.object({ id: IdSchema, name: z.string(), durationMinutes: z.number().int().positive(), comment: z.string() }).strict()),
  archived: z.boolean(), createdAt: DateTimeSchema, updatedAt: DateTimeSchema, capabilities: EventCapabilitiesSchema,
}).strict()
export type CrmEvent = z.infer<typeof EventSchema>
export type EventDto = CrmEvent
export const EventDtoSchema = EventSchema
export const EventCreateSchema = z.object({ code: z.string().trim().min(1).max(120).optional(), name: z.string().trim().min(1).max(500), categoryId: IdSchema.nullable().default(null), commercialOfferingId: IdSchema.nullable().default(null), pricingMode: EventPricingModeSchema.default("legacy_manual"), ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable().default(null), addOnSelections: z.array(EventAddOnSelectionSchema).max(100).default([]), resourceSelections: z.array(EventResourceSelectionSchema).max(100).default([]), customerId: IdSchema.nullable().default(null), phone: z.string().max(64).default(""), startsAt: DateTimeSchema, endsAt: DateTimeSchema, guestCount: z.number().int().nonnegative(), currency: CurrencySchema.default("RUB"), total: NonNegativeMoneySchema.optional(), status: EventStatusSchema.default("inquiry"), comment: z.string().max(20_000).default(""), requiresAction: z.boolean().default(false), assigneeIds: z.array(IdSchema).max(100).default([]), scenario: z.array(z.object({ id: IdSchema.optional(), name: z.string().trim().min(1).max(500), durationMinutes: z.number().int().positive().max(10080), comment: z.string().max(20_000).default("") }).strict()).max(500).default([]), operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema }).strict().superRefine((value, context) => {
  if (value.pricingMode === "legacy_manual" && value.total === undefined) context.addIssue({ code: "custom", path: ["total"], message: "Legacy event requires a total" })
  if (value.pricingMode === "quote_required" && value.total !== undefined) context.addIssue({ code: "custom", path: ["total"], message: "Quoted event total is server-owned" })
  if (value.pricingMode === "quote_required" && !value.commercialOfferingId) context.addIssue({ code: "custom", path: ["commercialOfferingId"], message: "Quoted event requires a commercial offering" })
})
export type EventCreate = z.infer<typeof EventCreateSchema>
export const EventUpdateSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema, name: z.string().trim().min(1).max(500).optional(), categoryId: IdSchema.nullable().optional(), commercialOfferingId: IdSchema.nullable().optional(), ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable().optional(), addOnSelections: z.array(EventAddOnSelectionSchema).max(100).optional(), resourceSelections: z.array(EventResourceSelectionSchema).max(100).optional(), customerId: IdSchema.nullable().optional(), phone: z.string().max(64).optional(), startsAt: DateTimeSchema.optional(), endsAt: DateTimeSchema.optional(), guestCount: z.number().int().nonnegative().optional(), total: NonNegativeMoneySchema.optional(), comment: z.string().max(20_000).optional(), requiresAction: z.boolean().optional(), assigneeIds: z.array(IdSchema).max(100).optional(), scenario: z.array(z.object({ id: IdSchema.optional(), name: z.string().trim().min(1).max(500), durationMinutes: z.number().int().positive().max(10080), comment: z.string().max(20_000).default("") }).strict()).max(500).optional() }).strict()
export type EventUpdate = z.infer<typeof EventUpdateSchema>
export const EventTransitionSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema, status: EventStatusSchema, quoteAcceptance: QuoteAcceptanceReferenceSchema.optional() }).strict().superRefine((value, context) => {
  if (value.quoteAcceptance !== undefined && value.status !== "booked") context.addIssue({ code: "custom", path: ["quoteAcceptance"], message: "Quote acceptance is only allowed when booking an event" })
})
export type EventTransition = z.infer<typeof EventTransitionSchema>
export const EventArchiveSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema }).strict()
export type EventArchive = z.infer<typeof EventArchiveSchema>
export const EventListQuerySchema = z.object({ status: EventStatusSchema.optional(), categoryId: IdSchema.optional(), customerId: IdSchema.optional(), requiresAction: z.preprocess((v) => v === "true" ? true : v === "false" ? false : v, z.boolean()).optional(), unpaid: z.preprocess((v) => v === "true" ? true : v === "false" ? false : v, z.boolean()).optional(), from: DateTimeSchema.optional(), to: DateTimeSchema.optional(), archived: z.preprocess((v) => v === "true" ? true : v === "false" ? false : v, z.boolean()).optional(), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().min(1).max(2048).optional() }).strict()
export type EventListQuery = z.infer<typeof EventListQuerySchema>
