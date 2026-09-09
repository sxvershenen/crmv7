import { z } from "zod"

import { CapabilitiesSchema } from "./capabilities.js"
import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js"
import { IdempotencyKeySchema, OperationIdSchema } from "./operations.js"

const CategoryCapabilitiesSchema = CapabilitiesSchema.pick({ canView: true, canCreate: true, canEdit: true, canArchive: true }).strict()

export const ProgramCategoryIconSchema = z.enum(["campfire", "leaf", "palette", "snowflake", "sparkles"])
export const ProgramCategoryToneSchema = z.enum(["amber", "emerald", "violet", "sky", "rose"])
export const EventCategoryIconSchema = z.enum(["heart", "building", "cake", "bus"])
export const EventCategoryToneSchema = z.enum(["rose", "violet", "amber", "sky"])

const CategoryBaseSchema = z.object({
  id: IdSchema,
  version: VersionSchema,
  name: z.string().min(1).max(500),
  description: z.string(),
  archived: z.boolean(),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
  capabilities: CategoryCapabilitiesSchema,
}).strict()

export const ProgramCategorySchema = CategoryBaseSchema.extend({
  icon: ProgramCategoryIconSchema,
  tone: ProgramCategoryToneSchema,
  templateCount: z.number().int().nonnegative(),
}).strict()
export type ProgramCategoryDto = z.infer<typeof ProgramCategorySchema>

export const ProgramCategoryTemplateSummarySchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(500),
  version: VersionSchema,
  updatedAt: DateTimeSchema,
  nextRun: z.object({ id: IdSchema, startsAt: DateTimeSchema }).nullable(),
}).strict()
export const ProgramCategoryDetailSchema = ProgramCategorySchema.extend({ relatedTemplates: z.array(ProgramCategoryTemplateSummarySchema) }).strict()
export type ProgramCategoryDetail = z.infer<typeof ProgramCategoryDetailSchema>

export const ProgramCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(500),
  description: z.string().max(20_000).default(""),
  icon: ProgramCategoryIconSchema,
  tone: ProgramCategoryToneSchema,
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict()
export type ProgramCategoryCreate = z.infer<typeof ProgramCategoryCreateSchema>
export const ProgramCategoryUpdateSchema = z.object({
  version: VersionSchema,
  name: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20_000).optional(),
  icon: ProgramCategoryIconSchema.optional(),
  tone: ProgramCategoryToneSchema.optional(),
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict()
export type ProgramCategoryUpdate = z.infer<typeof ProgramCategoryUpdateSchema>
export const ProgramCategoryArchiveSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema }).strict()
export type ProgramCategoryArchive = z.infer<typeof ProgramCategoryArchiveSchema>
export const ProgramCategoryListQuerySchema = z.object({
  archived: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).max(2048).optional(),
}).strict()
export type ProgramCategoryListQuery = z.infer<typeof ProgramCategoryListQuerySchema>

export const EventCategorySchema = CategoryBaseSchema.extend({
  icon: EventCategoryIconSchema,
  tone: EventCategoryToneSchema,
  eventCount: z.number().int().nonnegative(),
}).strict()
export type EventCategoryDto = z.infer<typeof EventCategorySchema>

export const EventCategoryEventSummarySchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(500),
  startsAt: DateTimeSchema,
  clientName: z.string(),
}).strict()
export const EventCategoryDetailSchema = EventCategorySchema.extend({ relatedEvents: z.array(EventCategoryEventSummarySchema) }).strict()
export type EventCategoryDetail = z.infer<typeof EventCategoryDetailSchema>

export const EventCategoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(500),
  description: z.string().max(20_000).default(""),
  icon: EventCategoryIconSchema,
  tone: EventCategoryToneSchema,
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict()
export type EventCategoryCreate = z.infer<typeof EventCategoryCreateSchema>
export const EventCategoryUpdateSchema = z.object({
  version: VersionSchema,
  name: z.string().trim().min(1).max(500).optional(),
  description: z.string().max(20_000).optional(),
  icon: EventCategoryIconSchema.optional(),
  tone: EventCategoryToneSchema.optional(),
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
}).strict()
export type EventCategoryUpdate = z.infer<typeof EventCategoryUpdateSchema>
export const EventCategoryArchiveSchema = z.object({ version: VersionSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema }).strict()
export type EventCategoryArchive = z.infer<typeof EventCategoryArchiveSchema>
export const EventCategoryListQuerySchema = ProgramCategoryListQuerySchema
export type EventCategoryListQuery = ProgramCategoryListQuery

export const ProgramCategoryListResponseSchema = z.object({ items: z.array(ProgramCategorySchema), nextCursor: z.string().nullable() }).strict()
export const EventCategoryListResponseSchema = z.object({ items: z.array(EventCategorySchema), nextCursor: z.string().nullable() }).strict()
