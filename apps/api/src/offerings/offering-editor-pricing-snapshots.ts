import { UnprocessableEntityException } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"

import { type PriceBook, type PriceWeekday } from "@crm/contracts"
import {
  BusinessCalendarDateEntity,
  BusinessCalendarDateOverrideEntity,
  BusinessCalendarEntity,
  CatalogOfferingEntity,
  EventServiceTemplateEntity,
  OfferingBindingEntity,
  PriceBookEntity,
  PriceRuleEntity,
  ProgramTemplateEntity,
  RatePlanEntity,
} from "@crm/db"
import { type HousePricingSnapshot, type HouseRatePlan, type ProgramPricingSnapshot } from "@crm/domain"

function unprocessable(code: string, message: string, details?: Record<string, unknown>): never { throw new UnprocessableEntityException({ code, message, ...(details ? { details } : {}) }) }

function range(minimum: number | null, maximum: number | null) {
  return minimum === null && maximum === null ? null : { min: minimum ?? 0, max: maximum }
}

export async function loadEventServicePricingSnapshot(manager: EntityManager, offering: CatalogOfferingEntity, book: PriceBookEntity, snapshot: HousePricingSnapshot) {
    const bindings = await manager.find(OfferingBindingEntity, { where: { offeringId: offering.id, role: "primary" } })
    const live = bindings.filter((binding) => binding.archivedAt === null && binding.eventServiceTemplateId !== null)
    if (live.length !== 1) throw unprocessable("EVENT_SERVICE_OFFERING_AMBIGUOUS", "Для event-service нужен ровно один primary EventServiceTemplate binding")
    const template = await manager.findOne(EventServiceTemplateEntity, { where: { id: live[0]!.eventServiceTemplateId! } })
    if (!template || template.archivedAt !== null) throw unprocessable("EVENT_SERVICE_TEMPLATE_MISMATCH", "Primary EventServiceTemplate недоступен")
    return {
      offering: { ...snapshot.offering, subjectVersion: offering.subjectVersion, addOnAssignmentsVersion: offering.addonAssignmentsVersion },
      template: { id: template.id, version: template.version, defaultDurationMinutes: template.defaultDurationMinutes, minimumGuests: template.minimumGuests, maximumGuests: template.maximumGuests },
      priceBook: snapshot.priceBook,
      ratePlans: snapshot.ratePlans,
      calendar: snapshot.calendar,
    }
  }

export async function loadHousePricingSnapshot(manager: EntityManager, offering: CatalogOfferingEntity, book: PriceBookEntity, from: string, toExclusive: string): Promise<HousePricingSnapshot> {
    const calendar = await manager.findOne(BusinessCalendarEntity, { where: { id: offering.businessCalendarId } })
    if (!calendar) throw unprocessable("BUSINESS_CALENDAR_GAP", "Бизнес-календарь не найден")
    const officialDates = await manager.createQueryBuilder(BusinessCalendarDateEntity, "day")
      .where("day.calendar_id = :calendarId", { calendarId: calendar.id })
      .andWhere("day.local_date >= :from AND day.local_date < :toExclusive", { from, toExclusive })
      .andWhere("day.archived_at IS NULL")
      .orderBy("day.local_date", "ASC")
      .getMany()
    const overrides = await manager.createQueryBuilder(BusinessCalendarDateOverrideEntity, "override")
      .where("override.calendar_id = :calendarId", { calendarId: calendar.id })
      .andWhere("override.local_date >= :from AND override.local_date < :toExclusive", { from, toExclusive })
      .andWhere("override.state = 'active' AND override.archived_at IS NULL")
      .getMany()
    const overrideByDate = new Map(overrides.map((item) => [item.localDate, item]))
    const plans = await manager.find(RatePlanEntity, { where: { priceBookId: book.id }, order: { sortOrder: "ASC", id: "ASC" } })
    const rules = plans.length === 0 ? [] : await manager.find(PriceRuleEntity, { where: { ratePlanId: In(plans.map((item) => item.id)) }, order: { priority: "DESC", id: "ASC" } })
    const rulesByPlan = new Map<string, PriceRuleEntity[]>()
    for (const item of rules) rulesByPlan.set(item.ratePlanId, [...(rulesByPlan.get(item.ratePlanId) ?? []), item])
    return {
      offering: {
        id: offering.id, version: offering.version, pricingVersion: offering.pricingVersion,
        kind: offering.kind, state: offering.state, currency: offering.currency,
        timezone: offering.timezone, businessCalendarId: offering.businessCalendarId,
        activePriceBookId: offering.activePriceBookId,
      },
      priceBook: {
        id: book.id, version: book.version, revision: book.revision, offeringId: book.offeringId,
        state: book.state, currency: book.currency, timezone: book.timezone,
        validFrom: book.validFrom, validToExclusive: book.validToExclusive,
      },
      ratePlans: plans.filter((item) => item.archivedAt === null).map((plan) => domainRatePlan(plan, rulesByPlan.get(plan.id) ?? [])),
      calendar: {
        id: calendar.id, version: calendar.version, state: calendar.state,
        timezone: calendar.timezone, sourceVersion: calendar.sourceVersion,
        dates: officialDates.map((day) => {
          const override = overrideByDate.get(day.localDate)
          return {
            date: day.localDate,
            official: { id: day.id, version: day.version, dayClass: day.officialClass as "weekday" | "weekend" | "holiday", sourceVersion: day.sourceVersion },
            activeOverride: override ? { id: override.id, version: override.version, dayClass: override.overrideClass as "weekday" | "weekend" | "holiday", reason: override.reason } : null,
          }
        }),
      },
    }
  }

export async function loadProgramPricingSnapshot(manager: EntityManager, offering: CatalogOfferingEntity, snapshot: HousePricingSnapshot): Promise<ProgramPricingSnapshot> {
    const bindings = await manager.find(OfferingBindingEntity, { where: { offeringId: offering.id, role: "primary" } })
    const live = bindings.filter((binding) => binding.archivedAt === null && binding.programTemplateId !== null)
    if (live.length !== 1) throw unprocessable("OFFERING_PRIMARY_PROGRAM_TEMPLATE_REQUIRED", "Для программы нужен ровно один primary ProgramTemplate binding")
    const template = await manager.findOne(ProgramTemplateEntity, { where: { id: live[0]!.programTemplateId! } })
    if (!template || template.archivedAt !== null) throw unprocessable("OFFERING_PRIMARY_PROGRAM_TEMPLATE_REQUIRED", "Primary ProgramTemplate недоступен")
    return { ...snapshot, offering: { ...snapshot.offering, subjectVersion: offering.subjectVersion }, template: { id: template.id, version: template.version, durationMinutes: template.durationMinutes, minimumParticipants: template.minimumParticipants, participantLimit: template.participantLimit } }
  }

export function domainRatePlan(plan: RatePlanEntity, rules: readonly PriceRuleEntity[]): HouseRatePlan {
    return {
      id: plan.id, version: plan.version, priceBookId: plan.priceBookId, key: plan.key,
      label: plan.label, pricingBasis: plan.pricingBasis,
      quantityMetric: plan.quantityMetric as HouseRatePlan["quantityMetric"],
      baseAmountMinor: plan.baseAmountMinor, includedQuantity: plan.includedQuantity,
      baseExtraUnitAmountMinor: plan.baseExtraUnitAmountMinor,
      minQuantity: plan.minimumQuantity, maxQuantity: plan.maximumQuantity,
      minDurationMinutes: plan.minimumDurationMinutes, maxDurationMinutes: plan.maximumDurationMinutes,
      isDefault: plan.isDefault, archived: plan.archivedAt !== null,
      rules: rules.map((rule) => ({
        id: rule.id, version: rule.version,
        dateSelector: rule.selector === "custom_date_override"
          ? { type: "custom_date_override", from: rule.serviceDateFrom!, toExclusive: rule.serviceDateToExclusive!, label: rule.selectorLabel! }
          : rule.selector === "recurring_weekdays"
            ? { type: "recurring_weekdays", days: parseRecurringWeekdays(rule.selectorLabel) }
          : rule.selector === "day_class"
            ? { type: "day_class", dayClass: rule.dayClass as "weekday" | "weekend" }
            : { type: rule.selector as "any_date" | "calendar_holiday" },
        quantityRange: range(rule.minimumQuantity, rule.maximumQuantity),
        bookingLeadDays: range(rule.minimumBookingLeadDays, rule.maximumBookingLeadDays),
        durationMinutes: range(rule.minimumDurationMinutes, rule.maximumDurationMinutes),
        amountMinor: rule.amountMinor, extraUnitAmountMinor: rule.extraUnitAmountMinor,
        priority: rule.priority, reason: rule.reason, enabled: rule.enabled, archived: rule.archivedAt !== null,
      })),
    }
  }

export function parseRecurringWeekdays(value: string | null): PriceWeekday[] {
    const allowed = new Set<PriceWeekday>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])
    const days = value?.split(",") ?? []
    if (days.length === 0 || days.some((day) => !allowed.has(day as PriceWeekday)) || new Set(days).size !== days.length) {
      throw unprocessable("PRICE_RULE_INVALID", "Повторяющиеся дни не настроены")
    }
    return days as PriceWeekday[]
  }

export async function loadPriceBooks(manager: EntityManager, offeringId: string): Promise<PriceBook[]> {
    const books = await manager.find(PriceBookEntity, { where: { offeringId }, order: { revision: "DESC" } })
    const result: PriceBook[] = []
    for (const book of books.filter((item) => item.archivedAt === null)) result.push(await loadPriceBook(manager, book.id))
    return result
  }

export async function loadPriceBook(manager: EntityManager, priceBookId: string): Promise<PriceBook> {
    const book = await manager.findOneByOrFail(PriceBookEntity, { id: priceBookId })
    const plans = await manager.find(RatePlanEntity, { where: { priceBookId }, order: { sortOrder: "ASC", id: "ASC" } })
    const rules = plans.length === 0 ? [] : await manager.find(PriceRuleEntity, { where: { ratePlanId: In(plans.map((item) => item.id)) }, order: { priority: "DESC", id: "ASC" } })
    const byPlan = new Map<string, PriceRuleEntity[]>()
    for (const rule of rules) byPlan.set(rule.ratePlanId, [...(byPlan.get(rule.ratePlanId) ?? []), rule])
    return {
      id: book.id, offeringId: book.offeringId, version: book.version, revision: book.revision,
      name: book.name, currency: book.currency, timezone: book.timezone,
      state: book.state as PriceBook["state"], validFrom: book.validFrom,
      validToExclusive: book.validToExclusive, changeReason: book.changeReason,
      scheduledActivationAt: book.scheduledActivationAt?.toISOString() ?? null,
      activatedAt: book.activatedAt?.toISOString() ?? null, retiredAt: book.retiredAt?.toISOString() ?? null,
      supersedesPriceBookId: book.supersedesPriceBookId,
      ratePlans: plans.filter((item) => item.archivedAt === null).map((plan) => ({
        id: plan.id, priceBookId: plan.priceBookId, version: plan.version,
        key: plan.key, label: plan.label, pricingBasis: plan.pricingBasis as PriceBook["ratePlans"][number]["pricingBasis"],
        quantityMetric: plan.quantityMetric as PriceBook["ratePlans"][number]["quantityMetric"],
        baseAmount: plan.baseAmountMinor, includedQuantity: plan.includedQuantity,
        baseExtraUnitAmount: plan.baseExtraUnitAmountMinor,
        minQuantity: plan.minimumQuantity, maxQuantity: plan.maximumQuantity,
        minDurationMinutes: plan.minimumDurationMinutes, maxDurationMinutes: plan.maximumDurationMinutes,
        isDefault: plan.isDefault, displayOrder: plan.sortOrder,
        rules: (byPlan.get(plan.id) ?? []).filter((item) => item.archivedAt === null).map((rule) => ({
          id: rule.id, ratePlanId: rule.ratePlanId, version: rule.version,
          dateSelector: rule.selector === "custom_date_override"
            ? { type: "custom_date_override" as const, from: rule.serviceDateFrom!, toExclusive: rule.serviceDateToExclusive!, label: rule.selectorLabel! }
            : rule.selector === "recurring_weekdays"
              ? { type: "recurring_weekdays" as const, days: parseRecurringWeekdays(rule.selectorLabel) }
            : rule.selector === "day_class"
              ? { type: "day_class" as const, dayClass: rule.dayClass as "weekday" | "weekend" }
              : { type: rule.selector as "any_date" | "calendar_holiday" },
          quantityRange: range(rule.minimumQuantity, rule.maximumQuantity),
          bookingLeadDays: range(rule.minimumBookingLeadDays, rule.maximumBookingLeadDays),
          durationMinutes: range(rule.minimumDurationMinutes, rule.maximumDurationMinutes),
          amount: rule.amountMinor, extraUnitAmount: rule.extraUnitAmountMinor,
          priority: rule.priority, reason: rule.reason, enabled: rule.enabled,
        })),
      })),
      createdAt: book.createdAt.toISOString(), updatedAt: book.updatedAt.toISOString(),
    }
  }
