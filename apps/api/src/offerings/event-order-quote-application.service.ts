import { randomUUID } from "node:crypto"

import { ConflictException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, In, IsNull, type EntityManager } from "typeorm"

import {
  EventOrderQuoteResultSchema,
  type EventOrderQuoteBody,
  type EventOrderQuoteResult,
  type SessionUser,
} from "@crm/contracts"
import {
  AddonOfferingTermsEntity,
  BusinessCalendarDateEntity,
  BusinessCalendarDateOverrideEntity,
  BusinessCalendarEntity,
  CatalogOfferingEntity,
  EventEntity,
  IdempotencyKeyEntity,
  OfferingAddonAssignmentEntity,
  OfferingQuoteSnapshotEntity,
  PriceBookEntity,
  PriceRuleEntity,
  RatePlanEntity,
  ResourceEntity,
} from "@crm/db"
import { DomainError, resolveAddOnServiceDateQuote, type HousePricingSnapshot, type PricingWeekday } from "@crm/domain"

import { EventServiceApplicationService } from "./event-service-application.service.js"
import { canonicalSha256 } from "./offering-mutation-support.js"

export type EventOrderQuoteRequestContext = Readonly<{ actor: SessionUser; requestId: string; entrySurface: "internal" | "admin" }>

@Injectable()
export class EventOrderQuoteApplicationService {
  constructor(
    @Inject(DataSource) private readonly dataSource: DataSource,
    @Inject(EventServiceApplicationService) private readonly eventService: EventServiceApplicationService,
  ) {}

  async quote(eventId: string, input: EventOrderQuoteBody, context: EventOrderQuoteRequestContext): Promise<EventOrderQuoteResult> {
    if (!context.actor.capabilities.canView) throw new UnprocessableEntityException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для расчёта мероприятия" })
    const scope = `event:${eventId}:quote`
    const requestHash = canonicalSha256({ command: "event.order.quote", eventId, actorId: context.actor.id, input })
    const earlyReplay = await this.dataSource.transaction((manager) => this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash))
    if (earlyReplay) return EventOrderQuoteResultSchema.parse(earlyReplay)
    const event = await this.dataSource.getRepository(EventEntity).findOne({ where: { id: eventId, archivedAt: IsNull() } })
    if (!event) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Мероприятие не найдено" })
    if (event.pricingMode !== "quote_required" || !event.commercialOfferingId) throw new UnprocessableEntityException({ code: "EVENT_QUOTE_REQUIRED_ONLY", message: "Для ручного мероприятия серверный расчёт недоступен" })
    if (event.version !== input.expectedEventVersion) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Мероприятие было изменено другим сотрудником", details: { entityId: event.id, serverVersion: event.version } })
    if (input.eventId !== event.id || input.ratePlanKey !== event.ratePlanKey || !sameSelections(input.addOns, event.addOnSelections) || !sameResources(input.resourceSelections, event.resourceSelections)) {
      throw new ConflictException({ code: "EVENT_QUOTE_INPUT_MISMATCH", message: "Расчёт не соответствует сохранённому составу мероприятия" })
    }
    // Selection order is a set-level client concern, while the immutable SQL
    // guard compares the request/result arrays with the persisted Event JSON.
    // Reuse the saved order after the semantic comparison so a reordered retry
    // cannot pass the service and fail at snapshot insertion.
    const snapshotInput = { ...input, addOns: event.addOnSelections, resourceSelections: event.resourceSelections }
    const base = await this.eventService.preview(event.commercialOfferingId, {
      quoteType: "event_service_preview", ratePlanKey: input.ratePlanKey, startsAt: event.startsAt.toISOString(), endsAt: event.endsAt.toISOString(), guests: event.guestCount, currency: input.currency, addOns: [], operationId: input.operationId, idempotencyKey: input.idempotencyKey,
    }, context)
    const result = await this.dataSource.transaction(async (manager) => {
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return EventOrderQuoteResultSchema.parse(replay)
      const locked = await manager.findOne(EventEntity, { where: { id: event.id, archivedAt: IsNull() }, lock: { mode: "pessimistic_write" } })
      if (!locked || locked.version !== input.expectedEventVersion) throw new ConflictException({ code: "VERSION_CONFLICT", message: "Мероприятие было изменено другим сотрудником" })
      const resources = await this.loadResources(manager, snapshotInput.resourceSelections.map((selection) => selection.resourceId))
      const resourceSelections = resources.map((resource) => ({ resourceId: resource.id, version: resource.version }))
      const addOns = await this.calculateAddOns(manager, locked, locked.commercialOfferingId!, snapshotInput, new Date(base.calculatedAt))
      const validUntil = addOns.validUntil && addOns.validUntil < base.validUntil ? addOns.validUntil : base.validUntil
      const total = { amountMinor: base.total.amountMinor + addOns.lines.reduce((sum, line) => sum + line.amount.amountMinor, 0), currency: base.currency }
      const composed = EventOrderQuoteResultSchema.parse({
        ...base, quoteId: randomUUID(), quoteType: "event_order", acceptanceReady: true, eventId: locked.id, eventVersion: locked.version,
        validUntil, inputs: { ...base.inputs, addOns: snapshotInput.addOns, resourceSelections: snapshotInput.resourceSelections }, lines: [...base.lines, ...addOns.lines], total,
        provenance: { ...base.provenance, addOns: addOns.provenance, resourceSelections }, immutableSnapshot: true,
      })
      const operationalContext = { kind: "event_order" as const, eventId: locked.id, eventVersion: locked.version, subjectVersion: composed.provenance.subjectVersion, eventServiceTemplateId: composed.eventServiceTemplateId, eventServiceTemplateVersion: composed.provenance.eventServiceTemplateVersion, offeringBindingId: composed.provenance.offeringBindingId, offeringBindingVersion: composed.provenance.offeringBindingVersion, resourcePins: resourceSelections }
      await manager.save(manager.create(OfferingQuoteSnapshotEntity, {
        id: composed.quoteId, offeringId: composed.offeringId, quoteType: "event_order", offeringVersion: composed.provenance.offeringVersion, subjectVersion: composed.provenance.subjectVersion,
        eventServiceTemplateId: composed.eventServiceTemplateId, eventServiceTemplateVersion: composed.provenance.eventServiceTemplateVersion, offeringBindingId: composed.provenance.offeringBindingId, offeringBindingVersion: composed.provenance.offeringBindingVersion,
        programTemplateId: null, programTemplateVersion: null, pricingVersion: composed.provenance.pricingVersion, addOnAssignmentsVersion: composed.provenance.addOnsVersion, priceBookId: composed.provenance.priceBookId, priceBookVersion: composed.provenance.priceBookVersion,
        businessCalendarId: composed.provenance.businessCalendarId, businessCalendarVersion: composed.provenance.businessCalendarVersion, businessCalendarSourceVersion: composed.provenance.businessCalendarSourceVersion,
        requestPayload: snapshotInput as unknown as Record<string, unknown>, resultPayload: composed as unknown as Record<string, unknown>, provenance: composed.provenance as unknown as Record<string, unknown>, calculatedAt: new Date(composed.calculatedAt), validUntil: new Date(composed.validUntil), operationId: input.operationId, idempotencyKey: input.idempotencyKey, actorId: context.actor.id, requestId: context.requestId, entrySurface: context.entrySurface, operationalContext,
      }))
      await manager.save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId: input.operationId, idempotencyKey: input.idempotencyKey, requestHash, responseStatus: 200, responseBody: composed as unknown as Record<string, unknown>, createdAt: new Date() }))
      return composed
    })
    return result
  }

  private async loadResources(manager: EntityManager, ids: readonly string[]) {
    if (new Set(ids).size !== ids.length) throw new UnprocessableEntityException({ code: "EVENT_RESOURCE_DUPLICATE", message: "Ресурс мероприятия выбран несколько раз" })
    if (ids.length === 0) return []
    const resources = await manager.createQueryBuilder(ResourceEntity, "resource").where("resource.id IN (:...ids) AND resource.archived_at IS NULL", { ids: [...ids].sort() }).orderBy("resource.id", "ASC").getMany()
    if (resources.length !== ids.length) throw new UnprocessableEntityException({ code: "EVENT_RESOURCE_UNAVAILABLE", message: "Один из ресурсов мероприятия недоступен" })
    if (resources.some((resource) => resource.capacityMode !== "fixed")) throw new UnprocessableEntityException({ code: "EVENT_RESOURCE_CAPACITY_UNSUPPORTED", message: "Ресурсы с общей вместимостью пока не поддерживаются для этого заказа" })
    return resources
  }

  private async calculateAddOns(manager: EntityManager, event: EventEntity, offeringId: string, input: EventOrderQuoteBody, now: Date) {
    const lines: EventOrderQuoteResult["lines"] = []
    const provenance: EventOrderQuoteResult["provenance"]["addOns"] = []
    let validUntil: Date | null = null
    const selectedIds = new Set<string>()
    for (const selection of input.addOns) {
      if (selectedIds.has(selection.assignmentId)) throw new UnprocessableEntityException({ code: "ADDON_ASSIGNMENT_DUPLICATED", message: "Дополнительная услуга выбрана несколько раз" })
      selectedIds.add(selection.assignmentId)
    }
    const configured = await manager.find(OfferingAddonAssignmentEntity, { where: { offeringId, archivedAt: IsNull(), enabled: true }, order: { id: "ASC" } })
    for (const assignment of configured) {
      if (assignment.required && !selectedIds.has(assignment.id)) throw new UnprocessableEntityException({ code: "ADDON_REQUIRED", message: "Обязательная дополнительная услуга не выбрана", details: { assignmentId: assignment.id } })
    }
    for (const selection of [...input.addOns].sort((left, right) => left.assignmentId.localeCompare(right.assignmentId))) {
      const assignment = await manager.createQueryBuilder(OfferingAddonAssignmentEntity, "assignment").where("assignment.id = :id AND assignment.offering_id = :offeringId AND assignment.archived_at IS NULL", { id: selection.assignmentId, offeringId }).getOne()
      if (!assignment || !assignment.enabled) throw new UnprocessableEntityException({ code: "ADDON_ASSIGNMENT_UNAVAILABLE", message: "Дополнительная услуга не подключена к категории" })
      const addOn = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").where("offering.id = :id AND offering.kind = 'addon' AND offering.archived_at IS NULL", { id: assignment.addonOfferingId }).getOne()
      if (!addOn || addOn.state !== "active" || addOn.salesMode === "request_only") throw new UnprocessableEntityException({ code: "ADDON_OFFERING_INACTIVE", message: "Дополнительная услуга недоступна" })
      const terms = await manager.findOne(AddonOfferingTermsEntity, { where: { offeringId: addOn.id } })
      if (!terms || terms.offeringKind !== "addon" || (terms.serviceType !== "quantity_service" && terms.serviceType !== "person_service") || !terms.applicableOfferingKinds.includes("event_service")) throw new UnprocessableEntityException({ code: "ADDON_NOT_APPLICABLE", message: "Дополнительная услуга не подходит категории мероприятия" })
      if (terms.serviceType === "person_service" && selection.quantity !== event.guestCount) throw new UnprocessableEntityException({ code: "ADDON_PARTICIPANT_QUANTITY_MISMATCH", message: "Количество услуги на гостя должно совпадать с числом гостей" })
      const minimum = assignment.minimumQuantity ?? terms.minimumQuantity ?? 1
      const maximum = assignment.maximumQuantity ?? terms.maximumQuantity
      const step = terms.quantityStep ?? 1
      if (selection.quantity < minimum || maximum !== null && selection.quantity > maximum || (selection.quantity - minimum) % step !== 0) throw new UnprocessableEntityException({ code: "ADDON_QUANTITY_OUT_OF_RANGE", message: "Количество дополнительной услуги вне диапазона" })
      if (addOn.currency !== input.currency || !addOn.activePriceBookId) throw new UnprocessableEntityException({ code: "ADDON_PRICE_BOOK_NOT_ACTIVE", message: "Для дополнительной услуги нет активной цены" })
      const book = await manager.findOne(PriceBookEntity, { where: { id: addOn.activePriceBookId, offeringId: addOn.id } })
      if (!book || book.archivedAt !== null || book.state !== "active") throw new UnprocessableEntityException({ code: "ADDON_PRICE_BOOK_NOT_ACTIVE", message: "Для дополнительной услуги нет активной цены" })
      const scheduled = await manager.createQueryBuilder(PriceBookEntity, "book").where("book.offering_id = :offeringId AND book.state = 'scheduled' AND book.archived_at IS NULL", { offeringId: addOn.id }).orderBy("book.scheduled_activation_at", "ASC").getOne()
      if (scheduled?.scheduledActivationAt && scheduled.scheduledActivationAt <= now) throw new ConflictException({ code: "ADDON_PRICE_BOOK_NOT_ACTIVE", message: "Запланированная цена дополнительной услуги ожидает активации; повторите расчёт после обработки расписания", details: { assignmentId: assignment.id, priceBookId: scheduled.id, scheduledActivationAt: scheduled.scheduledActivationAt.toISOString() } })
      const serviceDate = localDate(event.startsAt, addOn.timezone)
      const snapshot = await this.loadAddOnSnapshot(manager, addOn, book, serviceDate)
      let calculation
      try { calculation = resolveAddOnServiceDateQuote(snapshot, { offeringId: addOn.id, ratePlanKey: assignment.ratePlanKeyOverride, serviceDate, quantity: selection.quantity, serviceType: terms.serviceType as "quantity_service" | "person_service", currency: input.currency }, { quoteId: randomUUID(), calculatedAt: now, quoteTtlSeconds: 15 * 60, nextPricingActivationAt: scheduled?.scheduledActivationAt ?? null }) } catch (error) { if (error instanceof DomainError) throw new UnprocessableEntityException({ code: error.code, message: error.message, details: error.details }); throw error }
      let calculationValidUntil = new Date(now.getTime() + 15 * 60 * 1000)
      const localMidnight = nextLocalMidnight(now, addOn.timezone)
      if (localMidnight > now && localMidnight < calculationValidUntil) calculationValidUntil = localMidnight
      if (!validUntil || calculationValidUntil < validUntil) validUntil = calculationValidUntil
      lines.push({ kind: "addon", label: assignment.labelOverride ?? addOn.operationalName, serviceDate, quantity: calculation.quantity, unitAmount: { amountMinor: calculation.unitAmountMinor, currency: calculation.currency }, amount: { amountMinor: calculation.totalAmountMinor, currency: calculation.currency }, ratePlanId: calculation.ratePlan.id, ratePlanVersion: calculation.ratePlan.version, matchedRuleId: calculation.matchedRule?.id ?? null, matchedRuleVersion: calculation.matchedRule?.version ?? null, addOnAssignmentId: assignment.id, addOnOfferingId: addOn.id, explanation: calculation.matchedRule?.selector.type ?? "base" })
      provenance.push({ assignmentId: assignment.id, addOnOfferingId: addOn.id, serviceType: terms.serviceType as "quantity_service" | "person_service", offeringVersion: addOn.version, pricingVersion: addOn.pricingVersion, assignmentVersion: assignment.version, priceBookId: book.id, priceBookVersion: book.version, businessCalendarId: calculation.calendarId, businessCalendarVersion: calculation.calendarVersion })
    }
    return { lines, provenance, validUntil: validUntil?.toISOString() ?? null }
  }

  private async loadAddOnSnapshot(manager: EntityManager, offering: CatalogOfferingEntity, book: PriceBookEntity, serviceDate: string): Promise<HousePricingSnapshot> {
    const calendar = await manager.findOne(BusinessCalendarEntity, { where: { id: offering.businessCalendarId } })
    if (!calendar) throw new UnprocessableEntityException({ code: "CALENDAR_NOT_ACTIVE", message: "Календарь дополнительной услуги недоступен" })
    const days = (await manager.find(BusinessCalendarDateEntity, { where: { calendarId: calendar.id, localDate: serviceDate } })).filter((day) => day.archivedAt === null)
    const overrides = (await manager.find(BusinessCalendarDateOverrideEntity, { where: { calendarId: calendar.id, localDate: serviceDate, state: "active" } })).filter((item) => item.archivedAt === null)
    const plans = await manager.find(RatePlanEntity, { where: { priceBookId: book.id }, order: { sortOrder: "ASC", id: "ASC" } })
    const rules = plans.length ? await manager.find(PriceRuleEntity, { where: { ratePlanId: In(plans.map((plan) => plan.id)) }, order: { priority: "DESC", id: "ASC" } }) : []
    const byPlan = new Map<string, PriceRuleEntity[]>()
    for (const rule of rules) byPlan.set(rule.ratePlanId, [...(byPlan.get(rule.ratePlanId) ?? []), rule])
    return { offering: { id: offering.id, version: offering.version, pricingVersion: offering.pricingVersion, kind: offering.kind, state: offering.state, currency: offering.currency, timezone: offering.timezone, businessCalendarId: offering.businessCalendarId, activePriceBookId: offering.activePriceBookId }, priceBook: { id: book.id, version: book.version, revision: book.revision, offeringId: book.offeringId, state: book.state, currency: book.currency, timezone: book.timezone, validFrom: book.validFrom, validToExclusive: book.validToExclusive }, ratePlans: plans.filter((plan) => plan.archivedAt === null).map((plan) => ({ id: plan.id, version: plan.version, priceBookId: plan.priceBookId, key: plan.key, label: plan.label, pricingBasis: plan.pricingBasis, quantityMetric: plan.quantityMetric as "guests" | "participants" | "units" | null, baseAmountMinor: plan.baseAmountMinor, includedQuantity: plan.includedQuantity, baseExtraUnitAmountMinor: plan.baseExtraUnitAmountMinor, minQuantity: plan.minimumQuantity, maxQuantity: plan.maximumQuantity, minDurationMinutes: plan.minimumDurationMinutes, maxDurationMinutes: plan.maximumDurationMinutes, isDefault: plan.isDefault, archived: false, rules: (byPlan.get(plan.id) ?? []).map((rule) => ({ id: rule.id, version: rule.version, dateSelector: rule.selector === "custom_date_override" ? { type: "custom_date_override" as const, from: rule.serviceDateFrom!, toExclusive: rule.serviceDateToExclusive!, label: rule.selectorLabel! } : rule.selector === "recurring_weekdays" ? { type: "recurring_weekdays" as const, days: (rule.selectorLabel ?? "").split(",") as PricingWeekday[] } : rule.selector === "day_class" ? { type: "day_class" as const, dayClass: rule.dayClass as "weekday" | "weekend" } : { type: rule.selector as "any_date" | "calendar_holiday" }, quantityRange: rule.minimumQuantity === null && rule.maximumQuantity === null ? null : { min: rule.minimumQuantity ?? 0, max: rule.maximumQuantity }, bookingLeadDays: rule.minimumBookingLeadDays === null && rule.maximumBookingLeadDays === null ? null : { min: rule.minimumBookingLeadDays ?? 0, max: rule.maximumBookingLeadDays }, durationMinutes: rule.minimumDurationMinutes === null && rule.maximumDurationMinutes === null ? null : { min: rule.minimumDurationMinutes ?? 0, max: rule.maximumDurationMinutes }, amountMinor: rule.amountMinor, extraUnitAmountMinor: rule.extraUnitAmountMinor, priority: rule.priority, reason: rule.reason, enabled: rule.enabled, archived: rule.archivedAt !== null })) })), calendar: { id: calendar.id, version: calendar.version, state: calendar.state, timezone: calendar.timezone, sourceVersion: calendar.sourceVersion, dates: days.map((day) => ({ date: day.localDate, official: { id: day.id, version: day.version, dayClass: day.officialClass as "weekday" | "weekend" | "holiday", sourceVersion: day.sourceVersion }, activeOverride: overrides[0] ? { id: overrides[0].id, version: overrides[0].version, dayClass: overrides[0].overrideClass as "weekday" | "weekend" | "holiday", reason: overrides[0].reason } : null })) } }
  }

  private async replay(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string) {
    for (const lock of [`key:${scope}:${idempotencyKey}`, `operation:${scope}:${operationId}`].sort()) {
      await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock])
    }
    const stored = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("key")
      .where("key.scope = :scope", { scope })
      .andWhere("(key.operation_id = :operationId OR key.idempotency_key = :idempotencyKey)", { operationId, idempotencyKey })
      .getOne()
    if (!stored) return null
    if (stored.operationId !== operationId || stored.idempotencyKey !== idempotencyKey || stored.requestHash !== requestHash) {
      throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ уже использован для другой операции" })
    }
    return stored.responseBody
  }
}

function sameSelections(left: readonly { assignmentId: string; quantity: number }[], right: readonly { assignmentId: string; quantity: number }[]) {
  const canonical = (selections: readonly { assignmentId: string; quantity: number }[]) => [...selections].sort(compareSelection).map(({ assignmentId, quantity }) => ({ assignmentId, quantity }))
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}
function sameResources(left: readonly { resourceId: string }[], right: readonly { resourceId: string }[]) {
  const canonical = (selections: readonly { resourceId: string }[]) => [...selections].sort((a, b) => a.resourceId.localeCompare(b.resourceId)).map(({ resourceId }) => ({ resourceId }))
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}
function compareSelection(a: { assignmentId: string; quantity: number }, b: { assignmentId: string; quantity: number }) { return a.assignmentId.localeCompare(b.assignmentId) }
function localDate(value: Date, timezone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value) }
function nextLocalMidnight(now: Date, timezone: string) {
  const current = localDate(now, timezone)
  const [year, month, day] = current.split("-").map(Number)
  const midnightAsUtc = Date.UTC(year!, month! - 1, day! + 1)
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(midnightAsUtc))
  const values = new Map(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]))
  const renderedAsUtc = Date.UTC(values.get("year")!, values.get("month")! - 1, values.get("day")!, values.get("hour")!, values.get("minute")!, values.get("second")!)
  return new Date(midnightAsUtc - (renderedAsUtc - midnightAsUtc))
}
