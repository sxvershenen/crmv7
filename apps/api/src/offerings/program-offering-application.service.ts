import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, In, IsNull, type EntityManager } from "typeorm"

import {
  OfferingConfigurationOutboxEventSchema,
  ProgramOfferingLookupResultSchema,
  ProgramOfferingPrepareResultSchema,
  ProgramOfferingQuoteResultSchema,
  type ProgramOfferingLookupItem,
  type ProgramOfferingLookupResult,
  type ProgramOfferingPrepareBody,
  type ProgramOfferingPrepareResult,
  type ProgramOfferingQuotePreviewBody,
  type ProgramOfferingQuoteResult,
  type PriceWeekday,
  type SessionUser,
} from "@crm/contracts"
import {
  BusinessCalendarDateEntity,
  BusinessCalendarDateOverrideEntity,
  BusinessCalendarEntity,
  CatalogOfferingEntity,
  ChangeLogEntity,
  CmsNodeEntity,
  CmsSourceLinkEntity,
  IdempotencyKeyEntity,
  OfferingBindingEntity,
  OfferingQuoteSnapshotEntity,
  OutboxDeliveryEntity,
  OutboxEventEntity,
  PriceBookEntity,
  PriceRuleEntity,
  ProgramTemplateEntity,
  RatePlanEntity,
} from "@crm/db"
import { DomainError, resolveProgramTemplateQuote, type HousePriceRule, type ProgramPricingSnapshot } from "@crm/domain"

import { ensureCatalogOfferingEditorialDraft } from "../cms/cms-source-draft.js"
import { canonicalSha256 } from "./offering-mutation-support.js"

export type ProgramOfferingRequestContext = Readonly<{ actor: SessionUser; requestId: string; entrySurface: "internal" | "admin" }>
type StoredReplay = { responseBody: Record<string, unknown> | null; operationId: string; idempotencyKey: string; requestHash: string }

@Injectable()
export class ProgramOfferingApplicationService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async lookup(programTemplateId: string, context: ProgramOfferingRequestContext): Promise<ProgramOfferingLookupResult> {
    this.assertRead(context)
    return this.dataSource.transaction("REPEATABLE READ", async (manager) => {
      const template = await manager.findOne(ProgramTemplateEntity, { where: { id: programTemplateId } })
      if (!template || template.archivedAt !== null) throw new NotFoundException({ code: "PROGRAM_TEMPLATE_NOT_FOUND", message: "Шаблон программы не найден" })
      const offerings = await this.findExactOfferings(manager, template.id, false)
      if (offerings.length === 0) return ProgramOfferingLookupResultSchema.parse({ resolution: "unprepared", programTemplateId: template.id, programTemplateVersion: template.version })
      const candidates = await Promise.all(offerings.map((offering) => this.lookupItem(manager, offering, template)))
      if (candidates.length === 1) return ProgramOfferingLookupResultSchema.parse({ resolution: "linked", offering: candidates[0] })
      return ProgramOfferingLookupResultSchema.parse({ resolution: "ambiguous", programTemplateId: template.id, programTemplateVersion: template.version, candidates })
    })
  }

  async prepare(programTemplateId: string, input: ProgramOfferingPrepareBody, context: ProgramOfferingRequestContext): Promise<ProgramOfferingPrepareResult> {
    this.assertCreate(context)
    const scope = `program-template:${programTemplateId}:offering:prepare`
    return this.serializable(async (manager) => {
      const fingerprint = canonicalSha256({ command: "program-offering.prepare", programTemplateId, actorId: context.actor.id, input })
      const replay = await this.replay<ProgramOfferingPrepareResult>(manager, scope, input.operationId, input.idempotencyKey, fingerprint)
      if (replay) return replay
      const template = await manager.createQueryBuilder(ProgramTemplateEntity, "template").setLock("pessimistic_write").where("template.id = :programTemplateId", { programTemplateId }).getOne()
      if (!template || template.archivedAt !== null) throw new NotFoundException({ code: "PROGRAM_TEMPLATE_NOT_FOUND", message: "Шаблон программы не найден" })
      if (template.version !== input.expectedProgramTemplateVersion) throw conflict("VERSION_CONFLICT", "Шаблон программы был изменён другим пользователем", { segment: "programTemplate", expectedVersion: input.expectedProgramTemplateVersion, serverVersion: template.version })
      const existing = await this.findExactOfferings(manager, template.id, true)
      if (existing.length) throw conflict("PROGRAM_OFFERING_ALREADY_EXISTS", "Для шаблона уже существует program offering", { offeringIds: existing.map((item) => item.id) })
      const calendars = await manager.find(BusinessCalendarEntity, { where: { state: "active", archivedAt: IsNull() }, order: { id: "ASC" } })
      if (calendars.length !== 1) throw unprocessable("BUSINESS_CALENDAR_ACTIVE_COUNT_INVALID", "Для подготовки программы нужен ровно один активный бизнес-календарь", { count: calendars.length })
      const calendar = calendars[0]!
      const offering = await manager.save(manager.create(CatalogOfferingEntity, {
        id: randomUUID(), code: await this.uniqueCode(manager, template), kind: "program", operationalName: template.name,
        internalComment: "Подготовлено из operational ProgramTemplate; legacy basePrice/publication требуют ручной сверки.",
        state: "draft", subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1,
        salesMode: "quoted", priceDisplayMode: "from", currency: "RUB", timezone: calendar.timezone,
        taxMode: "tax_included", businessCalendarId: calendar.id, leadDirection: null, defaultAssigneeId: null,
        scope: null, ownerOfferingId: null, activePriceBookId: null, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      await manager.save(manager.create(OfferingBindingEntity, {
        id: randomUUID(), offeringId: offering.id, resourceId: null, resourceGroupId: null, programTemplateId: template.id, eventServiceTemplateId: null,
        role: "primary", quantityDefault: 1, capacityImpactDefault: 1, preparationBeforeMinutes: 0, preparationAfterMinutes: 0,
        availabilityRequired: false, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      let editorial
      try {
        editorial = await ensureCatalogOfferingEditorialDraft(manager, { offeringId: offering.id, actorId: context.actor.id, requestId: context.requestId })
      } catch (error) {
        throw conflict("OFFERING_EDITORIAL_RECONCILIATION_REQUIRED", "CMS-черновик программы не прошёл сверку", { reason: error instanceof Error ? error.message : "unknown" })
      }
      if (editorial.status === "report_only") throw conflict("OFFERING_EDITORIAL_RECONCILIATION_REQUIRED", "Legacy program CMS locator требует ручной сверки", editorial.report as unknown as Record<string, unknown>)
      const response = ProgramOfferingPrepareResultSchema.parse({
        offeringId: offering.id, offeringVersion: offering.version, subjectVersion: offering.subjectVersion,
        pricingVersion: offering.pricingVersion, addOnAssignmentsVersion: offering.addonAssignmentsVersion,
        programTemplateId: template.id, programTemplateVersion: template.version,
        cmsReady: true, publicReady: false, editorialNodeId: editorial.link.nodeId,
      })
      await this.recordPrepared(manager, offering, template, calendar, input.operationId, context, fingerprint)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, fingerprint, response)
      return response
    })
  }

  async preview(programTemplateId: string, input: ProgramOfferingQuotePreviewBody, context: ProgramOfferingRequestContext): Promise<ProgramOfferingQuoteResult> {
    this.assertRead(context)
    const scope = `program-template:${programTemplateId}:offering:quote-preview`
    return this.serializable(async (manager) => {
      const fingerprint = canonicalSha256({ command: "program-offering.quote-preview", programTemplateId, actorId: context.actor.id, input })
      const replay = await this.replay<ProgramOfferingQuoteResult>(manager, scope, input.operationId, input.idempotencyKey, fingerprint)
      if (replay) return replay
      const template = await manager.createQueryBuilder(ProgramTemplateEntity, "template").setLock("pessimistic_write").where("template.id = :programTemplateId", { programTemplateId }).getOne()
      if (!template || template.archivedAt !== null) throw new NotFoundException({ code: "PROGRAM_TEMPLATE_NOT_FOUND", message: "Шаблон программы не найден" })
      const candidates = await this.findExactOfferings(manager, template.id, true)
      if (candidates.length !== 1) throw conflict(candidates.length ? "PROGRAM_OFFERING_AMBIGUOUS" : "PROGRAM_OFFERING_NOT_FOUND", "Program offering не найден однозначно", { offeringIds: candidates.map((item) => item.id) })
      const offering = candidates[0]!
      if (!offering.activePriceBookId) throw unprocessable("PRICE_BOOK_NOT_ACTIVE", "Для программы нет активного прайс-листа")
      const book = await manager.createQueryBuilder(PriceBookEntity, "book").setLock("pessimistic_write").where("book.id = :id AND book.offering_id = :offeringId", { id: offering.activePriceBookId, offeringId: offering.id }).getOne()
      if (!book || book.archivedAt !== null) throw unprocessable("PRICE_BOOK_NOT_ACTIVE", "Активный прайс-лист программы недоступен")
      const now = new Date()
      const nextScheduled = await manager.createQueryBuilder(PriceBookEntity, "book").where("book.offering_id = :offeringId AND book.state = 'scheduled'", { offeringId: offering.id }).orderBy("book.scheduled_activation_at", "ASC").getOne()
      if (nextScheduled?.scheduledActivationAt && nextScheduled.scheduledActivationAt <= now) throw conflict("PRICE_BOOK_NOT_ACTIVE", "Запланированная цена ожидает активации", { priceBookId: nextScheduled.id })
      const snapshot = await this.loadSnapshot(manager, offering, template, book, input.serviceDate)
      let calculation
      try {
        calculation = resolveProgramTemplateQuote(snapshot, {
          offeringId: offering.id, programTemplateId: template.id, ratePlanKey: input.ratePlanKey,
          serviceDate: input.serviceDate, participants: input.participants, durationMinutes: template.durationMinutes, currency: input.currency,
        }, { quoteId: randomUUID(), calculatedAt: now, quoteTtlSeconds: 15 * 60, nextPricingActivationAt: nextScheduled?.scheduledActivationAt ?? null })
      } catch (error) {
        if (error instanceof DomainError) throw unprocessable(error.code, error.message, { ...error.details, fieldErrors: error.fieldErrors })
        throw error
      }
      const result = ProgramOfferingQuoteResultSchema.parse({
        quoteType: calculation.quoteType, acceptanceReady: calculation.acceptanceReady, quoteId: calculation.quoteId,
        offeringId: offering.id, programTemplateId: template.id, calculatedAt: calculation.calculatedAt,
        validUntil: calculation.validUntil, leadDays: calculation.leadDays, currency: calculation.currency,
        inputs: { serviceDate: input.serviceDate, participants: input.participants, durationMinutes: template.durationMinutes },
        lines: calculation.lines.map((line) => ({
          kind: line.kind, label: line.kind === "base" ? (snapshot.ratePlans.find((plan) => plan.id === line.ratePlan.id)?.pricingBasis === "per_person" ? "Участники" : "Пакет") : "Дополнительные участники",
          serviceDate: input.serviceDate, quantity: line.quantity,
          unitAmount: { amountMinor: line.unitAmountMinor, currency: calculation.currency }, amount: { amountMinor: line.totalAmountMinor, currency: calculation.currency },
          ratePlanId: line.ratePlan.id, ratePlanVersion: line.ratePlan.version,
          matchedRuleId: line.matchedRule?.id ?? null, matchedRuleVersion: line.matchedRule?.version ?? null,
          explanation: line.matchedRule?.selector.type ?? "base",
        })),
        total: { amountMinor: calculation.totalAmountMinor, currency: calculation.currency },
        provenance: { offeringVersion: offering.version, subjectVersion: offering.subjectVersion, programTemplateVersion: template.version, pricingVersion: offering.pricingVersion, addOnsVersion: offering.addonAssignmentsVersion, priceBookId: book.id, priceBookVersion: book.version, businessCalendarId: snapshot.calendar.id, businessCalendarVersion: snapshot.calendar.version, businessCalendarSourceVersion: snapshot.calendar.sourceVersion, matchedRuleIds: [...new Set(calculation.lines.flatMap((line) => line.matchedRule ? [line.matchedRule.id] : []))] },
        immutableSnapshot: true,
      })
      await manager.save(manager.create(OfferingQuoteSnapshotEntity, {
        id: calculation.quoteId, offeringId: offering.id, quoteType: "template_preview",
        offeringVersion: offering.version, subjectVersion: offering.subjectVersion, programTemplateId: template.id, programTemplateVersion: template.version,
        pricingVersion: offering.pricingVersion, addOnAssignmentsVersion: offering.addonAssignmentsVersion,
        priceBookId: book.id, priceBookVersion: book.version, businessCalendarId: snapshot.calendar.id,
        businessCalendarVersion: snapshot.calendar.version, businessCalendarSourceVersion: snapshot.calendar.sourceVersion,
        requestPayload: { programTemplateId, ...input } as Record<string, unknown>, resultPayload: result as unknown as Record<string, unknown>,
        provenance: calculation as unknown as Record<string, unknown>, calculatedAt: new Date(calculation.calculatedAt), validUntil: new Date(calculation.validUntil),
        operationId: input.operationId, idempotencyKey: input.idempotencyKey, actorId: context.actor.id,
        requestId: context.requestId, entrySurface: context.entrySurface, operationalContext: null,
      }))
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, fingerprint, result)
      return result
    })
  }

  private async findExactOfferings(manager: EntityManager, templateId: string, lock: boolean) {
    const builder = manager.createQueryBuilder(CatalogOfferingEntity, "offering")
    if (lock) builder.setLock("pessimistic_write")
    return builder.innerJoin(OfferingBindingEntity, "binding", "binding.offering_id = offering.id")
      .where("offering.kind = 'program' AND offering.archived_at IS NULL AND offering.state <> 'archived'")
      .andWhere("binding.program_template_id = :templateId AND binding.role = 'primary' AND binding.archived_at IS NULL", { templateId })
      .orderBy("offering.id", "ASC").getMany()
  }

  private async lookupItem(manager: EntityManager, offering: CatalogOfferingEntity, template: ProgramTemplateEntity): Promise<ProgramOfferingLookupItem> {
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

  private async loadSnapshot(manager: EntityManager, offering: CatalogOfferingEntity, template: ProgramTemplateEntity, book: PriceBookEntity, serviceDate: string): Promise<ProgramPricingSnapshot> {
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
      ratePlans: plans.filter((plan) => plan.archivedAt === null).map((plan) => ({ id: plan.id, version: plan.version, priceBookId: plan.priceBookId, key: plan.key, label: plan.label, pricingBasis: plan.pricingBasis, quantityMetric: plan.quantityMetric as "guests" | "participants" | "units" | null, baseAmountMinor: plan.baseAmountMinor, includedQuantity: plan.includedQuantity, baseExtraUnitAmountMinor: plan.baseExtraUnitAmountMinor, minQuantity: plan.minimumQuantity, maxQuantity: plan.maximumQuantity, minDurationMinutes: plan.minimumDurationMinutes, maxDurationMinutes: plan.maximumDurationMinutes, isDefault: plan.isDefault, archived: plan.archivedAt !== null, rules: (byPlan.get(plan.id) ?? []).map((rule) => this.rule(rule)) })),
      calendar: { id: calendar.id, version: calendar.version, state: calendar.state, timezone: calendar.timezone, sourceVersion: calendar.sourceVersion, dates: liveDays.map((day) => ({ date: day.localDate, official: { id: day.id, version: day.version, dayClass: day.officialClass as "weekday" | "weekend" | "holiday", sourceVersion: day.sourceVersion }, activeOverride: liveOverrides[0] ? { id: liveOverrides[0].id, version: liveOverrides[0].version, dayClass: liveOverrides[0].overrideClass as "weekday" | "weekend" | "holiday", reason: liveOverrides[0].reason } : null })) },
    }
  }

  private rule(rule: PriceRuleEntity): HousePriceRule {
    return { id: rule.id, version: rule.version, dateSelector: rule.selector === "custom_date_override" ? { type: "custom_date_override", from: rule.serviceDateFrom!, toExclusive: rule.serviceDateToExclusive!, label: rule.selectorLabel! } : rule.selector === "recurring_weekdays" ? { type: "recurring_weekdays", days: this.weekdays(rule.selectorLabel) } : rule.selector === "day_class" ? { type: "day_class", dayClass: rule.dayClass as "weekday" | "weekend" } : { type: rule.selector as "any_date" | "calendar_holiday" }, quantityRange: range(rule.minimumQuantity, rule.maximumQuantity), bookingLeadDays: range(rule.minimumBookingLeadDays, rule.maximumBookingLeadDays), durationMinutes: range(rule.minimumDurationMinutes, rule.maximumDurationMinutes), amountMinor: rule.amountMinor, extraUnitAmountMinor: rule.extraUnitAmountMinor, priority: rule.priority, reason: rule.reason, enabled: rule.enabled, archived: rule.archivedAt !== null }
  }

  private weekdays(value: string | null): PriceWeekday[] { const allowed = new Set<PriceWeekday>(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]); const days = value?.split(",") ?? []; if (!days.length || days.some((day) => !allowed.has(day as PriceWeekday))) throw unprocessable("PRICE_RULE_INVALID", "Повторяющиеся дни не настроены"); return days as PriceWeekday[] }
  private async uniqueCode(manager: EntityManager, template: ProgramTemplateEntity) { const base = `PROGRAM-${template.code}`.slice(0, 120); if (!await manager.findOne(CatalogOfferingEntity, { where: { code: base } })) return base; throw conflict("OFFERING_CODE_CONFLICT", "Код program offering уже занят", { code: base }) }

  private async recordPrepared(manager: EntityManager, offering: CatalogOfferingEntity, template: ProgramTemplateEntity, calendar: BusinessCalendarEntity, operationId: string, context: ProgramOfferingRequestContext, configurationHash: string) {
    const now = new Date()
    const base = { occurredAt: now.toISOString(), actorId: context.actor.id, requestId: context.requestId, operationId, entrySurface: context.entrySurface, aggregate: { type: "catalog_offering" as const, id: offering.id }, versions: { calendar: calendar.version, subject: offering.subjectVersion, addOns: offering.addonAssignmentsVersion }, configurationHash }
    const prepared = OfferingConfigurationOutboxEventSchema.parse({ ...base, eventId: randomUUID(), eventType: "crm.offering.program_prepared" })
    const invalidated = OfferingConfigurationOutboxEventSchema.parse({ ...base, eventId: randomUUID(), eventType: "public.offering_projection.invalidated" })
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "catalog_offering", entityId: offering.id, action: prepared.eventType, actorId: context.actor.id, requestId: context.requestId, changes: { ...prepared, programTemplateId: template.id, programTemplateVersion: template.version, publicReady: false }, createdAt: now }))
    await this.saveOutbox(manager, prepared, ["sse"])
    await this.saveOutbox(manager, invalidated, ["sse", "public_projection"])
  }

  private async saveOutbox(manager: EntityManager, event: ReturnType<typeof OfferingConfigurationOutboxEventSchema.parse>, consumers: readonly string[]) { const at = new Date(event.occurredAt); await manager.save(manager.create(OutboxEventEntity, { id: event.eventId, topic: event.eventType, aggregateType: event.aggregate.type, aggregateId: event.aggregate.id, payload: event as unknown as Record<string, unknown>, availableAt: at, processedAt: null, attempts: 0, createdAt: at })); await manager.save(consumers.map((consumer) => manager.create(OutboxDeliveryEntity, { eventId: event.eventId, consumer, status: "pending", attempts: 0, availableAt: at, processedAt: null, lastError: null, createdAt: at, updatedAt: at }))) }
  private async replay<T>(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<T | null> { for (const lock of [`key:${scope}:${idempotencyKey}`, `operation:${scope}:${operationId}`].sort()) await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lock]); const stored = await manager.createQueryBuilder(IdempotencyKeyEntity, "key").where("key.scope = :scope", { scope }).andWhere("(key.operation_id = :operationId OR key.idempotency_key = :idempotencyKey)", { operationId, idempotencyKey }).getOne() as StoredReplay | null; if (!stored) return null; if (stored.operationId !== operationId || stored.idempotencyKey !== idempotencyKey || stored.requestHash !== requestHash) throw conflict("IDEMPOTENCY_CONFLICT", "Ключ идемпотентности уже использован для другой операции"); return stored.responseBody as T }
  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: object) { await manager.save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 200, responseBody: response as Record<string, unknown>, createdAt: new Date() })) }
  private assertRead(context: ProgramOfferingRequestContext) { if (!context.actor.capabilities.canView || context.entrySurface === "admin" && context.actor.capabilities.canViewContent !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для расчёта программы" }) }
  private assertCreate(context: ProgramOfferingRequestContext) { if (!context.actor.capabilities.canCreate || !context.actor.capabilities.canEdit || context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для подготовки программы" }) }
  private async serializable<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> { for (let attempt = 0; ; attempt += 1) { try { return await this.dataSource.transaction("SERIALIZABLE", operation) } catch (error) { const driver = (error as { driverError?: { code?: string; constraint?: string }; code?: string; constraint?: string }).driverError ?? error as { code?: string; constraint?: string }; const retryableUnique = driver.code === "23505" && (driver.constraint === "catalog_offerings_code_unique" || driver.constraint === "offering_bindings_one_live_program_primary_idx"); if (attempt >= 2 || driver.code !== "40001" && driver.code !== "40P01" && !retryableUnique) throw error } } }
}

function range(min: number | null, max: number | null) { return min === null && max === null ? null : { min: min ?? 0, max } }
function conflict(code: string, message: string, details: Record<string, unknown> = {}) { return new ConflictException({ code, message, details }) }
function unprocessable(code: string, message: string, details: Record<string, unknown> = {}) { return new UnprocessableEntityException({ code, message, details }) }
