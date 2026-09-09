import {
  HousePriceBookDraftCreateBodySchema,
  HousePriceBookDraftReplaceBodySchema,
  type HousePriceBookDraftCreateBody,
  type HousePriceBookDraftReplaceBody,
  type PriceBook,
  type PriceRule,
  type PriceRuleDraft,
  type RatePlan,
  type RatePlanDraft,
} from "@crm/contracts"

import type { OfferingEditorCommandMeta } from "./gateway.js"

export type DraftPriceBookForm = {
  changeReason: string
  name: string
  ratePlans: RatePlanDraft[]
  validFrom: string
  validToExclusive: string
}

export class OfferingEditorValidationError extends Error {
  readonly issues: string[]

  constructor(issues: string[]) {
    super(issues.join(" "))
    this.name = "OfferingEditorValidationError"
    this.issues = issues
  }
}

function toRuleDraft(rule: PriceRule): PriceRuleDraft {
  return {
    amount: rule.amount,
    bookingLeadDays: rule.bookingLeadDays,
    dateSelector: rule.dateSelector,
    durationMinutes: rule.durationMinutes,
    enabled: rule.enabled,
    extraUnitAmount: rule.extraUnitAmount,
    id: rule.id,
    priority: rule.priority,
    quantityRange: rule.quantityRange,
    reason: rule.reason,
  }
}

export function toRatePlanDraft(ratePlan: RatePlan): RatePlanDraft {
  return {
    baseAmount: ratePlan.baseAmount,
    baseExtraUnitAmount: ratePlan.baseExtraUnitAmount,
    displayOrder: ratePlan.displayOrder,
    id: ratePlan.id,
    includedQuantity: ratePlan.includedQuantity,
    isDefault: ratePlan.isDefault,
    key: ratePlan.key,
    label: ratePlan.label,
    maxDurationMinutes: ratePlan.maxDurationMinutes,
    maxQuantity: ratePlan.maxQuantity,
    minDurationMinutes: ratePlan.minDurationMinutes,
    minQuantity: ratePlan.minQuantity,
    pricingBasis: ratePlan.pricingBasis,
    quantityMetric: ratePlan.quantityMetric,
    rules: ratePlan.rules.map(toRuleDraft),
  }
}

export function priceBookToDraftForm(priceBook: PriceBook): DraftPriceBookForm {
  return {
    changeReason: priceBook.changeReason,
    name: priceBook.name,
    ratePlans: priceBook.ratePlans.map(toRatePlanDraft),
    validFrom: priceBook.validFrom,
    validToExclusive: priceBook.validToExclusive ?? "",
  }
}

export function createEmptyRatePlan(): RatePlanDraft {
  return {
    baseAmount: 0,
    baseExtraUnitAmount: null,
    displayOrder: 0,
    includedQuantity: null,
    isDefault: true,
    key: "standard",
    label: "Стандарт",
    maxDurationMinutes: null,
    maxQuantity: null,
    minDurationMinutes: null,
    minQuantity: null,
    pricingBasis: "per_night",
    quantityMetric: null,
    rules: [],
  }
}

export function createDraftPriceBookForm(source: PriceBook | null, validFrom: string): DraftPriceBookForm {
  // A server draft is already the user's editable source of truth. Keep its
  // identity and reason byte-for-byte stable for a replace round-trip.
  if (source?.state === "draft") return priceBookToDraftForm(source)

  if (source) {
    return {
      ...priceBookToDraftForm(source),
      changeReason: "",
      name: `${source.name} — черновик`,
    }
  }

  return {
    changeReason: "",
    name: "Новый прайс-лист",
    ratePlans: [createEmptyRatePlan()],
    validFrom,
    validToExclusive: "",
  }
}

function validationError(result: { error: { issues: Array<{ message: string }> } }): OfferingEditorValidationError {
  return new OfferingEditorValidationError(result.error.issues.map((issue) => issue.message))
}

export function buildCreateDraftPriceBookBody(
  form: DraftPriceBookForm,
  meta: OfferingEditorCommandMeta,
  supersedesPriceBookId: string | null,
): HousePriceBookDraftCreateBody {
  const ratePlans = form.ratePlans.map((ratePlan) => {
    const nextPlan: RatePlanDraft = { ...ratePlan, rules: ratePlan.rules.map((rule) => {
      const nextRule: PriceRuleDraft = { ...rule }
      delete nextRule.id
      return nextRule
    }) }
    delete nextPlan.id
    return nextPlan
  })
  const result = HousePriceBookDraftCreateBodySchema.safeParse({
    ...meta,
    changeReason: form.changeReason,
    name: form.name,
    ratePlans,
    supersedesPriceBookId,
    validFrom: form.validFrom,
    validToExclusive: form.validToExclusive || null,
  })
  if (!result.success) throw validationError(result)
  return result.data
}

export function buildReplaceDraftPriceBookBody(
  form: DraftPriceBookForm,
  meta: OfferingEditorCommandMeta,
): HousePriceBookDraftReplaceBody {
  const result = HousePriceBookDraftReplaceBodySchema.safeParse({
    ...meta,
    changeReason: form.changeReason,
    name: form.name,
    ratePlans: form.ratePlans,
    validFrom: form.validFrom,
    validToExclusive: form.validToExclusive || null,
  })
  if (!result.success) throw validationError(result)
  return result.data
}
