import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { DataSource, type EntityManager } from "typeorm"

import type { SessionUser } from "@crm/contracts"
import { ChangeLogEntity, IdempotencyKeyEntity, OutboxEventEntity, ResourceAllocationEntity, ResourceEntity } from "@crm/db"
import { assertAvailable, checkAvailability, type AvailabilityAllocation } from "@crm/domain"

import { toResourceDto } from "./resource.mapper.js"
import type {
  ResourceAllocationCreate,
  ResourceAllocationsQuery,
  ResourceBlockCancel,
  ResourceBlockCreate,
  ResourceArchive,
  ResourceAvailabilityQuery,
  ResourceAvailabilityByCodeQuery,
  ResourceCreate,
  ResourceListQuery,
  ResourceDto,
  ResourceCapabilities,
  ResourceUpdate,
} from "./resources.contracts.js"

@Injectable()
export class ResourcesService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: ResourceListQuery, actor: SessionUser): Promise<ResourceDto[]> {
    this.assertCapability(actor, "canView")
    const builder = this.dataSource.getRepository(ResourceEntity).createQueryBuilder("resource")
      .where(query.archived === true ? "resource.archived_at IS NOT NULL" : "resource.archived_at IS NULL")
    if (query.kind) {
      const aliases: Record<string, string[]> = { houses: ["houses", "house"], venues: ["venues", "venue"] }
      builder.andWhere("resource.kind IN (:...kinds)", { kinds: aliases[query.kind] ?? [query.kind] })
    }
    builder.orderBy("resource.name", "ASC").take(query.limit)
    const resources = await builder.getMany()
    return Promise.all(resources.map(async (resource) => toResourceDto(resource, actor, await this.resourceAllocations(resource.id))))
  }

  async get(code: string, actor: SessionUser): Promise<ResourceDto> {
    this.assertCapability(actor, "canView")
    const resource = await this.findByCode(code)
    return toResourceDto(resource, actor, await this.resourceAllocations(resource.id))
  }

  async create(input: ResourceCreate, actor: SessionUser, requestId: string): Promise<ResourceDto> {
    this.assertCapability(actor, "canCreate")
    return this.dataSource.transaction(async (manager) => {
      const resource = manager.create(ResourceEntity, {
        id: randomUUID(),
        code: input.code ?? `R-${randomUUID().slice(0, 8)}`,
        kind: input.kind,
        name: input.name,
        capacityMode: input.capacityMode,
        capacityTotal: input.capacityTotal,
        settings: input.settings,
        createdBy: actor.id,
        updatedBy: actor.id,
        archivedAt: null,
      })
      const saved = await manager.save(resource)
      await this.recordMutation(manager, saved, "created", actor.id, requestId, { after: this.snapshot(saved) })
      return toResourceDto(saved, actor, [])
    })
  }

  async update(code: string, input: ResourceUpdate, actor: SessionUser, requestId: string): Promise<ResourceDto> {
    this.assertCapability(actor, "canEdit")
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.getRepository(ResourceEntity).findOne({ where: [{ code }, { id: code }] })
      if (!current) throw this.notFound()
      if (current.version !== input.version) throw this.versionConflict(current)
      const before = this.snapshot(current)
      const result = await manager.createQueryBuilder().update(ResourceEntity).set({
        ...(input.kind === undefined ? {} : { kind: input.kind }),
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.capacityMode === undefined ? {} : { capacityMode: input.capacityMode }),
        ...(input.capacityTotal === undefined ? {} : { capacityTotal: input.capacityTotal }),
        ...(input.settings === undefined ? {} : { settings: { ...(current.settings ?? {}), ...input.settings } }),
        updatedBy: actor.id,
        version: () => '"version" + 1',
        updatedAt: () => "now()",
      }).where("id = :id AND version = :version", { id: current.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(ResourceEntity, { id: current.id }))
      const saved = await manager.findOneByOrFail(ResourceEntity, { id: current.id })
      await this.recordMutation(manager, saved, "updated", actor.id, requestId, { before, after: this.snapshot(saved) })
      return toResourceDto(saved, actor, await this.resourceAllocations(saved.id))
    })
  }

  async archive(code: string, input: ResourceArchive, actor: SessionUser, requestId: string): Promise<ResourceDto> {
    this.assertCapability(actor, "canArchive")
    return this.dataSource.transaction(async (manager) => {
      const current = await manager.getRepository(ResourceEntity).findOne({ where: [{ code }, { id: code }] })
      if (!current) throw this.notFound()
      if (current.version !== input.version) throw this.versionConflict(current)
      const archivedAt = new Date()
      const result = await manager.createQueryBuilder().update(ResourceEntity).set({
        archivedAt, settings: { ...(current.settings ?? {}), active: false }, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()",
      }).where("id = :id AND version = :version", { id: current.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(ResourceEntity, { id: current.id }))
      const saved = await manager.findOneByOrFail(ResourceEntity, { id: current.id })
      await this.recordMutation(manager, saved, "archived", actor.id, requestId, { archivedAt: archivedAt.toISOString() })
      return toResourceDto(saved, actor, await this.resourceAllocations(saved.id))
    })
  }

  async availability(input: ResourceAvailabilityQuery, actor: SessionUser) {
    this.assertCapability(actor, "canView")
    const resource = await this.dataSource.getRepository(ResourceEntity).findOneBy({ id: input.resourceId })
    if (!resource) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND", message: "Ресурс не найден" })
    const allocations = await this.overlappingAllocations(this.dataSource.manager, input)
    const availabilityRequest = {
      resourceId: resource.id,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      quantity: input.quantity,
      ...(input.excludeSourceId ? { excludeSourceId: input.excludeSourceId } : {}),
    }
    const result = checkAvailability(availabilityRequest, allocations.map(this.toAvailabilityAllocation), resource.capacityMode === "shared" ? { capacity: resource.capacityTotal } : {})
    return { available: result.available, conflicts: result.conflicts.map((conflict) => {
      const allocation = allocations.find((item) => item.id === conflict.allocationId)
      return {
        allocationId: conflict.allocationId,
        resourceId: resource.id,
        sourceType: allocation?.sourceType ?? "resource_block",
        sourceId: conflict.sourceId,
        startAt: conflict.startAt.toISOString(),
        endAt: conflict.endAt.toISOString(),
        requestedQuantity: conflict.requestedQuantity,
        availableQuantity: conflict.availableQuantity,
        reason: conflict.reason,
      }
    }) }
  }

  async availabilityByCode(code: string, input: ResourceAvailabilityByCodeQuery, actor: SessionUser) {
    const resource = await this.findByCode(code)
    return this.availability({ resourceId: resource.id, ...input }, actor)
  }

  async createAllocation(input: ResourceAllocationCreate, actor: SessionUser, requestId: string) {
    this.assertCapability(actor, "canEdit")
    return this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const idempotencyScope = `resource-allocation:${actor.id}`
      const requestHash = JSON.stringify(input)
      const existingOperation = await manager.getRepository(IdempotencyKeyEntity).findOneBy({ scope: idempotencyScope, operationId: input.operationId })
      if (existingOperation) {
        if (existingOperation.requestHash !== requestHash) {
          throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "operationId уже использован с другими данными" })
        }
        if (existingOperation.responseBody) return existingOperation.responseBody
      }
      const resource = await manager.getRepository(ResourceEntity).findOne({
        where: { id: input.resourceId }, lock: { mode: "pessimistic_write" },
      })
      if (!resource) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND", message: "Ресурс не найден" })
      if (resource.archivedAt) throw new ConflictException({ code: "RESOURCE_ARCHIVED", message: "Архивный ресурс недоступен" })
      if (resource.version !== input.expectedVersion) throw this.versionConflict(resource)
      const allocations = await this.overlappingAllocations(manager, {
        resourceId: input.resourceId, startAt: input.startAt, endAt: input.endAt,
      })
      const check = checkAvailability({
        resourceId: resource.id, startAt: new Date(input.startAt), endAt: new Date(input.endAt), quantity: input.quantity,
      }, allocations.map(this.toAvailabilityAllocation), resource.capacityMode === "shared" ? { capacity: resource.capacityTotal } : {})
      if (input.overrideConflict && !actor.capabilities.canOverrideConflict) {
        throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для переопределения конфликта" })
      }
      if (!check.available && !input.overrideConflict) assertAvailable(check)
      const allocation = manager.create(ResourceAllocationEntity, {
        id: randomUUID(), resourceId: resource.id, sourceType: input.sourceType, sourceId: input.sourceId,
        startAt: new Date(input.startAt), endAt: new Date(input.endAt), quantity: input.quantity,
        capacityImpact: input.capacityImpact,
        status: input.status,
        exclusive: resource.capacityMode === "fixed" && !input.overrideConflict,
        createdBy: actor.id, updatedBy: actor.id, archivedAt: null,
      })
      const saved = await manager.save(allocation)
      const resourcePatch = input.reason && input.sourceType === "resource_block"
        ? { settings: { ...(resource.settings ?? {}), blockMetadata: { ...((resource.settings ?? {}).blockMetadata as Record<string, { reason: string }> | undefined), [saved.id]: { reason: input.reason } } } }
        : {}
      const resourceResult = await manager.getRepository(ResourceEntity).createQueryBuilder().update(ResourceEntity).set({
        ...resourcePatch, version: () => '"version" + 1', updatedBy: actor.id, updatedAt: () => "now()",
      }).where("id = :id AND version = :version", { id: resource.id, version: input.expectedVersion }).execute()
      if (resourceResult.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(ResourceEntity, { id: resource.id }))
      resource.version += 1
      const now = new Date()
      await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, {
        id: randomUUID(), entityType: "resource_allocation", entityId: saved.id, action: "created", actorId: actor.id,
        requestId, changes: { after: this.allocationSnapshot(saved), overrideConflict: !check.available && input.overrideConflict }, createdAt: now,
      }))
      await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, {
        id: randomUUID(), topic: "resource.allocation.created", aggregateType: "resource", aggregateId: resource.id,
        payload: { allocationId: saved.id, resourceId: resource.id, sourceId: saved.sourceId }, availableAt: now, processedAt: null, attempts: 0, createdAt: now,
      }))
      const responseBody = this.allocationSnapshot(saved)
      await manager.getRepository(IdempotencyKeyEntity).save(manager.create(IdempotencyKeyEntity, {
        id: randomUUID(), scope: idempotencyScope, operationId: input.operationId, requestHash,
        idempotencyKey: input.operationId, responseStatus: 201, responseBody, createdAt: new Date(),
      }))
      return responseBody
    })
  }

  async allocations(code: string, query: ResourceAllocationsQuery, actor: SessionUser) {
    this.assertCapability(actor, "canView")
    const resource = await this.findByCode(code)
    const rows = await this.resourceAllocations(resource.id)
    return rows.filter((item) => query.includeCancelled || (item.status !== "cancelled" && item.archivedAt === null)).map((item) => ({
      id: item.id, resourceId: item.resourceId, sourceType: item.sourceType as ResourceDto["blocks"][number]["sourceType"], sourceId: item.sourceId,
      startAt: item.startAt.toISOString(), endAt: item.endAt.toISOString(), quantity: item.quantity, capacityImpact: item.capacityImpact,
      status: item.status as ResourceDto["blocks"][number]["status"], version: item.version,
    }))
  }

  async blocks(code: string, query: ResourceAllocationsQuery, actor: SessionUser) {
    this.assertCapability(actor, "canView")
    const resource = await this.findByCode(code)
    const rows = await this.resourceAllocations(resource.id)
    return rows.filter((item) => item.sourceType === "resource_block" && (query.includeCancelled || (item.status !== "cancelled" && item.archivedAt === null))).map((item) => ({
      id: item.id, resourceId: item.resourceId, sourceType: "resource_block" as const, sourceId: item.sourceId,
      startAt: item.startAt.toISOString(), endAt: item.endAt.toISOString(), quantity: item.quantity, capacityImpact: item.capacityImpact,
      status: item.status as "tentative" | "active" | "cancelled", version: item.version,
      reason: (resource.settings?.blockMetadata as Record<string, { reason?: string }> | undefined)?.[item.id]?.reason ?? "",
    }))
  }

  async createBlock(code: string, input: ResourceBlockCreate, actor: SessionUser, requestId: string) {
    const resource = await this.findByCode(code)
    return this.createAllocation({
      resourceId: resource.id, sourceType: "resource_block", sourceId: randomUUID(), startAt: input.startAt, endAt: input.endAt,
      quantity: 1, capacityImpact: resource.capacityTotal, status: "active", operationId: input.operationId,
      expectedVersion: input.expectedVersion, overrideConflict: false, reason: input.reason,
    }, actor, requestId)
  }

  async cancelBlock(code: string, blockId: string, input: ResourceBlockCancel, actor: SessionUser, requestId: string) {
    this.assertCapability(actor, "canEdit")
    return this.dataSource.transaction(async (manager) => {
      const resource = await manager.getRepository(ResourceEntity).findOne({ where: [{ code }, { id: code }] })
      if (!resource) throw this.notFound()
      if (resource.version !== input.version) throw this.versionConflict(resource)
      const allocation = await manager.getRepository(ResourceAllocationEntity).findOneBy({ id: blockId, resourceId: resource.id, sourceType: "resource_block" })
      if (!allocation) throw new NotFoundException({ code: "RESOURCE_BLOCK_NOT_FOUND", message: "Блокировка не найдена" })
      const now = new Date()
      await manager.getRepository(ResourceAllocationEntity).update({ id: allocation.id, version: allocation.version }, { status: "cancelled", archivedAt: now, updatedBy: actor.id, updatedAt: () => "now()" })
      const result = await manager.createQueryBuilder().update(ResourceEntity).set({ version: () => '"version" + 1', updatedBy: actor.id, updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: resource.id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(ResourceEntity, { id: resource.id }))
      const savedResource = await manager.findOneByOrFail(ResourceEntity, { id: resource.id })
      const saved = await manager.getRepository(ResourceAllocationEntity).findOneByOrFail({ id: blockId })
      await this.recordMutation(manager, savedResource, "block_cancelled", actor.id, requestId, { allocationId: blockId, before: this.allocationSnapshot(allocation), after: this.allocationSnapshot(saved) })
      return { ...this.allocationSnapshot(saved), reason: (savedResource.settings?.blockMetadata as Record<string, { reason?: string }> | undefined)?.[blockId]?.reason ?? "" }
    })
  }

  private async findByCode(code: string) {
    const resource = await this.dataSource.getRepository(ResourceEntity).findOne({ where: [{ code }, { id: code }] })
    if (!resource) throw this.notFound()
    return resource
  }

  private async resourceAllocations(resourceId: string) {
    return this.dataSource.getRepository(ResourceAllocationEntity).find({ where: { resourceId } })
  }

  private async overlappingAllocations(manager: EntityManager, input: Pick<ResourceAvailabilityQuery, "resourceId" | "startAt" | "endAt"> & { excludeSourceId?: string | undefined }) {
    const query = manager.getRepository(ResourceAllocationEntity).createQueryBuilder("allocation")
      .where("allocation.resource_id = :resourceId", { resourceId: input.resourceId })
      .andWhere("allocation.status IN (:...statuses)", { statuses: ["active", "tentative"] })
      .andWhere("allocation.archived_at IS NULL")
      .andWhere("allocation.start_at < :endAt AND allocation.end_at > :startAt", { startAt: new Date(input.startAt), endAt: new Date(input.endAt) })
    if (input.excludeSourceId) query.andWhere("allocation.source_id <> :excludeSourceId", { excludeSourceId: input.excludeSourceId })
    return query.getMany()
  }

  private readonly toAvailabilityAllocation = (allocation: ResourceAllocationEntity): AvailabilityAllocation => ({
    id: allocation.id, resourceId: allocation.resourceId, sourceId: allocation.sourceId,
    startAt: allocation.startAt, endAt: allocation.endAt, quantity: allocation.quantity,
    capacityImpact: allocation.capacityImpact, status: allocation.status as AvailabilityAllocation["status"],
  })

  private assertCapability(actor: SessionUser, capability: keyof ResourceCapabilities) {
    if (!actor.capabilities[capability]) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: `Capability ${capability} is required` })
  }

  private versionConflict(resource: ResourceEntity) {
    return new ConflictException({ code: "VERSION_CONFLICT", message: "Ресурс был изменён другим сотрудником", details: { entityId: resource.code, serverVersion: resource.version, server: resource } })
  }

  private notFound() { return new NotFoundException({ code: "RESOURCE_NOT_FOUND", message: "Ресурс не найден" }) }

  private snapshot(resource: ResourceEntity) {
    return { id: resource.id, code: resource.code, version: resource.version, kind: resource.kind, name: resource.name, capacityMode: resource.capacityMode, capacityTotal: resource.capacityTotal, settings: resource.settings, archivedAt: resource.archivedAt?.toISOString() ?? null }
  }

  private allocationSnapshot(allocation: ResourceAllocationEntity) {
    return { id: allocation.id, version: allocation.version, resourceId: allocation.resourceId, sourceType: allocation.sourceType, sourceId: allocation.sourceId, startAt: allocation.startAt.toISOString(), endAt: allocation.endAt.toISOString(), quantity: allocation.quantity, capacityImpact: allocation.capacityImpact, status: allocation.status }
  }

  private async recordMutation(manager: EntityManager, resource: ResourceEntity, action: string, actorId: string, requestId: string, changes: Record<string, unknown>) {
    const now = new Date()
    await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "resource", entityId: resource.id, action, actorId, requestId, changes, createdAt: now }))
    await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `resource.${action}`, aggregateType: "resource", aggregateId: resource.id, payload: { resourceId: resource.id, code: resource.code, version: resource.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
  }
}
