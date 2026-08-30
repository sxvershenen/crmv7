import { randomUUID } from "node:crypto"

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { InjectRepository } from "@nestjs/typeorm"
import { DataSource, type EntityManager, IsNull, Repository } from "typeorm"

import type { SavedViewCreate, SavedViewDto, SavedViewUpdate, SessionUser } from "@crm/contracts"
import { ChangeLogEntity, OutboxEventEntity, SavedViewEntity } from "@crm/db"

@Injectable()
export class SavedViewsService {
  constructor(
    @InjectRepository(SavedViewEntity) private readonly views: Repository<SavedViewEntity>,
    @Inject(DataSource) private readonly dataSource: DataSource,
  ) {}

  async list(owner: SessionUser, entityType?: string) {
    const views = await this.views.find({
      where: { ownerId: owner.id, archivedAt: IsNull(), ...(entityType ? { entityType } : {}) },
      order: { isDefault: "DESC", name: "ASC" },
    })
    return views.map(this.toDto)
  }

  async create(input: SavedViewCreate, owner: SessionUser, requestId: string) {
    return this.dataSource.transaction(async (manager) => {
      if (input.isDefault) await this.clearDefault(manager, owner.id, input.entityType)
      const entity = manager.create(SavedViewEntity, {
        id: randomUUID(), ownerId: owner.id, entityType: input.entityType, name: input.name.trim(),
        definition: input.definition, isDefault: input.isDefault, createdBy: owner.id, updatedBy: owner.id, archivedAt: null,
      })
      const saved = await manager.save(entity)
      await this.recordMutation(manager, saved, "created", owner.id, requestId)
      return this.toDto(saved)
    })
  }

  async update(id: string, input: SavedViewUpdate, owner: SessionUser, requestId: string) {
    return this.dataSource.transaction(async (manager) => {
      const entity = await manager.findOneBy(SavedViewEntity, { id, ownerId: owner.id })
      if (!entity) throw new NotFoundException({ code: "SAVED_VIEW_NOT_FOUND", message: "Представление не найдено" })
      if (entity.version !== input.version) throw this.versionConflict(entity)
      const entityType = input.entityType ?? entity.entityType
      if (input.isDefault) await this.clearDefault(manager, owner.id, entityType)
      const result = await manager.createQueryBuilder().update(SavedViewEntity).set({
        ...(input.entityType === undefined ? {} : { entityType: input.entityType }),
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.definition === undefined ? {} : { definition: input.definition }),
        ...(input.isDefault === undefined ? {} : { isDefault: input.isDefault }),
        updatedBy: owner.id,
        version: () => '"version" + 1',
        updatedAt: () => "now()",
      }).where("id = :id AND owner_id = :ownerId AND version = :version", { id, ownerId: owner.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(SavedViewEntity, { id }))
      const saved = await manager.findOneByOrFail(SavedViewEntity, { id })
      await this.recordMutation(manager, saved, "updated", owner.id, requestId)
      return this.toDto(saved)
    })
  }

  async archive(id: string, version: number, owner: SessionUser, requestId: string) {
    return this.dataSource.transaction(async (manager) => {
      const entity = await manager.findOneBy(SavedViewEntity, { id, ownerId: owner.id })
      if (!entity) throw new NotFoundException({ code: "SAVED_VIEW_NOT_FOUND", message: "Представление не найдено" })
      if (entity.version !== version) throw this.versionConflict(entity)
      const result = await manager.createQueryBuilder().update(SavedViewEntity).set({
        archivedAt: new Date(), updatedBy: owner.id, version: () => '"version" + 1', updatedAt: () => "now()",
      }).where("id = :id AND owner_id = :ownerId AND version = :version", { id, ownerId: owner.id, version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(SavedViewEntity, { id }))
      const saved = await manager.findOneByOrFail(SavedViewEntity, { id })
      await this.recordMutation(manager, saved, "archived", owner.id, requestId)
      return { ok: true }
    })
  }

  private async clearDefault(manager: EntityManager, ownerId: string, entityType: string) {
    await manager.update(SavedViewEntity, { ownerId, entityType, isDefault: true }, { isDefault: false })
  }

  private versionConflict(entity: SavedViewEntity) {
    return new ConflictException({ code: "VERSION_CONFLICT", message: "Представление было изменено", details: { entityId: entity.id, serverVersion: entity.version, server: this.toDto(entity) } })
  }

  private async recordMutation(manager: EntityManager, entity: SavedViewEntity, action: string, actorId: string, requestId: string) {
    const now = new Date()
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "saved_view", entityId: entity.id, action, actorId, requestId, changes: { after: this.toDto(entity) }, createdAt: now }))
    await manager.save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `saved_view.${action}`, aggregateType: "saved_view", aggregateId: entity.id, payload: { savedViewId: entity.id, version: entity.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
  }

  private toDto(entity: SavedViewEntity): SavedViewDto {
    return {
      id: entity.id,
      version: entity.version,
      entityType: entity.entityType,
      name: entity.name,
      definition: entity.definition,
      isDefault: entity.isDefault,
      updatedAt: entity.updatedAt.toISOString(),
    }
  }
}
