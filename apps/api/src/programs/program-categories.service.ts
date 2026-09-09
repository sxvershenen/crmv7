import { randomUUID } from "node:crypto"

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { DataSource, type EntityManager } from "typeorm"

import type { ProgramCategoryArchive, ProgramCategoryCreate, ProgramCategoryDetail, ProgramCategoryDto, ProgramCategoryListQuery, ProgramCategoryUpdate, SessionUser } from "@crm/contracts"
import { ChangeLogEntity, IdempotencyKeyEntity, OutboxEventEntity, ProgramCategoryEntity, ProgramOccurrenceEntity, ProgramTemplateEntity } from "@crm/db"
import { assertCapability } from "@crm/domain"
import { ensureCmsSourceDraft } from "../cms/cms-source-draft.js"

@Injectable()
export class ProgramCategoriesService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: ProgramCategoryListQuery, actor: SessionUser) {
    assertCapability(actor.capabilities, "canView")
    const builder = this.dataSource.getRepository(ProgramCategoryEntity).createQueryBuilder("category")
      .where(query.archived === true ? "category.archived_at IS NOT NULL" : "category.archived_at IS NULL")
      .orderBy("category.created_at", "DESC").addOrderBy("category.id", "DESC").take(query.limit + 1)
    if (query.cursor) builder.andWhere("category.created_at < :cursor", { cursor: new Date(query.cursor) })
    const rows = await builder.getMany()
    const page = rows.slice(0, query.limit)
    const counts = await this.counts(this.dataSource.manager, page.map((row) => row.id))
    return { items: page.map((row) => this.dto(row, actor, counts.get(row.id) ?? 0)), nextCursor: rows.length > query.limit ? page.at(-1)?.createdAt.toISOString() ?? null : null }
  }

  async get(id: string, actor: SessionUser): Promise<ProgramCategoryDetail> {
    assertCapability(actor.capabilities, "canView")
    const row = await this.find(this.dataSource.manager, id)
    return this.detail(this.dataSource.manager, row, actor)
  }

  async create(input: ProgramCategoryCreate, actor: SessionUser, requestId: string): Promise<ProgramCategoryDetail> {
    assertCapability(actor.capabilities, "canCreate")
    return this.dataSource.transaction(async (manager) => {
      const replay = await this.replay(manager, "program-category:create", input.operationId, input.idempotencyKey)
      if (replay) return replay as ProgramCategoryDetail
      const row = manager.create(ProgramCategoryEntity, { id: randomUUID(), name: input.name, description: input.description, icon: input.icon, tone: input.tone, createdBy: actor.id, updatedBy: actor.id, archivedAt: null })
      const saved = await manager.save(row)
      const response = await this.detail(manager, saved, actor)
      await this.mutate(manager, saved, "created", actor.id, requestId, { after: response })
      await ensureCmsSourceDraft(manager, { sourceKind: "program_category", sourceId: saved.id, sourceVersion: saved.version, title: saved.name, summary: saved.description, actorId: actor.id, requestId })
      await this.remember(manager, "program-category:create", input.operationId, input.idempotencyKey, response)
      return response
    })
  }

  async update(id: string, input: ProgramCategoryUpdate, actor: SessionUser, requestId: string): Promise<ProgramCategoryDetail> {
    assertCapability(actor.capabilities, "canEdit")
    return this.dataSource.transaction(async (manager) => {
      const scope = `program-category:${id}:update`
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey)
      if (replay) return replay as ProgramCategoryDetail
      const current = await this.find(manager, id)
      if (current.version !== input.version) throw this.versionConflict(current)
      const before = await this.detail(manager, current, actor)
      const result = await manager.createQueryBuilder().update(ProgramCategoryEntity).set({
        ...(input.name === undefined ? {} : { name: input.name }), ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.icon === undefined ? {} : { icon: input.icon }), ...(input.tone === undefined ? {} : { tone: input.tone }), updatedBy: actor.id,
        version: () => '"version" + 1', updatedAt: () => "now()",
      }).where("id = :id AND version = :version", { id: current.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(current)
      const saved = await manager.findOneByOrFail(ProgramCategoryEntity, { id: current.id })
      const response = await this.detail(manager, saved, actor)
      await this.mutate(manager, saved, "updated", actor.id, requestId, { before, after: response })
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, response)
      return response
    })
  }

  async archive(id: string, input: ProgramCategoryArchive, actor: SessionUser, requestId: string): Promise<ProgramCategoryDetail> {
    assertCapability(actor.capabilities, "canArchive")
    return this.dataSource.transaction(async (manager) => {
      const scope = `program-category:${id}:archive`
      const replay = await this.replay(manager, scope, input.operationId, input.idempotencyKey)
      if (replay) return replay as ProgramCategoryDetail
      const current = await this.find(manager, id)
      if (current.version !== input.version) throw this.versionConflict(current)
      const result = await manager.createQueryBuilder().update(ProgramCategoryEntity).set({ archivedAt: new Date(), updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: current.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(current)
      const saved = await manager.findOneByOrFail(ProgramCategoryEntity, { id: current.id })
      const response = await this.detail(manager, saved, actor)
      await this.mutate(manager, saved, "archived", actor.id, requestId, response)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, response)
      return response
    })
  }

  private async detail(manager: EntityManager, row: ProgramCategoryEntity, actor: SessionUser): Promise<ProgramCategoryDetail> {
    const templates = await manager.getRepository(ProgramTemplateEntity).createQueryBuilder("template")
      .where("template.category_id = :categoryId AND template.archived_at IS NULL", { categoryId: row.id }).orderBy("template.name", "ASC").getMany()
    const occurrences = templates.length ? await manager.getRepository(ProgramOccurrenceEntity).createQueryBuilder("occurrence").where("occurrence.template_id IN (:...templateIds) AND occurrence.archived_at IS NULL AND occurrence.starts_at >= now()", { templateIds: templates.map((template) => template.id) }).orderBy("occurrence.starts_at", "ASC").getMany() : []
    const nextByTemplate = new Map<string, ProgramOccurrenceEntity>()
    for (const occurrence of occurrences) if (!nextByTemplate.has(occurrence.templateId)) nextByTemplate.set(occurrence.templateId, occurrence)
    const counts = templates.length
    return { ...this.dto(row, actor, counts), relatedTemplates: templates.map((template) => { const next = nextByTemplate.get(template.id); return { id: template.id, name: template.name, version: template.version, updatedAt: template.updatedAt.toISOString(), nextRun: next ? { id: next.id, startsAt: next.startsAt.toISOString() } : null } }) }
  }

  private dto(row: ProgramCategoryEntity, actor: SessionUser, templateCount: number): ProgramCategoryDto {
    return { id: row.id, version: row.version, name: row.name, description: row.description, icon: row.icon as ProgramCategoryDto["icon"], tone: row.tone as ProgramCategoryDto["tone"], templateCount, archived: row.archivedAt !== null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), capabilities: { canView: actor.capabilities.canView, canCreate: actor.capabilities.canCreate, canEdit: actor.capabilities.canEdit, canArchive: actor.capabilities.canArchive } }
  }

  private async find(manager: EntityManager, id: string) { const row = await manager.getRepository(ProgramCategoryEntity).findOneBy({ id }); if (!row) throw new NotFoundException({ code: "PROGRAM_CATEGORY_NOT_FOUND", message: "Категория программ не найдена" }); return row }
  private async counts(manager: EntityManager, ids: string[]) { const map = new Map<string, number>(); if (!ids.length) return map; const rows = await manager.getRepository(ProgramTemplateEntity).createQueryBuilder("template").select("template.category_id", "categoryId").addSelect("COUNT(*)", "count").where("template.category_id IN (:...ids) AND template.archived_at IS NULL", { ids }).groupBy("template.category_id").getRawMany<{ categoryId: string; count: string }>(); for (const row of rows) map.set(row.categoryId, Number(row.count)); return map }
  private versionConflict(entity: { version: number }) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Категория уже изменена", details: { currentVersion: entity.version }, retryable: true }) }
  private async mutate(manager: EntityManager, entity: ProgramCategoryEntity, action: string, actorId: string, requestId: string, changes: unknown) { const now = new Date(); await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "program_category", entityId: entity.id, action, actorId, requestId, changes: changes as Record<string, unknown>, createdAt: now })); await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `program_category.${action}`, aggregateType: "program_category", aggregateId: entity.id, payload: { id: entity.id, version: entity.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now })) }
  private async replay(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string) { const row = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("key").where("key.scope = :scope AND (key.operation_id = :operationId OR key.idempotency_key = :idempotencyKey)", { scope, operationId, idempotencyKey }).getOne(); if (!row) return null; if (row.responseBody) return row.responseBody; throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Операция уже выполняется" }) }
  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, response: unknown) { await manager.getRepository(IdempotencyKeyEntity).save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash: JSON.stringify(response), responseStatus: 200, responseBody: response as Record<string, unknown>, createdAt: new Date() })) }
}
