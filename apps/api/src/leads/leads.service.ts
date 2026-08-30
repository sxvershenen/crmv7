import { randomUUID } from "node:crypto"

import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { DataSource, type EntityManager } from "typeorm"

import type { LeadCreate, LeadDto, LeadListQuery, LeadStatus, LeadTransition, LeadUpdate, SessionUser } from "@crm/contracts"
import { ChangeLogEntity, CustomerEntity, LeadEntity, OutboxEventEntity } from "@crm/db"
import { assertCapability } from "@crm/domain"

import { toLeadDto } from "./lead.mapper.js"

const transitions: Readonly<Record<LeadStatus, readonly LeadStatus[]>> = {
  new: ["in_progress", "waiting", "success", "rejected", "spam", "archived"],
  in_progress: ["new", "waiting", "success", "rejected", "spam", "archived"],
  waiting: ["in_progress", "success", "rejected", "spam", "archived"],
  success: ["archived"], rejected: ["archived"], spam: ["archived"], archived: [],
}
const activeStatuses = new Set<LeadStatus>(["new", "in_progress", "waiting"])

@Injectable()
export class LeadsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: LeadListQuery, actor: SessionUser): Promise<{ items: LeadDto[]; nextCursor: string | null }> {
    assertCapability(actor.capabilities, "canView")
    const builder = this.dataSource.getRepository(LeadEntity).createQueryBuilder("lead")
      .where(query.archived === true ? "lead.archived_at IS NOT NULL" : "lead.archived_at IS NULL")
    if (query.customerId) builder.andWhere("lead.customer_id = :customerId", { customerId: query.customerId })
    if (query.status) builder.andWhere("lead.status = :status", { status: query.status })
    if (query.direction) builder.andWhere("lead.direction = :direction", { direction: query.direction })
    if (query.source) builder.andWhere("lead.source = :source", { source: query.source })
    if (query.assigneeId) builder.andWhere("lead.assignees @> :assignee::jsonb", { assignee: JSON.stringify([{ id: query.assigneeId }]) })
    if (query.search) builder.andWhere("(lead.name ILIKE :search OR lead.phone ILIKE :search OR lead.requested_item ILIKE :search)", { search: `%${query.search}%` })
    const cursor = query.cursor ? this.decodeCursor(query.cursor, query.order) : null
    if (cursor) {
      if (query.order === "nextContactAsc") {
        if (cursor.value === null) builder.andWhere("lead.next_contact_at IS NULL AND lead.id > :cursorId", { cursorId: cursor.id })
        else builder.andWhere("(lead.next_contact_at > :cursorAt OR (lead.next_contact_at = :cursorAt AND lead.id > :cursorId) OR lead.next_contact_at IS NULL)", { cursorAt: new Date(cursor.value), cursorId: cursor.id })
      } else if (query.order === "desiredStartAsc") {
        if (cursor.value === null) builder.andWhere("lead.desired_start_at IS NULL AND lead.id > :cursorId", { cursorId: cursor.id })
        else builder.andWhere("(lead.desired_start_at > :cursorAt OR (lead.desired_start_at = :cursorAt AND lead.id > :cursorId) OR lead.desired_start_at IS NULL)", { cursorAt: new Date(cursor.value), cursorId: cursor.id })
      }
      else builder.andWhere("(lead.created_at < :cursorAt OR (lead.created_at = :cursorAt AND lead.id < :cursorId))", { cursorAt: new Date(cursor.value ?? ""), cursorId: cursor.id })
    }
    if (query.order === "nextContactAsc") builder.orderBy("lead.next_contact_at", "ASC", "NULLS LAST").addOrderBy("lead.id", "ASC")
    else if (query.order === "desiredStartAsc") builder.orderBy("lead.desired_start_at", "ASC", "NULLS LAST").addOrderBy("lead.id", "ASC")
    else builder.orderBy("lead.created_at", "DESC").addOrderBy("lead.id", "DESC")
    builder.take(query.limit + 1)
    const rows = await builder.getMany()
    const hasNext = rows.length > query.limit
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows
    const last = pageRows.at(-1)
    const value = query.order === "createdDesc" ? last?.createdAt : query.order === "nextContactAsc" ? last?.nextContactAt : last?.desiredStartAt
    return { items: pageRows.map((lead) => toLeadDto(lead, actor)), nextCursor: hasNext && last ? this.encodeCursor(query.order, value?.toISOString() ?? null, last.id) : null }
  }

  async get(id: string, actor: SessionUser): Promise<LeadDto> { assertCapability(actor.capabilities, "canView"); return toLeadDto(await this.find(id), actor) }

  async create(input: LeadCreate, actor: SessionUser, requestId: string): Promise<LeadDto> {
    assertCapability(actor.capabilities, "canCreate")
    if (input.status !== "new") assertCapability(actor.capabilities, "canChangeStatus")
    return this.dataSource.transaction(async (manager) => {
      await this.assertCustomer(manager, input.customerId)
      this.assertInterval(input.desiredStartAt, input.desiredEndAt)
      const lead = manager.create(LeadEntity, {
        id: randomUUID(), customerId: input.customerId, name: input.name, phone: input.phone, channel: input.channel,
        direction: input.direction, requestedItem: input.requestedItem, desiredStartAt: input.desiredStartAt ? new Date(input.desiredStartAt) : null,
        desiredEndAt: input.desiredEndAt ? new Date(input.desiredEndAt) : null, guestCount: input.guestCount, comment: input.comment,
        source: input.source, utm: input.utm, assignees: input.assignees, nextContactAt: input.nextContactAt ? new Date(input.nextContactAt) : null,
        status: input.status, createdBy: actor.id, updatedBy: actor.id, archivedAt: input.status === "archived" ? new Date() : null,
      })
      const saved = await manager.save(lead)
      await this.adjustCustomerCounts(manager, saved.customerId, 1, activeStatuses.has(saved.status as LeadStatus) ? 1 : 0)
      await this.recordMutation(manager, saved, "created", actor.id, requestId, { after: toLeadDto(saved, actor) })
      return toLeadDto(saved, actor)
    })
  }

  async update(id: string, input: LeadUpdate, actor: SessionUser, requestId: string): Promise<LeadDto> {
    assertCapability(actor.capabilities, "canEdit")
    return this.dataSource.transaction(async (manager) => {
      const current = await this.findWith(manager, id)
      if (current.version !== input.version) throw this.versionConflict(current)
      await this.assertCustomer(manager, input.customerId === undefined ? current.customerId : input.customerId)
      this.assertInterval(input.desiredStartAt === undefined ? current.desiredStartAt?.toISOString() ?? null : input.desiredStartAt, input.desiredEndAt === undefined ? current.desiredEndAt?.toISOString() ?? null : input.desiredEndAt)
      const before = toLeadDto(current, actor)
      const patch: Partial<LeadEntity> = {
        ...(input.customerId === undefined ? {} : { customerId: input.customerId }), ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.phone === undefined ? {} : { phone: input.phone }), ...(input.channel === undefined ? {} : { channel: input.channel }),
        ...(input.direction === undefined ? {} : { direction: input.direction }), ...(input.requestedItem === undefined ? {} : { requestedItem: input.requestedItem }),
        ...(input.desiredStartAt === undefined ? {} : { desiredStartAt: input.desiredStartAt ? new Date(input.desiredStartAt) : null }),
        ...(input.desiredEndAt === undefined ? {} : { desiredEndAt: input.desiredEndAt ? new Date(input.desiredEndAt) : null }),
        ...(input.guestCount === undefined ? {} : { guestCount: input.guestCount }), ...(input.comment === undefined ? {} : { comment: input.comment }),
        ...(input.source === undefined ? {} : { source: input.source }), ...(input.utm === undefined ? {} : { utm: input.utm }),
        ...(input.assignees === undefined ? {} : { assignees: input.assignees }), ...(input.nextContactAt === undefined ? {} : { nextContactAt: input.nextContactAt ? new Date(input.nextContactAt) : null }), updatedBy: actor.id,
      }
      const result = await manager.createQueryBuilder().update(LeadEntity).set({ ...patch, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await this.findWith(manager, id))
      const saved = await this.findWith(manager, id)
      if (current.customerId !== saved.customerId) {
        await this.adjustCustomerCounts(manager, current.customerId, -1, activeStatuses.has(current.status as LeadStatus) ? -1 : 0)
        await this.adjustCustomerCounts(manager, saved.customerId, 1, activeStatuses.has(saved.status as LeadStatus) ? 1 : 0)
      }
      await this.recordMutation(manager, saved, "updated", actor.id, requestId, { before, after: toLeadDto(saved, actor) })
      return toLeadDto(saved, actor)
    })
  }

  async transition(id: string, input: LeadTransition, actor: SessionUser, requestId: string): Promise<LeadDto> {
    assertCapability(actor.capabilities, "canChangeStatus")
    return this.changeStatus(id, input, actor, requestId)
  }

  private async changeStatus(id: string, input: LeadTransition, actor: SessionUser, requestId: string, mutationAction = "status_changed"): Promise<LeadDto> {
    return this.dataSource.transaction(async (manager) => {
      const current = await this.findWith(manager, id)
      if (current.version !== input.version) throw this.versionConflict(current)
      if (current.status === input.status) return toLeadDto(current, actor)
      if (!transitions[current.status as LeadStatus]?.includes(input.status)) throw new ConflictException({ code: "INVALID_STATE_TRANSITION", message: `Недопустимый переход заявки: ${current.status} → ${input.status}`, fieldErrors: { status: ["Недопустимый переход статуса"] }, details: { from: current.status, to: input.status } })
      const archivedAt = input.status === "archived" ? new Date() : null
      const result = await manager.createQueryBuilder().update(LeadEntity).set({ status: input.status, archivedAt, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await this.findWith(manager, id))
      const saved = await this.findWith(manager, id)
      const wasActive = activeStatuses.has(current.status as LeadStatus)
      const isActive = activeStatuses.has(saved.status as LeadStatus)
      if (wasActive !== isActive) await this.adjustCustomerCounts(manager, saved.customerId, 0, isActive ? 1 : -1)
      await this.recordMutation(manager, saved, mutationAction, actor.id, requestId, { before: current.status, after: saved.status })
      return toLeadDto(saved, actor)
    })
  }

  async archive(id: string, version: number, actor: SessionUser, requestId: string): Promise<LeadDto> { assertCapability(actor.capabilities, "canArchive"); return this.changeStatus(id, { version, status: "archived" }, actor, requestId, "archived") }

  private async assertCustomer(manager: EntityManager, id: string | null) { if (id && !(await manager.getRepository(CustomerEntity).findOneBy({ id }))) throw new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "Клиент не найден" }) }
  private assertInterval(start: string | null | undefined, end: string | null | undefined) {
    if (start && end && new Date(start) >= new Date(end)) throw new BadRequestException({ code: "INVALID_INTERVAL", message: "Дата окончания должна быть позже даты начала", fieldErrors: { desiredEndAt: ["Дата окончания должна быть позже даты начала"] } })
  }
  private async adjustCustomerCounts(manager: EntityManager, customerId: string | null, leadDelta: number, activeLeadDelta: number) {
    if (!customerId || (leadDelta === 0 && activeLeadDelta === 0)) return
    await manager.query("UPDATE customers SET lead_count = GREATEST(0, lead_count + $1), active_lead_count = GREATEST(0, active_lead_count + $2), updated_at = now() WHERE id = $3", [leadDelta, activeLeadDelta, customerId])
  }
  private async find(id: string) { return this.findWith(this.dataSource.manager, id) }
  private async findWith(manager: EntityManager, id: string) { const entity = await manager.getRepository(LeadEntity).findOneBy({ id }); if (!entity) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "Заявка не найдена" }); return entity }
  private versionConflict(entity: LeadEntity) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Заявка была изменена другим сотрудником", details: { entityId: entity.id, serverVersion: entity.version } }) }
  private decodeCursor(value: string, order: LeadListQuery["order"]): { value: string | null; id: string } { try { const data = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { order: string; value: string | null; id: string }; if (data.order !== order || !data.id || (data.value !== null && typeof data.value !== "string")) throw new Error(); return data } catch { throw new ConflictException({ code: "INVALID_CURSOR", message: "Некорректный cursor" }) } }
  private encodeCursor(order: LeadListQuery["order"], value: string | null, id: string) { return Buffer.from(JSON.stringify({ order, value, id }), "utf8").toString("base64url") }
  private async recordMutation(manager: EntityManager, entity: LeadEntity, action: string, actorId: string, requestId: string, changes: Record<string, unknown>) { const now = new Date(); await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "lead", entityId: entity.id, action, actorId, requestId, changes, createdAt: now })); await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `lead.${action}`, aggregateType: "lead", aggregateId: entity.id, payload: { leadId: entity.id, customerId: entity.customerId, status: entity.status, version: entity.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now })) }
}
