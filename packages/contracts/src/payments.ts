import { z } from "zod";
import { DateTimeSchema, IdSchema, NonNegativeMoneySchema, VersionSchema } from "./primitives.js";
import { IdempotentOperationSchema } from "./operations.js";

export const PaymentOperationTypeSchema = z.enum(["charge", "refund", "adjustment"]);
export type PaymentOperationType = z.infer<typeof PaymentOperationTypeSchema>;
export const PaymentMethodSchema = z.enum(["cash", "card", "bank_transfer", "online", "other"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export const PaymentOperationSchema = IdempotentOperationSchema.extend({
  bookingId: IdSchema, type: PaymentOperationTypeSchema, amount: NonNegativeMoneySchema,
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
  id: IdSchema, bookingId: IdSchema, operationId: IdSchema, type: PaymentOperationTypeSchema,
  amount: NonNegativeMoneySchema, method: PaymentMethodSchema, reason: z.string().nullable(),
  sourcePaymentId: IdSchema.nullable(), createdAt: DateTimeSchema, createdBy: IdSchema, immutable: z.literal(true), version: VersionSchema,
}).strict();
export type Payment = z.infer<typeof PaymentSchema>;
export const PaymentSummarySchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/), totalDue: NonNegativeMoneySchema,
  charged: NonNegativeMoneySchema, refunded: NonNegativeMoneySchema, balance: z.number().int().safe(),
  state: z.enum(["unpaid", "partial", "paid", "overpaid", "refund", "debt"]),
}).strict();
export type PaymentSummary = z.infer<typeof PaymentSummarySchema>;

export const PaymentDtoSchema = PaymentSchema;
export type PaymentDto = Payment;
export const PaymentListQuerySchema = z.object({
  bookingId: IdSchema, limit: z.coerce.number().int().min(1).max(100).default(100), cursor: z.string().min(1).max(2048).optional(),
}).strict();
export type PaymentListQuery = z.infer<typeof PaymentListQuerySchema>;
export const PaymentListResponseSchema = z.object({ items: z.array(PaymentDtoSchema), nextCursor: z.string().nullable() }).strict();
export type PaymentListResponse = z.infer<typeof PaymentListResponseSchema>;
export const PaymentSummaryResponseSchema = PaymentSummarySchema;
