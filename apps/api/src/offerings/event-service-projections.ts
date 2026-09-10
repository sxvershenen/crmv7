import { UnprocessableEntityException } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"

import { type PriceWeekday } from "@crm/contracts"
import {
  BusinessCalendarDateEntity,
  BusinessCalendarDateOverrideEntity,
  BusinessCalendarEntity,
  CatalogOfferingEntity,
  EventServiceTemplateEntity,
  PriceBookEntity,
  PriceRuleEntity,
  RatePlanEntity,
} from "@crm/db"
import { type EventServicePricingSnapshot, type HousePriceRule } from "@crm/domain"

function unprocessable(code: string, message: string, details?: Record<string, unknown>): never { throw new UnprocessableEntityException({ code, message, ...(details ? { details } : {}) }) }

function range(min: number | null, max: number | null) { return min === null && max === null ? null : { min: min ?? 0, max } }

export function localDate(value: Date, timezone: string) { try { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value) } catch { throw unprocessable("PRICING_TIMEZONE_MISMATCH", "Часовой пояс предложения некорректен") } }

export function eventOfferingDto(offering: CatalogOfferingEntity) {
    return { id: offering.id, code: offering.code, version: offering.version, kind: "event_service" as const, operationalName: offering.operationalName, internalComment: offering.internalComment, state: offering.state as "draft" | "active" | "paused" | "archived", activePriceBookId: offering.activePriceBookId, archivedAt: offering.archivedAt?.toISOString() ?? null, createdAt: offering.createdAt.toISOString(), updatedAt: offering.updatedAt.toISOString(), salesMode: offering.salesMode as "request_only" | "quoted" | "selectable", priceDisplayMode: offering.priceDisplayMode as "exact" | "from" | "request", currency: offering.currency, timezone: offering.timezone, taxMode: offering.taxMode as "tax_included" | "tax_excluded" | "not_taxable", businessCalendarId: offering.businessCalendarId, fulfillment: { kind: "event_service" as const } }
  }

export function eventTemplateDto(template: EventServiceTemplateEntity) {
    return { id: template.id, version: template.version, code: template.code, format: template.format as "wedding" | "corporate" | "birthday" | "other", icon: template.icon as "heart" | "building" | "cake" | "bus", tone: template.tone as "rose" | "violet" | "amber" | "sky", defaultDurationMinutes: template.defaultDurationMinutes, minimumGuests: template.minimumGuests, maximumGuests: template.maximumGuests, preparationBeforeMinutes: template.preparationBeforeMinutes, preparationAfterMinutes: template.preparationAfterMinutes, archivedAt: template.archivedAt?.toISOString() ?? null, createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString() }
  }

export function eventSummary(offering: CatalogOfferingEntity, template: EventServiceTemplateEntity, cmsReady = true, editorialNodeId: string | null = null) {
    return { offeringId: offering.id, operationalName: offering.operationalName, offeringVersion: offering.version, state: offering.state as "draft" | "active" | "paused" | "archived", subjectVersion: offering.subjectVersion, pricingVersion: offering.pricingVersion, addOnAssignmentsVersion: offering.addonAssignmentsVersion, eventServiceTemplateId: template.id, eventServiceTemplateVersion: template.version, cmsReady, publicReady: false as const, editorialNodeId }
  }

export function eventLookupItem(offering: CatalogOfferingEntity, template: EventServiceTemplateEntity, cmsReady = true, editorialNodeId: string | null = null) {
    return { ...eventSummary(offering, template, cmsReady, editorialNodeId), code: offering.code, operationalName: offering.operationalName }
  }

export async function eventLoadSnapshot(manager: EntityManager, offering: CatalogOfferingEntity, template: EventServiceTemplateEntity, book: PriceBookEntity, serviceDate: string): Promise<EventServicePricingSnapshot> {
    const calendar = await manager.findOne(BusinessCalendarEntity, { where: { id: offering.businessCalendarId } })
    if (!calendar) throw unprocessable("CALENDAR_NOT_ACTIVE", "Календарь мероприятия не найден")
    const days = await manager.find(BusinessCalendarDateEntity, { where: { calendarId: calendar.id, localDate: serviceDate } })
    const overrides = await manager.find(BusinessCalendarDateOverrideEntity, { where: { calendarId: calendar.id, localDate: serviceDate, state: "active" } })
    const plans = await manager.find(RatePlanEntity, { where: { priceBookId: book.id }, order: { sortOrder: "ASC", id: "ASC" } })
    const rules = plans.length ? await manager.find(PriceRuleEntity, { where: { ratePlanId: In(plans.map((plan) => plan.id)) }, order: { priority: "DESC", id: "ASC" } }) : []
    const byPlan = new Map<string, PriceRuleEntity[]>()
    for (const rule of rules) byPlan.set(rule.ratePlanId, [...(byPlan.get(rule.ratePlanId) ?? []), rule])
    return {
      offering: { id: offering.id, version: offering.version, subjectVersion: offering.subjectVersion, pricingVersion: offering.pricingVersion, addOnAssignmentsVersion: offering.addonAssignmentsVersion, kind: offering.kind, state: offering.state, currency: offering.currency, timezone: offering.timezone, businessCalendarId: offering.businessCalendarId, activePriceBookId: offering.activePriceBookId },
      template: { id: template.id, version: template.version, defaultDurationMinutes: template.defaultDurationMinutes, minimumGuests: template.minimumGuests, maximumGuests: template.maximumGuests, preparationBeforeMinutes: template.preparationBeforeMinutes, preparationAfterMinutes: template.preparationAfterMinutes },
      priceBook: { id: book.id, version: book.version, revision: book.revision, offeringId: book.offeringId, state: book.state, currency: book.currency, timezone: book.timezone, validFrom: book.validFrom, validToExclusive: book.validToExclusive },
      ratePlans: plans.filter((plan) => plan.archivedAt === null).map((plan) => ({ id: plan.id, version: plan.version, priceBookId: plan.priceBookId, key: plan.key, label: plan.label, pricingBasis: plan.pricingBasis, quantityMetric: plan.quantityMetric as "guests" | "participants" | "units" | null, baseAmountMinor: plan.baseAmountMinor, includedQuantity: plan.includedQuantity, baseExtraUnitAmountMinor: plan.baseExtraUnitAmountMinor, minQuantity: plan.minimumQuantity, maxQuantity: plan.maximumQuantity, minDurationMinutes: plan.minimumDurationMinutes, maxDurationMinutes: plan.maximumDurationMinutes, isDefault: plan.isDefault, archived: false, rules: (byPlan.get(plan.id) ?? []).map((rule) => eventRule(rule)) })),
      calendar: { id: calendar.id, version: calendar.version, state: calendar.state, timezone: calendar.timezone, sourceVersion: calendar.sourceVersion, dates: days.filter((day) => day.archivedAt === null).map((day) => ({ date: day.localDate, official: { id: day.id, version: day.version, dayClass: day.officialClass as "weekday" | "weekend" | "holiday", sourceVersion: day.sourceVersion }, activeOverride: overrides.find((override) => override.archivedAt === null)?.id ? { id: overrides.find((override) => override.archivedAt === null)!.id, version: overrides.find((override) => override.archivedAt === null)!.version, dayClass: overrides.find((override) => override.archivedAt === null)!.overrideClass as "weekday" | "weekend" | "holiday", reason: overrides.find((override) => override.archivedAt === null)!.reason } : null })) },
    }
  }

export function eventRule(rule: PriceRuleEntity): HousePriceRule {
    return { id: rule.id, version: rule.version, dateSelector: rule.selector === "custom_date_override" ? { type: "custom_date_override", from: rule.serviceDateFrom!, toExclusive: rule.serviceDateToExclusive!, label: rule.selectorLabel! } : rule.selector === "recurring_weekdays" ? { type: "recurring_weekdays", days: eventWeekdays(rule.selectorLabel) } : rule.selector === "day_class" ? { type: "day_class", dayClass: rule.dayClass as "weekday" | "weekend" } : { type: rule.selector as "any_date" | "calendar_holiday" }, quantityRange: range(rule.minimumQuantity, rule.maximumQuantity), bookingLeadDays: range(rule.minimumBookingLeadDays, rule.maximumBookingLeadDays), durationMinutes: range(rule.minimumDurationMinutes, rule.maximumDurationMinutes), amountMinor: rule.amountMinor, extraUnitAmountMinor: rule.extraUnitAmountMinor, priority: rule.priority, reason: rule.reason, enabled: rule.enabled, archived: rule.archivedAt !== null }
  }

export function eventWeekdays(value: string | null): PriceWeekday[] { const allowed = new Set<PriceWeekday>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]); const days = value?.split(",") ?? []; if (!days.length || days.some((day) => !allowed.has(day as PriceWeekday))) throw unprocessable("PRICE_RULE_INVALID", "Повторяющиеся дни не настроены"); return days as PriceWeekday[] }
