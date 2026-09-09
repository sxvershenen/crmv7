import { z } from "zod";
import { DateSchema, DateTimeSchema, IdSchema, VersionSchema } from "./primitives.js";
import { OperationIdSchema, IdempotencyKeySchema } from "./operations.js";

export const PromoCodeSchema = z.string().trim().toUpperCase().min(2).max(40).regex(/^[A-ZА-ЯЁ0-9_-]+$/u);
export const PromotionTermsSchema = z.object({
  code: PromoCodeSchema,
  name: z.string().trim().min(1).max(160),
  active: z.boolean(),
  discountType: z.enum(["percent", "fixed"]),
  // Fixed amounts and minimum eligible subtotal are integer kopecks (RUB).
  value: z.number().int().positive().max(100_000_000),
  minimumAmountMinor: z.number().int().nonnegative().max(100_000_000),
  startsAt: DateTimeSchema.nullable(),
  endsAt: DateTimeSchema.nullable(),
  scope: z.enum(["all", "selected"]),
  resourceIds: z.array(IdSchema).max(100),
  offeringIds: z.array(IdSchema).max(100),
}).strict().superRefine((value, ctx) => {
  if (value.discountType === "percent" && value.value > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "Скидка не может превышать 100%" });
  if (value.startsAt && value.endsAt && new Date(value.startsAt) >= new Date(value.endsAt)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Окончание должно быть позже начала" });
  if (value.scope === "selected" && !value.resourceIds.length && !value.offeringIds.length) ctx.addIssue({ code: "custom", path: ["scope"], message: "Выберите ресурсы или услуги" });
  if (value.scope === "all" && (value.resourceIds.length || value.offeringIds.length)) ctx.addIssue({ code: "custom", path: ["scope"], message: "Для всех услуг список ограничений должен быть пустым" });
});
export type PromotionTerms = z.infer<typeof PromotionTermsSchema>;
export const PromotionSchema = z.object({ id: IdSchema, version: VersionSchema, terms: PromotionTermsSchema, createdAt: DateTimeSchema, updatedAt: DateTimeSchema }).strict();
export type Promotion = z.infer<typeof PromotionSchema>;
export const PromotionMutationSchema = z.object({ terms: PromotionTermsSchema, operationId: OperationIdSchema, idempotencyKey: IdempotencyKeySchema }).strict();
export const PromotionUpdateSchema = PromotionMutationSchema.extend({ expectedVersion: VersionSchema }).strict();
export type PromotionMutation = z.infer<typeof PromotionMutationSchema>;
export type PromotionUpdate = z.infer<typeof PromotionUpdateSchema>;
export const BookingPromotionSchema = z.object({ promotionId: IdSchema, version: VersionSchema, code: PromoCodeSchema, discountType: z.enum(["percent", "fixed"]), value: z.number().int().positive(), eligibleAmountMinor: z.number().int().nonnegative(), discountAmountMinor: z.number().int().nonnegative(), appliedAt: DateTimeSchema }).strict();
export type BookingPromotion = z.infer<typeof BookingPromotionSchema>;
const CalendarDateSchema = DateSchema.refine(value => { const date = new Date(`${value}T00:00:00Z`); return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value; }, { message: "Некорректная дата" });
export const MarketingPeriodSchema = z.object({ from: CalendarDateSchema, to: CalendarDateSchema }).strict().refine(value => value.from <= value.to, { message: "Некорректный период" });
export type MarketingPeriod = z.infer<typeof MarketingPeriodSchema>;
export const PromotionStatsSchema = z.object({ promotionId: IdSchema, bookings: z.number().int().nonnegative(), confirmedBookings: z.number().int().nonnegative(), discountAmountMinor: z.number().int().nonnegative(), bookingAmountMinor: z.number().int().nonnegative(), paidAmountMinor: z.number().int() }).strict();
export const PromotionListSchema = z.object({ items: z.array(PromotionSchema), canManage: z.boolean() }).strict();
export const MarketingReportSchema = z.object({
  period: MarketingPeriodSchema,
  visitorsStatus: z.literal("not_configured"),
  visitors: z.null(),
  attributionModel: z.literal("lead_snapshot"),
  promotions: z.array(PromotionStatsSchema),
  campaigns: z.array(z.object({ source: z.string(), medium: z.string(), campaign: z.string(), content: z.string(), term: z.string(), leads: z.number().int().nonnegative(), qualifiedLeads: z.number().int().nonnegative(), bookings: z.number().int().nonnegative(), paidAmountMinor: z.number().int() }).strict()),
}).strict();
export type MarketingReport = z.infer<typeof MarketingReportSchema>;
