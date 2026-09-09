import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, In, IsNull, type EntityManager } from "typeorm"

import {
  OfferingConfigurationOutboxEventSchema,
  ProgramOfferingLookupResultSchema,
  ProgramOfferingPrepareResultSchema,
  ProgramOfferingQuoteResultSchema,
  ProgramRegistrationQuoteOperationalContextSchema,
  ProgramRegistrationQuoteResultSchema,
  type ProgramOfferingLookupItem,
  type ProgramOfferingLookupResult,
  type ProgramOfferingPrepareBody,
  type ProgramOfferingPrepareResult,
  type ProgramOfferingQuotePreviewBody,
  type ProgramOfferingQuoteResult,
  type ProgramRegistrationQuoteBody,
  type ProgramRegistrationQuoteResult,
  type PriceWeekday,
  type SessionUser,
} from "@crm/contracts"
import {
  BusinessCalendarDateEntity,
  BusinessCalendarDateOverrideEntity,
  BusinessCalendarEntity,
  AddonOfferingTermsEntity,
  CatalogOfferingEntity,
  ChangeLogEntity,
  CmsNodeEntity,
  CmsSourceLinkEntity,
  IdempotencyKeyEntity,
  OfferingBindingEntity,
  OfferingAddonAssignmentEntity,
  OfferingQuoteSnapshotEntity,
  OutboxDeliveryEntity,
  OutboxEventEntity,
  PriceBookEntity,
  PriceRuleEntity,
  ProgramTemplateEntity,
  ProgramOccurrenceEntity,
  RatePlanEntity,
} from "@crm/db"
import { DomainError, resolveAddOnServiceDateQuote, resolveProgramTemplateQuote, type HousePriceRule, type HousePricingSnapshot, type ProgramPricingSnapshot } from "@crm/domain"

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
        const driver = (error as { driverError?: { code?: string }; code?: string }).driverError ?? error as { code?: string }
        if (driver.code === "40001" || driver.code === "40P01") throw error
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

  async registrationQuote(programOccurrenceId: string, input: ProgramRegistrationQuoteBody, context: ProgramOfferingRequestContext): Promise<ProgramRegistrationQuoteResult> {
    this.assertRead(context)
    const scope = `program-occurrence:${programOccurrenceId}:offering:registration-quote`
    return this.serializable(async (manager) => {
      const fingerprint = canonicalSha256({ command: "program-offering.registration-quote", programOccurrenceId, actorId: context.actor.id, input })
      const replay = await this.replay<ProgramRegistrationQuoteResult>(manager, scope, input.operationId, input.idempotencyKey, fingerprint)
      if (replay) return replay
      const occurrence = await manager.createQueryBuilder(ProgramOccurrenceEntity, "occurrence").setLock("pessimistic_write").where("occurrence.id = :id", { id: programOccurrenceId }).getOne()
      if (!occurrence || occurrence.archivedAt !== null) throw new NotFoundException({ code: "PROGRAM_OCCURRENCE_NOT_FOUND", message: "Проведение программы не найдено" })
      if (occurrence.version !== input.expectedOccurrenceVersion) throw conflict("VERSION_CONFLICT", "Проведение программы было изменено", { segment: "programOccurrence", expectedVersion: input.expectedOccurrenceVersion, serverVersion: occurrence.version })
      if (occurrence.status !== "open") throw conflict("PROGRAM_OCCURRENCE_NOT_OPEN", "Регистрация на проведение закрыта")
      if (input.participants > occurrence.participantLimit) throw unprocessable("CAPACITY_EXCEEDED", "Количество участников превышает лимит проведения")
      const template = await manager.createQueryBuilder(ProgramTemplateEntity, "template").setLock("pessimistic_write").where("template.id = :id", { id: occurrence.templateId }).getOne()
      if (!template || template.archivedAt !== null) throw new NotFoundException({ code: "PROGRAM_TEMPLATE_NOT_FOUND", message: "Шаблон программы не найден" })
      if ((occurrence.endsAt.getTime() - occurrence.startsAt.getTime()) / 60_000 !== template.durationMinutes) throw unprocessable("PROGRAM_OCCURRENCE_DURATION_MISMATCH", "Длительность проведения не совпадает с шаблоном")
      const candidates = await this.findExactOfferings(manager, template.id, true)
      if (candidates.length !== 1) throw conflict(candidates.length ? "PROGRAM_OFFERING_AMBIGUOUS" : "PROGRAM_OFFERING_NOT_FOUND", "Program offering не найден однозначно", { offeringIds: candidates.map((item) => item.id) })
      const offering = candidates[0]!
      if (offering.state !== "active" || !offering.activePriceBookId) throw unprocessable("PRICE_BOOK_NOT_ACTIVE", "Активная цена программы недоступна")
      const book = await manager.createQueryBuilder(PriceBookEntity, "book").setLock("pessimistic_write").where("book.id = :id AND book.offering_id = :offeringId", { id: offering.activePriceBookId, offeringId: offering.id }).getOne()
      if (!book || book.archivedAt !== null || book.state !== "active") throw unprocessable("PRICE_BOOK_NOT_ACTIVE", "Активная цена программы недоступна")
      const serviceDate = localDate(occurrence.startsAt, offering.timezone)
      const snapshot = await this.loadSnapshot(manager, offering, template, book, serviceDate)
      const override = occurrence.ratePlanOverrideId === null ? null : snapshot.ratePlans.find((plan) => plan.id === occurrence.ratePlanOverrideId)
      if (occurrence.ratePlanOverrideId !== null && !override) throw unprocessable("RATE_PLAN_OVERRIDE_INVALID", "Тариф проведения больше недоступен")
      if (override && input.ratePlanKey !== null && input.ratePlanKey !== override.key) throw unprocessable("RATE_PLAN_OVERRIDE_MISMATCH", "Для проведения закреплён другой тариф")
      const now = new Date()
      const nextScheduled = await manager.createQueryBuilder(PriceBookEntity, "book").where("book.offering_id = :offeringId AND book.state = 'scheduled'", { offeringId: offering.id }).orderBy("book.scheduled_activation_at", "ASC").getOne()
      if (nextScheduled?.scheduledActivationAt && nextScheduled.scheduledActivationAt <= now) throw conflict("PRICE_BOOK_NOT_ACTIVE", "Запланированная цена ожидает активации", { priceBookId: nextScheduled.id })
      let calculation
      try {
        calculation = resolveProgramTemplateQuote(snapshot, {
          offeringId: offering.id, programTemplateId: template.id, ratePlanKey: override?.key ?? input.ratePlanKey,
          serviceDate, participants: input.participants, durationMinutes: template.durationMinutes, currency: input.currency,
        }, { quoteId: randomUUID(), calculatedAt: now, quoteTtlSeconds: 15 * 60, nextPricingActivationAt: nextScheduled?.scheduledActivationAt ?? null })
      } catch (error) {
        if (error instanceof DomainError) throw unprocessable(error.code, error.message, { ...error.details, fieldErrors: error.fieldErrors })
        throw error
      }
      const addOns = await this.calculateProgramAddOns(manager, offering, input, serviceDate, now)
      const selections = [...input.addOns].sort((left, right) => left.assignmentId.localeCompare(right.assignmentId))
      const validUntil = addOns.validUntil && addOns.validUntil < calculation.validUntil ? addOns.validUntil : calculation.validUntil
      const baseLines = calculation.lines.map((line) => ({
        kind: line.kind, label: line.kind === "base" ? (snapshot.ratePlans.find((plan) => plan.id === line.ratePlan.id)?.pricingBasis === "per_person" ? "Участники" : "Пакет") : "Дополнительные участники",
        serviceDate, quantity: line.quantity, unitAmount: { amountMinor: line.unitAmountMinor, currency: calculation.currency }, amount: { amountMinor: line.totalAmountMinor, currency: calculation.currency },
        ratePlanId: line.ratePlan.id, ratePlanVersion: line.ratePlan.version, matchedRuleId: line.matchedRule?.id ?? null, matchedRuleVersion: line.matchedRule?.version ?? null, explanation: line.matchedRule?.selector.type ?? "base",
      }))
      const result = ProgramRegistrationQuoteResultSchema.parse({
        quoteType: "program_registration", acceptanceReady: true, quoteId: calculation.quoteId, offeringId: offering.id,
        programTemplateId: template.id, programOccurrenceId: occurrence.id, programOccurrenceVersion: occurrence.version,
        calculatedAt: calculation.calculatedAt, validUntil, leadDays: calculation.leadDays, currency: calculation.currency,
        inputs: { serviceDate, startsAt: occurrence.startsAt.toISOString(), endsAt: occurrence.endsAt.toISOString(), participants: input.participants, durationMinutes: template.durationMinutes, addOns: selections },
        lines: [...baseLines, ...addOns.lines], total: { amountMinor: calculation.totalAmountMinor + addOns.lines.reduce((sum, line) => sum + line.amount.amountMinor, 0), currency: calculation.currency },
        provenance: { offeringVersion: offering.version, subjectVersion: offering.subjectVersion, programTemplateVersion: template.version, pricingVersion: offering.pricingVersion, addOnsVersion: offering.addonAssignmentsVersion, priceBookId: book.id, priceBookVersion: book.version, businessCalendarId: snapshot.calendar.id, businessCalendarVersion: snapshot.calendar.version, businessCalendarSourceVersion: snapshot.calendar.sourceVersion, matchedRuleIds: [...new Set([...calculation.lines.flatMap((line) => line.matchedRule ? [line.matchedRule.id] : []), ...addOns.lines.flatMap((line) => line.matchedRuleId ? [line.matchedRuleId] : [])])], addOns: addOns.provenance },
        immutableSnapshot: true,
      })
      const operationalContext = ProgramRegistrationQuoteOperationalContextSchema.parse({ kind: "program_registration", subjectVersion: offering.subjectVersion, programTemplateId: template.id, programTemplateVersion: template.version, programOccurrenceId: occurrence.id, programOccurrenceVersion: occurrence.version })
      await manager.save(manager.create(OfferingQuoteSnapshotEntity, {
        id: calculation.quoteId, offeringId: offering.id, quoteType: "program_registration", offeringVersion: offering.version, subjectVersion: offering.subjectVersion,
        programTemplateId: template.id, programTemplateVersion: template.version, pricingVersion: offering.pricingVersion, addOnAssignmentsVersion: offering.addonAssignmentsVersion,
        priceBookId: book.id, priceBookVersion: book.version, businessCalendarId: snapshot.calendar.id, businessCalendarVersion: snapshot.calendar.version,
        businessCalendarSourceVersion: snapshot.calendar.sourceVersion, requestPayload: { ...input, addOns: selections } as Record<string, unknown>, resultPayload: result as unknown as Record<string, unknown>, provenance: { base: calculation, addOns: addOns.provenance } as unknown as Record<string, unknown>,
        calculatedAt: new Date(calculation.calculatedAt), validUntil: new Date(validUntil), operationId: input.operationId, idempotencyKey: input.idempotencyKey,
        actorId: context.actor.id, requestId: context.requestId, entrySurface: context.entrySurface, operationalContext,
      }))
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, fingerprint, result)
      return result
    })
  }

  private async calculateProgramAddOns(manager: EntityManager, owner: CatalogOfferingEntity, input: ProgramRegistrationQuoteBody, serviceDate: string, now: Date) {
    const lines: ProgramRegistrationQuoteResult["lines"] = []
    const provenance: ProgramRegistrationQuoteResult["provenance"]["addOns"] = []
    let validUntil: Date | null = null
    for (const selection of [...input.addOns].sort((left, right) => left.assignmentId.localeCompare(right.assignmentId))) {
      const assignment = await manager.createQueryBuilder(OfferingAddonAssignmentEntity, "assignment").setLock("pessimistic_write")
        .where("assignment.id = :id AND assignment.offering_id = :offeringId AND assignment.archived_at IS NULL", { id: selection.assignmentId, offeringId: owner.id }).getOne()
      if (!assignment || !assignment.enabled) throw unprocessable("ADDON_ASSIGNMENT_UNAVAILABLE", "Дополнительная услуга не подключена к программе", { assignmentId: selection.assignmentId })
      const addOn = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write")
        .where("offering.id = :id AND offering.kind = 'addon' AND offering.archived_at IS NULL", { id: assignment.addonOfferingId }).getOne()
      if (!addOn || addOn.state !== "active" || addOn.salesMode === "request_only") throw unprocessable("ADDON_OFFERING_INACTIVE", "Дополнительная услуга недоступна", { assignmentId: assignment.id })
      const terms = await manager.findOne(AddonOfferingTermsEntity, { where: { offeringId: addOn.id } })
      if (!terms || terms.offeringKind !== "addon" || (terms.serviceType !== "quantity_service" && terms.serviceType !== "person_service")) throw unprocessable("ADDON_SERVICE_TYPE_UNSUPPORTED", "Для регистрации поддерживаются только quantity_service и person_service", { assignmentId: assignment.id })
      if (!terms.applicableOfferingKinds.includes("program")) throw unprocessable("ADDON_NOT_APPLICABLE", "Дополнительная услуга не подходит программе", { assignmentId: assignment.id })
      const minimum = assignment.minimumQuantity ?? terms.minimumQuantity ?? 1
      const maximum = assignment.maximumQuantity ?? terms.maximumQuantity
      const step = terms.quantityStep ?? 1
      if (selection.quantity < minimum || maximum !== null && selection.quantity > maximum || (selection.quantity - minimum) % step !== 0) throw unprocessable("ADDON_QUANTITY_OUT_OF_RANGE", "Количество дополнительной услуги вне допустимого диапазона", { assignmentId: assignment.id, minimum, maximum, step })
      if (terms.serviceType === "person_service" && selection.quantity !== input.participants) throw unprocessable("ADDON_PARTICIPANT_QUANTITY_MISMATCH", "Количество person-service должно совпадать с участниками", { assignmentId: assignment.id })
      if (addOn.currency !== input.currency || !addOn.activePriceBookId) throw unprocessable("ADDON_PRICE_BOOK_NOT_ACTIVE", "Для дополнительной услуги нет активной цены", { assignmentId: assignment.id })
      const book = await manager.createQueryBuilder(PriceBookEntity, "book").setLock("pessimistic_write").where("book.id = :id AND book.offering_id = :offeringId", { id: addOn.activePriceBookId, offeringId: addOn.id }).getOne()
      if (!book || book.archivedAt !== null || book.state !== "active") throw unprocessable("ADDON_PRICE_BOOK_NOT_ACTIVE", "Для дополнительной услуги нет активной цены", { assignmentId: assignment.id })
      const snapshot = await this.loadAddOnSnapshot(manager, addOn, book, serviceDate)
      let calculation
      try {
        calculation = resolveAddOnServiceDateQuote(snapshot, { offeringId: addOn.id, ratePlanKey: assignment.ratePlanKeyOverride, serviceDate, quantity: selection.quantity, serviceType: terms.serviceType, currency: input.currency }, { quoteId: randomUUID(), calculatedAt: now, quoteTtlSeconds: 15 * 60, nextPricingActivationAt: null })
      } catch (error) {
        if (error instanceof DomainError) throw unprocessable(error.code, error.message, { ...error.details, fieldErrors: error.fieldErrors })
        throw error
      }
      const scheduled = await manager.createQueryBuilder(PriceBookEntity, "book").where("book.offering_id = :offeringId AND book.state = 'scheduled'", { offeringId: addOn.id }).orderBy("book.scheduled_activation_at", "ASC").getOne()
      if (scheduled?.scheduledActivationAt && scheduled.scheduledActivationAt <= now) throw conflict("ADDON_PRICE_BOOK_NOT_ACTIVE", "Запланированная цена дополнения ожидает активации", { assignmentId: assignment.id })
      if (scheduled?.scheduledActivationAt && (!validUntil || scheduled.scheduledActivationAt < validUntil)) validUntil = scheduled.scheduledActivationAt
      lines.push({ kind: "addon", label: assignment.labelOverride ?? addOn.operationalName, serviceDate, quantity: calculation.quantity, unitAmount: { amountMinor: calculation.unitAmountMinor, currency: calculation.currency }, amount: { amountMinor: calculation.totalAmountMinor, currency: calculation.currency }, ratePlanId: calculation.ratePlan.id, ratePlanVersion: calculation.ratePlan.version, matchedRuleId: calculation.matchedRule?.id ?? null, matchedRuleVersion: calculation.matchedRule?.version ?? null, addOnAssignmentId: assignment.id, addOnOfferingId: addOn.id, explanation: calculation.matchedRule?.selector.type ?? "base" })
      provenance.push({ assignmentId: assignment.id, addOnOfferingId: addOn.id, serviceType: terms.serviceType, offeringVersion: addOn.version, pricingVersion: addOn.pricingVersion, priceBookId: book.id, priceBookVersion: book.version, businessCalendarId: calculation.calendarId, businessCalendarVersion: calculation.calendarVersion })
    }
    const ttl = new Date(now.getTime() + 15 * 60 * 1000)
    return { lines, provenance, validUntil: validUntil && validUntil < ttl ? validUntil.toISOString() : input.addOns.length ? ttl.toISOString() : null }
  }

  private async loadAddOnSnapshot(manager: EntityManager, offering: CatalogOfferingEntity, book: PriceBookEntity, serviceDate: string): Promise<HousePricingSnapshot> {
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
      ratePlans: plans.filter((plan) => plan.archivedAt === null).map((plan) => ({ id: plan.id, version: plan.version, priceBookId: plan.priceBookId, key: plan.key, label: plan.label, pricingBasis: plan.pricingBasis, quantityMetric: plan.quantityMetric as "guests" | "participants" | "units" | null, baseAmountMinor: plan.baseAmountMinor, includedQuantity: plan.includedQuantity, baseExtraUnitAmountMinor: plan.baseExtraUnitAmountMinor, minQuantity: plan.minimumQuantity, maxQuantity: plan.maximumQuantity, minDurationMinutes: plan.minimumDurationMinutes, maxDurationMinutes: plan.maximumDurationMinutes, isDefault: plan.isDefault, archived: false, rules: (byPlan.get(plan.id) ?? []).map((rule) => this.rule(rule)) })),
      calendar: { id: calendar.id, version: calendar.version, state: calendar.state, timezone: calendar.timezone, sourceVersion: calendar.sourceVersion, dates: days.map((day) => ({ date: day.localDate, official: { id: day.id, version: day.version, dayClass: day.officialClass as "weekday" | "weekend" | "holiday", sourceVersion: day.sourceVersion }, activeOverride: overrides[0] ? { id: overrides[0].id, version: overrides[0].version, dayClass: overrides[0].overrideClass as "weekday" | "weekend" | "holiday", reason: overrides[0].reason } : null })) },
    }
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
function localDate(value: Date, timezone: string) { const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value); const get = (type: "year" | "month" | "day") => parts.find((item) => item.type === type)!.value; return `${get("year")}-${get("month")}-${get("day")}` }
function conflict(code: string, message: string, details: Record<string, unknown> = {}) { return new ConflictException({ code, message, details }) }
function unprocessable(code: string, message: string, details: Record<string, unknown> = {}) { return new UnprocessableEntityException({ code, message, details }) }
