import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common"
import { DataSource, In, IsNull, type EntityManager } from "typeorm"

import {
  AddOnLibraryResponseSchema,
  OfferingAddOnAssignmentsReplaceResultSchema,
  OfferingBindingsReplaceResultSchema,
  OfferingConfigurationOutboxEventSchema,
  OfferingCustomAddOnCreateResultSchema,
  type AddOnLibraryQuery,
  type AddOnLibraryResponse,
  type StayOfferingBindingsReplace,
  type OfferingAddOnAssignmentsReplace,
  type OfferingAddOnAssignment,
  type OfferingBindingsReplaceResult,
  type OfferingCustomAddOnCreate,
  type OfferingCustomAddOnCreateResult,
  type OfferingAddOnAssignmentsReplaceResult,
} from "@crm/contracts"
import {
  AddonOfferingTermsEntity,
  CampgroundOfferingTermsEntity,
  CatalogOfferingEntity,
  ChangeLogEntity,
  IdempotencyKeyEntity,
  OfferingAddonAssignmentEntity,
  OfferingBindingEntity,
  OutboxDeliveryEntity,
  OutboxEventEntity,
  PriceBookEntity,
  RatePlanEntity,
  ResourceEntity,
  ResourceGroupEntity,
  ResourceGroupMemberEntity,
} from "@crm/db"
import { DomainError, validateCampgroundOfferingBindings, validateHouseOfferingBindings, validateOfferingAddOnAssignments } from "@crm/domain"

import { canonicalSha256 } from "./offering-mutation-support.js"
import type { OfferingRequestContext } from "./offering-editor-application.service.js"

type StoredReplay = { responseBody: Record<string, unknown> | null; operationId: string; idempotencyKey: string; requestHash: string }
type Cursor = { updatedAt: string; id: string }

@Injectable()
export class OfferingConfigurationApplicationService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async replaceStayBindings(input: StayOfferingBindingsReplace, context: OfferingRequestContext): Promise<OfferingBindingsReplaceResult> {
    this.assertBindingsEdit(context)
    const scope = `offering:${input.offeringId}:bindings:replace`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "stay.bindings.replace", offeringId: input.offeringId, input })
      const replay = await this.replay<OfferingBindingsReplaceResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const offering = await this.lockOffering(manager, input.offeringId)
      if (offering.kind !== "house" && offering.kind !== "campground") throw unprocessable("OFFERING_KIND_UNSUPPORTED", "Связи проживания доступны только для домиков и кемпингов")
      this.assertSegmentVersion(offering.subjectVersion, input.expectedSubjectVersion, "subject", offering.id)
      const resources = await this.lockAndValidateBindingResources(manager, input.bindings.map((item) => item.target.id))
      if (offering.kind === "house") {
        this.validateDomain(() => validateHouseOfferingBindings(input.bindings))
      } else {
        const terms = await manager.findOne(CampgroundOfferingTermsEntity, { where: { offeringId: offering.id } })
        if (!terms) throw unprocessable("CAMPGROUND_TERMS_INVALID", "Для кемпинга не заданы operational terms")
        const memberships = await manager.find(ResourceGroupMemberEntity, { where: { resourceId: In(resources.map((item) => item.id)), archivedAt: IsNull() } })
        const groupIds = [...new Set(memberships.map((item) => item.groupId))]
        const groups = groupIds.length ? await manager.find(ResourceGroupEntity, { where: { id: In(groupIds) } }) : []
        const groupsById = new Map(groups.map((group) => [group.id, group]))
        this.validateDomain(() => validateCampgroundOfferingBindings(
          { salesUnit: terms.sellableUnit as "owned_tent" | "own_tent_pitch", allocationMode: terms.inventoryMode as "discrete_inventory" | "shared_capacity" },
          input.bindings,
          resources.map((resource) => ({ id: resource.id, capacityMode: resource.capacityMode as "fixed" | "shared", archived: resource.archivedAt !== null })),
          memberships.map((membership) => ({ resourceId: membership.resourceId, role: membership.role as "owned_tent" | "own_tent_area" | "common_area", groupState: (groupsById.get(membership.groupId)?.state ?? "archived") as "draft" | "active" | "archived", archived: membership.archivedAt !== null })),
        ))
      }
      const requestedHash = bindingsHash(input.bindings)
      const current = await manager.find(OfferingBindingEntity, { where: { offeringId: offering.id, archivedAt: IsNull() }, order: { createdAt: "ASC", id: "ASC" } })
      if (bindingsHash(current.map(toBindingDraft)) === requestedHash) {
        const response = OfferingBindingsReplaceResultSchema.parse({ offeringId: offering.id, subjectVersion: offering.subjectVersion, bindingsHash: requestedHash, bindings: current.map(toBindingDto) })
        await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
        return response
      }
      const now = new Date(), currentByKey = new Map(current.map((item) => [bindingKey(toBindingDraft(item)), item]))
      const retained: OfferingBindingEntity[] = []
      const changed: OfferingBindingEntity[] = []
      for (const binding of input.bindings) {
        const existing = currentByKey.get(bindingKey(binding))
        if (existing) {
          if (canonicalSha256(toBindingDraft(existing)) !== canonicalSha256(binding)) {
            existing.quantityDefault = binding.defaultQuantity; existing.capacityImpactDefault = binding.defaultCapacityImpact; existing.preparationBeforeMinutes = binding.preparationBeforeMinutes; existing.preparationAfterMinutes = binding.preparationAfterMinutes; existing.availabilityRequired = binding.availabilityRequired; existing.updatedBy = context.actor.id; changed.push(existing)
          }
          retained.push(existing); currentByKey.delete(bindingKey(binding))
        } else { const entity = manager.create(OfferingBindingEntity, bindingEntity(offering.id, binding, context.actor.id)); retained.push(entity); changed.push(entity) }
      }
      for (const removed of currentByKey.values()) { removed.archivedAt = now; removed.updatedBy = context.actor.id; await manager.save(removed) }
      if (changed.length) await manager.save(changed)
      const created = retained
      const subjectVersion = await this.bumpSegment(manager, offering, "subjectVersion", input.expectedSubjectVersion, context.actor.id)
      const response = OfferingBindingsReplaceResultSchema.parse({ offeringId: offering.id, subjectVersion, bindingsHash: requestedHash, bindings: created.map(toBindingDto) })
      await this.recordOfferingConfiguration(manager, offering, "crm.offering.bindings_replaced", input.operationId, context, { calendar: null, subject: subjectVersion, addOns: null }, requestedHash)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async listAddOnLibrary(query: AddOnLibraryQuery, context: OfferingRequestContext): Promise<AddOnLibraryResponse> {
    this.assertRead(context)
    const cursor = query.cursor ? decodeCursor(query.cursor) : null
    const builder = this.dataSource.getRepository(CatalogOfferingEntity).createQueryBuilder("offering")
      .where("offering.kind = 'addon'").andWhere("offering.archived_at IS NULL")
      .orderBy("offering.updated_at", "DESC").addOrderBy("offering.id", "DESC").take(query.limit + 1)
    if (query.state) builder.andWhere("offering.state = :state", { state: query.state })
    if (query.scope) builder.andWhere("offering.scope = :scope", { scope: query.scope })
    if (query.serviceType) builder.andWhere("EXISTS (SELECT 1 FROM addon_offering_terms terms WHERE terms.offering_id = offering.id AND terms.service_type = :serviceType)", { serviceType: query.serviceType })
    if (query.q) builder.andWhere("(LOWER(offering.operational_name) LIKE :q ESCAPE '\\' OR LOWER(offering.code) LIKE :q ESCAPE '\\' OR EXISTS (SELECT 1 FROM addon_offering_terms terms WHERE terms.offering_id = offering.id AND LOWER(terms.category_key) LIKE :q ESCAPE '\\'))", { q: `%${escapeLike(query.q.toLocaleLowerCase("ru-RU"))}%` })
    if (cursor) builder.andWhere("(offering.updated_at, offering.id) < (:updatedAt, :id)", cursor)
    const rows = await builder.getMany()
    const page = rows.slice(0, query.limit)
    const items = await Promise.all(page.map((offering) => this.addOnLibraryItem(this.dataSource.manager, offering)))
    const last = page.at(-1)
    return AddOnLibraryResponseSchema.parse({ items, nextCursor: rows.length > query.limit && last ? encodeCursor({ updatedAt: last.updatedAt.toISOString(), id: last.id }) : null })
  }

  async replaceAddOnAssignments(input: OfferingAddOnAssignmentsReplace, context: OfferingRequestContext): Promise<OfferingAddOnAssignmentsReplaceResult> {
    this.assertAssignmentsEdit(context)
    const scope = `offering:${input.offeringId}:add-ons:replace`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "addon.assignments.replace", offeringId: input.offeringId, input })
      const replay = await this.replay<OfferingAddOnAssignmentsReplaceResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const offering = await this.lockOffering(manager, input.offeringId)
      this.assertSegmentVersion(offering.addonAssignmentsVersion, input.expectedAddOnsVersion, "addOns", offering.id)
      const addOns = await this.lockAndValidateAddOns(manager, input.assignments.map((item) => item.addOnOfferingId))
      this.validateDomain(() => validateOfferingAddOnAssignments(offering.id, input.assignments, addOns.map(toAddOnCandidate)))
      await this.validateEnabledAssignmentPricing(manager, offering, input.assignments, addOns)
      const assignmentsHash = assignmentHash(input.assignments)
      const existing = await manager.find(OfferingAddonAssignmentEntity, { where: { offeringId: offering.id, archivedAt: IsNull() }, order: { displayOrder: "ASC", id: "ASC" } })
      if (assignmentHash(existing.map(toAssignmentDraft)) === assignmentsHash) {
        const response = OfferingAddOnAssignmentsReplaceResultSchema.parse({ offeringId: offering.id, addOnAssignmentsVersion: offering.addonAssignmentsVersion, assignmentsHash, assignments: existing.map(toAssignmentDto) })
        await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
        return response
      }
      const now = new Date(), existingByAddOn = new Map(existing.map((item) => [item.addonOfferingId, item]))
      const retained: OfferingAddonAssignmentEntity[] = []
      const changed: OfferingAddonAssignmentEntity[] = []
      for (const draft of input.assignments) {
        const entity = existingByAddOn.get(draft.addOnOfferingId)
        if (entity) { if (canonicalSha256(toAssignmentDraft(entity)) !== canonicalSha256(draft)) { applyAssignment(entity, draft, context.actor.id); changed.push(entity) }; retained.push(entity); existingByAddOn.delete(draft.addOnOfferingId) }
        else { const created = manager.create(OfferingAddonAssignmentEntity, assignmentEntity(offering.id, draft, context.actor.id)); retained.push(created); changed.push(created) }
      }
      for (const removed of existingByAddOn.values()) { removed.archivedAt = now; removed.updatedBy = context.actor.id; await manager.save(removed) }
      if (changed.length) await manager.save(changed)
      const created = retained
      const addOnAssignmentsVersion = await this.bumpSegment(manager, offering, "addonAssignmentsVersion", input.expectedAddOnsVersion, context.actor.id)
      const response = OfferingAddOnAssignmentsReplaceResultSchema.parse({ offeringId: offering.id, addOnAssignmentsVersion, assignmentsHash, assignments: created.map(toAssignmentDto) })
      await this.recordOfferingConfiguration(manager, offering, "crm.offering.addon_assignments_replaced", input.operationId, context, { calendar: null, subject: null, addOns: addOnAssignmentsVersion }, assignmentsHash)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  async createCustomAddOnAndAssign(input: OfferingCustomAddOnCreate, context: OfferingRequestContext): Promise<OfferingCustomAddOnCreateResult> {
    this.assertAssignmentsEdit(context)
    if (!context.actor.capabilities.canCreate) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для создания дополнения" })
    const scope = `offering:${input.offeringId}:add-ons:custom-create`
    return this.serializable(async (manager) => {
      const hash = canonicalSha256({ command: "addon.custom.create-and-assign", offeringId: input.offeringId, input })
      const replay = await this.replay<OfferingCustomAddOnCreateResult>(manager, scope, input.operationId, input.idempotencyKey, hash)
      if (replay) return replay
      const owner = await this.lockOffering(manager, input.offeringId)
      this.assertSegmentVersion(owner.addonAssignmentsVersion, input.expectedAddOnsVersion, "addOns", owner.id)
      const initialState = input.addOn.salesMode === "request_only" ? "active" : "draft"
      if (input.assignment.enabled && initialState !== "active") throw unprocessable("ADDON_NOT_ACTIVE", "Продаваемый доп можно включить после настройки рабочей цены")
      const code = input.addOn.code ?? `addon_${randomUUID().replaceAll("-", "").slice(0, 12)}`
      const duplicate = await manager.findOne(CatalogOfferingEntity, { where: { code } })
      if (duplicate) throw conflict("OFFERING_CODE_TAKEN", "Предложение с таким кодом уже существует", { code })
      const addOn = await manager.save(manager.create(CatalogOfferingEntity, {
        id: randomUUID(), code, kind: "addon", operationalName: input.addOn.operationalName, internalComment: input.addOn.internalComment,
        state: initialState, subjectVersion: 1, pricingVersion: 1, addonAssignmentsVersion: 1, salesMode: input.addOn.salesMode,
        priceDisplayMode: input.addOn.priceDisplayMode, currency: owner.currency, timezone: owner.timezone, taxMode: input.addOn.taxMode ?? owner.taxMode,
        businessCalendarId: owner.businessCalendarId, leadDirection: null, defaultAssigneeId: null, scope: "offering_specific", ownerOfferingId: owner.id,
        activePriceBookId: null, createdBy: context.actor.id, updatedBy: context.actor.id, archivedAt: null,
      }))
      const quantityTerms = input.addOn.serviceType === "quantity_service" || input.addOn.serviceType === "person_service"
        ? { minimumQuantity: 1, maximumQuantity: 100, defaultQuantity: 1, quantityStep: 1 }
        : { minimumQuantity: null, maximumQuantity: null, defaultQuantity: null, quantityStep: null }
      const terms = await manager.save(manager.create(AddonOfferingTermsEntity, {
        offeringId: addOn.id, offeringKind: "addon", serviceType: input.addOn.serviceType,
        categoryKey: input.addOn.categoryKey, standalone: input.addOn.standalone,
        applicableOfferingKinds: ["house", "campground", "venue", "event_service", "program"],
        ...quantityTerms, createdAt: new Date(), createdBy: context.actor.id,
      }))
      const assignment = await manager.save(manager.create(OfferingAddonAssignmentEntity, assignmentEntity(owner.id, { ...input.assignment, addOnOfferingId: addOn.id }, context.actor.id)))
      const addOnAssignmentsVersion = await this.bumpSegment(manager, owner, "addonAssignmentsVersion", input.expectedAddOnsVersion, context.actor.id)
      const assignmentsHash = assignmentHash((await manager.find(OfferingAddonAssignmentEntity, { where: { offeringId: owner.id, archivedAt: IsNull() }, order: { displayOrder: "ASC", id: "ASC" } })).map(toAssignmentDraft))
      const response = OfferingCustomAddOnCreateResultSchema.parse({ addOn: await this.addOnLibraryItem(manager, addOn, terms), assignment: toAssignmentDto(assignment), addOnAssignmentsVersion, assignmentsHash })
      await this.recordOfferingConfiguration(manager, owner, "crm.offering.custom_addon_created", input.operationId, context, { calendar: null, subject: null, addOns: addOnAssignmentsVersion }, assignmentsHash)
      await this.remember(manager, scope, input.operationId, input.idempotencyKey, hash, response)
      return response
    })
  }

  private async addOnLibraryItem(manager: EntityManager, offering: CatalogOfferingEntity, suppliedTerms?: AddonOfferingTermsEntity) {
    const terms = suppliedTerms ?? await manager.findOne(AddonOfferingTermsEntity, { where: { offeringId: offering.id } })
    if (!terms) throw unprocessable("ADDON_TERMS_NOT_FOUND", "Для дополнения не заданы operational terms", { offeringId: offering.id })
    return { offering: toOfferingDto(offering, terms), serviceType: terms.serviceType, scope: offering.scope, ownerOfferingId: offering.ownerOfferingId, categoryKey: terms.categoryKey, standalone: terms.standalone }
  }

  private async lockAndValidateBindingResources(manager: EntityManager, resourceIds: readonly string[]) {
    const ids = [...new Set(resourceIds)].sort()
    const rows: ResourceEntity[] = []
    for (const id of ids) { const resource = await manager.createQueryBuilder(ResourceEntity, "resource").setLock("pessimistic_write").where("resource.id = :id", { id }).getOne(); if (!resource || resource.archivedAt !== null) throw unprocessable("OFFERING_BINDING_TARGET_NOT_FOUND", "Связанный ресурс не найден или архивирован", { resourceId: id }); rows.push(resource) }
    return rows
  }

  private async lockAndValidateAddOns(manager: EntityManager, addOnIds: readonly string[]) {
    const result: CatalogOfferingEntity[] = []
    for (const id of [...new Set(addOnIds)].sort()) {
      const addOn = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write").where("offering.id = :id", { id }).getOne()
      if (!addOn || addOn.kind !== "addon" || addOn.archivedAt !== null) throw unprocessable("ADDON_NOT_FOUND", "Дополнение не найдено или недоступно", { addOnOfferingId: id })
      result.push(addOn)
    }
    return result
  }

  private async validateEnabledAssignmentPricing(manager: EntityManager, owner: CatalogOfferingEntity, assignments: OfferingAddOnAssignmentsReplace["assignments"], addOns: readonly CatalogOfferingEntity[]) {
    const byId = new Map(addOns.map((item) => [item.id, item]))
    for (const assignment of assignments.filter((item) => item.enabled)) {
      const addOn = byId.get(assignment.addOnOfferingId)!
      if (addOn.state !== "active") throw unprocessable("ADDON_NOT_ACTIVE", "Включённым может быть только active add-on", { addOnOfferingId: addOn.id, state: addOn.state })
      if (addOn.currency !== owner.currency) throw unprocessable("ADDON_CURRENCY_MISMATCH", "Валюта допа должна совпадать с валютой предложения", { addOnOfferingId: addOn.id, offeringCurrency: owner.currency, addOnCurrency: addOn.currency })
      if (addOn.salesMode !== "request_only" && !addOn.activePriceBookId) {
        throw unprocessable("ADDON_PRICE_BOOK_NOT_ACTIVE", "Для включённого продаваемого допа нужен активный прайс-лист", { addOnOfferingId: addOn.id })
      }
      if (assignment.ratePlanKeyOverride) {
        const books = await manager.find(PriceBookEntity, { where: { offeringId: addOn.id, state: "active" } })
        const bookIds = books.filter((item) => item.archivedAt === null).map((item) => item.id)
        const plan = bookIds.length ? await manager.findOne(RatePlanEntity, { where: { priceBookId: In(bookIds), key: assignment.ratePlanKeyOverride } }) : null
        if (!plan || plan.archivedAt !== null) throw unprocessable("ADDON_RATE_PLAN_NOT_FOUND", "У допа нет доступного указанного тарифа", { addOnOfferingId: addOn.id, ratePlanKeyOverride: assignment.ratePlanKeyOverride })
      }
    }
  }

  private async lockOffering(manager: EntityManager, offeringId: string, kind?: string) {
    const offering = await manager.createQueryBuilder(CatalogOfferingEntity, "offering").setLock("pessimistic_write").where("offering.id = :offeringId", { offeringId }).getOne()
    if (!offering || offering.archivedAt !== null || (kind && offering.kind !== kind)) throw new NotFoundException({ code: "OFFERING_NOT_FOUND", message: "Предложение не найдено" })
    return offering
  }

  private assertSegmentVersion(actual: number, expected: number, segment: "subject" | "addOns", offeringId: string) { if (actual !== expected) throw conflict("VERSION_CONFLICT", "Условия предложения были изменены другим пользователем", { segment, offeringId, expectedVersion: expected, serverVersion: actual }) }

  private async bumpSegment(manager: EntityManager, offering: CatalogOfferingEntity, field: "subjectVersion" | "addonAssignmentsVersion", expected: number, actorId: string) {
    const column = field === "subjectVersion" ? "subject_version" : "addon_assignments_version"
    const rows = returningRows<{ version: number }>(await manager.query(`UPDATE catalog_offerings SET ${column} = ${column} + 1, updated_at = now(), updated_by = $1 WHERE id = $2 AND ${column} = $3 RETURNING ${column} AS version`, [actorId, offering.id, expected]))
    if (rows.length !== 1) throw conflict("VERSION_CONFLICT", "Условия предложения были изменены другим пользователем", { offeringId: offering.id })
    return Number(rows[0]!.version)
  }

  private async recordOfferingConfiguration(manager: EntityManager, offering: CatalogOfferingEntity, eventType: "crm.offering.bindings_replaced" | "crm.offering.addon_assignments_replaced" | "crm.offering.custom_addon_created", operationId: string, context: OfferingRequestContext, versions: { calendar: number | null; subject: number | null; addOns: number | null }, configurationHash: string) {
    const now = new Date()
    const event = OfferingConfigurationOutboxEventSchema.parse({ eventId: randomUUID(), eventType, occurredAt: now.toISOString(), actorId: context.actor.id, requestId: context.requestId, operationId, entrySurface: context.entrySurface, aggregate: { type: "catalog_offering", id: offering.id }, versions, configurationHash })
    await manager.save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "catalog_offering", entityId: offering.id, action: eventType, actorId: context.actor.id, requestId: context.requestId, changes: { operationId, entrySurface: context.entrySurface, versions, configurationHash }, createdAt: now }))
    await this.saveOutbox(manager, event, ["sse"])
    if (offering.state === "active" && (offering.salesMode === "request_only" || offering.activePriceBookId !== null)) {
      const invalidation = OfferingConfigurationOutboxEventSchema.parse({ ...event, eventId: randomUUID(), eventType: "public.offering_projection.invalidated" })
      await this.saveOutbox(manager, invalidation, ["sse", "public_projection"])
    }
  }

  private async saveOutbox(manager: EntityManager, event: ReturnType<typeof OfferingConfigurationOutboxEventSchema.parse>, consumers: readonly string[]) {
    const at = new Date(event.occurredAt)
    await manager.save(manager.create(OutboxEventEntity, { id: event.eventId, topic: event.eventType, aggregateType: event.aggregate.type, aggregateId: event.aggregate.id, payload: event as unknown as Record<string, unknown>, availableAt: at, processedAt: null, attempts: 0, createdAt: at }))
    await manager.save(consumers.map((consumer) => manager.create(OutboxDeliveryEntity, { eventId: event.eventId, consumer, status: "pending", attempts: 0, availableAt: at, processedAt: null, lastError: null, createdAt: at, updatedAt: at })))
  }

  private async replay<T>(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<T | null> { for (const lock of [`key:${scope}:${idempotencyKey}`, `operation:${scope}:${operationId}`].sort()) await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock]); const stored = await manager.createQueryBuilder(IdempotencyKeyEntity, "key").where("key.scope = :scope", { scope }).andWhere("(key.operation_id = :operationId OR key.idempotency_key = :idempotencyKey)", { operationId, idempotencyKey }).getOne() as StoredReplay | null; if (!stored) return null; if (stored.operationId !== operationId || stored.idempotencyKey !== idempotencyKey || stored.requestHash !== requestHash) throw conflict("IDEMPOTENCY_CONFLICT", "Ключ идемпотентности уже использован для другой операции"); return stored.responseBody as T }
  private async remember(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: object) { await manager.save(manager.create(IdempotencyKeyEntity, { id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 200, responseBody: response as Record<string, unknown>, createdAt: new Date() })) }
  private assertRead(context: OfferingRequestContext) { if (!context.actor.capabilities.canView || (context.entrySurface === "admin" && context.actor.capabilities.canViewContent !== true)) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для просмотра дополнений" }) }
  private assertBindingsEdit(context: OfferingRequestContext) { if (!context.actor.capabilities.canEdit || !context.actor.capabilities.canAssign || (context.entrySurface === "admin" && context.actor.capabilities.canEditContent !== true)) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для редактирования связей" }) }
  private assertAssignmentsEdit(context: OfferingRequestContext) { this.assertBindingsEdit(context) }
  private validateDomain(action: () => void) { try { action() } catch (error) { if (error instanceof DomainError) throw unprocessable(error.code, error.message, error.details); throw error } }
  private async serializable<T>(operation: (manager: EntityManager) => Promise<T>): Promise<T> { for (let attempt = 0; ; attempt += 1) try { return await this.dataSource.transaction("SERIALIZABLE", operation) } catch (error) { const code = (error as { driverError?: { code?: string }; code?: string }).driverError?.code ?? (error as { code?: string }).code; if (attempt >= 2 || (code !== "40001" && code !== "40P01")) throw error } }
}

function toBindingDto(row: OfferingBindingEntity) { const target = row.resourceId ? { type: "resource" as const, id: row.resourceId } : row.resourceGroupId ? { type: "resource_group" as const, id: row.resourceGroupId } : row.programTemplateId ? { type: "program_template" as const, id: row.programTemplateId } : { type: "event_service_template" as const, id: row.eventServiceTemplateId! }; return { id: row.id, offeringId: row.offeringId, version: row.version, target, role: row.role, availabilityRequired: row.availabilityRequired, defaultQuantity: row.quantityDefault, defaultCapacityImpact: row.capacityImpactDefault, preparationBeforeMinutes: row.preparationBeforeMinutes, preparationAfterMinutes: row.preparationAfterMinutes } }
function toBindingDraft(row: OfferingBindingEntity) { const dto = toBindingDto(row); return { target: dto.target, role: dto.role, availabilityRequired: dto.availabilityRequired, defaultQuantity: dto.defaultQuantity, defaultCapacityImpact: dto.defaultCapacityImpact, preparationBeforeMinutes: dto.preparationBeforeMinutes, preparationAfterMinutes: dto.preparationAfterMinutes } }
function bindingKey(binding: { target: { type: string; id: string }; role: string }) { return `${binding.target.type}:${binding.target.id}:${binding.role}` }
function bindingsHash(bindings: readonly ReturnType<typeof toBindingDraft>[]) { return canonicalSha256([...bindings].sort((left, right) => bindingKey(left).localeCompare(bindingKey(right)))) }
function bindingEntity(offeringId: string, binding: ReturnType<typeof toBindingDraft>, actorId: string) { return { id: randomUUID(), offeringId, resourceId: binding.target.type === "resource" ? binding.target.id : null, resourceGroupId: null, programTemplateId: null, eventServiceTemplateId: null, role: binding.role, quantityDefault: binding.defaultQuantity, capacityImpactDefault: binding.defaultCapacityImpact, preparationBeforeMinutes: binding.preparationBeforeMinutes, preparationAfterMinutes: binding.preparationAfterMinutes, availabilityRequired: binding.availabilityRequired, createdBy: actorId, updatedBy: actorId, archivedAt: null } }
function assignmentEntity(offeringId: string, assignment: { addOnOfferingId: string; enabled: boolean; required: boolean; recommended: boolean; groupKey: string | null; ratePlanKeyOverride: string | null; labelOverride: string | null; descriptionOverride: string | null; minQuantityOverride: number | null; maxQuantityOverride: number | null; defaultQuantityOverride: number | null; displayOrder: number }, actorId: string) { return { id: randomUUID(), offeringId, addonOfferingId: assignment.addOnOfferingId, addonOfferingKind: "addon", enabled: assignment.enabled, required: assignment.required, recommended: assignment.recommended, groupKey: assignment.groupKey, ratePlanKeyOverride: assignment.ratePlanKeyOverride, labelOverride: assignment.labelOverride, descriptionOverride: assignment.descriptionOverride, minimumQuantity: assignment.minQuantityOverride, maximumQuantity: assignment.maxQuantityOverride, defaultQuantity: assignment.defaultQuantityOverride, displayOrder: assignment.displayOrder, createdBy: actorId, updatedBy: actorId, archivedAt: null } }
function applyAssignment(entity: OfferingAddonAssignmentEntity, assignment: Parameters<typeof assignmentEntity>[1], actorId: string) { entity.enabled = assignment.enabled; entity.required = assignment.required; entity.recommended = assignment.recommended; entity.groupKey = assignment.groupKey; entity.ratePlanKeyOverride = assignment.ratePlanKeyOverride; entity.labelOverride = assignment.labelOverride; entity.descriptionOverride = assignment.descriptionOverride; entity.minimumQuantity = assignment.minQuantityOverride; entity.maximumQuantity = assignment.maxQuantityOverride; entity.defaultQuantity = assignment.defaultQuantityOverride; entity.displayOrder = assignment.displayOrder; entity.updatedBy = actorId }
function toAssignmentDto(row: OfferingAddonAssignmentEntity): OfferingAddOnAssignment { return { id: row.id, offeringId: row.offeringId, version: row.version, addOnOfferingId: row.addonOfferingId, enabled: row.enabled, required: row.required, recommended: row.recommended, groupKey: row.groupKey, ratePlanKeyOverride: row.ratePlanKeyOverride, labelOverride: row.labelOverride, descriptionOverride: row.descriptionOverride, minQuantityOverride: row.minimumQuantity, maxQuantityOverride: row.maximumQuantity, defaultQuantityOverride: row.defaultQuantity, displayOrder: row.displayOrder } }
function toAssignmentDraft(row: OfferingAddonAssignmentEntity) { const dto = toAssignmentDto(row); return { addOnOfferingId: dto.addOnOfferingId, enabled: dto.enabled, required: dto.required, recommended: dto.recommended, groupKey: dto.groupKey, ratePlanKeyOverride: dto.ratePlanKeyOverride, labelOverride: dto.labelOverride, descriptionOverride: dto.descriptionOverride, minQuantityOverride: dto.minQuantityOverride, maxQuantityOverride: dto.maxQuantityOverride, defaultQuantityOverride: dto.defaultQuantityOverride, displayOrder: dto.displayOrder } }
function assignmentHash(assignments: readonly ReturnType<typeof toAssignmentDraft>[]) { return canonicalSha256([...assignments].sort((left, right) => left.addOnOfferingId.localeCompare(right.addOnOfferingId))) }
function toAddOnCandidate(row: CatalogOfferingEntity) { return { id: row.id, kind: row.kind, state: row.state as "draft" | "active" | "paused" | "archived", archived: row.archivedAt !== null, scope: row.scope as "reusable" | "offering_specific", ownerOfferingId: row.ownerOfferingId } }
function toOfferingDto(row: CatalogOfferingEntity, terms: AddonOfferingTermsEntity) { return { id: row.id, code: row.code, version: row.version, kind: "addon", operationalName: row.operationalName, internalComment: row.internalComment, state: row.state, salesMode: row.salesMode, priceDisplayMode: row.priceDisplayMode, currency: row.currency, timezone: row.timezone, taxMode: row.taxMode, businessCalendarId: row.businessCalendarId, fulfillment: { kind: "addon", serviceType: terms.serviceType, standalone: terms.standalone, scope: row.scope, ownerOfferingId: row.ownerOfferingId }, activePriceBookId: row.activePriceBookId, archivedAt: row.archivedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() } }
function returningRows<T>(result: unknown): T[] { return !Array.isArray(result) ? [] : (Array.isArray(result[0]) ? result[0] : result) as T[] }
function encodeCursor(cursor: Cursor) { return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url") }
function decodeCursor(value: string): Cursor { try { const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<Cursor>; if (typeof parsed.updatedAt !== "string" || typeof parsed.id !== "string") throw new Error("invalid"); return { updatedAt: parsed.updatedAt, id: parsed.id } } catch { throw unprocessable("INVALID_CURSOR", "Некорректный курсор") } }
function escapeLike(value: string) { return value.replace(/[\\%_]/g, "\\$&") }
function conflict(code: string, message: string, details: Record<string, unknown> = {}) { return new ConflictException({ code, message, details }) }
function unprocessable(code: string, message: string, details: Record<string, unknown> = {}) { return new UnprocessableEntityException({ code, message, details }) }
