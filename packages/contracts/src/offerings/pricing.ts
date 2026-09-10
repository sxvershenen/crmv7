import { z } from "zod";
import { CurrencySchema, DateSchema, DateTimeSchema, IdSchema, VersionSchema } from "../primitives.js";
import { OfferingPricingMutationMetaSchema } from "./catalog.js";

const NonNegativeMinorAmountSchema = z.number().int().nonnegative().safe();

export const PriceBookStateSchema = z.enum(["draft", "scheduled", "active", "retired"]);
export type PriceBookState = z.infer<typeof PriceBookStateSchema>;
export const PricingBasisSchema = z.enum([
  "per_night",
  "per_day",
  "per_slot",
  "per_hour",
  "per_person",
  "per_unit",
  "flat_package",
]);
export type PricingBasis = z.infer<typeof PricingBasisSchema>;
export const PriceQuantityMetricSchema = z.enum(["guests", "participants", "units"]);
export type PriceQuantityMetric = z.infer<typeof PriceQuantityMetricSchema>;
export const PriceWeekdaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
export type PriceWeekday = z.infer<typeof PriceWeekdaySchema>;

export const PriceDateSelectorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("any_date") }).strict(),
  z.object({
    type: z.literal("day_class"),
    dayClass: z.enum(["weekday", "weekend"]),
  }).strict(),
  z.object({
    type: z.literal("recurring_weekdays"),
    days: z.array(PriceWeekdaySchema).min(1).max(7).refine((days) => new Set(days).size === days.length, { message: "Weekdays must be unique" }),
  }).strict(),
  z.object({ type: z.literal("calendar_holiday") }).strict(),
  z.object({
    type: z.literal("custom_date_override"),
    from: DateSchema,
    toExclusive: DateSchema,
    label: z.string().trim().min(1).max(240),
  }).strict(),
]);
export type PriceDateSelector = z.infer<typeof PriceDateSelectorSchema>;

export const InclusiveIntegerRangeSchema = z.object({
  min: z.number().int().nonnegative().max(1_000_000),
  max: z.number().int().nonnegative().max(1_000_000).nullable(),
}).strict().refine((value) => value.max === null || value.min <= value.max, {
  path: ["max"],
  message: "Invalid range",
});
export type InclusiveIntegerRange = z.infer<typeof InclusiveIntegerRangeSchema>;

const PriceRuleFieldsSchema = z.object({
  dateSelector: PriceDateSelectorSchema,
  quantityRange: InclusiveIntegerRangeSchema.nullable(),
  bookingLeadDays: InclusiveIntegerRangeSchema.nullable(),
  durationMinutes: InclusiveIntegerRangeSchema.nullable(),
  amount: NonNegativeMinorAmountSchema.nullable(),
  extraUnitAmount: NonNegativeMinorAmountSchema.nullable(),
  priority: z.number().int().min(0).max(10_000),
  reason: z.string().max(1000),
  enabled: z.boolean(),
}).strict();

function validatePriceRule(
  value: z.infer<typeof PriceRuleFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (
    value.dateSelector.type === "custom_date_override"
    && value.dateSelector.from >= value.dateSelector.toExclusive
  ) {
    context.addIssue({
      code: "custom",
      path: ["dateSelector", "toExclusive"],
      message: "toExclusive must be after from",
    });
  }
  if (
    value.dateSelector.type === "any_date"
    && value.quantityRange === null
    && value.bookingLeadDays === null
    && value.durationMinutes === null
  ) {
    context.addIssue({ code: "custom", path: [], message: "Base amount belongs to the rate plan" });
  }
  if (value.amount === null && value.extraUnitAmount === null) {
    context.addIssue({
      code: "custom",
      path: ["amount"],
      message: "At least one price override is required",
    });
  }
}

export const PriceRuleSchema = PriceRuleFieldsSchema.extend({
  id: IdSchema,
  ratePlanId: IdSchema,
  version: VersionSchema,
}).strict().superRefine(validatePriceRule);
export type PriceRule = z.infer<typeof PriceRuleSchema>;
export const PriceRuleDraftSchema = PriceRuleFieldsSchema.extend({
  id: IdSchema.optional(),
}).strict().superRefine(validatePriceRule);
export type PriceRuleDraft = z.infer<typeof PriceRuleDraftSchema>;

const RatePlanFieldsSchema = z.object({
  key: z.string().min(1).max(120).regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(1).max(240),
  pricingBasis: PricingBasisSchema,
  quantityMetric: PriceQuantityMetricSchema.nullable(),
  baseAmount: NonNegativeMinorAmountSchema,
  includedQuantity: z.number().int().nonnegative().max(1_000_000).nullable(),
  baseExtraUnitAmount: NonNegativeMinorAmountSchema.nullable(),
  minQuantity: z.number().int().positive().max(1_000_000).nullable(),
  maxQuantity: z.number().int().positive().max(1_000_000).nullable(),
  minDurationMinutes: z.number().int().positive().max(525_600).nullable(),
  maxDurationMinutes: z.number().int().positive().max(525_600).nullable(),
  isDefault: z.boolean(),
  displayOrder: z.number().int().min(-100_000).max(100_000),
}).strict();

function validateRatePlan(
  value: z.infer<typeof RatePlanFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (value.minQuantity !== null && value.maxQuantity !== null && value.minQuantity > value.maxQuantity) {
    context.addIssue({ code: "custom", path: ["maxQuantity"], message: "Invalid quantity range" });
  }
  if (
    value.minDurationMinutes !== null
    && value.maxDurationMinutes !== null
    && value.minDurationMinutes > value.maxDurationMinutes
  ) {
    context.addIssue({ code: "custom", path: ["maxDurationMinutes"], message: "Invalid duration range" });
  }
  if ((value.includedQuantity !== null || value.baseExtraUnitAmount !== null) && value.quantityMetric === null) {
    context.addIssue({
      code: "custom",
      path: ["quantityMetric"],
      message: "A quantity metric is required for included or extra-unit pricing",
    });
  }
}

export const RatePlanSchema = RatePlanFieldsSchema.extend({
  id: IdSchema,
  priceBookId: IdSchema,
  version: VersionSchema,
  rules: z.array(PriceRuleSchema).max(10_000),
}).strict().superRefine(validateRatePlan);
export type RatePlan = z.infer<typeof RatePlanSchema>;
export const RatePlanDraftSchema = RatePlanFieldsSchema.extend({
  id: IdSchema.optional(),
  rules: z.array(PriceRuleDraftSchema).max(10_000).default([]),
}).strict().superRefine(validateRatePlan);
export type RatePlanDraft = z.infer<typeof RatePlanDraftSchema>;

/** Event-service pricing is intentionally narrower than the shared rate-plan vocabulary. */
function validateEventServiceFlatPackage(
  value: z.infer<typeof RatePlanFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (value.pricingBasis !== "flat_package") {
    context.addIssue({ code: "custom", path: ["pricingBasis"], message: "Event-service packages must use flat_package pricing" });
  }
  if (value.quantityMetric !== "guests") {
    context.addIssue({ code: "custom", path: ["quantityMetric"], message: "Event-service packages must use guests as the quantity metric" });
  }
  if (value.includedQuantity === null) {
    context.addIssue({ code: "custom", path: ["includedQuantity"], message: "Event-service packages require an included guest limit" });
  }
}

export const EventServiceRatePlanDraftSchema = RatePlanDraftSchema.superRefine(validateEventServiceFlatPackage);
export type EventServiceRatePlanDraft = z.infer<typeof EventServiceRatePlanDraftSchema>;
export const EventServiceRatePlanSchema = RatePlanSchema.superRefine(validateEventServiceFlatPackage);
export type EventServiceRatePlan = z.infer<typeof EventServiceRatePlanSchema>;

const PriceBookFieldsSchema = z.object({
  name: z.string().trim().min(1).max(240),
  currency: CurrencySchema,
  timezone: z.string().trim().min(1).max(100),
  validFrom: DateSchema,
  validToExclusive: DateSchema.nullable(),
  changeReason: z.string().max(1000),
}).strict();

function validatePriceBook(
  value: z.infer<typeof PriceBookFieldsSchema>,
  context: z.RefinementCtx,
) {
  if (value.validToExclusive !== null && value.validFrom >= value.validToExclusive) {
    context.addIssue({
      code: "custom",
      path: ["validToExclusive"],
      message: "validToExclusive must be after validFrom",
    });
  }
}

export const PriceBookSchema = PriceBookFieldsSchema.extend({
  id: IdSchema,
  offeringId: IdSchema,
  version: VersionSchema,
  revision: z.number().int().positive().safe(),
  state: PriceBookStateSchema,
  scheduledActivationAt: DateTimeSchema.nullable(),
  activatedAt: DateTimeSchema.nullable(),
  retiredAt: DateTimeSchema.nullable(),
  supersedesPriceBookId: IdSchema.nullable(),
  ratePlans: z.array(RatePlanSchema).max(1000),
  createdAt: DateTimeSchema,
  updatedAt: DateTimeSchema,
}).strict().superRefine((value, context) => {
  validatePriceBook(value, context);
  if (value.state === "scheduled" && value.scheduledActivationAt === null) {
    context.addIssue({
      code: "custom",
      path: ["scheduledActivationAt"],
      message: "scheduledActivationAt is required for a scheduled price book",
    });
  }
});
export type PriceBook = z.infer<typeof PriceBookSchema>;

export const PriceBookDraftCreateSchema = OfferingPricingMutationMetaSchema.extend({
  offeringId: IdSchema,
  supersedesPriceBookId: IdSchema.nullable().default(null),
  ...PriceBookFieldsSchema.shape,
  changeReason: z.string().max(1000).default(""),
  ratePlans: z.array(RatePlanDraftSchema).max(1000).default([]),
}).strict().superRefine(validatePriceBook);
export type PriceBookDraftCreate = z.infer<typeof PriceBookDraftCreateSchema>;

/** Endpoint body: offering identity, currency and timezone come from the path/aggregate. */
export const HousePriceBookDraftCreateBodySchema = OfferingPricingMutationMetaSchema.extend({
  supersedesPriceBookId: IdSchema.nullable().default(null),
  name: z.string().trim().min(1).max(240),
  validFrom: DateSchema,
  validToExclusive: DateSchema.nullable(),
  changeReason: z.string().max(1000).default(""),
  ratePlans: z.array(RatePlanDraftSchema).max(1000).default([]),
}).strict().superRefine((value, context) => {
  if (value.validToExclusive !== null && value.validFrom >= value.validToExclusive) {
    context.addIssue({ code: "custom", path: ["validToExclusive"], message: "validToExclusive must be after validFrom" });
  }
});
export type HousePriceBookDraftCreateBody = z.infer<typeof HousePriceBookDraftCreateBodySchema>;

export const HousePriceBookDraftReplaceBodySchema = OfferingPricingMutationMetaSchema.extend({
  name: z.string().trim().min(1).max(240),
  validFrom: DateSchema,
  validToExclusive: DateSchema.nullable(),
  changeReason: z.string().max(1000),
  ratePlans: z.array(RatePlanDraftSchema).max(1000),
}).strict().superRefine((value, context) => {
  if (value.validToExclusive !== null && value.validFrom >= value.validToExclusive) {
    context.addIssue({ code: "custom", path: ["validToExclusive"], message: "validToExclusive must be after validFrom" });
  }
});
export type HousePriceBookDraftReplaceBody = z.infer<typeof HousePriceBookDraftReplaceBodySchema>;

export const PriceBookDraftMutationSchema = OfferingPricingMutationMetaSchema.extend({
  priceBookId: IdSchema,
  name: z.string().trim().min(1).max(240).optional(),
  validFrom: DateSchema.optional(),
  validToExclusive: DateSchema.nullable().optional(),
  changeReason: z.string().max(1000).optional(),
  ratePlans: z.array(RatePlanDraftSchema).max(1000).optional(),
}).strict().refine((value) => Object.keys(value).some((key) => ![
  "operationId",
  "idempotencyKey",
  "expectedPricingVersion",
  "priceBookId",
].includes(key)), { message: "At least one pricing field is required" });
export type PriceBookDraftMutation = z.infer<typeof PriceBookDraftMutationSchema>;

export const PriceBookTransitionSchema = OfferingPricingMutationMetaSchema.extend({
  priceBookId: IdSchema,
  action: z.enum(["activate", "schedule", "retire"]),
  scheduledActivationAt: DateTimeSchema.nullable().default(null),
  reason: z.string().trim().min(1).max(1000),
}).strict().superRefine((value, context) => {
  if (value.action === "schedule" && value.scheduledActivationAt === null) {
    context.addIssue({
      code: "custom",
      path: ["scheduledActivationAt"],
      message: "scheduledActivationAt is required when scheduling",
    });
  }
  if (value.action !== "schedule" && value.scheduledActivationAt !== null) {
    context.addIssue({
      code: "custom",
      path: ["scheduledActivationAt"],
      message: "scheduledActivationAt is only allowed when scheduling",
    });
  }
});
export type PriceBookTransition = z.infer<typeof PriceBookTransitionSchema>;

export const HousePriceBookActivateBodySchema = OfferingPricingMutationMetaSchema.extend({
  reason: z.string().trim().min(1).max(1000),
}).strict();
export type HousePriceBookActivateBody = z.infer<typeof HousePriceBookActivateBodySchema>;

export const HousePriceBookScheduleBodySchema = OfferingPricingMutationMetaSchema.extend({
  scheduledActivationAt: DateTimeSchema,
  reason: z.string().trim().min(1).max(1000),
}).strict();
export type HousePriceBookScheduleBody = z.infer<typeof HousePriceBookScheduleBodySchema>;

export const OfferingPricingMutationResultSchema = z.object({
  priceBook: PriceBookSchema,
  pricingVersion: VersionSchema,
}).strict();
export type OfferingPricingMutationResult = z.infer<typeof OfferingPricingMutationResultSchema>;

