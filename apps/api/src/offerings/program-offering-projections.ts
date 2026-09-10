import { UnprocessableEntityException } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"

import { type PriceWeekday, type ProgramOfferingLookupItem } from "@crm/contracts"
import {
  BusinessCalendarDateEntity,
  BusinessCalendarDateOverrideEntity,
  BusinessCalendarEntity,
  CatalogOfferingEntity,
  CmsNodeEntity,
  CmsSourceLinkEntity,
  PriceBookEntity,
  PriceRuleEntity,
  ProgramTemplateEntity,
  RatePlanEntity,
} from "@crm/db"
import { type HousePriceRule, type HousePricingSnapshot, type ProgramPricingSnapshot } from "@crm/domain"

function unprocessable(code: string, message: string, details?: Record<string, unknown>): never { throw new UnprocessableEntityException({ code, message, ...(details ? { details } : {}) }) }

function range(min: number | null, max: number | null) { return min === null && max === null ? null : { min: min ?? 0, max } }

export async function programLoadAddOnSnapshot(manager: EntityManager, offering: CatalogOfferingEntity, book: PriceBookEntity, serviceDate: string): Promise<HousePricingSnapshot> {
    const calendar = await manager.findOne(BusinessCalendarEntity, { where: { id: offering.businessCalendarId } })
    if (!calendar) throw unprocessable("CALENDAR_NOT_ACTIVE", "Календарь дополнительной услуги недоступен")
    const days = (await manager.find(BusinessCalendarDateEntity, { where: { calendarId: calendar.id, localDate: serviceDate } })).filter((day) => day.archivedAt === null)
    const overrides = (await manager.find(BusinessCalendarDateOverrideEntity, { where: { calendarId: calendar.id, localDate: serviceDate, state: "active" } })).filter((item) => item.archivedAt === null)
    const plans = await manager.find(RatePlanEntity, { where: { priceBookId: book.id }, order: { sortOrder: "ASC", id: "ASC" } })
    const rules = plans.length ? await manager.find(PriceRuleEntity, { where: { ratePlanId: In(plans.map((plan) => plan.id)) }, order: { priority: "DESC", id: "ASC" } }) : []
    const byPlan = new Map<string, PriceRuleEntity[]>()
    for (const rule of rules) byPlan.set(rule.ratePlanId, [...(byPlan.get(rule.ratePlanId) ?? []), rule])
    return {
      offering: { id: offering.id, version: offering.version, pricingVersion: offering.pricingVersion, kind: offering.kind, state: offering.state, currency: offering.currency, timezone: offering.timezone, businessCalendarId: offering.businessCalendarId, activePriceBookId: offering.activePriceBookId },
      priceBook: { id: book.id, version: book.version, revision: book.revision, offeringId: book.offeringId, state: book.state, currency: book.currency, timezone: book.timezone, validFrom: book.validFrom, validToExclusive: book.validToExclusive },
      ratePlans: plans.filter((plan) => plan.archivedAt === null).map((plan) => ({ id: plan.id, version: plan.version, priceBookId: plan.priceBookId, key: plan.key, label: plan.label, pricingBasis: plan.pricingBasis, quantityMetric: plan.quantityMetric as "guests" | "participants" | "units" | null, baseAmountMinor: plan.baseAmountMinor, includedQuantity: plan.includedQuantity, baseExtraUnitAmountMinor: plan.baseExtraUnitAmountMinor, minQuantity: plan.minimumQuantity, maxQuantity: plan.maximumQuantity, minDurationMinutes: plan.minimumDurationMinutes, maxDurationMinutes: plan.maximumDurationMinutes, isDefault: plan.isDefault, archived: false, rules: (byPlan.get(plan.id) ?? []).map((rule) => programRule(rule)) })),
      calendar: { id: calendar.id, version: calendar.version, state: calendar.state, timezone: calendar.timezone, sourceVersion: calendar.sourceVersion, dates: days.map((day) => ({ date: day.localDate, official: { id: day.id, version: day.version, dayClass: day.officialClass as "weekday" | "weekend" | "holiday", sourceVersion: day.sourceVersion }, activeOverride: overrides[0] ? { id: overrides[0].id, version: overrides[0].version, dayClass: overrides[0].overrideClass as "weekday" | "weekend" | "holiday", reason: overrides[0].reason } : null })) },
    }
  }

export async function programLookupItem(manager: EntityManager, offering: CatalogOfferingEntity, template: ProgramTemplateEntity): Promise<ProgramOfferingLookupItem> {
    const link = await manager.findOne(CmsSourceLinkEntity, { where: { sourceKind: "catalog_offering", sourceId: offering.id } })
    const node = link ? await manager.findOne(CmsNodeEntity, { where: { id: link.nodeId } }) : null
    return {
      offeringId: offering.id,
      offeringVersion: offering.version,
      subjectVersion: offering.subjectVersion,
      pricingVersion: offering.pricingVersion,
      addOnAssignmentsVersion: offering.addonAssignmentsVersion,
      programTemplateId: template.id,
      programTemplateVersion: template.version,
      state: offering.state as ProgramOfferingLookupItem["state"],
      cmsReady: Boolean(link && node?.kind === "program_detail" && node.status === "active" && node.archivedAt === null),
      publicReady: false,
      editorialNodeId: link?.nodeId ?? null,
    }
  }

export async function programLoadSnapshot(manager: EntityManager, offering: CatalogOfferingEntity, template: ProgramTemplateEntity, book: PriceBookEntity, serviceDate: string): Promise<ProgramPricingSnapshot> {
    const calendar = await manager.findOne(BusinessCalendarEntity, { where: { id: offering.businessCalendarId } })
    if (!calendar) throw unprocessable("CALENDAR_NOT_ACTIVE", "Бизнес-календарь программы не найден")
    const days = await manager.find(BusinessCalendarDateEntity, { where: { calendarId: calendar.id, localDate: serviceDate } })
    const liveDays = days.filter((day) => day.archivedAt === null)
    const overrides = await manager.find(BusinessCalendarDateOverrideEntity, { where: { calendarId: calendar.id, localDate: serviceDate, state: "active" } })
    const liveOverrides = overrides.filter((override) => override.archivedAt === null)
    const plans = await manager.find(RatePlanEntity, { where: { priceBookId: book.id }, order: { sortOrder: "ASC", id: "ASC" } })
    const rules = plans.length ? await manager.find(PriceRuleEntity, { where: { ratePlanId: In(plans.map((plan) => plan.id)) }, order: { priority: "DESC", id: "ASC" } }) : []
    const byPlan = new Map<string, PriceRuleEntity[]>()
    for (const rule of rules) byPlan.set(rule.ratePlanId, [...(byPlan.get(rule.ratePlanId) ?? []), rule])
    return {
      offering: { id: offering.id, version: offering.version, subjectVersion: offering.subjectVersion, pricingVersion: offering.pricingVersion, kind: offering.kind, state: offering.state, currency: offering.currency, timezone: offering.timezone, businessCalendarId: offering.businessCalendarId, activePriceBookId: offering.activePriceBookId },
      template: { id: template.id, version: template.version, durationMinutes: template.durationMinutes, minimumParticipants: template.minimumParticipants, participantLimit: template.participantLimit },
      priceBook: { id: book.id, version: book.version, revision: book.revision, offeringId: book.offeringId, state: book.state, currency: book.currency, timezone: book.timezone, validFrom: book.validFrom, validToExclusive: book.validToExclusive },
      ratePlans: plans.filter((plan) => plan.archivedAt === null).map((plan) => ({ id: plan.id, version: plan.version, priceBookId: plan.priceBookId, key: plan.key, label: plan.label, pricingBasis: plan.pricingBasis, quantityMetric: plan.quantityMetric as "guests" | "participants" | "units" | null, baseAmountMinor: plan.baseAmountMinor, includedQuantity: plan.includedQuantity, baseExtraUnitAmountMinor: plan.baseExtraUnitAmountMinor, minQuantity: plan.minimumQuantity, maxQuantity: plan.maximumQuantity, minDurationMinutes: plan.minimumDurationMinutes, maxDurationMinutes: plan.maximumDurationMinutes, isDefault: plan.isDefault, archived: plan.archivedAt !== null, rules: (byPlan.get(plan.id) ?? []).map((rule) => programRule(rule)) })),
      calendar: { id: calendar.id, version: calendar.version, state: calendar.state, timezone: calendar.timezone, sourceVersion: calendar.sourceVersion, dates: liveDays.map((day) => ({ date: day.localDate, official: { id: day.id, version: day.version, dayClass: day.officialClass as "weekday" | "weekend" | "holiday", sourceVersion: day.sourceVersion }, activeOverride: liveOverrides[0] ? { id: liveOverrides[0].id, version: liveOverrides[0].version, dayClass: liveOverrides[0].overrideClass as "weekday" | "weekend" | "holiday", reason: liveOverrides[0].reason } : null })) },
    }
  }

export function programRule(rule: PriceRuleEntity): HousePriceRule {
    return { id: rule.id, version: rule.version, dateSelector: rule.selector === "custom_date_override" ? { type: "custom_date_override", from: rule.serviceDateFrom!, toExclusive: rule.serviceDateToExclusive!, label: rule.selectorLabel! } : rule.selector === "recurring_weekdays" ? { type: "recurring_weekdays", days: programWeekdays(rule.selectorLabel) } : rule.selector === "day_class" ? { type: "day_class", dayClass: rule.dayClass as "weekday" | "weekend" } : { type: rule.selector as "any_date" | "calendar_holiday" }, quantityRange: range(rule.minimumQuantity, rule.maximumQuantity), bookingLeadDays: range(rule.minimumBookingLeadDays, rule.maximumBookingLeadDays), durationMinutes: range(rule.minimumDurationMinutes, rule.maximumDurationMinutes), amountMinor: rule.amountMinor, extraUnitAmountMinor: rule.extraUnitAmountMinor, priority: rule.priority, reason: rule.reason, enabled: rule.enabled, archived: rule.archivedAt !== null }
  }

export function programWeekdays(value: string | null): PriceWeekday[] { const allowed = new Set<PriceWeekday>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]); const days = value?.split(",") ?? []; if (!days.length || days.some((day) => !allowed.has(day as PriceWeekday))) throw unprocessable("PRICE_RULE_INVALID", "Повторяющиеся дни не настроены"); return days as PriceWeekday[] }
