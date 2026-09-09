import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, IsNull, type EntityManager } from "typeorm"

import {
  BusinessCalendarDetailSchema,
  BusinessCalendarListResponseSchema,
  BusinessCalendarMutationResultSchema,
  OfferingConfigurationOutboxEventSchema,
  type BusinessCalendarCreate,
  type BusinessCalendarDetail,
  type BusinessCalendarImport,
  type BusinessCalendarListQuery,
  type BusinessCalendarListResponse,
  type BusinessCalendarMutation,
  type BusinessCalendarMutationResult,
  type BusinessCalendarOverrideReplace,
  type BusinessCalendarStateTransition,
} from "@crm/contracts"
import {
  BusinessCalendarDateEntity,
  BusinessCalendarDateOverrideEntity,
  BusinessCalendarEntity,
  ChangeLogEntity,
  IdempotencyKeyEntity,
  OutboxDeliveryEntity,
  OutboxEventEntity,
} from "@crm/db"
import { DomainError, assertBusinessCalendarMutable, businessCalendarContentHash, validateBusinessCalendarActivation, validateBusinessCalendarCoverageChange, validateBusinessCalendarImport } from "@crm/domain"

import { canonicalSha256 } from "./offering-mutation-support.js"
import type { OfferingRequestContext } from "./offering-editor-application.service.js"

type StoredReplay = { responseBody: Record<string, unknown> | null; operationId: string; idempotencyKey: string; requestHash: string }
type Cursor = { updatedAt: string; id: string }

@Injectable()
export class BusinessCalendarApplicationService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: BusinessCalendarListQuery, context: OfferingRequestContext): Promise<BusinessCalendarListResponse> {
    this.assertRead(context)
    const cursor = query.cursor ? decodeCursor(query.cursor) : null
    const builder = this.dataSource.getRepository(BusinessCalendarEntity).createQueryBuilder("calendar")
      .where("calendar.archived_at IS NULL")
      .orderBy("calendar.updated_at", "DESC").addOrderBy("calendar.id", "DESC").take(query.limit + 1)
    if (query.state) builder.andWhere("calendar.state = :state", { state: query.state })
    if (query.q) builder.andWhere("(LOWER(calendar.name) LIKE :q ESCAPE '\\' OR LOWER(calendar.code) LIKE :q ESCAPE '\\')", { q: `%${escapeLike(query.q.toLocaleLowerCase("ru-RU"))}%` })
    if (cursor) builder.andWhere("(calendar.updated_at, calendar.id) < (:updatedAt, :id)", cursor)
    const rows = await builder.getMany()
    const items = rows.slice(0, query.limit)
    const last = items.at(-1)
    return BusinessCalendarListResponseSchema.parse({
      items: items.map((item) => this.calendarSummary(item)),
      nextCursor: rows.length > query.limit && last ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id }) : null,
    })
  }

  async detail(calendarId: string, context: OfferingRequestContext): Promise<BusinessCalendarDetail> {
    this.assertRead(context)
    return this.dataSource.transaction("REPEATABLE READ", async (manager) => this.loadDetail(manager, calendarId))
  }

  async create(input: BusinessCalendarCreate, context: OfferingRequestContext): Promise<BusinessCalendarMutationResult> {
    this.assertEdit(context)
    const scope = "business-calendar:create"
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "calendar.create", code: input.code, input })
      const replay = await this.replay<BusinessCalendarMutationResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const duplicate = await manager.findOne(BusinessCalendarEntity, { where: { code: input.code } })
      if (duplicate) throw conflict("BUSINESS_CALENDAR_CODE_TAKEN", "Календарь с таким кодом уже существует", { code: input.code })
      const now = new Date()
      const calendar = await manager.save(manager.create(BusinessCalendarEntity, {
        id: randomUUID(), code: input.code, name: input.name, timezone: input.timezone, countryCode: "RU",
        source: "official_ru", sourceVersion: "unimported", state: "draft", importedAt: now,
        coverageFrom: null, coverageToExclusive: null, contentHash: null,
        createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      const response = BusinessCalendarMutationResultSchema.parse({ calendar: await this.loadDetail(manager, calendar.id) })
      await this.record(manager, calendar, "created", input.operationId, context, { calendar: calendar.version })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async update(input: BusinessCalendarMutation, context: OfferingRequestContext): Promise<BusinessCalendarMutationResult> {
    this.assertEdit(context)
    const scope = `business-calendar:${input.calendarId}:update`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "calendar.update", calendarId: input.calendarId, input })
      const replay = await this.replay<BusinessCalendarMutationResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const calendar = await this.lockCalendar(manager, input.calendarId)
      this.assertVersion(calendar, input.expectedCalendarVersion)
      this.assertMutable(calendar)
      if (input.name === calendar.name) {
        const response = BusinessCalendarMutationResultSchema.parse({ calendar: await this.loadDetail(manager, calendar.id) })
        await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
        return response
      }
      calendar.name = input.name ?? calendar.name
      calendar.updatedBy = context.actor.id
      const saved = await manager.save(calendar)
      const response = BusinessCalendarMutationResultSchema.parse({ calendar: await this.loadDetail(manager, saved.id) })
      await this.record(manager, saved, "updated", input.operationId, context, { calendar: saved.version })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async importOfficial(input: BusinessCalendarImport, context: OfferingRequestContext): Promise<BusinessCalendarMutationResult> {
    this.assertEdit(context)
    const scope = `business-calendar:${input.calendarId}:import`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "calendar.import", calendarId: input.calendarId, input })
      const replay = await this.replay<BusinessCalendarMutationResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const calendar = await this.lockCalendar(manager, input.calendarId)
      this.assertVersion(calendar, input.expectedCalendarVersion)
      this.assertMutable(calendar)
      this.validateDomain(() => validateBusinessCalendarImport(input.coverage, input.days))
      const overrides = await manager.find(BusinessCalendarDateOverrideEntity, { where: { calendarId: calendar.id, archivedAt: IsNull(), state: "active" } })
      const outsideOverride = overrides.find((override) => override.localDate < input.coverage.from || override.localDate >= input.coverage.toExclusive)
      if (outsideOverride) {
        throw unprocessable("BUSINESS_CALENDAR_OVERRIDE_OUTSIDE_COVERAGE", "Сначала удалите override за пределами нового покрытия", { date: outsideOverride.localDate })
      }
      const contentHash = businessCalendarContentHash(input.sourceVersion, input.coverage, input.days, overrides.map(toOverrideHash))
      if (calendar.contentHash === contentHash) {
        const response = BusinessCalendarMutationResultSchema.parse({ calendar: await this.loadDetail(manager, calendar.id) })
        await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
        return response
      }
      if (calendar.state === "active") {
        this.validateDomain(() => validateBusinessCalendarCoverageChange(calendar.coverageFrom && calendar.coverageToExclusive ? { from: calendar.coverageFrom, toExclusive: calendar.coverageToExclusive } : null, input.coverage))
      }
      await manager.delete(BusinessCalendarDateEntity, { calendarId: calendar.id })
      calendar.sourceVersion = input.sourceVersion
      calendar.importedAt = new Date()
      calendar.coverageFrom = input.coverage.from
      calendar.coverageToExclusive = input.coverage.toExclusive
      calendar.contentHash = contentHash
      calendar.updatedBy = context.actor.id
      const saved = await manager.save(calendar)
      await manager.save(input.days.map((day) => manager.create(BusinessCalendarDateEntity, {
        id: randomUUID(), calendarId: calendar.id, localDate: day.date, officialClass: day.dayClass,
        officialLabel: day.label, sourceVersion: input.sourceVersion, createdBy: context.actor.id,
        updatedBy: context.actor.id, archivedAt: null,
      })))
      const response = BusinessCalendarMutationResultSchema.parse({ calendar: await this.loadDetail(manager, saved.id) })
      await this.record(manager, saved, "official_imported", input.operationId, context, { calendar: saved.version, configurationHash: calendar.contentHash })
      await this.invalidateLiveOfferings(manager, saved, input.operationId, context)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async replaceOverride(input: BusinessCalendarOverrideReplace, context: OfferingRequestContext): Promise<BusinessCalendarMutationResult> {
    this.assertEdit(context)
    const scope = `business-calendar:${input.calendarId}:override:${input.date}`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "calendar.override.replace", calendarId: input.calendarId, date: input.date, input })
      const replay = await this.replay<BusinessCalendarMutationResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const calendar = await this.lockCalendar(manager, input.calendarId)
      this.assertVersion(calendar, input.expectedCalendarVersion)
      this.assertMutable(calendar)
      this.assertDateCovered(calendar, input.date)
      const existing = await manager.createQueryBuilder(BusinessCalendarDateOverrideEntity, "override").setLock("pessimistic_write")
        .where("override.calendar_id = :calendarId AND override.local_date = :date", { calendarId: calendar.id, date: input.date }).getOne()
      if ((input.override === null && (!existing || existing.archivedAt !== null)) || (input.override !== null && existing?.archivedAt === null && existing.state === "active" && existing.overrideClass === input.override.dayClass && existing.label === input.override.label && existing.reason === input.override.reason)) {
        const response = BusinessCalendarMutationResultSchema.parse({ calendar: await this.loadDetail(manager, calendar.id) })
        await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
        return response
      }
      if (input.override === null) {
        if (existing && existing.archivedAt === null) { existing.archivedAt = new Date(); existing.updatedBy = context.actor.id; await manager.save(existing) }
      } else if (existing) {
        existing.overrideClass = input.override.dayClass; existing.label = input.override.label; existing.reason = input.override.reason
        existing.state = "active"; existing.archivedAt = null; existing.updatedBy = context.actor.id; await manager.save(existing)
      } else {
        await manager.save(manager.create(BusinessCalendarDateOverrideEntity, {
          id: randomUUID(), calendarId: calendar.id, localDate: input.date, overrideClass: input.override.dayClass,
          label: input.override.label, reason: input.override.reason, state: "active", createdBy: context.actor.id,
          updatedBy: context.actor.id, archivedAt: null,
        }))
      }
      const [daysForHash, overridesForHash] = await Promise.all([
        manager.find(BusinessCalendarDateEntity, { where: { calendarId: calendar.id, archivedAt: IsNull() }, order: { localDate: "ASC" } }),
        manager.find(BusinessCalendarDateOverrideEntity, { where: { calendarId: calendar.id, archivedAt: IsNull(), state: "active" }, order: { localDate: "ASC" } }),
      ])
      calendar.contentHash = businessCalendarContentHash(calendar.sourceVersion, { from: calendar.coverageFrom!, toExclusive: calendar.coverageToExclusive! }, daysForHash.map((day) => ({ date: day.localDate, dayClass: day.officialClass as "weekday" | "weekend" | "holiday", label: day.officialLabel })), overridesForHash.map(toOverrideHash))
      calendar.updatedBy = context.actor.id
      const saved = await manager.save(calendar)
      const response = BusinessCalendarMutationResultSchema.parse({ calendar: await this.loadDetail(manager, saved.id) })
      await this.record(manager, saved, input.override ? "override_replaced" : "override_removed", input.operationId, context, { calendar: saved.version, date: input.date })
      if (saved.state === "active") await this.invalidateLiveOfferings(manager, saved, input.operationId, context)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async transition(input: BusinessCalendarStateTransition, context: OfferingRequestContext): Promise<BusinessCalendarMutationResult> {
    this.assertChangeState(context)
    const scope = `business-calendar:${input.calendarId}:transition`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "calendar.transition", calendarId: input.calendarId, input })
      const replay = await this.replay<BusinessCalendarMutationResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const calendar = await this.lockCalendar(manager, input.calendarId)
      this.assertVersion(calendar, input.expectedCalendarVersion)
      if (input.targetState === "active") await this.assertCalendarReady(manager, calendar)
      if (calendar.state === "retired" && input.targetState !== "retired") throw conflict("BUSINESS_CALENDAR_RETIRED", "Снятый с использования календарь неизменяем")
      if (calendar.state === input.targetState) {
        const response = BusinessCalendarMutationResultSchema.parse({ calendar: await this.loadDetail(manager, calendar.id) })
        await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
        return response
      }
      calendar.state = input.targetState; calendar.updatedBy = context.actor.id
      const saved = await manager.save(calendar)
      const response = BusinessCalendarMutationResultSchema.parse({ calendar: await this.loadDetail(manager, saved.id) })
      await this.record(manager, saved, `state_${input.targetState}`, input.operationId, context, { calendar: saved.version, reason: input.reason })
      await this.invalidateLiveOfferings(manager, saved, input.operationId, context)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  private async loadDetail(manager: EntityManager, calendarId: string): Promise<BusinessCalendarDetail> {
    const calendar = await manager.findOne(BusinessCalendarEntity, { where: { id: calendarId } })
    if (!calendar || calendar.archivedAt !== null) throw new NotFoundException({ code: "BUSINESS_CALENDAR_NOT_FOUND", message: "Календарь не найден" })
    const [dates, overrides] = await Promise.all([
      manager.find(BusinessCalendarDateEntity, { where: { calendarId, archivedAt: IsNull() }, order: { localDate: "ASC" } }),
      manager.find(BusinessCalendarDateOverrideEntity, { where: { calendarId, archivedAt: IsNull(), state: "active" }, order: { localDate: "ASC" } }),
    ])
    const overridesByDate = new Map(overrides.map((item) => [item.localDate, item]))
    return BusinessCalendarDetailSchema.parse({
      ...this.calendarSummary(calendar),
      days: dates.map((date) => {
        const override = overridesByDate.get(date.localDate)
        return { calendarId, date: date.localDate, dayClass: (override?.overrideClass ?? date.officialClass), label: override?.label ?? date.officialLabel,
          source: override ? "manual_override" : "official_ru", sourceVersion: date.sourceVersion, version: override?.version ?? date.version }
      }),
      overrides: overrides.map((item) => ({ id: item.id, calendarId: item.calendarId, date: item.localDate, dayClass: item.overrideClass, label: item.label, reason: item.reason, version: item.version, state: item.state, updatedAt: item.updatedAt.toISOString() })),
    })
  }

  private calendarSummary(calendar: BusinessCalendarEntity) {
    return { id: calendar.id, code: calendar.code, version: calendar.version, name: calendar.name, countryCode: "RU", timezone: calendar.timezone,
      state: calendar.state, sourceVersion: calendar.sourceVersion, importedAt: calendar.importedAt.toISOString(), updatedAt: calendar.updatedAt.toISOString(),
      coverage: calendar.coverageFrom && calendar.coverageToExclusive ? { from: calendar.coverageFrom, toExclusive: calendar.coverageToExclusive } : null, contentHash: calendar.contentHash }
  }

  private async lockCalendar(manager: EntityManager, calendarId: string) {
    const calendar = await manager.createQueryBuilder(BusinessCalendarEntity, "calendar").setLock("pessimistic_write").where("calendar.id = :calendarId", { calendarId }).getOne()
    if (!calendar || calendar.archivedAt !== null) throw new NotFoundException({ code: "BUSINESS_CALENDAR_NOT_FOUND", message: "Календарь не найден" })
    return calendar
  }

  private assertVersion(calendar: BusinessCalendarEntity, expectedVersion: number) {
    if (calendar.version !== expectedVersion) throw conflict("VERSION_CONFLICT", "Календарь был изменён другим пользователем", { segment: "calendar", calendarId: calendar.id, expectedVersion, serverVersion: calendar.version })
  }

  private async assertCalendarReady(manager: EntityManager, calendar: BusinessCalendarEntity) {
    const [days, overrides] = await Promise.all([
      manager.find(BusinessCalendarDateEntity, { where: { calendarId: calendar.id, archivedAt: IsNull() }, order: { localDate: "ASC" } }),
      manager.find(BusinessCalendarDateOverrideEntity, { where: { calendarId: calendar.id, archivedAt: IsNull(), state: "active" }, order: { localDate: "ASC" } }),
    ])
    this.validateDomain(() => validateBusinessCalendarActivation({ currentState: calendar.state as "draft" | "active" | "retired", sourceVersion: calendar.sourceVersion, coverage: calendar.coverageFrom && calendar.coverageToExclusive ? { from: calendar.coverageFrom, toExclusive: calendar.coverageToExclusive } : null, importedDays: days.map((day) => ({ date: day.localDate, dayClass: day.officialClass as "weekday" | "weekend" | "holiday", label: day.officialLabel })), overrides: overrides.map(toOverrideHash), contentHash: calendar.contentHash }))
  }

  private assertMutable(calendar: BusinessCalendarEntity) {
    this.validateDomain(() => assertBusinessCalendarMutable(calendar.state as "draft" | "active" | "retired"))
  }

  private assertCoverageNotShrunk(calendar: BusinessCalendarEntity, from: string, toExclusive: string) {
    if ((calendar.coverageFrom && from > calendar.coverageFrom) || (calendar.coverageToExclusive && toExclusive < calendar.coverageToExclusive)) {
      throw conflict("BUSINESS_CALENDAR_COVERAGE_SHRINK", "Активное покрытие календаря нельзя сокращать", { current: { from: calendar.coverageFrom, toExclusive: calendar.coverageToExclusive }, requested: { from, toExclusive } })
    }
  }

  private assertDateCovered(calendar: BusinessCalendarEntity, date: string) {
    if (!calendar.coverageFrom || !calendar.coverageToExclusive || date < calendar.coverageFrom || date >= calendar.coverageToExclusive) {
      throw unprocessable("BUSINESS_CALENDAR_DATE_OUTSIDE_COVERAGE", "Дата не входит в импортированное покрытие календаря", { date })
    }
  }

  private assertCompleteCoverage(from: string, toExclusive: string, dates: readonly string[]) {
    const supplied = new Set(dates)
    if (supplied.size !== dates.length) throw unprocessable("BUSINESS_CALENDAR_DUPLICATE_DATE", "Импорт содержит повторяющиеся даты")
    for (let date = from; date < toExclusive; date = addDays(date, 1)) {
      if (!supplied.has(date)) throw unprocessable("BUSINESS_CALENDAR_INCOMPLETE_COVERAGE", "Импорт должен явно классифицировать каждый день периода", { missingDate: date })
    }
    if (supplied.size !== dayCount(from, toExclusive)) throw unprocessable("BUSINESS_CALENDAR_INVALID_COVERAGE", "Импорт содержит даты вне указанного периода")
  }

  private validateDomain(action: () => void) { try { action() } catch (error) { if (error instanceof DomainError) throw unprocessable(error.code, error.message, error.details); throw error } }

  private async record(manager: EntityManager, calendar: BusinessCalendarEntity, action: string, operationId: string, context: OfferingRequestContext, versions: { calendar: number; configurationHash?: string; [key: string]: unknown }) {
    const now = new Date()
    const eventType = action === "created" ? "crm.business_calendar.created" : action === "updated" ? "crm.business_calendar.updated" : action === "official_imported" ? "crm.business_calendar.imported" : action.startsWith("state_") ? "crm.business_calendar.state_changed" : "crm.business_calendar.override_replaced"
    const event = OfferingConfigurationOutboxEventSchema.parse({ eventId: randomUUID(), eventType, occurredAt: now.toISOString(), actorId: context.actor.id, requestId: context.requestId, operationId, entrySurface: context.entrySurface, aggregate: { type: "business_calendar", id: calendar.id }, versions: { calendar: calendar.version, subject: null, addOns: null }, configurationHash: versions.configurationHash ?? calendar.contentHash ?? canonicalSha256({ id: calendar.id, version: calendar.version }) })
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "business_calendar", entityId: calendar.id, action, actorId: context.actor.id, requestId: context.requestId, changes: { ...versions, operationId, entrySurface: context.entrySurface }, createdAt: now }))
    await manager.save(manager.create(OutboxEventEntity, { id: event.eventId, topic: event.eventType, aggregateType: "business_calendar", aggregateId: calendar.id, payload: event as unknown as Record<string, unknown>, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
    await manager.save(manager.create(OutboxDeliveryEntity, { eventId: event.eventId, consumer: "sse", status: "pending", attempts: 0, availableAt: now, processedAt: null, lastError: null, createdAt: now, updatedAt: now }))
  }

  private async invalidateLiveOfferings(manager: EntityManager, calendar: BusinessCalendarEntity, operationId: string, context: OfferingRequestContext) {
    // The concrete event schema is supplied by the catalog foundation. Each offering gets its own projection checkpoint.
    const rows = await manager.query("SELECT id, version, subject_version, pricing_version, addon_assignments_version FROM catalog_offerings WHERE business_calendar_id = $1 AND state = 'active' AND active_price_book_id IS NOT NULL AND archived_at IS NULL ORDER BY id FOR UPDATE", [calendar.id]) as Array<{ id: string; version: number; subject_version: number; pricing_version: number; addon_assignments_version: number }>
    const now = new Date()
    for (const offering of rows) {
      const event = OfferingConfigurationOutboxEventSchema.parse({ eventId: randomUUID(), eventType: "public.offering_projection.invalidated", occurredAt: now.toISOString(), actorId: context.actor.id, requestId: context.requestId, operationId, entrySurface: context.entrySurface, aggregate: { type: "catalog_offering", id: offering.id }, versions: { calendar: calendar.version, subject: null, addOns: null }, configurationHash: calendar.contentHash ?? canonicalSha256({ calendarId: calendar.id, version: calendar.version }) })
      await manager.save(manager.create(OutboxEventEntity, { id: event.eventId, topic: event.eventType, aggregateType: "catalog_offering", aggregateId: offering.id, payload: event as unknown as Record<string, unknown>, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
      await manager.save(["sse", "public_projection"].map((consumer) => manager.create(OutboxDeliveryEntity, { eventId: event.eventId, consumer, status: "pending", attempts: 0, availableAt: now, processedAt: null, lastError: null, createdAt: now, updatedAt: now })))
    }
  }

  private async replay<T>(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<T | null> {
    for (const lock of [`key:${scope}:${idempotencyKey}`, `operation:${scope}:${operationId}`].sort()) await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock])
    const stored = await manager.createQueryBuilder(IdempotencyKeyEntity, "key").where("key.scope = :scope", { scope }).andWhere("(key.operation_id = :operationId OR key.idempotency_key = :idempotencyKey)", { operationId, idempotencyKey }).getOne() as StoredReplay | null
    if (!stored) return null
    if (stored.operationId !== operationId || stored.idempotencyKey !== idempotencyKey || stored.requestHash !== requestHash) throw conflict("IDEMPOTENCY_CONFLICT", "Ключ идемпотентности уже использован для другой операции")
    return stored.responseBody as T
  }

  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: object) {
    await manager.save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 200, responseBody: response as Record<string, unknown>, createdAt: new Date() }))
  }

  private assertRead(context: OfferingRequestContext) { if (!context.actor.capabilities.canView || (context.entrySurface === "admin" && context.actor.capabilities.canViewContent !== true)) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для просмотра календаря" }) }
  private assertEdit(context: OfferingRequestContext) { if (!context.actor.capabilities.canEdit || (context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true)) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для редактирования календаря" }) }
  private assertChangeState(context: OfferingRequestContext) { if (!context.actor.capabilities.canChangeStatus || (context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true)) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для активации календаря" }) }

  private async serializable<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) try { return await this.dataSource.transaction("SERIALIZABLE", operation) } catch (error) {
      const code = (error as { driverError?: { code?: string }; code?: string }).driverError?.code ?? (error as { code?: string }).code
      if (attempt >= 2 || (code !== "40001" && code !== "40P01")) throw error
    }
  }
}

function encodeCursor(cursor: Cursor) { return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url") }
function decodeCursor(value: string): Cursor { try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>; if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") throw new Error("invalid"); return { updatedAt: parsed.updatedAt, id: parsed.id } } catch { throw unprocessable("INVALID_CURSOR", "Некорректный курсор") } }
function escapeLike(value: string) { return value.replace(/[\\%_]/g, "\\$&") }
function addDays(value: string, days: number) { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10) }
function dayCount(from: string, toExclusive: string) { return Math.round((Date.parse(`${toExclusive}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / 86_400_000) }
function toOverrideHash(override: BusinessCalendarDateOverrideEntity) { return { date: override.localDate, dayClass: override.overrideClass as "weekday" | "weekend" | "holiday", label: override.label, reason: override.reason, active: override.archivedAt === null && override.state === "active" } }
function conflict(code: string, message: string, details: Record<string, unknown> = {}) { return new ConflictException({ code, message, details }) }
function unprocessable(code: string, message: string, details: Record<string, unknown> = {}) { return new UnprocessableEntityException({ code, message, details }) }
