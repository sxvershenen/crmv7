import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, IsNull, type EntityManager } from "typeorm"

import {
  EventServiceOfferingDossierSchema,
  EventServiceOfferingLookupResultSchema,
  EventServiceOfferingQuoteResultSchema,
  EventServiceOfferingQuoteSnapshotSchema,
  EventServiceTemplateMutationResultSchema,
  EventServiceTemplateRegistryResponseSchema,
  OfferingConfigurationOutboxEventSchema,
  type EventServiceOfferingDossier,
  type EventServiceOfferingLookupResult,
  type EventServiceOfferingQuotePreviewBody,
  type EventServiceOfferingQuoteResult,
  type EventServiceTemplateCreateBody,
  type EventServiceTemplateMutationBody,
  type EventServiceTemplateMutationResult,
  type EventServiceTemplateRegistryQuery,
  type EventServiceTemplateReopenBody,
  type EventServiceTemplateRegistryItem,
  type SessionUser,
} from "@crm/contracts"
import {
  BusinessCalendarEntity,
  CatalogOfferingEntity,
  ChangeLogEntity,
  CmsNodeEntity,
  CmsNodeRevisionEntity,
  CmsPublicProfileEntity,
  CmsSourceLinkEntity,
  EventServiceTemplateEntity,
  IdempotencyKeyEntity,
  OfferingBindingEntity,
  OfferingQuoteSnapshotEntity,
  OutboxDeliveryEntity,
  OutboxEventEntity,
  PriceBookEntity,
} from "@crm/db"
import { DomainError, resolveEventServiceQuote } from "@crm/domain"

import { ensureCatalogOfferingEditorialDraft } from "../cms/cms-source-draft.js"
import { canonicalSha256 } from "./offering-mutation-support.js"
import { eventLoadSnapshot, eventLookupItem, eventOfferingDto, eventSummary, eventTemplateDto, localDate } from "./event-service-projections.js"

export type EventServiceRequestContext = Readonly<{ actor: SessionUser; requestId: string; entrySurface: "internal" | "admin" }>
type StoredReplay = { responseBody: Record<string, unknown> | null; operationId: string; idempotencyKey: string; requestHash: string }

@Injectable()
export class EventServiceApplicationService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  private templateDto(template: EventServiceTemplateEntity) { return eventTemplateDto(template) }

  async registry(query: EventServiceTemplateRegistryQuery, context: EventServiceRequestContext) {
    this.assertRead(context)
    const builder = this.dataSource.getRepository(EventServiceTemplateEntity).createQueryBuilder("template")
      .where("template.archived_at IS NULL")
      .orderBy("date_trunc('milliseconds', template.updated_at)", "DESC")
      .addOrderBy("template.id", "DESC")
      .take(query.limit + 1)
    if (query.q) builder.andWhere("(LOWER(template.code) LIKE :q ESCAPE '\\' OR EXISTS (SELECT 1 FROM offering_bindings search_binding JOIN catalog_offerings search_offering ON search_offering.id = search_binding.offering_id WHERE search_binding.event_service_template_id = template.id AND search_binding.role = 'primary' AND search_binding.archived_at IS NULL AND (LOWER(search_offering.operational_name) LIKE :q ESCAPE '\\' OR LOWER(search_offering.code) LIKE :q ESCAPE '\\')))", { q: `%${escapeLike(query.q.toLocaleLowerCase("ru-RU"))}%` })
    if (query.format) builder.andWhere("template.format = :format", { format: query.format })
    if (query.state) builder.andWhere("EXISTS (SELECT 1 FROM offering_bindings state_binding JOIN catalog_offerings state_offering ON state_offering.id = state_binding.offering_id WHERE state_binding.event_service_template_id = template.id AND state_binding.role = 'primary' AND state_binding.archived_at IS NULL AND state_offering.kind = 'event_service' AND state_offering.archived_at IS NULL AND state_offering.state = :state)", { state: query.state })
    const cursor = query.cursor ? decodeEventServiceRegistryCursor(query.cursor) : null
    if (cursor) builder.andWhere("(date_trunc('milliseconds', template.updated_at) < :updatedAt OR (date_trunc('milliseconds', template.updated_at) = :updatedAt AND template.id < :id))", cursor)
    const templates = await builder.getMany()
    const items: EventServiceTemplateRegistryItem[] = []
    for (const template of templates.slice(0, query.limit)) {
      const candidates = await this.findExactOfferings(this.dataSource.manager, template.id, false)
      if (query.state && !candidates.some((candidate) => candidate.state === query.state)) continue
      const offering = candidates.length === 1 ? candidates[0]! : null
      const link = offering ? await this.dataSource.manager.findOne(CmsSourceLinkEntity, { where: { sourceKind: "catalog_offering", sourceId: offering.id } }) : null
      items.push({ template: this.templateDto(template), offering: offering ? eventSummary(offering, template, Boolean(link), link?.nodeId ?? null) : null })
    }
    const last = templates.slice(0, query.limit).at(-1)
    return EventServiceTemplateRegistryResponseSchema.parse({ items, nextCursor: templates.length > query.limit && last ? encodeEventServiceRegistryCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id }) : null })
  }

  async create(input: EventServiceTemplateCreateBody, context: EventServiceRequestContext): Promise<EventServiceOfferingDossier> {
    this.assertCreate(context)
    const scope = "event-service:template:create"
    return this.serializable(async (manager) => {
      const fingerprint = canonicalSha256({ command: "event-service.create", actorId: context.actor.id, input })
      const replay = await this.replay<EventServiceOfferingDossier>(manager, scope, input.operationId, input.idempotencyKey, fingerprint)
      if (replay) return replay
      const calendar = await manager.findOne(BusinessCalendarEntity, { where: { id: input.businessCalendarId, state: "active", archivedAt: IsNull() } })
      if (!calendar) throw new NotFoundException({ code: "BUSINESS_CALENDAR_NOT_FOUND", message: "Бизнес-календарь не найден" })
      if (calendar.timezone !== input.timezone) throw unprocessable("PRICING_TIMEZONE_MISMATCH", "Часовой пояс предложения должен совпадать с календарём")
      if (await manager.findOne(EventServiceTemplateEntity, { where: { code: input.templateCode } })) throw conflict("EVENT_SERVICE_TEMPLATE_CODE_CONFLICT", "Технический код шаблона мероприятия уже занят", { code: input.templateCode })
      if (await manager.findOne(CatalogOfferingEntity, { where: { code: input.offeringCode } })) throw conflict("OFFERING_CODE_CONFLICT", "Код event-service offering уже занят", { code: input.offeringCode })
      const template = await manager.save(manager.create(EventServiceTemplateEntity, {
        id: randomUUID(), code: input.templateCode, format: input.format, defaultDurationMinutes: input.defaultDurationMinutes,
        icon: input.icon, tone: input.tone,
        minimumGuests: input.minimumGuests, maximumGuests: input.maximumGuests,
        preparationBeforeMinutes: input.preparationBeforeMinutes, preparationAfterMinutes: input.preparationAfterMinutes,
        createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      const offering = await manager.save(manager.create(CatalogOfferingEntity, {
        id: randomUUID(), code: input.offeringCode, kind: "event_service", operationalName: input.operationalName,
        internalComment: input.internalComment, state: "draft", subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1,
        salesMode: input.salesMode, priceDisplayMode: input.priceDisplayMode, currency: input.currency, timezone: input.timezone,
        taxMode: input.taxMode, businessCalendarId: input.businessCalendarId, leadDirection: null, defaultAssigneeId: null,
        scope: null, ownerOfferingId: null, activePriceBookId: null, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      await manager.save(manager.create(OfferingBindingEntity, {
        id: randomUUID(), offeringId: offering.id, resourceId: null, resourceGroupId: null, programTemplateId: null,
        eventServiceTemplateId: template.id, role: "primary", quantityDefault: 1, capacityImpactDefault: 1,
        preparationBeforeMinutes: template.preparationBeforeMinutes, preparationAfterMinutes: template.preparationAfterMinutes,
        availabilityRequired: false, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      const editorial = await this.ensureEditorial(manager, offering.id, context)
      if (editorial.status === "report_only") throw conflict("OFFERING_EDITORIAL_RECONCILIATION_REQUIRED", "CMS-черновик требует ручной сверки")
      const response = await this.dossier(manager, offering, template)
      await this.recordPrepared(manager, offering, template, calendar, input.operationId, context, fingerprint, "crm.offering.event_service_prepared")
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, fingerprint, response)
      return response
    })
  }

  async lookup(templateId: string, context: EventServiceRequestContext): Promise<EventServiceOfferingLookupResult> {
    this.assertRead(context)
    return this.dataSource.transaction("REPEATABLE READ", async (manager) => {
      const template = await manager.findOne(EventServiceTemplateEntity, { where: { id: templateId } })
      if (!template || template.archivedAt !== null) throw new NotFoundException({ code: "EVENT_SERVICE_TEMPLATE_NOT_FOUND", message: "Шаблон мероприятия не найден" })
      const candidates = await this.findExactOfferings(manager, template.id, false)
      if (candidates.length === 0) return EventServiceOfferingLookupResultSchema.parse({ resolution: "unprepared", eventServiceTemplateId: template.id, eventServiceTemplateVersion: template.version })
      const items = await Promise.all(candidates.map(async (offering) => {
        const link = await manager.findOne(CmsSourceLinkEntity, { where: { sourceKind: "catalog_offering", sourceId: offering.id } })
        return eventLookupItem(offering, template, Boolean(link), link?.nodeId ?? null)
      }))
      if (items.length !== 1) return EventServiceOfferingLookupResultSchema.parse({ resolution: "ambiguous", eventServiceTemplateId: template.id, eventServiceTemplateVersion: template.version, candidates: items })
      return EventServiceOfferingLookupResultSchema.parse({ resolution: "linked", offering: items[0] })
    })
  }

  async update(templateId: string, input: EventServiceTemplateMutationBody, context: EventServiceRequestContext): Promise<EventServiceTemplateMutationResult> {
    this.assertEdit(context)
    const scope = `event-service:template:${templateId}:update`
    return this.serializable(async (manager) => {
      const fingerprint = canonicalSha256({ command: "event-service.template.update", templateId, actorId: context.actor.id, input })
      const replay = await this.replay<EventServiceTemplateMutationResult>(manager, scope, input.operationId, input.idempotencyKey, fingerprint)
      if (replay) return replay
      const template = await manager.createQueryBuilder(EventServiceTemplateEntity, "template").setLock("pessimistic_write").where("template.id = :templateId", { templateId }).getOne()
      if (!template || template.archivedAt !== null) throw new NotFoundException({ code: "EVENT_SERVICE_TEMPLATE_NOT_FOUND", message: "Шаблон мероприятия не найден" })
      this.assertVersion(template.version, input.expectedSubjectVersion, "eventServiceTemplate")
      const offeringChanged = input.operationalName !== undefined || input.internalComment !== undefined
      const linkedOfferings = await this.findExactOfferings(manager, template.id, true)
      let offering: CatalogOfferingEntity | null = null
      if (offeringChanged) {
        if (linkedOfferings.length !== 1) throw conflict(linkedOfferings.length ? "EVENT_SERVICE_OFFERING_AMBIGUOUS" : "EVENT_SERVICE_OFFERING_NOT_FOUND", "Event-service offering не найден однозначно", { offeringIds: linkedOfferings.map((item) => item.id) })
        offering = linkedOfferings[0]!
        if (input.expectedOfferingVersion === undefined) throw conflict("VERSION_CONFLICT", "Для изменения коммерческих данных требуется версия offering", { segment: "offering" })
        this.assertVersion(offering.version, input.expectedOfferingVersion, "offering")
        Object.assign(offering, {
          ...(input.operationalName === undefined ? {} : { operationalName: input.operationalName }),
          ...(input.internalComment === undefined ? {} : { internalComment: input.internalComment }),
          updatedBy: context.actor.id,
        })
      }
      Object.assign(template, {
        format: input.format, ...(input.icon === undefined ? {} : { icon: input.icon }), ...(input.tone === undefined ? {} : { tone: input.tone }), defaultDurationMinutes: input.defaultDurationMinutes, minimumGuests: input.minimumGuests,
        maximumGuests: input.maximumGuests, preparationBeforeMinutes: input.preparationBeforeMinutes,
        preparationAfterMinutes: input.preparationAfterMinutes, updatedBy: context.actor.id,
      })
      const saved = await manager.save(template)
      const response = EventServiceTemplateMutationResultSchema.parse({ template: this.templateDto(saved), subjectVersion: saved.version })
      if (offering) await manager.save(offering)
      const changes = { ...input, expectedSubjectVersion: undefined, expectedOfferingVersion: undefined }
      await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "event_service_template", entityId: saved.id, action: "updated", actorId: context.actor.id, requestId: context.requestId, changes, createdAt: new Date() }))
      if (offering) await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "catalog_offering", entityId: offering.id, action: "updated", actorId: context.actor.id, requestId: context.requestId, changes, createdAt: new Date() }))
      for (const linked of linkedOfferings) await this.recordTemplateMutation(manager, linked, input.operationId, context, canonicalSha256({ command: "event-service.template.updated", templateId, templateVersion: saved.version, input }), "crm.offering.event_service_updated")
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, fingerprint, response)
      return response
    })
  }

  async reopen(templateId: string, input: EventServiceTemplateReopenBody, context: EventServiceRequestContext): Promise<EventServiceTemplateMutationResult> {
    this.assertEdit(context)
    const scope = `event-service:template:${templateId}:reopen`
    return this.serializable(async (manager) => {
      const fingerprint = canonicalSha256({ command: "event-service.template.reopen", templateId, actorId: context.actor.id, input })
      const replay = await this.replay<EventServiceTemplateMutationResult>(manager, scope, input.operationId, input.idempotencyKey, fingerprint)
      if (replay) return replay
      const template = await manager.createQueryBuilder(EventServiceTemplateEntity, "template").setLock("pessimistic_write").where("template.id = :templateId", { templateId }).getOne()
      if (!template) throw new NotFoundException({ code: "EVENT_SERVICE_TEMPLATE_NOT_FOUND", message: "Шаблон мероприятия не найден" })
      this.assertVersion(template.version, input.expectedSubjectVersion, "eventServiceTemplate")
      const linkedOfferings = await this.findExactOfferings(manager, template.id, true)
      if (template.archivedAt !== null) { template.archivedAt = null; template.updatedBy = context.actor.id }
      const saved = await manager.save(template)
      const response = EventServiceTemplateMutationResultSchema.parse({ template: this.templateDto(saved), subjectVersion: saved.version })
      await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "event_service_template", entityId: saved.id, action: "reopened", actorId: context.actor.id, requestId: context.requestId, changes: { subjectVersion: saved.version }, createdAt: new Date() }))
      for (const offering of linkedOfferings) await this.recordTemplateMutation(manager, offering, input.operationId, context, canonicalSha256({ command: "event-service.template.reopened", templateId, templateVersion: saved.version }), "crm.offering.event_service_reopened")
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, fingerprint, response)
      return response
    })
  }

  async prepare(templateId: string, input: { operationId: string; idempotencyKey: string; expectedEventServiceTemplateVersion: number }, context: EventServiceRequestContext): Promise<EventServiceOfferingDossier> {
    this.assertCreate(context)
    const scope = `event-service:template:${templateId}:prepare`
    return this.serializable(async (manager) => {
      const fingerprint = canonicalSha256({ command: "event-service.prepare", templateId, actorId: context.actor.id, input })
      const replay = await this.replay<EventServiceOfferingDossier>(manager, scope, input.operationId, input.idempotencyKey, fingerprint)
      if (replay) return replay
      const template = await manager.createQueryBuilder(EventServiceTemplateEntity, "template").setLock("pessimistic_write").where("template.id = :templateId", { templateId }).getOne()
      if (!template || template.archivedAt !== null) throw new NotFoundException({ code: "EVENT_SERVICE_TEMPLATE_NOT_FOUND", message: "Шаблон мероприятия не найден" })
      this.assertVersion(template.version, input.expectedEventServiceTemplateVersion, "eventServiceTemplate")
      const existing = await this.findExactOfferings(manager, template.id, true)
      if (existing.length > 1) throw conflict("EVENT_SERVICE_OFFERING_AMBIGUOUS", "Для шаблона найдено несколько event-service identities", { offeringIds: existing.map((item) => item.id) })
      if (existing.length === 1) {
        const response = await this.dossier(manager, existing[0]!, template)
        await this.remember(manager, scope, input.operationId, input.idempotencyKey, fingerprint, response)
        return response
      }
      const calendars = await manager.find(BusinessCalendarEntity, { where: { state: "active", archivedAt: IsNull() }, order: { id: "ASC" } })
      if (calendars.length !== 1) throw unprocessable("BUSINESS_CALENDAR_ACTIVE_COUNT_INVALID", "Для подготовки мероприятия нужен ровно один активный календарь", { count: calendars.length })
      const calendar = calendars[0]!
      const offering = await manager.save(manager.create(CatalogOfferingEntity, {
        id: randomUUID(), code: await this.uniqueCode(manager, template), kind: "event_service", operationalName: template.code,
        internalComment: "Подготовлено из EventServiceTemplate; цены и публикация требуют ручной настройки.", state: "draft",
        subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1, salesMode: "quoted", priceDisplayMode: "from",
        currency: "RUB", timezone: calendar.timezone, taxMode: "tax_included", businessCalendarId: calendar.id,
        leadDirection: null, defaultAssigneeId: null, scope: null, ownerOfferingId: null, activePriceBookId: null,
        createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      await manager.save(manager.create(OfferingBindingEntity, {
        id: randomUUID(), offeringId: offering.id, resourceId: null, resourceGroupId: null, programTemplateId: null,
        eventServiceTemplateId: template.id, role: "primary", quantityDefault: 1, capacityImpactDefault: 1,
        preparationBeforeMinutes: template.preparationBeforeMinutes, preparationAfterMinutes: template.preparationAfterMinutes,
        availabilityRequired: false, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      const editorial = await this.ensureEditorial(manager, offering.id, context)
      if (editorial.status === "report_only") throw conflict("OFFERING_EDITORIAL_RECONCILIATION_REQUIRED", "CMS-черновик требует ручной сверки")
      const response = await this.dossier(manager, offering, template)
      await this.recordPrepared(manager, offering, template, calendar, input.operationId, context, fingerprint, "crm.offering.event_service_prepared")
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, fingerprint, response)
      return response
    })
  }

  async preview(offeringId: string, input: EventServiceOfferingQuotePreviewBody, context: EventServiceRequestContext): Promise<EventServiceOfferingQuoteResult> {
    this.assertRead(context)
    const scope = `event-service:offering:${offeringId}:quote-preview`
    return this.serializable(async (manager) => {
      const fingerprint = canonicalSha256({ command: "event-service.quote-preview", offeringId, actorId: context.actor.id, input })
      const replay = await this.replay<EventServiceOfferingQuoteResult>(manager, scope, input.operationId, input.idempotencyKey, fingerprint)
      if (replay) return replay
      const offering = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write").where("offering.id = :offeringId", { offeringId }).getOne()
      if (!offering || offering.archivedAt !== null || offering.kind !== "event_service") throw new NotFoundException({ code: "EVENT_SERVICE_OFFERING_NOT_FOUND", message: "Event-service offering не найден" })
      const bindings = await manager.createQueryBuilder(OfferingBindingEntity, "binding").setLock("pessimistic_read").where("binding.offering_id = :offeringId AND binding.role = 'primary' AND binding.archived_at IS NULL AND binding.event_service_template_id IS NOT NULL", { offeringId }).orderBy("binding.id", "ASC").getMany()
      if (bindings.length !== 1) throw conflict("EVENT_SERVICE_OFFERING_AMBIGUOUS", "Event-service offering не связан с единственным шаблоном", { offeringIds: [offering.id] })
      const binding = bindings[0]!
      const template = await manager.createQueryBuilder(EventServiceTemplateEntity, "template").setLock("pessimistic_read").where("template.id = :id", { id: binding.eventServiceTemplateId }).getOne()
      if (!template || template.archivedAt !== null) throw unprocessable("EVENT_SERVICE_TEMPLATE_MISMATCH", "Шаблон мероприятия недоступен")
      if (!offering.activePriceBookId) throw unprocessable("PRICE_BOOK_NOT_ACTIVE", "Для мероприятия нет активного прайс-листа")
      const book = await manager.createQueryBuilder(PriceBookEntity, "book").setLock("pessimistic_read").where("book.id = :id AND book.offering_id = :offeringId", { id: offering.activePriceBookId, offeringId }).getOne()
      if (!book || book.archivedAt !== null) throw unprocessable("PRICE_BOOK_NOT_ACTIVE", "Активный прайс-лист мероприятия недоступен")
      const now = new Date()
      const nextScheduled = await manager.createQueryBuilder(PriceBookEntity, "book").where("book.offering_id = :offeringId AND book.state = 'scheduled' AND book.archived_at IS NULL", { offeringId }).orderBy("book.scheduled_activation_at", "ASC").getOne()
      if (nextScheduled?.scheduledActivationAt && nextScheduled.scheduledActivationAt <= now) throw conflict("PRICE_BOOK_NOT_ACTIVE", "Запланированная цена ожидает активации", { priceBookId: nextScheduled.id })
      const serviceDate = localDate(new Date(input.startsAt), offering.timezone)
      const snapshot = await eventLoadSnapshot(manager, offering, template, book, serviceDate)
      let calculation
      try {
        calculation = resolveEventServiceQuote(snapshot, { offeringId, eventServiceTemplateId: template.id, ratePlanKey: input.ratePlanKey, startsAt: input.startsAt, endsAt: input.endsAt, guests: input.guests, currency: input.currency }, { quoteId: randomUUID(), calculatedAt: now, quoteTtlSeconds: 15 * 60, nextPricingActivationAt: nextScheduled?.scheduledActivationAt ?? null })
      } catch (error) {
        if (error instanceof DomainError) throw unprocessable(error.code, error.message, { ...error.details, fieldErrors: error.fieldErrors })
        throw error
      }
      const result = EventServiceOfferingQuoteResultSchema.parse({
        quoteType: calculation.quoteType, acceptanceReady: false, quoteId: calculation.quoteId, offeringId, eventServiceTemplateId: template.id,
        calculatedAt: calculation.calculatedAt, validUntil: calculation.validUntil, leadDays: calculation.leadDays, currency: calculation.currency,
        inputs: { startsAt: input.startsAt, endsAt: input.endsAt, serviceDate: calculation.serviceDate, durationMinutes: calculation.durationMinutes, guests: input.guests, timezone: offering.timezone, ratePlanKey: input.ratePlanKey },
        lines: calculation.lines.map((line) => ({ kind: line.kind, label: line.kind === "base" ? "Пакет" : "Дополнительные гости", serviceDate: calculation.serviceDate, quantity: line.quantity, unitAmount: { amountMinor: line.unitAmountMinor, currency: calculation.currency }, amount: { amountMinor: line.totalAmountMinor, currency: calculation.currency }, ratePlanId: line.ratePlan.id, ratePlanVersion: line.ratePlan.version, matchedRuleId: line.matchedRule?.id ?? null, matchedRuleVersion: line.matchedRule?.version ?? null, explanation: line.matchedRule?.selector.type ?? "base" })),
        total: { amountMinor: calculation.totalAmountMinor, currency: calculation.currency },
        provenance: {
          offeringVersion: offering.version, subjectVersion: offering.subjectVersion, eventServiceTemplateVersion: template.version,
          offeringBindingId: binding.id, offeringBindingVersion: binding.version,
          pricingVersion: offering.pricingVersion, addOnsVersion: offering.addonAssignmentsVersion,
          priceBookId: book.id, priceBookVersion: book.version,
          businessCalendarId: snapshot.calendar.id, businessCalendarVersion: snapshot.calendar.version,
          businessCalendarSourceVersion: snapshot.calendar.sourceVersion,
          businessCalendarDateId: calculation.calendarDateId, businessCalendarDateVersion: calculation.calendarDateVersion,
          businessCalendarDateOverrideId: calculation.calendarDateOverrideId, businessCalendarDateOverrideVersion: calculation.calendarDateOverrideVersion,
          preparationBeforeMinutes: calculation.preparationBeforeMinutes, preparationAfterMinutes: calculation.preparationAfterMinutes,
          preparationStartsAt: calculation.preparationStartsAt, preparationEndsAt: calculation.preparationEndsAt,
          matchedRuleIds: [...new Set(calculation.lines.flatMap((line) => line.matchedRule ? [line.matchedRule.id] : []))],
        },
        immutableSnapshot: true,
      })
      await manager.save(manager.create(OfferingQuoteSnapshotEntity, {
        id: calculation.quoteId, offeringId, quoteType: "event_service_preview", offeringVersion: offering.version, subjectVersion: offering.subjectVersion,
        eventServiceTemplateId: template.id, eventServiceTemplateVersion: template.version, programTemplateId: null, programTemplateVersion: null,
        offeringBindingId: binding.id, offeringBindingVersion: binding.version,
        pricingVersion: offering.pricingVersion, addOnAssignmentsVersion: offering.addonAssignmentsVersion, priceBookId: book.id, priceBookVersion: book.version,
        businessCalendarId: snapshot.calendar.id, businessCalendarVersion: snapshot.calendar.version, businessCalendarSourceVersion: snapshot.calendar.sourceVersion,
        requestPayload: { offeringId, eventServiceTemplateId: template.id, ...input } as Record<string, unknown>, resultPayload: result as unknown as Record<string, unknown>, provenance: calculation as unknown as Record<string, unknown>,
        calculatedAt: new Date(calculation.calculatedAt), validUntil: new Date(calculation.validUntil), operationId: input.operationId, idempotencyKey: input.idempotencyKey,
        actorId: context.actor.id, requestId: context.requestId, entrySurface: context.entrySurface, operationalContext: null,
      }))
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, fingerprint, result)
      return result
    })
  }

  async reload(quoteId: string, context: EventServiceRequestContext): Promise<EventServiceOfferingQuoteResult> {
    this.assertRead(context)
    const snapshot = await this.dataSource.getRepository(OfferingQuoteSnapshotEntity).findOneBy({ id: quoteId, quoteType: "event_service_preview" })
    if (!snapshot) throw new NotFoundException({ code: "QUOTE_SNAPSHOT_NOT_FOUND", message: "Event-service quote snapshot не найден" })
    return EventServiceOfferingQuoteSnapshotSchema.parse(snapshot.resultPayload)
  }

  private async dossier(manager: EntityManager, offering: CatalogOfferingEntity, template: EventServiceTemplateEntity): Promise<EventServiceOfferingDossier> {
    const link = await manager.findOne(CmsSourceLinkEntity, { where: { sourceKind: "catalog_offering", sourceId: offering.id } })
    const editorial = link ? await this.editorial(manager, link, offering) : null
    return EventServiceOfferingDossierSchema.parse({
      offering: eventOfferingDto(offering), template: this.templateDto(template), subjectVersion: offering.subjectVersion,
      pricingVersion: offering.pricingVersion, addOnAssignmentsVersion: offering.addonAssignmentsVersion,
      cmsReady: Boolean(editorial), publicReady: false, editorial,
    })
  }

  private async editorial(manager: EntityManager, link: CmsSourceLinkEntity, offering: CatalogOfferingEntity) {
    const node = await manager.findOne(CmsNodeEntity, { where: { id: link.nodeId } })
    if (!node) return null
    const revisions = await manager.find(CmsNodeRevisionEntity, { where: { nodeId: node.id }, order: { revision: "DESC" } })
    const toRevision = (revision: CmsNodeRevisionEntity | undefined) => revision && ["draft", "review", "approved", "scheduled", "published"].includes(revision.state) ? { id: revision.id, revision: revision.revision, state: revision.state as "draft" | "review" | "approved" | "scheduled" | "published", path: revision.path, title: revision.title, contentHash: revision.contentHash } : null
    const profile = await manager.findOne(CmsPublicProfileEntity, { where: { nodeId: node.id } })
    const blockers = [
      ...(offering.state !== "active" ? ["offering_not_active" as const] : []),
      ...(node.status !== "active" || node.archivedAt !== null ? ["cms_node_archived" as const] : []),
      ...(node.kind !== "event_detail" ? ["cms_node_kind_incompatible" as const] : []),
      ...(!profile ? ["public_profile_missing" as const] : []),
      "safe_public_projection_missing" as const,
    ]
    return {
      source: { sourceKind: "catalog_offering" as const, sourceId: offering.id, sourceVersion: link.sourceVersion, createdAt: link.createdAt.toISOString() },
      node: { id: node.id, version: node.version, kind: "event_detail" as const, status: node.status as "active" | "archived" },
      currentRevision: toRevision(revisions.find((revision) => revision.state === "draft" || revision.state === "review") ?? revisions[0]),
      latestPublished: toRevision(revisions.find((revision) => revision.state === "published")),
      publication: { eligible: false as const, blockers },
    }
  }

  private async findExactOfferings(manager: EntityManager, templateId: string, lock: boolean) {
    const builder = manager.createQueryBuilder(CatalogOfferingEntity, "offering")
    if (lock) builder.setLock("pessimistic_write")
    return builder.innerJoin(OfferingBindingEntity, "binding", "binding.offering_id = offering.id")
      .where("offering.kind = 'event_service' AND offering.archived_at IS NULL AND offering.state <> 'archived'")
      .andWhere("binding.event_service_template_id = :templateId AND binding.role = 'primary' AND binding.archived_at IS NULL", { templateId })
      .orderBy("offering.id", "ASC").getMany()
  }

  private async uniqueCode(manager: EntityManager, template: EventServiceTemplateEntity) { const base = `EVENT-${template.code}`.slice(0, 120); if (!await manager.findOne(CatalogOfferingEntity, { where: { code: base } })) return base; throw conflict("OFFERING_CODE_CONFLICT", "Код event-service offering уже занят", { code: base }) }

  private async ensureEditorial(manager: EntityManager, offeringId: string, context: EventServiceRequestContext) {
    try {
      return await ensureCatalogOfferingEditorialDraft(manager, { offeringId, actorId: context.actor.id, requestId: context.requestId })
    } catch (error) {
      const driver = (error as { driverError?: { code?: string }; code?: string }).driverError ?? error as { code?: string }
      if (driver.code === "40001" || driver.code === "40P01") throw error
      throw conflict("OFFERING_EDITORIAL_RECONCILIATION_REQUIRED", "CMS-черновик event-service не прошёл сверку", { reason: error instanceof Error ? error.message : "unknown" })
    }
  }

  private async recordPrepared(manager: EntityManager, offering: CatalogOfferingEntity, template: EventServiceTemplateEntity, calendar: BusinessCalendarEntity, operationId: string, context: EventServiceRequestContext, configurationHash: string, eventType: "crm.offering.event_service_prepared") {
    const now = new Date()
    const base = { occurredAt: now.toISOString(), actorId: context.actor.id, requestId: context.requestId, operationId, entrySurface: context.entrySurface, aggregate: { type: "catalog_offering" as const, id: offering.id }, versions: { calendar: calendar.version, subject: offering.subjectVersion, addOns: offering.addonAssignmentsVersion }, configurationHash }
    const prepared = OfferingConfigurationOutboxEventSchema.parse({ ...base, eventId: randomUUID(), eventType })
    const invalidated = OfferingConfigurationOutboxEventSchema.parse({ ...base, eventId: randomUUID(), eventType: "public.offering_projection.invalidated" })
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "catalog_offering", entityId: offering.id, action: prepared.eventType, actorId: context.actor.id, requestId: context.requestId, changes: { ...prepared, eventServiceTemplateId: template.id, eventServiceTemplateVersion: template.version, publicReady: false }, createdAt: now }))
    await this.saveOutbox(manager, prepared, ["sse"])
    await this.saveOutbox(manager, invalidated, ["sse", "public_projection"])
  }

  private async recordTemplateMutation(manager: EntityManager, offering: CatalogOfferingEntity, operationId: string, context: EventServiceRequestContext, configurationHash: string, eventType: "crm.offering.event_service_updated" | "crm.offering.event_service_reopened") {
    const now = new Date()
    const base = { occurredAt: now.toISOString(), actorId: context.actor.id, requestId: context.requestId, operationId, entrySurface: context.entrySurface, aggregate: { type: "catalog_offering" as const, id: offering.id }, versions: { calendar: null, subject: offering.subjectVersion, addOns: offering.addonAssignmentsVersion }, configurationHash }
    const changed = OfferingConfigurationOutboxEventSchema.parse({ ...base, eventId: randomUUID(), eventType })
    await this.saveOutbox(manager, changed, ["sse"])
    if (offering.state === "active") {
      const invalidated = OfferingConfigurationOutboxEventSchema.parse({ ...base, eventId: randomUUID(), eventType: "public.offering_projection.invalidated" })
      await this.saveOutbox(manager, invalidated, ["sse", "public_projection"])
    }
  }

  private async saveOutbox(manager: EntityManager, event: ReturnType<typeof OfferingConfigurationOutboxEventSchema.parse>, consumers: readonly string[]) { const at = new Date(event.occurredAt); await manager.save(manager.create(OutboxEventEntity, { id: event.eventId, topic: event.eventType, aggregateType: event.aggregate.type, aggregateId: event.aggregate.id, payload: event as unknown as Record<string, unknown>, availableAt: at, processedAt: null, attempts: 0, createdAt: at })); await manager.save(consumers.map((consumer) => manager.create(OutboxDeliveryEntity, { eventId: event.eventId, consumer, status: "pending", attempts: 0, availableAt: at, processedAt: null, lastError: null, createdAt: at, updatedAt: at }))) }
  private async replay<T>(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<T | null> { for (const lock of [`key:${scope}:${idempotencyKey}`, `operation:${scope}:${operationId}`].sort()) await manager.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lock]); const stored = await manager.createQueryBuilder(IdempotencyKeyEntity, "key").where("key.scope = :scope", { scope }).andWhere("(key.operation_id = :operationId OR key.idempotency_key = :idempotencyKey)", { operationId, idempotencyKey }).getOne() as StoredReplay | null; if (!stored) return null; if (stored.operationId !== operationId || stored.idempotencyKey !== idempotencyKey || stored.requestHash !== requestHash) throw conflict("IDEMPOTENCY_CONFLICT", "Ключ идемпотентности уже использован для другой операции"); return stored.responseBody as T }
  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: object) { await manager.save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 200, responseBody: response as Record<string, unknown>, createdAt: new Date() })) }
  private assertRead(context: EventServiceRequestContext) { if (!context.actor.capabilities.canView || context.entrySurface === "admin" && context.actor.capabilities.canViewContent !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для работы с форматами мероприятий" }) }
  private assertEdit(context: EventServiceRequestContext) { if (!context.actor.capabilities.canEdit || context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для изменения формата мероприятия" }) }
  private assertCreate(context: EventServiceRequestContext) { if (!context.actor.capabilities.canCreate || !context.actor.capabilities.canEdit || context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для создания формата мероприятия" }) }
  private assertVersion(actual: number, expected: number, segment: string) { if (actual !== expected) throw conflict("VERSION_CONFLICT", "Сегмент был изменён другим пользователем", { segment, expectedVersion: expected, serverVersion: actual }) }
  private async serializable<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> { for (let attempt = 0; ; attempt += 1) { try { return await this.dataSource.transaction("SERIALIZABLE", operation) } catch (error) { const driver = (error as { driverError?: { code?: string; constraint?: string }; code?: string; constraint?: string }).driverError ?? error as { code?: string; constraint?: string }; if (driver.code === "23505" && driver.constraint === "event_service_templates_code_unique") throw conflict("EVENT_SERVICE_TEMPLATE_CODE_CONFLICT", "Технический код шаблона мероприятия уже занят"); const retryableUnique = driver.code === "23505" && ["catalog_offerings_code_unique", "offering_bindings_one_live_event_service_primary_idx", "offering_bindings_one_primary_idx"].includes(driver.constraint ?? ""); if (attempt >= 2 || driver.code !== "40001" && driver.code !== "40P01" && !retryableUnique) throw error } } }
}
function escapeLike(value: string) { return value.replace(/[\\%_]/g, "\\$&") }
export function encodeEventServiceRegistryCursor(value: { updatedAt: string; id: string }) { return Buffer.from(JSON.stringify(value), "utf8").toString("base64url") }
export function decodeEventServiceRegistryCursor(value: string): { updatedAt: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { updatedAt?: unknown; id?: unknown }
    const updatedAt = new Date(String(parsed.updatedAt ?? ""))
    const id = String(parsed.id ?? "")
    if (Number.isNaN(updatedAt.getTime()) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new Error("invalid")
    return { updatedAt, id }
  } catch {
    throw unprocessable("PAGINATION_CURSOR_INVALID", "Курсор реестра форматов мероприятий некорректен")
  }
}
function conflict(code: string, message: string, details: Record<string, unknown> = {}) { return new ConflictException({ code, message, details }) }
function unprocessable(code: string, message: string, details: Record<string, unknown> = {}) { return new UnprocessableEntityException({ code, message, details }) }
