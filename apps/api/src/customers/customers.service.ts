import { randomUUID } from "node:crypto"

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { DataSource, type EntityManager } from "typeorm"

import type { CustomerCreate, CustomerDto, CustomerListQuery, CustomerUpdate, SessionUser } from "@crm/contracts"
import { ChangeLogEntity, CustomerEntity, OutboxEventEntity } from "@crm/db"
import { assertCapability, normalizePhone } from "@crm/domain"

import { toCustomerDto } from "./customer.mapper.js"

@Injectable()
export class CustomersService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: CustomerListQuery, actor: SessionUser): Promise<{ items: CustomerDto[]; nextCursor: string | null }> {
    assertCapability(actor.capabilities, "canView")
    const builder = this.dataSource.getRepository(CustomerEntity).createQueryBuilder("customer")
      .where(query.archived === true ? "customer.archived_at IS NOT NULL" : "customer.archived_at IS NULL")
    if (query.type) builder.andWhere("customer.type = :type", { type: query.type })
    if (query.duplicateRisk) builder.andWhere("customer.duplicate_risk = :duplicateRisk", { duplicateRisk: query.duplicateRisk })
    if (query.hasDebt === true) builder.andWhere("customer.debt > 0")
    if (query.hasDebt === false) builder.andWhere("customer.debt <= 0")
    if (query.search) builder.andWhere("(customer.name ILIKE :search OR customer.email ILIKE :search OR customer.phones::text ILIKE :search)", { search: `%${query.search}%` })
    const cursor = query.cursor ? this.decodeCursor(query.cursor, query.order) : null
    if (cursor) {
      if (query.order === "nameAsc") builder.andWhere("(customer.name > :cursorValue OR (customer.name = :cursorValue AND customer.id > :cursorId))", { cursorValue: cursor.value, cursorId: cursor.id })
      else if (query.order === "nextContactAsc") {
        if (cursor.value === null) builder.andWhere("customer.next_contact_at IS NULL AND customer.id > :cursorId", { cursorId: cursor.id })
        else builder.andWhere("(customer.next_contact_at > :cursorAt OR (customer.next_contact_at = :cursorAt AND customer.id > :cursorId) OR customer.next_contact_at IS NULL)", { cursorAt: new Date(cursor.value), cursorId: cursor.id })
      }
      else builder.andWhere("(customer.created_at < :cursorAt OR (customer.created_at = :cursorAt AND customer.id < :cursorId))", { cursorAt: new Date(cursor.value ?? ""), cursorId: cursor.id })
    }
    if (query.order === "nameAsc") builder.orderBy("customer.name", "ASC").addOrderBy("customer.id", "ASC")
    else if (query.order === "nextContactAsc") builder.orderBy("customer.next_contact_at", "ASC", "NULLS LAST").addOrderBy("customer.id", "ASC")
    else builder.orderBy("customer.created_at", "DESC").addOrderBy("customer.id", "DESC")
    builder.take(query.limit + 1)
    const rows = await builder.getMany()
    const hasNext = rows.length > query.limit
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows
    const last = pageRows.at(-1)
    const value = query.order === "createdDesc" ? last?.createdAt : query.order === "nextContactAsc" ? last?.nextContactAt : last?.name
    return { items: pageRows.map((customer) => toCustomerDto(customer, actor)), nextCursor: hasNext && last ? this.encodeCursor(query.order, value instanceof Date ? value.toISOString() : value ?? null, last.id) : null }
  }

  async get(id: string, actor: SessionUser): Promise<CustomerDto> {
    assertCapability(actor.capabilities, "canView")
    return toCustomerDto(await this.find(id), actor)
  }

  async create(input: CustomerCreate, actor: SessionUser, requestId: string): Promise<CustomerDto> {
    assertCapability(actor.capabilities, "canCreate")
    return this.dataSource.transaction(async (manager) => {
      const phones = input.phone && !input.phones.includes(input.phone) ? [input.phone, ...input.phones] : input.phones
      const duplicateRisk = input.duplicateRisk === "none" && await this.hasPhoneDuplicate(manager, phones)
        ? "possible"
        : input.duplicateRisk
      const customer = manager.create(CustomerEntity, {
        id: randomUUID(), type: input.type, name: input.name, phones, channels: input.channels, email: input.email, notes: input.notes,
        consent: input.consent, duplicateRisk, assignees: input.assignees,
        leadCount: 0, activeLeadCount: 0, bookingCount: 0, futureBookingCount: 0, taskCount: 0, turnover: 0, debt: 0,
        nextContactAt: null, lastVisitAt: null, createdBy: actor.id, updatedBy: actor.id, archivedAt: null,
      })
      const saved = await manager.save(customer)
      await this.recordMutation(manager, saved, "created", actor.id, requestId, { after: toCustomerDto(saved, actor) })
      return toCustomerDto(saved, actor)
    })
  }

  async update(id: string, input: CustomerUpdate, actor: SessionUser, requestId: string): Promise<CustomerDto> {
    assertCapability(actor.capabilities, "canEdit")
    return this.dataSource.transaction(async (manager) => {
      const current = await this.findWith(manager, id)
      if (current.version !== input.version) throw this.versionConflict(current)
      const before = toCustomerDto(current, actor)
      const phones = input.phone === undefined ? (input.phones ?? current.phones) : input.phone === null ? [] : (input.phones?.includes(input.phone) ? input.phones : [input.phone, ...(input.phones ?? current.phones)])
      const patch: Partial<CustomerEntity> = { updatedBy: actor.id }
      if (input.name !== undefined) patch.name = input.name
      if (input.type !== undefined) patch.type = input.type
      if (input.phones !== undefined || input.phone !== undefined) patch.phones = phones
      if (input.channels !== undefined) patch.channels = input.channels
      if (input.email !== undefined) patch.email = input.email
      if (input.notes !== undefined) patch.notes = input.notes
      if (input.consent !== undefined) patch.consent = input.consent
      if (input.duplicateRisk !== undefined) patch.duplicateRisk = input.duplicateRisk
      if ((input.phones !== undefined || input.phone !== undefined) && (patch.duplicateRisk ?? current.duplicateRisk) === "none" && await this.hasPhoneDuplicate(manager, phones, current.id)) patch.duplicateRisk = "possible"
      if (input.assignees !== undefined) patch.assignees = input.assignees
      const result = await manager.createQueryBuilder().update(CustomerEntity).set({ ...patch, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id, version: input.version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await this.findWith(manager, id))
      const saved = await this.findWith(manager, id)
      await this.recordMutation(manager, saved, "updated", actor.id, requestId, { before, after: toCustomerDto(saved, actor) })
      return toCustomerDto(saved, actor)
    })
  }

  async archive(id: string, version: number, actor: SessionUser, requestId: string): Promise<CustomerDto> {
    assertCapability(actor.capabilities, "canArchive")
    return this.dataSource.transaction(async (manager) => {
      const current = await this.findWith(manager, id)
      if (current.version !== version) throw this.versionConflict(current)
      const archivedAt = new Date()
      const result = await manager.createQueryBuilder().update(CustomerEntity).set({ archivedAt, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id, version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await this.findWith(manager, id))
      const saved = await this.findWith(manager, id)
      await this.recordMutation(manager, saved, "archived", actor.id, requestId, { archivedAt: archivedAt.toISOString() })
      return toCustomerDto(saved, actor)
    })
  }

  async assignSelf(id: string, version: number, actor: SessionUser, requestId: string): Promise<CustomerDto> {
    assertCapability(actor.capabilities, "canAssign")
    return this.dataSource.transaction(async (manager) => {
      const current = await this.findWith(manager, id)
      if (current.version !== version) throw this.versionConflict(current)
      if (current.assignees.some((assignee) => assignee.id === actor.id)) return toCustomerDto(current, actor)
      const assignee = { id: actor.id, initials: this.initials(actor.name), name: actor.name }
      const assignees = [...current.assignees, assignee]
      const result = await manager.createQueryBuilder().update(CustomerEntity).set({ assignees, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id, version }).execute()
      if (result.affected !== 1) throw this.versionConflict(await this.findWith(manager, id))
      const saved = await this.findWith(manager, id)
      await this.recordMutation(manager, saved, "assigned", actor.id, requestId, { before: current.assignees, after: assignees })
      return toCustomerDto(saved, actor)
    })
  }

  private async find(id: string) { return this.findWith(this.dataSource.manager, id) }
  private initials(name: string) { return name.trim().split(/\s+/u).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU") ?? "").join("") || "?" }
  private async hasPhoneDuplicate(manager: EntityManager, phones: string[], excludeId?: string) {
    const keys = [...new Set(phones.flatMap((phone) => {
      const normalized = normalizePhone(phone)
      return normalized ? [normalized.length >= 10 ? normalized.slice(-10) : normalized] : []
    }))]
    if (keys.length === 0) return false
    const rows = await manager.query(`
      SELECT EXISTS (
        SELECT 1
        FROM customers customer
        CROSS JOIN LATERAL jsonb_array_elements_text(customer.phones) stored_phone
        WHERE customer.archived_at IS NULL
          AND ($2::uuid IS NULL OR customer.id <> $2::uuid)
          AND right(regexp_replace(stored_phone, '[^0-9]', '', 'g'), 10) = ANY($1::text[])
      ) AS duplicate
    `, [keys, excludeId ?? null]) as Array<{ duplicate: boolean }>
    return rows[0]?.duplicate === true
  }
  private async findWith(manager: EntityManager, id: string) {
    const entity = await manager.getRepository(CustomerEntity).findOneBy({ id })
    if (!entity) throw new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "Клиент не найден" })
    return entity
  }
  private versionConflict(entity: CustomerEntity) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Клиент был изменён другим сотрудником", details: { entityId: entity.id, serverVersion: entity.version, server: toCustomerDto(entity, { capabilities: { canView: true, canCreate: false, canEdit: false, canArchive: false } } as SessionUser) } }) }
  private decodeCursor(value: string, order: CustomerListQuery["order"]): { value: string | null; id: string } {
    try { const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { order: string; value: string | null; id: string }; if (decoded.order !== order || !decoded.id || (decoded.value !== null && typeof decoded.value !== "string")) throw new Error(); return decoded }
    catch { throw new ConflictException({ code: "INVALID_CURSOR", message: "Некорректный cursor" }) }
  }
  private encodeCursor(order: CustomerListQuery["order"], value: string | null, id: string) { return Buffer.from(JSON.stringify({ order, value, id }), "utf8").toString("base64url") }
  private async recordMutation(manager: EntityManager, entity: CustomerEntity, action: string, actorId: string, requestId: string, changes: Record<string, unknown>) {
    const now = new Date()
    await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "customer", entityId: entity.id, action, actorId, requestId, changes, createdAt: now }))
    await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `customer.${action}`, aggregateType: "customer", aggregateId: entity.id, payload: { customerId: entity.id, version: entity.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now }))
  }
}
