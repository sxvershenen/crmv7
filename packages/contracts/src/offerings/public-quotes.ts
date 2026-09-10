import { z } from "zod";
import { IdempotencyKeySchema } from "../operations.js";
import { CurrencySchema, DateSchema, DateTimeSchema, IdSchema, NonNegativeMoneySchema } from "../primitives.js";
import { OfferingQuotePeriodSchema, OfferingQuoteQuantitiesSchema } from "./quotes.js";

export const PublicOfferingQuoteRequestSchema = z.object({
  requestId: IdSchema,
  offeringId: IdSchema,
  ratePlanKey: z.string().regex(/^[a-z][a-z0-9_]*$/).max(120).nullable(),
  period: OfferingQuotePeriodSchema,
  quantities: OfferingQuoteQuantitiesSchema,
  currency: CurrencySchema,
  addOns: z.array(z.object({
    publicOptionId: IdSchema,
    quantity: z.number().int().positive().max(1_000_000),
  }).strict()).max(100),
  idempotencyKey: IdempotencyKeySchema,
}).strict();
export type PublicOfferingQuoteRequest = z.infer<typeof PublicOfferingQuoteRequestSchema>;

export const PublicOfferingQuoteSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("quoted"),
    quoteId: IdSchema,
    calculatedAt: DateTimeSchema,
    validUntil: DateTimeSchema,
    currency: CurrencySchema,
    lines: z.array(z.object({
      kind: z.enum(["base", "night", "extra_unit", "addon"]),
      label: z.string().min(1).max(500),
      serviceDate: DateSchema.nullable(),
      quantity: z.number().int().positive(),
      amount: NonNegativeMoneySchema,
      explanationCode: z.enum([
        "base",
        "weekday",
        "weekend",
        "calendar_holiday",
        "custom_date_override",
        "quantity_tier",
        "early_booking",
        "addon",
      ]),
    }).strict()).max(10_000),
    total: NonNegativeMoneySchema,
    asOf: DateTimeSchema,
  }).strict(),
  z.object({
    status: z.literal("request_required"),
    message: z.string().min(1).max(1000),
    asOf: DateTimeSchema,
  }).strict(),
  z.object({
    status: z.literal("unavailable"),
    reason: z.enum(["temporarily_unavailable", "not_sold_for_period", "capacity_unavailable", "quote_unavailable"]),
    message: z.string().min(1).max(1000),
    asOf: DateTimeSchema,
  }).strict(),
]);
export type PublicOfferingQuote = z.infer<typeof PublicOfferingQuoteSchema>;
