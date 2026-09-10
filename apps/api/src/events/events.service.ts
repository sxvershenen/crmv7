import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, Optional, UnprocessableEntityException } from "@nestjs/common"
import { Brackets, DataSource, IsNull, type EntityManager } from "typeorm"

import { DateTimeSchema, IdSchema } from "@crm/contracts"
import type { EventArchive, EventCreate, EventDto, EventListQuery, EventTransition, EventUpdate, SessionUser } from "@crm/contracts"
import { CatalogOfferingEntity, ChangeLogEntity, EventEntity, EventServiceTemplateEntity, IdempotencyKeyEntity, OfferingBindingEntity, OutboxEventEntity } from "@crm/db"
import { canonicalSha256 } from "../offerings/offering-mutation-support.js"
import { OperationalQuoteAcceptanceService } from "../offerings/operational-quote-acceptance.service.js"

@Injectable()
export class EventsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource, @Optional() @Inject(OperationalQuoteAcceptanceService) private readonly quoteAcceptance: OperationalQuoteAcceptanceService | null = null) {}

  async list(query: EventListQuery, actor: SessionUser): Promise<{ items: EventDto[]; nextCursor: string | null }> {
    this.assert(actor, "canView")
    const builder = this.dataSource.getRepository(EventEntity).createQueryBuilder("event").where(query.archived === true ? "event.archived_at IS NOT NULL" : "event.archived_at IS NULL")
    if (query.status) builder.andWhere("event.status = :status", { status: query.status }); if (query.categoryId) builder.andWhere("event.category_id = :categoryId", { categoryId: query.categoryId }); if (query.customerId) builder.andWhere("event.customer_id = :customerId", { customerId: query.customerId }); if (query.requiresAction !== undefined) builder.andWhere("event.requires_action = :requiresAction", { requiresAction: query.requiresAction }); if (query.unpaid === true) builder.andWhere("event.paid_amount < event.total_amount"); if (query.from) builder.andWhere("event.starts_at >= :from", { from: new Date(query.from) }); if (query.to) builder.andWhere("event.starts_at < :to", { to: new Date(query.to) });
    if (query.cursor) {
      const cursor = decodeEventListCursor(query.cursor)
      if (cursor.id) builder.andWhere("(event.starts_at > :cursorStartsAt OR (event.starts_at = :cursorStartsAt AND event.id > :cursorId))", { cursorStartsAt: cursor.startsAt, cursorId: cursor.id })
      else builder.andWhere("event.starts_at > :cursorStartsAt", { cursorStartsAt: cursor.startsAt })
    }
    builder.orderBy("event.starts_at", "ASC").addOrderBy("event.id", "ASC").take(query.limit + 1)
    const rows = await builder.getMany(); const page = rows.slice(0, query.limit); const last = page.at(-1); return { items: page.map((row) => this.dto(row, actor)), nextCursor: rows.length > query.limit && last ? encodeEventListCursor(last.startsAt, last.id) : null }
  }
  async get(idOrCode: string, actor: SessionUser) { this.assert(actor, "canView"); return this.dto(await this.find(this.dataSource.manager, idOrCode), actor) }
  async create(input: EventCreate, actor: SessionUser, requestId: string) {
    this.assert(actor, "canCreate")
    if (input.status !== "inquiry" && input.status !== "planning") throw new ConflictException({ code: "EVENT_CREATE_REQUIRES_DRAFT", message: "Новое мероприятие создаётся только как inquiry или planning" })
    if (input.pricingMode === "quote_required" && !input.commercialOfferingId) throw new UnprocessableEntityException({ code: "EVENT_OFFERING_REQUIRED", message: "Для рассчитанного мероприятия нужна коммерческая категория" })
    if (input.pricingMode === "legacy_manual" && input.commercialOfferingId) throw new UnprocessableEntityException({ code: "EVENT_OFFERING_MODE_MISMATCH", message: "Ручное мероприятие не может ссылаться на коммерческую категорию" })
    const total = input.total ?? { amountMinor: 0, currency: input.currency }
    return this.dataSource.transaction(async (manager) => {
      const hash = canonicalSha256({ command: "event.create", actorId: actor.id, input })
      const replay = await this.replay(manager, "event:create", input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const commercialOffering = input.commercialOfferingId ? await this.assertCommercialOffering(manager, input.commercialOfferingId) : null
      if (commercialOffering && commercialOffering.currency !== input.currency) throw new UnprocessableEntityException({ code: "CURRENCY_MISMATCH", message: "Валюта мероприятия должна совпадать с валютой коммерческой категории" })
      const row = manager.create(EventEntity, {
        id: randomUUID(), code: input.code ?? `E-${await this.next(manager)}`, name: input.name, categoryId: input.categoryId,
        commercialOfferingId: input.commercialOfferingId, pricingMode: input.pricingMode, ratePlanKey: input.ratePlanKey,
        addOnSelections: input.addOnSelections, resourceSelections: input.resourceSelections, acceptedQuote: null,
        customerId: input.customerId, phone: input.phone, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), guestCount: input.guestCount,
        totalAmount: input.pricingMode === "quote_required" ? 0 : total.amountMinor, paidAmount: 0, currency: commercialOffering?.currency ?? total.currency, status: input.status,
        comment: input.comment, requiresAction: input.requiresAction, assigneeIds: input.assigneeIds,
        scenario: input.scenario.map((stage) => ({ ...stage, id: stage.id ?? randomUUID() })), createdBy: actor.id, updatedBy: actor.id, archivedAt: null,
      })
      const saved = await manager.save(row)
      const response = this.dto(saved, actor)
      await this.mutate(manager, saved, "created", actor.id, requestId, response)
      await this.remember(manager, "event:create", input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }
  async update(idOrCode: string, input: EventUpdate, actor: SessionUser, requestId: string) {
    this.assert(actor, "canEdit")
    return this.dataSource.transaction(async (manager) => {
      const resolved = await this.find(manager, idOrCode)
      const scope = `event:${resolved.id}:update`
      const hash = canonicalSha256({ command: "event.update", eventId: resolved.id, actorId: actor.id, input })
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const current = await this.findForUpdate(manager, resolved.id)
      this.assertVersion(current, input.version)
      const commercialChanged = this.commercialChanged(current, input)
      if (current.acceptedQuote && commercialChanged) throw new ConflictException({ code: "EVENT_ACCEPTED_IMMUTABLE", message: "Подтверждённые коммерческие условия мероприятия неизменяемы" })
      if (current.pricingMode === "quote_required" && input.total !== undefined && input.total.amountMinor !== current.totalAmount) throw new ConflictException({ code: "EVENT_TOTAL_SERVER_OWNED", message: "Сумма рассчитанного мероприятия изменяется только принятием quote" })
      if (input.total && input.total.currency !== current.currency) throw new ConflictException({ code: "CURRENCY_MISMATCH", message: "Валюта мероприятия неизменяема" })
      if (input.commercialOfferingId && input.commercialOfferingId !== current.commercialOfferingId) await this.assertCommercialOffering(manager, input.commercialOfferingId)
      const patch: Partial<EventEntity> = {
        ...(input.name === undefined ? {} : { name: input.name }), ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...(input.commercialOfferingId === undefined ? {} : { commercialOfferingId: input.commercialOfferingId }), ...(input.ratePlanKey === undefined ? {} : { ratePlanKey: input.ratePlanKey }),
        ...(input.addOnSelections === undefined ? {} : { addOnSelections: input.addOnSelections }), ...(input.resourceSelections === undefined ? {} : { resourceSelections: input.resourceSelections }),
        ...(input.customerId === undefined ? {} : { customerId: input.customerId }), ...(input.phone === undefined ? {} : { phone: input.phone }),
        ...(input.startsAt === undefined ? {} : { startsAt: new Date(input.startsAt) }), ...(input.endsAt === undefined ? {} : { endsAt: new Date(input.endsAt) }),
        ...(input.guestCount === undefined ? {} : { guestCount: input.guestCount }), ...(input.total === undefined ? {} : { totalAmount: input.total.amountMinor }),
        ...(input.comment === undefined ? {} : { comment: input.comment }), ...(input.requiresAction === undefined ? {} : { requiresAction: input.requiresAction }),
        ...(input.assigneeIds === undefined ? {} : { assigneeIds: input.assigneeIds }), ...(input.scenario === undefined ? {} : { scenario: input.scenario.map((stage) => ({ ...stage, id: stage.id ?? randomUUID() })) }), updatedBy: actor.id,
      }
      const result = await manager.createQueryBuilder().update(EventEntity).set({ ...patch, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: current.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(current)
      const saved = await manager.findOneByOrFail(EventEntity, { id: current.id })
      const response = this.dto(saved, actor)
      await this.mutate(manager, saved, "updated", actor.id, requestId, { before: this.dto(current, actor), after: response })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }
  async transition(idOrCode: string, input: EventTransition, actor: SessionUser, requestId: string) {
    this.assert(actor, "canChangeStatus")
    return this.dataSource.transaction(async (manager) => {
      const resolved = await this.find(manager, idOrCode)
      const scope = `event:${resolved.id}:transition`
      const hash = canonicalSha256({ command: "event.transition", eventId: resolved.id, actorId: actor.id, input })
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const current = await this.findForUpdate(manager, resolved.id)
      this.assertVersion(current, input.version)
      const allowed: Record<string, string[]> = { inquiry: ["planning", "cancelled"], planning: ["booked", "cancelled"], booked: ["completed", "cancelled"], completed: [], cancelled: [] }
      if (!allowed[current.status]?.includes(input.status)) throw new ConflictException({ code: "INVALID_STATE_TRANSITION", message: `Нельзя перевести мероприятие из ${current.status} в ${input.status}` })
      if (current.pricingMode === "quote_required" && input.status === "booked" && !input.quoteAcceptance) throw new UnprocessableEntityException({ code: "EVENT_QUOTE_ACCEPTANCE_REQUIRED", message: "Для рассчитанного мероприятия нужно принять quote" })
      if (input.quoteAcceptance && (input.status !== "booked" || current.pricingMode !== "quote_required" || current.status !== "planning")) throw new UnprocessableEntityException({ code: "EVENT_QUOTE_ACCEPTANCE_INVALID", message: "Quote можно принять только для planning рассчитанного мероприятия" })
      if (input.quoteAcceptance) {
        if (!this.quoteAcceptance) throw new UnprocessableEntityException({ code: "QUOTE_TARGET_UNSUPPORTED", message: "Принятие quote для Event недоступно" })
        const prepared = await this.quoteAcceptance.prepareEventOrder(manager, current, input.quoteAcceptance.quoteSnapshotId)
        const result = await manager.createQueryBuilder().update(EventEntity).set({ status: "booked", totalAmount: prepared.result.total.amountMinor, acceptedQuote: prepared.result as unknown as Record<string, unknown>, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: current.id, version: input.version }).execute()
        if (result.affected !== 1) throw this.versionConflict(current)
        const saved = await manager.findOneByOrFail(EventEntity, { id: current.id })
        await this.quoteAcceptance.recordEventOrder(manager, saved, prepared, actor, requestId, input.operationId)
        const response = this.dto(saved, actor)
        await this.mutate(manager, saved, "transitioned", actor.id, requestId, { from: current.status, to: "booked", quoteSnapshotId: prepared.quote.id })
        await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
        return response
      }
      if (input.status === "cancelled" && current.status === "booked" && current.acceptedQuote) {
        if (!this.quoteAcceptance) throw new UnprocessableEntityException({ code: "QUOTE_TARGET_UNSUPPORTED", message: "Освобождение ресурсов мероприятия недоступно" })
        await this.quoteAcceptance.releaseEventResources(manager, current, actor, requestId)
      }
      const result = await manager.createQueryBuilder().update(EventEntity).set({ status: input.status, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: current.id, version: input.version }).execute(); if (result.affected !== 1) throw this.versionConflict(current); const saved = await manager.findOneByOrFail(EventEntity, { id: current.id }); const response = this.dto(saved, actor); await this.mutate(manager, saved, "transitioned", actor.id, requestId, { from: current.status, to: input.status }); await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response); return response }) }
  async archive(idOrCode: string, input: EventArchive, actor: SessionUser, requestId: string) {
    this.assert(actor, "canArchive")
    return this.dataSource.transaction(async (manager) => {
      const resolved = await this.find(manager, idOrCode)
      const scope = `event:${resolved.id}:archive`
      const hash = canonicalSha256({ command: "event.archive", eventId: resolved.id, actorId: actor.id, input })
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const current = await this.findForUpdate(manager, resolved.id)
      this.assertVersion(current, input.version)
      const result = await manager.createQueryBuilder().update(EventEntity).set({ archivedAt: new Date(), updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: current.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(current)
      const saved = await manager.findOneByOrFail(EventEntity, { id: current.id })
      const response = this.dto(saved, actor)
      await this.mutate(manager, saved, "archived", actor.id, requestId, response)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }
  private commercialChanged(current: EventEntity, input: EventUpdate) {
    const same = (left: unknown, right: unknown) => canonicalSha256(left) === canonicalSha256(right)
    return (input.commercialOfferingId !== undefined && input.commercialOfferingId !== current.commercialOfferingId)
      || (input.ratePlanKey !== undefined && input.ratePlanKey !== current.ratePlanKey)
      || (input.addOnSelections !== undefined && !same(input.addOnSelections, current.addOnSelections ?? []))
      || (input.resourceSelections !== undefined && !same(input.resourceSelections, current.resourceSelections ?? []))
      || (input.startsAt !== undefined && new Date(input.startsAt).getTime() !== current.startsAt.getTime())
      || (input.endsAt !== undefined && new Date(input.endsAt).getTime() !== current.endsAt.getTime())
      || (input.guestCount !== undefined && input.guestCount !== current.guestCount)
      || (input.total !== undefined && (input.total.amountMinor !== current.totalAmount || input.total.currency !== current.currency))
  }

  private async assertCommercialOffering(manager: EntityManager, offeringId: string) {
    const offering = await manager.findOne(CatalogOfferingEntity, { where: { id: offeringId, kind: "event_service", state: "active", archivedAt: IsNull() } })
    if (!offering) throw new UnprocessableEntityException({ code: "EVENT_OFFERING_NOT_FOUND", message: "Активная коммерческая категория мероприятия не найдена" })
    const bindings = await manager.createQueryBuilder(OfferingBindingEntity, "binding")
      .where("binding.offering_id = :offeringId AND binding.role = 'primary' AND binding.event_service_template_id IS NOT NULL AND binding.archived_at IS NULL", { offeringId })
      .orderBy("binding.id", "ASC").getMany()
    if (bindings.length !== 1 || !bindings[0]!.eventServiceTemplateId) throw new UnprocessableEntityException({ code: "EVENT_OFFERING_BINDING_INVALID", message: "Коммерческая категория мероприятия не связана с одним шаблоном" })
    const template = await manager.findOne(EventServiceTemplateEntity, { where: { id: bindings[0]!.eventServiceTemplateId, archivedAt: IsNull() } })
    if (!template) throw new UnprocessableEntityException({ code: "EVENT_SERVICE_TEMPLATE_NOT_FOUND", message: "Шаблон мероприятия недоступен" })
    return offering
  }

  private dto(row: EventEntity, actor: SessionUser): EventDto { return { id: row.id, version: row.version, code: row.code, name: row.name, categoryId: row.categoryId, commercialOfferingId: row.commercialOfferingId, pricingMode: row.pricingMode as EventDto["pricingMode"], ratePlanKey: row.ratePlanKey, addOnSelections: row.addOnSelections ?? [], resourceSelections: row.resourceSelections ?? [], acceptedQuote: row.acceptedQuote as EventDto["acceptedQuote"], customerId: row.customerId, phone: row.phone, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), guestCount: row.guestCount, total: { amountMinor: row.totalAmount, currency: row.currency }, paid: { amountMinor: row.paidAmount, currency: row.currency }, status: row.status as EventDto["status"], comment: row.comment, requiresAction: row.requiresAction, hasConflict: false, assigneeIds: row.assigneeIds, scenario: (row.scenario ?? []).map((stage) => ({ id: String(stage.id), name: String(stage.name), durationMinutes: Number(stage.durationMinutes), comment: String(stage.comment ?? "") })), archived: row.archivedAt !== null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), capabilities: { canView: actor.capabilities.canView, canCreate: actor.capabilities.canCreate, canEdit: actor.capabilities.canEdit, canArchive: actor.capabilities.canArchive, canChangeStatus: actor.capabilities.canChangeStatus, canOverrideConflict: actor.capabilities.canOverrideConflict } } }
  private assert(actor: SessionUser, key: keyof SessionUser["capabilities"]) { if (!actor.capabilities[key]) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: `Capability ${key} is required` }) }
  private assertVersion(row: { version: number; id: string }, version: number) { if (row.version !== version) throw this.versionConflict(row) }
  private versionConflict(row: { id: string; version: number }) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Мероприятие было изменено другим сотрудником", details: { entityId: row.id, serverVersion: row.version } }) }
  private async find(manager: EntityManager, idOrCode: string) { const row = await manager.getRepository(EventEntity).findOne({ where: /^[0-9a-f-]{36}$/i.test(idOrCode) ? { id: idOrCode } : { code: idOrCode } }); if (!row) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Мероприятие не найдено" }); return row }
  private async findForUpdate(manager: EntityManager, idOrCode: string) { const builder = manager.createQueryBuilder(EventEntity, "event").setLock("pessimistic_write"); const row = await builder.where(/^[0-9a-f-]{36}$/i.test(idOrCode) ? "event.id = :id" : "event.code = :code", /^[0-9a-f-]{36}$/i.test(idOrCode) ? { id: idOrCode } : { code: idOrCode }).getOne(); if (!row) throw new NotFoundException({ code: "EVENT_NOT_FOUND", message: "Мероприятие не найдено" }); return row }
  private async next(manager: EntityManager) { const result = await manager.query(`SELECT nextval('event_code_seq')::text AS nextval`) as Array<{ nextval: string }>; return result[0]!.nextval }
  private async mutate(manager: EntityManager, entity: EventEntity, action: string, actorId: string, requestId: string, changes: unknown) { const now = new Date(); await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "event", entityId: entity.id, action, actorId, requestId, changes: changes as Record<string, unknown>, createdAt: now })); await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `event.${action}`, aggregateType: "event", aggregateId: entity.id, payload: { eventId: entity.id, version: entity.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now })) }
  private async replay(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string) {
    for (const lock of [`key:${scope}:${idempotencyKey}`, `operation:${scope}:${operationId}`].sort()) {
      await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock])
    }
    const row = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("key")
      .where("key.scope = :scope", { scope })
      .andWhere(new Brackets((q) => q.where("key.operation_id = :operationId", { operationId }).orWhere("key.idempotency_key = :idempotencyKey", { idempotencyKey })))
      .getOne()
    if (!row) return null
    if (row.operationId !== operationId || row.idempotencyKey !== idempotencyKey || row.requestHash !== requestHash) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ идемпотентности уже использован с другими данными" })
    if (row.responseBody) return row.responseBody
    throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Операция уже выполняется" })
  }
  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: unknown) { await manager.getRepository(IdempotencyKeyEntity).save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 200, responseBody: response as Record<string, unknown>, createdAt: new Date() })) }
}

function encodeEventListCursor(startsAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ startsAt: startsAt.toISOString(), id }), "utf8").toString("base64url")
}

function decodeEventListCursor(value: string): { startsAt: Date; id: string | null } {
  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8"))
  } catch {
    decoded = undefined
  }
  if (typeof decoded === "object" && decoded !== null && ("startsAt" in decoded || "id" in decoded)) {
    const candidate = decoded as { startsAt?: unknown; id?: unknown }
    if (typeof candidate.startsAt === "string" && DateTimeSchema.safeParse(candidate.startsAt).success && typeof candidate.id === "string" && IdSchema.safeParse(candidate.id).success) {
      return { startsAt: new Date(candidate.startsAt), id: candidate.id }
    }
    throw new UnprocessableEntityException({ code: "INVALID_CURSOR", message: "Курсор имеет неверный формат" })
  }
  // Legacy cursors were plain ISO timestamps; continue to accept them.
  const startsAt = new Date(value)
  if (Number.isNaN(startsAt.getTime())) throw new UnprocessableEntityException({ code: "INVALID_CURSOR", message: "Курсор имеет неверный формат" })
  return { startsAt, id: null }
}
