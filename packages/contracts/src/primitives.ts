import { z } from "zod";

export const IdSchema = z.string().uuid();
export type Id = z.infer<typeof IdSchema>;

export const DateTimeSchema = z.string().datetime({ offset: true });
export type DateTime = z.infer<typeof DateTimeSchema>;

export const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const CurrencySchema = z.string().regex(/^[A-Z]{3}$/, "Expected ISO 4217 currency code");

export const MoneySchema = z.object({
  amountMinor: z.number().int().safe(),
  currency: CurrencySchema,
}).strict();
export type Money = z.infer<typeof MoneySchema>;

export const NonNegativeMoneySchema = MoneySchema.extend({
  amountMinor: z.number().int().nonnegative().safe(),
}).strict();
export type NonNegativeMoney = z.infer<typeof NonNegativeMoneySchema>;

export const EntityRefSchema = z.object({ id: IdSchema, type: z.string().min(1).max(64) }).strict();
export type EntityRef = z.infer<typeof EntityRefSchema>;

export const VersionSchema = z.number().int().positive().safe();
export const VersionedSchema = z.object({ version: VersionSchema }).strict();

export const PaginationInputSchema = z.object({
  cursor: z.string().min(1).max(2048).optional(),
  limit: z.number().int().min(1).max(100).default(50),
}).strict();
export type PaginationInput = z.input<typeof PaginationInputSchema>;

export const PageInfoSchema = z.object({
  nextCursor: z.string().min(1).max(2048).nullable(),
  hasNextPage: z.boolean(),
}).strict();

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)]),
);

export const JsonScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const BoundedJsonObjectSchema = z.record(z.string().min(1).max(120), JsonScalarSchema);
export const BoundedJsonValueSchema = z.union([
  JsonScalarSchema,
  z.array(JsonScalarSchema).max(500),
  BoundedJsonObjectSchema,
  z.array(BoundedJsonObjectSchema).max(500),
  z.record(z.string().min(1).max(120), z.union([JsonScalarSchema, z.array(JsonScalarSchema).max(500)])),
]);
export type BoundedJsonValue = z.infer<typeof BoundedJsonValueSchema>;
