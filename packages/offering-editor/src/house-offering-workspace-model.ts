import type { InternalOfferingEditor, PricingBasis, RatePlanDraft } from "@crm/contracts"

import type { OfferingEditorAddOnsCommandMetaFactory } from "./house-addon-editor.js"
import type { OfferingEditorSubjectCommandMetaFactory } from "./house-binding-editor.js"
import type { OfferingEditorCommandMetaFactory, OfferingEditorGateway } from "./gateway.js"
import type { DraftPriceBookForm } from "./price-book-draft.js"

export type HouseOfferingWorkspaceTab = "overview" | "composition" | "pricing"
export type CampgroundOfferingWorkspaceTab = HouseOfferingWorkspaceTab

export type HouseOfferingWorkspaceProps = {
  createCommandMeta: OfferingEditorCommandMetaFactory
  createSubjectCommandMeta: OfferingEditorSubjectCommandMetaFactory
  createAddOnsCommandMeta: OfferingEditorAddOnsCommandMetaFactory
  gateway: OfferingEditorGateway
  initialTab?: HouseOfferingWorkspaceTab
  editorialHref?: (nodeId: string) => string | null
  offeringId: string
  onBack?: () => void
  onEditorChange?: (editor: InternalOfferingEditor) => void
  onOpenEditorial?: (nodeId: string) => void
  onNavigationGuardChange?: (guard: (() => boolean) | null) => void
  onTabChange?: (tab: HouseOfferingWorkspaceTab) => void
  layout?: "standalone" | "embedded"
}

export type CampgroundOfferingWorkspaceProps = Omit<HouseOfferingWorkspaceProps, "gateway"> & {
  gateway: OfferingEditorGateway
}

export type SaveState = "dirty" | "saving" | "saved" | "conflict"
export type AddOnPricingConstraint = { basis: "per_unit" | "per_person"; metric: "units" | "participants" }

export function constrainAddOnPricingForm(form: DraftPriceBookForm, constraint: AddOnPricingConstraint | null): DraftPriceBookForm {
  if (!constraint) return form
  return { ...form, ratePlans: form.ratePlans.map((plan) => constrainAddOnRatePlan(plan, constraint)) }
}

export function constrainAddOnRatePlan(plan: RatePlanDraft, constraint: AddOnPricingConstraint | null): RatePlanDraft {
  if (!constraint) return plan
  return { ...plan, pricingBasis: constraint.basis, quantityMetric: constraint.metric, includedQuantity: null, baseExtraUnitAmount: null, minQuantity: null, maxQuantity: null }
}

export const pricingBasisOptions = [
  { label: "За ночь", value: "per_night" },
  { label: "За день", value: "per_day" },
  { label: "За слот", value: "per_slot" },
  { label: "За час", value: "per_hour" },
  { label: "За человека", value: "per_person" },
  { label: "За единицу", value: "per_unit" },
  { label: "Фиксированный пакет", value: "flat_package" },
]

export const metricOptions = [
  { label: "Не применяется", value: "none" },
  { label: "Гости", value: "guests" },
  { label: "Участники", value: "participants" },
  { label: "Единицы", value: "units" },
]

export const priceBookTone = { active: "success", draft: "warning", retired: "neutral", scheduled: "info" } as const
export const priceBookLabel = { active: "Активен", draft: "Черновик", retired: "Снят", scheduled: "Запланирован" } as const
export const salesModeLabel = { request_only: "По заявке", quoted: "По расчёту", selectable: "Можно выбрать" } as const
export const priceDisplayLabel = { exact: "Точная цена", from: "Цена от", request: "По запросу" } as const
export const taxModeLabel = { tax_included: "Налог включён", tax_excluded: "Налог сверху", not_taxable: "Без налога" } as const
export const bindingTargetLabel = { resource: "Ресурс", resource_group: "Группа ресурсов", program_template: "Шаблон программы", event_service_template: "Шаблон мероприятия" } as const
export const pricingBasisShortLabel: Record<PricingBasis, string> = {
  flat_package: "пакет",
  per_day: "день",
  per_hour: "час",
  per_night: "ночь",
  per_person: "человека",
  per_slot: "слот",
  per_unit: "единицу",
}
export const quantityMetricLabel = { guests: "гостя", participants: "участника", units: "единицу" } as const

export function numberOrNull(value: string) { return value.trim() === "" ? null : Number(value) }
export function numberOrZero(value: string) { const result = Number(value); return Number.isFinite(result) ? result : 0 }
export function minorMoney(value: number, currency: string) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value / 100) }
export function compactDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`)) }
export function compactDateTime(value: string, timeZone: string) { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value)) }
export function priceBookSource(editor: InternalOfferingEditor) { return editor.priceBooks.find((item) => item.state === "active") ?? editor.priceBooks[0] ?? null }
export function draftPriceBook(editor: InternalOfferingEditor) { return editor.priceBooks.find((item) => item.state === "draft") ?? null }
