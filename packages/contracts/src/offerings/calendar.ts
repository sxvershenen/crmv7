import { z } from "zod";
import { IdempotencyKeySchema, OperationIdSchema } from "../operations.js";
import { DateSchema, DateTimeSchema, IdSchema, VersionSchema } from "../primitives.js";

export const BusinessCalendarStateSchema = z.enum(["draft", "active", "retired"]);
export type BusinessCalendarState = z.infer<typeof BusinessCalendarStateSchema>;
export const BusinessCalendarDayClassSchema = z.enum(["weekday", "weekend", "holiday"]);
export type BusinessCalendarDayClass = z.infer<typeof BusinessCalendarDayClassSchema>;
export const BusinessCalendarDaySourceSchema = z.enum(["official_ru", "manual_override"]);
export const BusinessCalendarSchema = z.object({
  id: IdSchema,
  code: z.string().min(1).max(120),
  version: VersionSchema,
  name: z.string().min(1).max(240),
  countryCode: z.literal("RU"),
  timezone: z.string().min(1).max(100),
  state: BusinessCalendarStateSchema,
  sourceVersion: z.string().min(1).max(120),
  importedAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).strict();
export type BusinessCalendar = z.infer<typeof BusinessCalendarSchema>;

export const BusinessCalendarCoverageSchema = z.object({
  from: DateSchema,
  toExclusive: DateSchema,
}).strict().superRefine((value, context) => {
  if (value.from >= value.toExclusive) {
    context.addIssue({ code: "custom", path: ["toExclusive"], message: "toExclusive must be after from" });
  }
});
export type BusinessCalendarCoverage = z.infer<typeof BusinessCalendarCoverageSchema>;

export const BusinessCalendarOverrideSchema = z.object({
  id: IdSchema,
  calendarId: IdSchema,
  date: DateSchema,
  dayClass: BusinessCalendarDayClassSchema,
  label: z.string().trim().min(1).max(240).nullable(),
  reason: z.string().trim().min(1).max(1000),
  version: VersionSchema,
  state: z.enum(["active", "archived"]),
  updatedAt: DateTimeSchema,
}).strict();
export type BusinessCalendarOverride = z.infer<typeof BusinessCalendarOverrideSchema>;

export const BusinessCalendarListQuerySchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  state: BusinessCalendarStateSchema.optional(),
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict();
export type BusinessCalendarListQuery = z.infer<typeof BusinessCalendarListQuerySchema>;
export const BusinessCalendarListResponseSchema = z.object({
  items: z.array(BusinessCalendarSchema.extend({ coverage: BusinessCalendarCoverageSchema.nullable(), contentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable() }).strict()).max(100),
  nextCursor: z.string().min(1).max(2048).nullable(),
}).strict();
export type BusinessCalendarListResponse = z.infer<typeof BusinessCalendarListResponseSchema>;

export const BusinessCalendarMutationMetaSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  expectedCalendarVersion: VersionSchema,
}).strict();
export const BusinessCalendarCreateSchema = z.object({
  operationId: OperationIdSchema,
  idempotencyKey: IdempotencyKeySchema,
  code: z.string().trim().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(1).max(240),
  timezone: z.string().trim().min(1).max(100).default("Europe/Moscow"),
}).strict();
export type BusinessCalendarCreate = z.infer<typeof BusinessCalendarCreateSchema>;
export const BusinessCalendarMutationSchema = BusinessCalendarMutationMetaSchema.extend({
  calendarId: IdSchema,
  name: z.string().trim().min(1).max(240).optional(),
}).strict().refine((value) => value.name !== undefined, { message: "At least one calendar field is required" });
export type BusinessCalendarMutation = z.infer<typeof BusinessCalendarMutationSchema>;
export const BusinessCalendarMutationBodySchema = BusinessCalendarMutationMetaSchema.extend({
  name: z.string().trim().min(1).max(240).optional(),
}).strict().refine((value) => value.name !== undefined, { message: "At least one calendar field is required" });
export type BusinessCalendarMutationBody = z.infer<typeof BusinessCalendarMutationBodySchema>;
export const BusinessCalendarImportDaySchema = z.object({
  date: DateSchema,
  dayClass: BusinessCalendarDayClassSchema,
  label: z.string().trim().min(1).max(240).nullable().default(null),
}).strict();
export type BusinessCalendarImportDay = z.infer<typeof BusinessCalendarImportDaySchema>;
export const BusinessCalendarImportSchema = BusinessCalendarMutationMetaSchema.extend({
  calendarId: IdSchema,
  sourceVersion: z.string().trim().min(1).max(120),
  coverage: BusinessCalendarCoverageSchema,
  days: z.array(BusinessCalendarImportDaySchema).min(1).max(2000),
}).strict().superRefine((value, context) => {
  const dates = new Set<string>();
  value.days.forEach((day, index) => {
    if (day.date < value.coverage.from || day.date >= value.coverage.toExclusive) {
      context.addIssue({ code: "custom", path: ["days", index, "date"], message: "Imported day is outside coverage" });
    }
    if (dates.has(day.date)) context.addIssue({ code: "custom", path: ["days", index, "date"], message: "Imported dates must be unique" });
    dates.add(day.date);
  });
});
export type BusinessCalendarImport = z.infer<typeof BusinessCalendarImportSchema>;
export const BusinessCalendarImportBodySchema = BusinessCalendarMutationMetaSchema.extend({
  sourceVersion: z.string().trim().min(1).max(120),
  coverage: BusinessCalendarCoverageSchema,
  days: z.array(BusinessCalendarImportDaySchema).min(1).max(2000),
}).strict().superRefine((value, context) => {
  const dates = new Set<string>();
  value.days.forEach((day, index) => {
    if (day.date < value.coverage.from || day.date >= value.coverage.toExclusive) {
      context.addIssue({ code: "custom", path: ["days", index, "date"], message: "Imported day is outside coverage" });
    }
    if (dates.has(day.date)) context.addIssue({ code: "custom", path: ["days", index, "date"], message: "Imported dates must be unique" });
    dates.add(day.date);
  });
});
export type BusinessCalendarImportBody = z.infer<typeof BusinessCalendarImportBodySchema>;
export const BusinessCalendarOverrideReplaceSchema = BusinessCalendarMutationMetaSchema.extend({
  calendarId: IdSchema,
  date: DateSchema,
  override: z.object({
    dayClass: BusinessCalendarDayClassSchema,
    label: z.string().trim().min(1).max(240).nullable().default(null),
    reason: z.string().trim().min(1).max(1000),
  }).strict().nullable(),
}).strict();
export type BusinessCalendarOverrideReplace = z.infer<typeof BusinessCalendarOverrideReplaceSchema>;
export const BusinessCalendarOverrideReplaceBodySchema = BusinessCalendarOverrideReplaceSchema.omit({ calendarId: true, date: true });
export type BusinessCalendarOverrideReplaceBody = z.infer<typeof BusinessCalendarOverrideReplaceBodySchema>;
export const BusinessCalendarStateTransitionSchema = BusinessCalendarMutationMetaSchema.extend({
  calendarId: IdSchema,
  targetState: z.enum(["active", "retired"]),
  reason: z.string().trim().min(1).max(1000),
}).strict();
export type BusinessCalendarStateTransition = z.infer<typeof BusinessCalendarStateTransitionSchema>;
export const BusinessCalendarStateTransitionBodySchema = BusinessCalendarStateTransitionSchema.omit({ calendarId: true });
export type BusinessCalendarStateTransitionBody = z.infer<typeof BusinessCalendarStateTransitionBodySchema>;
export const BusinessCalendarDaySchema = z.object({
  calendarId: IdSchema,
  date: DateSchema,
  dayClass: BusinessCalendarDayClassSchema,
  label: z.string().min(1).max(240).nullable(),
  source: BusinessCalendarDaySourceSchema,
  sourceVersion: z.string().min(1).max(120),
  version: VersionSchema,
}).strict();
export type BusinessCalendarDay = z.infer<typeof BusinessCalendarDaySchema>;

export const BusinessCalendarDetailSchema = BusinessCalendarSchema.extend({
  coverage: BusinessCalendarCoverageSchema.nullable(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  days: z.array(BusinessCalendarDaySchema).max(2000),
  overrides: z.array(BusinessCalendarOverrideSchema).max(2000),
}).strict();
export type BusinessCalendarDetail = z.infer<typeof BusinessCalendarDetailSchema>;
export const BusinessCalendarMutationResultSchema = z.object({ calendar: BusinessCalendarDetailSchema }).strict();
export type BusinessCalendarMutationResult = z.infer<typeof BusinessCalendarMutationResultSchema>;

