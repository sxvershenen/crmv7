import { z } from "zod"

import { DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js"

export const FinanceSectionSchema = z.enum(["summary", "dynamics", "houses", "bath", "venues", "camping", "programs", "events", "sources"])
export const FinanceOperationViewTypeSchema = z.enum(["accrual", "payment", "refund", "adjustment"])
export const FinanceMethodViewSchema = z.enum(["card", "transfer", "cash"])
export const FinanceSortSchema = z.enum(["date", "type", "amount", "client", "relation", "method", "source", "assignee"])

export const FinanceQuerySchema = z.object({
  section: FinanceSectionSchema.default("summary"),
  date: z.string().date(),
  rangeEnd: z.string().date(),
  type: FinanceOperationViewTypeSchema.or(z.literal("all")).default("all"),
  method: FinanceMethodViewSchema.or(z.literal("all")).default("all"),
  refundsOnly: z.preprocess((value) => value === "true" ? true : value === "false" ? false : value, z.boolean()).default(false),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: FinanceSortSchema.default("date"),
  order: z.enum(["asc", "desc"]).default("desc"),
}).strict()
export type FinanceQuery = z.infer<typeof FinanceQuerySchema>

export const FinanceAssigneeSchema = z.object({ id: z.string().min(1), name: z.string().min(1), initials: z.string().max(10) }).strict()
export const FinanceOperationDtoSchema = z.object({
  id: z.string().min(1), bookingId: IdSchema, bookingVersion: VersionSchema,
  sourcePaymentId: IdSchema.nullable(), refundableMinor: z.number().int().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/),
  date: DateTimeSchema, type: FinanceOperationViewTypeSchema, amountMinor: z.number().int().safe(),
  clientName: z.string().min(1), relationLabel: z.string().min(1), relationHref: z.string().min(1),
  category: z.enum(["houses", "bath", "venues", "camping", "programs", "events"]),
  method: FinanceMethodViewSchema, source: z.string().min(1), assignees: z.array(FinanceAssigneeSchema),
}).strict()
export type FinanceOperationDto = z.infer<typeof FinanceOperationDtoSchema>

export const FinanceExpectedPaymentDtoSchema = z.object({
  id: IdSchema, dueAt: DateTimeSchema.nullable(), clientName: z.string().min(1), relationLabel: z.string().min(1),
  totalMinor: z.number().int().nonnegative(), paidMinor: z.number().int().nonnegative(), overdue: z.boolean(),
}).strict()
export const FinanceBreakdownDtoSchema = z.object({ id: z.string().min(1), label: z.string().min(1), accruedMinor: z.number().int(), paidMinor: z.number().int() }).strict()
export const FinanceBreakdownDetailDtoSchema = FinanceBreakdownDtoSchema.extend({
  section: z.enum(["houses", "bath", "venues", "camping", "programs", "events"]), href: z.string().min(1),
}).strict()
export const FinancePointDtoSchema = z.object({
  label: z.string().min(1), accruedMinor: z.number().int(), paidMinor: z.number().int(), refundsMinor: z.number().int(), debtMinor: z.number().int(), paymentCount: z.number().int().nonnegative(),
}).strict()
export const FinanceSummaryDtoSchema = z.object({
  accruedMinor: z.number().int(), paidMinor: z.number().int(), debtMinor: z.number().int(), refundsMinor: z.number().int(), averageMinor: z.number().int(), expectedMinor: z.number().int(), overdueMinor: z.number().int(),
}).strict()
export const FinanceDatasetDtoSchema = z.object({
  operations: z.array(FinanceOperationDtoSchema),
  expected: z.array(FinanceExpectedPaymentDtoSchema),
  breakdown: z.array(FinanceBreakdownDtoSchema),
  breakdownDetails: z.array(FinanceBreakdownDetailDtoSchema),
  sourceBreakdown: z.array(FinanceBreakdownDtoSchema),
  points: z.array(FinancePointDtoSchema),
  pagination: z.object({ page: z.number().int().positive(), pageSize: z.number().int().positive(), total: z.number().int().nonnegative(), totalPages: z.number().int().positive(), from: z.number().int().nonnegative(), to: z.number().int().nonnegative() }).strict(),
  summary: FinanceSummaryDtoSchema,
}).strict()
export type FinanceDatasetDto = z.infer<typeof FinanceDatasetDtoSchema>
