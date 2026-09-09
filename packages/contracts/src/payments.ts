import { z } from "zod";
import { DateTimeSchema, IdSchema, NonNegativeMoneySchema, VersionSchema } from "./primitives.js";
import { IdempotentOperationSchema } from "./operations.js";

export const PaymentTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("booking"), id: IdSchema }).strict(),
  z.object({ type: z.literal("event"), id: IdSchema }).strict(),
  z.object({ type: z.literal("program_registration"), id: IdSchema }).strict(),
]);
export type PaymentTarget = z.infer<typeof PaymentTargetSchema>;

export const PaymentOperationTypeSchema = z.enum(["charge", "refund", "adjustment"]);
export type PaymentOperationType = z.infer<typeof PaymentOperationTypeSchema>;
export const PaymentMethodSchema = z.enum(["cash", "card", "bank_transfer", "online", "other"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export const PaymentOperationSchema = IdempotentOperationSchema.extend({
  target: PaymentTargetSchema, type: PaymentOperationTypeSchema, amount: NonNegativeMoneySchema,
  method: PaymentMethodSchema, reason: z.string().trim().max(1000).nullable().default(null),
  sourcePaymentId: IdSchema.nullable().default(null),
}).strict().superRefine((operation, context) => {
  if (operation.amount.amountMinor <= 0) {
    context.addIssue({ code: "custom", path: ["amount", "amountMinor"], message: "Сумма должна быть больше нуля" });
  }
  if (operation.type === "refund" && operation.sourcePaymentId === null) {
    context.addIssue({ code: "custom", path: ["sourcePaymentId"], message: "Для возврата нужна исходная оплата" });
  }
  if (operation.type !== "refund" && operation.sourcePaymentId !== null) {
    context.addIssue({ code: "custom", path: ["sourcePaymentId"], message: "Исходная оплата допустима только для возврата" });
  }
});
export type PaymentOperation = z.infer<typeof PaymentOperationSchema>;
export const PaymentSchema = z.object({
  id: IdSchema, target: PaymentTargetSchema, operationId: IdSchema, type: PaymentOperationTypeSchema,
  amount: NonNegativeMoneySchema, method: PaymentMethodSchema, reason: z.string().nullable(),
  sourcePaymentId: IdSchema.nullable(), createdAt: DateTimeSchema, createdBy: IdSchema, immutable: z.literal(true), version: VersionSchema,
}).strict();
export type Payment = z.infer<typeof PaymentSchema>;
export const PaymentSummarySchema = z.object({
  target: PaymentTargetSchema,
  currency: z.string().regex(/^[A-Z]{3}$/), totalDue: NonNegativeMoneySchema,
  charged: NonNegativeMoneySchema, refunded: NonNegativeMoneySchema, balance: z.number().int().safe(),
  state: z.enum(["unpaid", "partial", "paid", "overpaid", "refund", "debt"]),
}).strict();
export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;

export const PaymentDtoSchema = PaymentSchema;
export type PaymentDto = Payment;
export const PaymentListQuerySchema = z.object({
  target: PaymentTargetSchema, limit: z.coerce.number().int().min(1).max(100).default(100), cursor: z.string().min(1).max(2048).optional(),
}).strict();
export type PaymentListQuery = z.infer<typeof PaymentListQuerySchema>;
export const PaymentSummaryQuerySchema = z.object({ target: PaymentTargetSchema }).strict();
export type PaymentSummaryQuery = z.infer<typeof PaymentSummaryQuerySchema>;
export const PaymentListResponseSchema = z.object({ items: z.array(PaymentDtoSchema), nextCursor: z.string().nullable() }).strict();
export type PaymentListResponse = z.infer<typeof PaymentListResponseSchema>;
export const PaymentSummaryResponseSchema = PaymentSummarySchema;
