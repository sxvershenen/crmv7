import { randomUUID } from "node:crypto"

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { DataSource, type EntityManager } from "typeorm"

import type { EventCategoryArchive, EventCategoryCreate, EventCategoryDetail, EventCategoryDto, EventCategoryListQuery, EventCategoryUpdate, SessionUser } from "@crm/contracts"
import { ChangeLogEntity, EventCategoryEntity, EventEntity, IdempotencyKeyEntity, OutboxEventEntity } from "@crm/db"
import { assertCapability } from "@crm/domain"
import { ensureCmsSourceDraft } from "../cms/cms-source-draft.js"

@Injectable()
export class EventCategoriesService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: EventCategoryListQuery, actor: SessionUser) {
    assertCapability(actor.capabilities, "canView")
    const builder = this.dataSource.getRepository(EventCategoryEntity).createQueryBuilder("category")
      .where(query.archived === true ? "category.archived_at IS NOT NULL" : "category.archived_at IS NULL")
      .orderBy("category.created_at", "DESC").addOrderBy("category.id", "DESC").take(query.limit + 1)
    if (query.cursor) builder.andWhere("category.created_at < :cursor", { cursor: new Date(query.cursor) })
    const rows = await builder.getMany(); const page = rows.slice(0, query.limit)
    const counts = await this.counts(this.dataSource.manager, page.map((row) => row.id))
    return { items: page.map((row) => this.dto(row, actor, counts.get(row.id) ?? 0)), nextCursor: rows.length > query.limit ? page.at(-1)?.createdAt.toISOString() ?? null : null }
  }

  async get(id: string, actor: SessionUser): Promise<EventCategoryDetail> { assertCapability(actor.capabilities, "canView"); const row = await this.find(this.dataSource.manager, id); return this.detail(this.dataSource.manager, row, actor) }

  async create(input: EventCategoryCreate, actor: SessionUser, requestId: string): Promise<EventCategoryDetail> {
    assertCapability(actor.capabilities, "canCreate")
    return this.dataSource.transaction(async (manager) => {
      const replay = await this.replay(manager, "event-category:create", input.operationId, input.idempotencyKey); if (replay) return replay as EventCategoryDetail
      const row = manager.create(EventCategoryEntity, { id: randomUUID(), name: input.name, description: input.description, icon: input.icon, tone: input.tone, createdBy: actor.id, updatedBy: actor.id, archivedAt: null })
      const saved = await manager.save(row); const response = await this.detail(manager, saved, actor)
      await this.mutate(manager, saved, "created", actor.id, requestId, { after: response }); await ensureCmsSourceDraft(manager, { sourceKind: "event_category", sourceId: saved.id, sourceVersion: saved.version, title: saved.name, summary: saved.description, actorId: actor.id, requestId }); await this.remember(manager, "event-category:create", input.operationId, input.idempotencyKey, response); return response
    })
  }

  async update(id: string, input: EventCategoryUpdate, actor: SessionUser, requestId: string): Promise<EventCategoryDetail> {
    assertCapability(actor.capabilities, "canEdit")
    return this.dataSource.transaction(async (manager) => {
      const scope = `event-category:${id}:update`; const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey); if (replay) return replay as EventCategoryDetail
      const current = await this.find(manager, id); if (current.version !== input.version) throw this.versionConflict(current); const before = await this.detail(manager, current, actor)
      const result = await manager.createQueryBuilder().update(EventCategoryEntity).set({ ...(input.name === undefined ? {} : { name: input.name }), ...(input.description === undefined ? {} : { description: input.description }), ...(input.icon === undefined ? {} : { icon: input.icon }), ...(input.tone === undefined ? {} : { tone: input.tone }), updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: current.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(current); const saved = await manager.findOneByOrFail(EventCategoryEntity, { id: current.id }); const response = await this.detail(manager, saved, actor)
      await this.mutate(manager, saved, "updated", actor.id, requestId, { before, after: response }); await this.remember(manager, scope, input.operationId, input.idempotencyKey, response); return response
    })
  }

  async archive(id: string, input: EventCategoryArchive, actor: SessionUser, requestId: string): Promise<EventCategoryDetail> {
    assertCapability(actor.capabilities, "canArchive")
    return this.dataSource.transaction(async (manager) => {
      const scope = `event-category:${id}:archive`; const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey); if (replay) return replay as EventCategoryDetail
      const current = await this.find(manager, id); if (current.version !== input.version) throw this.versionConflict(current)
      const result = await manager.createQueryBuilder().update(EventCategoryEntity).set({ archivedAt: new Date(), updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: current.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(current); const saved = await manager.findOneByOrFail(EventCategoryEntity, { id: current.id }); const response = await this.detail(manager, saved, actor)
      await this.mutate(manager, saved, "archived", actor.id, requestId, response); await this.remember(manager, scope, input.operationId, input.idempotencyKey, response); return response
    })
  }

  private async detail(manager: EntityManager, row: EventCategoryEntity, actor: SessionUser): Promise<EventCategoryDetail> {
    const events = await manager.getRepository(EventEntity).createQueryBuilder("event").where("event.category_id = :categoryId AND event.archived_at IS NULL", { categoryId: row.id }).orderBy("event.starts_at", "ASC").getMany()
    return { ...this.dto(row, actor, events.length), relatedEvents: events.map((event) => ({ id: event.id, name: event.name, startsAt: event.startsAt.toISOString(), clientName: event.customerId ?? "Без клиента" })) }
  }
  private dto(row: EventCategoryEntity, actor: SessionUser, eventCount: number): EventCategoryDto { return { id: row.id, version: row.version, name: row.name, description: row.description, icon: row.icon as EventCategoryDto["icon"], tone: row.tone as EventCategoryDto["tone"], eventCount, archived: row.archivedAt !== null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), capabilities: { canView: actor.capabilities.canView, canCreate: actor.capabilities.canCreate, canEdit: actor.capabilities.canEdit, canArchive: actor.capabilities.canArchive } } }
  private async find(manager: EntityManager, id: string) { const row = await manager.getRepository(EventCategoryEntity).findOneBy({ id }); if (!row) throw new NotFoundException({ code: "EVENT_CATEGORY_NOT_FOUND", message: "Категория мероприятий не найдена" }); return row }
  private async counts(manager: EntityManager, ids: string[]) { const map = new Map<string, number>(); if (!ids.length) return map; const rows = await manager.getRepository(EventEntity).createQueryBuilder("event").select("event.category_id", "categoryId").addSelect("COUNT(*)", "count").where("event.category_id IN (:...ids) AND event.archived_at IS NULL", { ids }).groupBy("event.category_id").getRawMany<{ categoryId: string; count: string }>(); for (const row of rows) map.set(row.categoryId, Number(row.count)); return map }
  private versionConflict(entity: { version: number }) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Категория уже изменена", details: { currentVersion: entity.version }, retryable: true }) }
  private async mutate(manager: EntityManager, entity: EventCategoryEntity, action: string, actorId: string, requestId: string, changes: unknown) { const now = new Date(); await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "event_category", entityId: entity.id, action, actorId, requestId, changes: changes as Record<string, unknown>, createdAt: now })); await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `event_category.${action}`, aggregateType: "event_category", aggregateId: entity.id, payload: { id: entity.id, version: entity.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now })) }
  private async replay(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string) { const row = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("key").where("key.scope = :scope AND (key.operation_id = :operationId OR key.idempotency_key = :idempotencyKey)", { scope, operationId, idempotencyKey }).getOne(); if (!row) return null; if (row.responseBody) return row.responseBody; throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Операция уже выполняется" }) }
  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, response: unknown) { await manager.getRepository(IdempotencyKeyEntity).save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash: JSON.stringify(response), responseStatus: 200, responseBody: response as Record<string, unknown>, createdAt: new Date() })) }
}
