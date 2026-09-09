import { z } from "zod"

import { CapabilitiesSchema } from "./capabilities.js"
import { DateTimeSchema, IdSchema, NonNegativeMoneySchema, VersionSchema } from "./primitives.js"
import { IdempotencyKeySchema, OperationIdSchema } from "./operations.js"
import { QuoteAcceptanceReferenceSchema } from "./operational-quote-acceptance.js"

export const ProgramTemplatePublicationSchema = z.enum(["draft", "published", "archived"])
export type ProgramTemplatePublication = z.infer<typeof ProgramTemplatePublicationSchema>
export const ProgramOccurrenceStatusSchema = z.enum(["draft", "open", "closed", "completed", "cancelled"])
export type ProgramOccurrenceStatus = z.infer<typeof ProgramOccurrenceStatusSchema>
export const ProgramRegistrationStatusSchema = z.enum(["new", "confirmed", "paid", "visited", "cancelled"])
export type ProgramRegistrationStatus = z.infer<typeof ProgramRegistrationStatusSchema>

const AssigneeIdsSchema = z.array(IdSchema).max(100).default([])
const StageSchema = z.object({
  id: IdSchema.optional(), name: z.string().trim().min(1).max(500), durationMinutes: z.number().int().positive().max(10080), comment: z.string().max(20_000).default(""),
}).strict()

export const ProgramTemplateCapabilitiesSchema = CapabilitiesSchema.pick({ canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true }).strict()
export const ProgramTemplateSchema = z.object({
  id: IdSchema, version: VersionSchema, code: z.string().min(1).max(120), name: z.string().min(1).max(500),
  categoryId: IdSchema.nullable(), durationMinutes: z.number().int().positive().max(10080), minimumParticipants: z.number().int().nonnegative().nullable(),
  participantLimit: z.number().int().positive().max(1_000_000), registrationCloseHours: z.number().nonnegative().max(8760).nullable(),
  basePrice: NonNegativeMoneySchema, description: z.string(), publication: ProgramTemplatePublicationSchema, published: z.boolean(),
  assigneeIds: z.array(IdSchema), stages: z.array(StageSchema.extend({ id: IdSchema })).max(500), nextOccurrence: z.object({ id: IdSchema, startsAt: DateTimeSchema }).nullable(),
  archived: z.boolean(), createdAt: DateTimeSchema, updatedAt: DateTimeSchema, capabilities: ProgramTemplateCapabilitiesSchema,
}).strict()
export type ProgramTemplate = z.infer<typeof ProgramTemplateSchema>
export const ProgramTemplateDtoSchema = ProgramTemplateSchema
export type ProgramTemplateDto = ProgramTemplate

export const ProgramTemplateCreateSchema = z.object({
  code: z.string().trim().min(1).max(120).optional(), name: z.string().trim().min(1).max(500), categoryId: IdSchema.nullable().default(null),
  durationMinutes: z.number().int().positive().max(10080), minimumParticipants: z.number().int().nonnegative().nullable().default(null),
  participantLimit: z.number().int().positive().max(1_000_000), registrationCloseHours: z.number().nonnegative().max(8760).nullable().default(null),
  basePrice: NonNegativeMoneySchema, description: z.string().max(20_000).default(""), publication: ProgramTemplatePublicationSchema.default("draft"),
  assigneeIds: AssigneeIdsSchema, stages: z.array(StageSchema).max(500).default([]),
  operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema,
}).strict()
export type ProgramTemplateCreate = z.infer<typeof ProgramTemplateCreateSchema>
export const ProgramTemplateUpdateSchema = z.object({
  version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema,
  name: z.string().trim().min(1).max(500).optional(), categoryId: IdSchema.nullable().optional(), durationMinutes: z.number().int().positive().max(10080).optional(),
  minimumParticipants: z.number().int().nonnegative().nullable().optional(), participantLimit: z.number().int().positive().max(1_000_000).optional(),
  registrationCloseHours: z.number().nonnegative().max(8760).nullable().optional(), basePrice: NonNegativeMoneySchema.optional(), description: z.string().max(20_000).optional(),
  publication: ProgramTemplatePublicationSchema.optional(), assigneeIds: z.array(IdSchema).max(100).optional(), stages: z.array(StageSchema).max(500).optional(),
}).strict()
export type ProgramTemplateUpdate = z.infer<typeof ProgramTemplateUpdateSchema>
export const ProgramTemplateArchiveSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema }).strict()
export type ProgramTemplateArchive = z.infer<typeof ProgramTemplateArchiveSchema>
export const ProgramTemplateListQuerySchema = z.object({ publication: ProgramTemplatePublicationSchema.optional(), categoryId: IdSchema.optional(), archived: z.preprocess((v) => v === "true" ? true : v === "false" ? false : v, z.boolean()).optional(), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().min(1).max(2048).optional() }).strict()
export type ProgramTemplateListQuery = z.infer<typeof ProgramTemplateListQuerySchema>

export const ProgramOccurrenceCapabilitiesSchema = CapabilitiesSchema.pick({ canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true, canOverrideConflict: true }).strict()
export const ProgramOccurrenceSchema = z.object({
  id: IdSchema, version: VersionSchema, code: z.string().min(1).max(120), templateId: IdSchema, name: z.string().min(1).max(500),
  startsAt: DateTimeSchema, endsAt: DateTimeSchema, participantLimit: z.number().int().positive(), registrationLimit: z.number().int().positive(),
  participantCount: z.number().int().nonnegative(), registrationCount: z.number().int().nonnegative(), revenue: NonNegativeMoneySchema, paid: NonNegativeMoneySchema,
  status: ProgramOccurrenceStatusSchema, comment: z.string(), assigneeIds: z.array(IdSchema), archived: z.boolean(), createdAt: DateTimeSchema, updatedAt: DateTimeSchema,
  capabilities: ProgramOccurrenceCapabilitiesSchema,
}).strict()
export type ProgramOccurrence = z.infer<typeof ProgramOccurrenceSchema>
export const ProgramOccurrenceDtoSchema = ProgramOccurrenceSchema
export type ProgramOccurrenceDto = ProgramOccurrence
export const ProgramOccurrenceCreateSchema = z.object({
  code: z.string().trim().min(1).max(120).optional(), templateId: IdSchema, name: z.string().trim().min(1).max(500).optional(), startsAt: DateTimeSchema, endsAt: DateTimeSchema,
  participantLimit: z.number().int().positive(), registrationLimit: z.number().int().positive(), comment: z.string().max(20_000).default(""), assigneeIds: AssigneeIdsSchema,
  currency: z.string().regex(/^[A-Z]{3}$/).default("RUB"), operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema,
}).strict()
export type ProgramOccurrenceCreate = z.infer<typeof ProgramOccurrenceCreateSchema>
export const ProgramOccurrenceUpdateSchema = z.object({
  version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema, templateId: IdSchema.optional(), name: z.string().trim().min(1).max(500).optional(),
  startsAt: DateTimeSchema.optional(), endsAt: DateTimeSchema.optional(), participantLimit: z.number().int().positive().optional(), registrationLimit: z.number().int().positive().optional(), comment: z.string().max(20_000).optional(), assigneeIds: z.array(IdSchema).max(100).optional(),
}).strict()
export type ProgramOccurrenceUpdate = z.infer<typeof ProgramOccurrenceUpdateSchema>
export const ProgramOccurrenceTransitionSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema, status: ProgramOccurrenceStatusSchema }).strict()
export type ProgramOccurrenceTransition = z.infer<typeof ProgramOccurrenceTransitionSchema>
export const ProgramOccurrenceArchiveSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema }).strict()
export type ProgramOccurrenceArchive = z.infer<typeof ProgramOccurrenceArchiveSchema>
export const ProgramOccurrenceListQuerySchema = z.object({ templateId: IdSchema.optional(), status: ProgramOccurrenceStatusSchema.optional(), from: DateTimeSchema.optional(), to: DateTimeSchema.optional(), archived: z.preprocess((v) => v === "true" ? true : v === "false" ? false : v, z.boolean()).optional(), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().min(1).max(2048).optional() }).strict()
export type ProgramOccurrenceListQuery = z.infer<typeof ProgramOccurrenceListQuerySchema>

export const ProgramRegistrationCapabilitiesSchema = CapabilitiesSchema.pick({ canView: true, canCreate: true, canEdit: true, canArchive: true, canChangeStatus: true, canAddPayment: true, canRefund: true }).strict()
export const ProgramRegistrationSchema = z.object({
  id: IdSchema, version: VersionSchema, code: z.string().min(1).max(120), occurrenceId: IdSchema, customerId: IdSchema.nullable(), phone: z.string(), participantCount: z.number().int().positive(), participantNames: z.string(),
  total: NonNegativeMoneySchema, discount: NonNegativeMoneySchema, paid: NonNegativeMoneySchema, status: ProgramRegistrationStatusSchema, promo: z.string(), source: z.string(), comment: z.string(), archived: z.boolean(), createdAt: DateTimeSchema, updatedAt: DateTimeSchema,
  capabilities: ProgramRegistrationCapabilitiesSchema,
}).strict()
export type ProgramRegistration = z.infer<typeof ProgramRegistrationSchema>
export const ProgramRegistrationDtoSchema = ProgramRegistrationSchema
export type ProgramRegistrationDto = ProgramRegistration
export const ProgramRegistrationCreateSchema = z.object({ code: z.string().trim().min(1).max(120).optional(), occurrenceId: IdSchema, customerId: IdSchema.nullable().default(null), phone: z.string().max(64).default(""), participantCount: z.number().int().positive(), participantNames: z.string().max(20_000).default(""), total: NonNegativeMoneySchema, discount: NonNegativeMoneySchema.default({ amountMinor: 0, currency: "RUB" }), status: ProgramRegistrationStatusSchema.default("new"), promo: z.string().max(120).default(""), source: z.string().max(120).default(""), comment: z.string().max(20_000).default(""), operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema }).strict()
export type ProgramRegistrationCreate = z.infer<typeof ProgramRegistrationCreateSchema>
export const ProgramRegistrationUpdateSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema, occurrenceId: IdSchema.optional(), customerId: IdSchema.nullable().optional(), phone: z.string().max(64).optional(), participantCount: z.number().int().positive().optional(), participantNames: z.string().max(20_000).optional(), total: NonNegativeMoneySchema.optional(), discount: NonNegativeMoneySchema.optional(), promo: z.string().max(120).optional(), source: z.string().max(120).optional(), comment: z.string().max(20_000).optional() }).strict()
export type ProgramRegistrationUpdate = z.infer<typeof ProgramRegistrationUpdateSchema>
export const ProgramRegistrationTransitionSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema, status: ProgramRegistrationStatusSchema, quoteAcceptance: QuoteAcceptanceReferenceSchema.optional() }).strict().superRefine((value, context) => {
  if (value.quoteAcceptance !== undefined && value.status !== "confirmed") context.addIssue({ code: "custom", path: ["quoteAcceptance"], message: "Quote acceptance is only allowed when confirming a registration" })
})
export type ProgramRegistrationTransition = z.infer<typeof ProgramRegistrationTransitionSchema>
export const ProgramRegistrationArchiveSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema }).strict()
export type ProgramRegistrationArchive = z.infer<typeof ProgramRegistrationArchiveSchema>
export const ProgramRegistrationListQuerySchema = z.object({ occurrenceId: IdSchema.optional(), customerId: IdSchema.optional(), status: ProgramRegistrationStatusSchema.optional(), archived: z.preprocess((v) => v === "true" ? true : v === "false" ? false : v, z.boolean()).optional(), limit: z.coerce.number().int().min(1).max(100).default(50), cursor: z.string().min(1).max(2048).optional() }).strict()
export type ProgramRegistrationListQuery = z.infer<typeof ProgramRegistrationListQuerySchema>
