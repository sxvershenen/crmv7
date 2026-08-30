import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { Brackets, DataSource, IsNull, QueryFailedError, type EntityManager } from "typeorm"

import type { BookingDetailResponse, BookingItem, BookingIntervalUpdate, BookingLeadLink, BookingLeadLinkHistoryResponse, BookingLeadLinkInput, BookingLeadLinkResponse, BookingLeadUnlinkInput, BookingProjectionBooking, BookingProjectionCategory, BookingProjectionOperation, BookingProjectionQuery, BookingProjectionResource, BookingProjectionResponse, SessionUser } from "@crm/contracts"
import { BookingEntity, BookingItemEntity, BookingLeadLinkEntity, ChangeLogEntity, IdempotencyKeyEntity, LeadEntity, OutboxEventEntity, PaymentEntity, ResourceAllocationEntity, ResourceEntity } from "@crm/db"
import { assertAvailable, checkAvailability, createInterval, type AvailabilityAllocation } from "@crm/domain"

import type { BookingArchive, BookingCreate, BookingDto, BookingListQuery, BookingTransition, BookingUpdate } from "./bookings.contracts.js"

type ItemInput = Omit<BookingItem, "id">

type ProjectionRow = {
  id: string; code: string; version: number; customer_id: string | null; status: string; currency: string; total_amount: number; snapshot: Record<string, unknown> | null;
  client_name: string | null; phone: string | null; item_id: string | null; item_type: string | null; resource_id: string | null; start_at: Date | string | null; end_at: Date | string | null;
  quantity: number | null; preparation_minutes: number | null; resource_code: string | null; resource_kind: string | null; resource_name: string | null; capacity_total: number | null;
  source_lead_id: string | null; lead_source: string | null; lead_utm: Record<string, string> | null; has_conflict: boolean;
}

@Injectable()
export class BookingsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async list(query: BookingListQuery, actor: SessionUser): Promise<BookingDto[]> {
    this.assert(actor, "canView")
    const builder = this.dataSource.getRepository(BookingEntity).createQueryBuilder("booking")
      .where(query.archived === true ? "booking.archived_at IS NOT NULL" : "booking.archived_at IS NULL")
    if (query.status) builder.andWhere("booking.status = :status", { status: query.status })
    if (query.customerId) builder.andWhere("booking.customer_id = :customerId", { customerId: query.customerId })
    builder.orderBy("booking.created_at", "DESC").take(query.limit)
    const bookings = await builder.getMany()
    return Promise.all(bookings.map((booking) => this.toDto(this.dataSource.manager, booking, actor)))
  }

  async get(idOrCode: string, actor: SessionUser): Promise<BookingDto> {
    this.assert(actor, "canView")
    const booking = await this.find(this.dataSource.manager, idOrCode)
    return this.toDto(this.dataSource.manager, booking, actor)
  }

  async projection(query: BookingProjectionQuery, actor: SessionUser): Promise<BookingProjectionResponse> {
    this.assert(actor, "canView")
    const from = new Date(`${query.date}T00:00:00+03:00`)
    const until = new Date(`${query.rangeEnd}T00:00:00+03:00`)
    until.setUTCDate(until.getUTCDate() + 1)
    const params: unknown[] = [from, until]
    const resourceClause = query.resource === "all" ? "" : ` AND item.resource_id = $${params.push(query.resource)}`
    const rows = await this.dataSource.query(`
      SELECT b.id, b.code, b.version, b.customer_id, b.status, b.currency, b.total_amount, b.snapshot,
             c.name AS client_name, COALESCE(c.phones->>0, '') AS phone,
             item.id AS item_id, item.type AS item_type, item.resource_id, item.start_at, item.end_at,
             item.quantity, item.preparation_minutes, resource.code AS resource_code,
             resource.kind AS resource_kind, resource.name AS resource_name, resource.capacity_total,
             active_link.lead_id AS source_lead_id, lead.source AS lead_source, lead.utm AS lead_utm,
             EXISTS (
               SELECT 1 FROM resource_allocations conflict
               WHERE conflict.resource_id = item.resource_id AND conflict.source_id <> item.id
                 AND NOT EXISTS (SELECT 1 FROM booking_items own_item WHERE own_item.id = conflict.source_id AND own_item.booking_id = b.id)
                 AND conflict.status IN ('active','tentative') AND conflict.archived_at IS NULL
                 AND conflict.start_at < item.end_at AND conflict.end_at > item.start_at
             ) AS has_conflict
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN LATERAL (
        SELECT bi.* FROM booking_items bi
        WHERE bi.booking_id = b.id AND bi.archived_at IS NULL
        ORDER BY bi.start_at, bi.id LIMIT 1
      ) item ON true
      LEFT JOIN resources resource ON resource.id = item.resource_id
      LEFT JOIN booking_lead_links active_link ON active_link.booking_id = b.id AND active_link.unlinked_at IS NULL
      LEFT JOIN leads lead ON lead.id = active_link.lead_id AND lead.archived_at IS NULL
      WHERE b.archived_at IS NULL
        AND item.start_at < $2 AND item.end_at > $1${resourceClause}
      ORDER BY item.start_at, b.id
    `, params) as ProjectionRow[]
    const payments = rows.length === 0 ? [] : await this.dataSource.query(`SELECT booking_id, kind, amount FROM payments WHERE booking_id = ANY($1::uuid[])`, [[...new Set(rows.map((row) => row.id))]]) as Array<{ booking_id: string; kind: string; amount: number }>
    const paymentByBooking = new Map<string, Array<{ kind: string; amount: number }>>()
    for (const payment of payments) paymentByBooking.set(payment.booking_id, [...(paymentByBooking.get(payment.booking_id) ?? []), payment])
    const bookings = rows.flatMap((row) => {
      const mapped = this.projectionBooking(row, paymentByBooking.get(row.id) ?? [])
      if (!mapped || (query.category !== "all" && mapped.category !== query.category)) return []
      if (query.source !== "all" && mapped.source !== query.source) return []
      if (query.utm !== "all" && mapped.utm !== query.utm) return []
      if (query.promo !== "all" && mapped.promo !== query.promo) return []
      if (mapped.amount < query.amountFrom) return []
      if (query.debtFrom > 0 && mapped.amount - mapped.paid < query.debtFrom) return []
      if (query.conflictOnly && !mapped.hasConflict) return []
      if (query.overpayOnly && mapped.paid <= mapped.amount) return []
      return [mapped]
    })
    const resources = await this.projectionResources(query, from, until)
    const resourceIds = new Set(resources.map((resource) => resource.id))
    const visibleBookings = bookings.filter((booking) => booking.resourceId === null || resourceIds.has(booking.resourceId))
    const operations = visibleBookings.flatMap((booking) => this.projectionOperations(booking, from, until))
    const direction = query.order === "asc" ? 1 : -1
    const value = (booking: BookingProjectionBooking): string | number => ({ id: booking.code, client: booking.clientName, arrival: booking.startAt, resource: booking.resourceName, status: booking.status, total: booking.amount, assignee: booking.assignees[0]?.name ?? "" })[query.sort]
    visibleBookings.sort((left, right) => { const a = value(left); const b = value(right); return (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ru")) * direction })
    operations.sort((left, right) => left.time.localeCompare(right.time) || (left.status === "cancelled" ? 1 : 0) - (right.status === "cancelled" ? 1 : 0))
    return { bookings: visibleBookings, operations, resources, window: { from: query.date, to: query.rangeEnd, canAppendBefore: true, canAppendAfter: true } }
  }

  async getDetail(idOrCode: string, actor: SessionUser): Promise<BookingDetailResponse> {
    this.assert(actor, "canView")
    const booking = await this.find(this.dataSource.manager, idOrCode)
    const base = await this.toDto(this.dataSource.manager, booking, actor)
    const customer = booking.customerId ? await this.dataSource.query("SELECT id, name, COALESCE(phones->>0, '') AS phone, email FROM customers WHERE id = $1", [booking.customerId]) as Array<{ id: string; name: string; phone: string; email: string | null }> : []
    const item = await this.dataSource.getRepository(BookingItemEntity).findOne({ where: { bookingId: booking.id, archivedAt: IsNull() }, order: { startAt: "ASC" } })
    const resource = item?.resourceId ? await this.dataSource.query("SELECT id, code, name, kind, capacity_total FROM resources WHERE id = $1", [item.resourceId]) as Array<{ id: string; code: string; name: string; kind: string; capacity_total: number }> : []
    const payments = await this.dataSource.getRepository(PaymentEntity).find({ where: { bookingId: booking.id }, order: { createdAt: "ASC" } })
    const projectionRow = item ? await this.dataSource.query("SELECT b.id, b.code, b.version, b.customer_id, b.status, b.currency, b.total_amount, b.snapshot, c.name AS client_name, COALESCE(c.phones->>0, '') AS phone, bi.id AS item_id, bi.type AS item_type, bi.resource_id, bi.start_at, bi.end_at, bi.quantity, bi.preparation_minutes, r.code AS resource_code, r.kind AS resource_kind, r.name AS resource_name, r.capacity_total, active_link.lead_id AS source_lead_id, lead.source AS lead_source, lead.utm AS lead_utm, false AS has_conflict FROM bookings b LEFT JOIN customers c ON c.id = b.customer_id JOIN booking_items bi ON bi.booking_id = b.id AND bi.id = $2 LEFT JOIN resources r ON r.id = bi.resource_id LEFT JOIN booking_lead_links active_link ON active_link.booking_id = b.id AND active_link.unlinked_at IS NULL LEFT JOIN leads lead ON lead.id = active_link.lead_id AND lead.archived_at IS NULL WHERE b.id = $1", [booking.id, item.id]) as ProjectionRow[] : []
    const projection = this.projectionBooking(projectionRow[0]!, payments.map((payment) => ({ kind: payment.kind, amount: payment.amount }))) ?? this.emptyProjection(booking, base, item)
    const marketing = typeof booking.snapshot.marketing === "object" && booking.snapshot.marketing !== null ? booking.snapshot.marketing as Record<string, unknown> : {}
    const leadLink = await this.activeLeadLink(this.dataSource.manager, booking.id)
    return { ...projection, leadLink: leadLink ? this.toLeadLink(leadLink) : null, customer: customer[0] ? { id: customer[0].id, name: customer[0].name, phone: customer[0].phone || null, email: customer[0].email } : null, resource: resource[0] ? { id: resource[0].id, code: resource[0].code, name: resource[0].name, category: this.category(resource[0].kind), capacity: resource[0].capacity_total } : null, items: base.items, payments: payments.map((payment) => ({ id: payment.id, operationId: payment.operationId, kind: payment.kind as "charge" | "refund" | "adjustment" | "payment", amount: payment.amount, currency: payment.currency, method: payment.method, sourcePaymentId: payment.sourcePaymentId, reason: payment.reason, createdAt: payment.createdAt.toISOString(), createdBy: payment.createdBy })), note: typeof booking.snapshot.note === "string" ? booking.snapshot.note : null, comments: Array.isArray(booking.snapshot.comments) ? booking.snapshot.comments : [], marketing }
  }

  async updateInterval(idOrCode: string, input: BookingIntervalUpdate, actor: SessionUser, requestId: string): Promise<BookingDto> {
    return this.update(idOrCode, { ...input, itemId: input.itemId, items: undefined }, actor, requestId)
  }

  async create(input: BookingCreate, actor: SessionUser, requestId: string): Promise<BookingDto> {
    this.assert(actor, "canCreate")
    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "booking:create"
      const requestHash = JSON.stringify(input)
      const replay = await this.idempotentReplay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const normalized = this.normalizeItems(input.items)
      const currency = normalized[0]!.price.currency
      this.assertCurrency(normalized, currency)
      const [{ nextval }] = await manager.query(`SELECT nextval('booking_code_seq')::text AS nextval`) as [{ nextval: string }]
      const booking = manager.create(BookingEntity, {
        id: randomUUID(), code: `B-${nextval}`, customerId: input.customerId, status: "draft", currency,
        totalAmount: this.total(normalized), snapshot: { note: input.note }, createdBy: actor.id, updatedBy: actor.id, archivedAt: null,
      })
      const saved = await manager.save(booking)
      const items = await this.replaceItems(manager, saved, normalized, actor)
      await this.allocateItems(manager, saved, items, actor, input.overrideConflict)
      await this.recordMutation(manager, saved, "created", actor.id, requestId, { after: this.snapshot(saved, items) })
      const response = await this.toDto(manager, saved, actor, items)
      await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    }))
  }

  async update(idOrCode: string, input: BookingUpdate, actor: SessionUser, requestId: string): Promise<BookingDto> {
    this.assert(actor, "canEdit")
    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `booking:${idOrCode}:update`
      const requestHash = JSON.stringify(input)
      const replay = await this.idempotentReplay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const current = await this.find(manager, idOrCode, true)
      if (current.version !== input.expectedVersion) throw this.versionConflict(current)
      const beforeItems = await manager.getRepository(BookingItemEntity).find({ where: { bookingId: current.id, archivedAt: IsNull() }, order: { createdAt: "ASC" } })
      let items = beforeItems
      if (input.itemId) {
        if (!input.startAt || !input.endAt) throw new ConflictException({ code: "INVALID_INTERVAL", message: "Для переноса нужны начало и окончание интервала", fieldErrors: { startAt: ["Обязательное поле"], endAt: ["Обязательное поле"] } })
        const target = beforeItems.find((item) => item.id === input.itemId)
        if (!target) throw new NotFoundException({ code: "BOOKING_ITEM_NOT_FOUND", message: "Позиция бронирования не найдена" })
        const normalized = beforeItems.map((item) => item.id === target.id ? { ...this.fromEntity(item), startAt: input.startAt!, endAt: input.endAt!, resourceId: input.resourceId === undefined ? item.resourceId : input.resourceId } : this.fromEntity(item))
        await this.cancelAllocations(manager, beforeItems, actor)
        await manager.getRepository(BookingItemEntity).update({ bookingId: current.id, archivedAt: IsNull() }, { archivedAt: new Date(), updatedBy: actor.id })
        items = await this.replaceItems(manager, current, this.normalizeItems(normalized), actor)
        await this.allocateItems(manager, current, items, actor, input.overrideConflict)
      } else if (input.items) {
        const normalized = this.normalizeItems(input.items)
        this.assertCurrency(normalized, normalized[0]!.price.currency)
        if (normalized[0]!.price.currency !== current.currency) throw new ConflictException({ code: "CURRENCY_MISMATCH", message: "Валюта брони неизменяема" })
        await this.cancelAllocations(manager, beforeItems, actor)
        await manager.getRepository(BookingItemEntity).update({ bookingId: current.id, archivedAt: IsNull() }, { archivedAt: new Date(), updatedBy: actor.id })
        items = await this.replaceItems(manager, current, normalized, actor)
        await this.allocateItems(manager, current, items, actor, input.overrideConflict)
      }
      const result = await manager.createQueryBuilder().update(BookingEntity).set({
        ...(input.customerId === undefined ? {} : { customerId: input.customerId }),
        ...(input.note === undefined ? {} : { snapshot: { ...current.snapshot, note: input.note } }),
        ...(input.items || input.itemId ? { totalAmount: this.total(items.map(this.fromEntity)) } : {}),
        updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()",
      }).where("id = :id AND version = :version", { id: current.id, version: input.expectedVersion }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(BookingEntity, { id: current.id }))
      const saved = await manager.findOneByOrFail(BookingEntity, { id: current.id })
      await this.recordMutation(manager, saved, "updated", actor.id, requestId, { before: this.snapshot(current, beforeItems), after: this.snapshot(saved, items) })
      const response = await this.toDto(manager, saved, actor, items)
      await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    }))
  }

  async transition(idOrCode: string, input: BookingTransition, actor: SessionUser, requestId: string): Promise<BookingDto> {
    this.assert(actor, "canChangeStatus")
    return this.dataSource.transaction(async (manager) => {
      const scope = `booking:${idOrCode}:transition`
      const requestHash = JSON.stringify(input)
      const replay = await this.idempotentReplay(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const current = await this.find(manager, idOrCode, true)
      if (current.version !== input.expectedVersion) throw this.versionConflict(current)
      this.assertTransition(current.status, input.status)
      const result = await manager.createQueryBuilder().update(BookingEntity).set({ status: input.status, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: current.id, version: input.expectedVersion }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(BookingEntity, { id: current.id }))
      const saved = await manager.findOneByOrFail(BookingEntity, { id: current.id })
      await this.syncAllocationsForStatus(manager, saved.id, input.status, actor)
      await this.recordMutation(manager, saved, "status_changed", actor.id, requestId, { before: current.status, after: saved.status })
      const response = await this.toDto(manager, saved, actor)
      await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
  }

  async archive(idOrCode: string, input: BookingArchive, actor: SessionUser, requestId: string): Promise<BookingDto> {
    this.assert(actor, "canArchive")
    return this.transition(idOrCode, { operationId: input.operationId, idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, status: "archived" }, actor, requestId)
  }

  private normalizeItems(items: readonly ItemInput[]): ItemInput[] {
    return items.map((item) => {
      createInterval(new Date(item.startAt), new Date(item.endAt))
      if (item.discount.amountMinor > item.price.amountMinor) throw new ConflictException({ code: "INVALID_AMOUNT", message: "Скидка не может быть больше цены" })
      return { ...item, type: item.type, resourceId: item.resourceId, startAt: item.startAt, endAt: item.endAt, quantity: item.quantity, price: { ...item.price }, discount: { ...item.discount }, preparationMinutes: item.preparationMinutes }
    })
  }

  private assertCurrency(items: readonly ItemInput[], currency: string) {
    if (items.some((item) => item.discount.currency !== currency || item.price.currency !== currency)) throw new ConflictException({ code: "CURRENCY_MISMATCH", message: "Все позиции должны быть в одной валюте" })
  }

  private total(items: readonly ItemInput[]) { return items.reduce((sum, item) => sum + item.price.amountMinor - item.discount.amountMinor, 0) }

  private async replaceItems(manager: EntityManager, booking: BookingEntity, items: readonly ItemInput[], actor: SessionUser) {
    const entities = items.map((item) => manager.create(BookingItemEntity, {
      id: randomUUID(), bookingId: booking.id, type: item.type, resourceId: item.resourceId, startAt: new Date(item.startAt), endAt: new Date(item.endAt), quantity: item.quantity,
      priceAmount: item.price.amountMinor, discountAmount: item.discount.amountMinor, currency: item.price.currency, preparationMinutes: item.preparationMinutes,
      createdBy: actor.id, updatedBy: actor.id, archivedAt: null,
    }))
    return manager.getRepository(BookingItemEntity).save(entities)
  }

  private async allocateItems(manager: EntityManager, booking: BookingEntity, items: BookingItemEntity[], actor: SessionUser, overrideConflict: boolean) {
    const resourceIds = [...new Set(items.flatMap((item) => item.resourceId ? [item.resourceId] : []))].sort()
    const resources = new Map<string, ResourceEntity>()
    for (const resourceId of resourceIds) {
      const resource = await manager.getRepository(ResourceEntity).findOne({ where: { id: resourceId }, lock: { mode: "pessimistic_write" } })
      if (!resource || resource.archivedAt) throw new NotFoundException({ code: "RESOURCE_NOT_FOUND", message: "Ресурс не найден" })
      resources.set(resource.id, resource)
    }
    for (const item of items) {
      if (!item.resourceId) continue
      const resource = resources.get(item.resourceId)!
      const start = new Date(item.startAt); start.setMinutes(start.getMinutes() - item.preparationMinutes)
      const existing = await manager.getRepository(ResourceAllocationEntity).createQueryBuilder("allocation").where("allocation.resource_id = :resourceId", { resourceId: resource.id }).andWhere("allocation.status IN (:...statuses)", { statuses: ["active", "tentative"] }).andWhere("allocation.archived_at IS NULL").andWhere("allocation.start_at < :endAt AND allocation.end_at > :startAt", { startAt: start, endAt: new Date(item.endAt) }).getMany()
      const result = checkAvailability({ resourceId: resource.id, startAt: start, endAt: new Date(item.endAt), quantity: item.quantity }, existing.map(this.toAllocation), resource.capacityMode === "shared" ? { capacity: resource.capacityTotal } : {})
      if (!result.available && overrideConflict && !actor.capabilities.canOverrideConflict) {
        throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для переопределения конфликта" })
      }
      if (!result.available && !overrideConflict) assertAvailable(result)
      await manager.getRepository(ResourceAllocationEntity).save(manager.create(ResourceAllocationEntity, {
        id: randomUUID(), resourceId: resource.id, sourceType: "booking_item", sourceId: item.id, startAt: start, endAt: new Date(item.endAt), quantity: item.quantity,
        capacityImpact: item.quantity, exclusive: resource.capacityMode === "fixed" && (result.available || !overrideConflict), status: booking.status === "draft" ? "tentative" : "active", createdBy: actor.id, updatedBy: actor.id, archivedAt: null,
      }))
    }
  }

  private async cancelAllocations(manager: EntityManager, items: BookingItemEntity[], actor: SessionUser) {
    for (const item of items) await manager.getRepository(ResourceAllocationEntity).update({ sourceId: item.id, status: "active" }, { status: "cancelled", archivedAt: new Date(), updatedBy: actor.id })
    for (const item of items) await manager.getRepository(ResourceAllocationEntity).update({ sourceId: item.id, status: "tentative" }, { status: "cancelled", archivedAt: new Date(), updatedBy: actor.id })
  }

  private async syncAllocationsForStatus(manager: EntityManager, bookingId: string, status: string, actor: SessionUser) {
    const itemIds = (await manager.getRepository(BookingItemEntity).find({ where: { bookingId } })).map((item) => item.id)
    if (itemIds.length === 0) return
    const allocations = manager.getRepository(ResourceAllocationEntity)
    if (["confirmed", "in_progress", "completed"].includes(status)) {
      await allocations.createQueryBuilder().update(ResourceAllocationEntity).set({ status: "active", archivedAt: null, updatedBy: actor.id, updatedAt: () => "now()" }).where("source_id IN (:...itemIds)", { itemIds }).andWhere("status IN (:...statuses)", { statuses: ["tentative", "active"] }).execute()
    } else if (["cancelled", "archived"].includes(status)) {
      await allocations.createQueryBuilder().update(ResourceAllocationEntity).set({ status: "cancelled", archivedAt: new Date(), updatedBy: actor.id, updatedAt: () => "now()" }).where("source_id IN (:...itemIds)", { itemIds }).andWhere("status IN (:...statuses)", { statuses: ["tentative", "active"] }).execute()
    } else {
      await allocations.createQueryBuilder().update(ResourceAllocationEntity).set({ status: "tentative", archivedAt: null, updatedBy: actor.id, updatedAt: () => "now()" }).where("source_id IN (:...itemIds)", { itemIds }).andWhere("status = :status", { status: "active" }).execute()
    }
  }

  private async find(manager: EntityManager, idOrCode: string, lock = false) {
    const repository = manager.getRepository(BookingEntity)
    const booking = lock && /^[0-9a-f-]{36}$/i.test(idOrCode) ? await repository.findOne({ where: { id: idOrCode }, lock: { mode: "pessimistic_write" } }) : await repository.findOneBy(/^[0-9a-f-]{36}$/i.test(idOrCode) ? { id: idOrCode } : { code: idOrCode })
    if (!booking) throw new NotFoundException({ code: "BOOKING_NOT_FOUND", message: "Бронь не найдена" })
    return booking
  }

  private async idempotentReplay(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string) {
    const existing = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("idempotency")
      .where("idempotency.scope = :scope", { scope })
      .andWhere(new Brackets((query) => query.where("idempotency.operation_id = :operationId", { operationId }).orWhere("idempotency.idempotency_key = :idempotencyKey", { idempotencyKey })))
      .getOne()
    if (!existing) return null
    if (existing.requestHash !== requestHash) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ идемпотентности уже использован с другими данными" })
    return existing.responseBody as BookingDto | null
  }

  private async storeIdempotentResponse(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: BookingDto) {
    await manager.getRepository(IdempotencyKeyEntity).save(manager.create(IdempotencyKeyEntity, {
      id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 201,
      responseBody: response as unknown as Record<string, unknown>, createdAt: new Date(),
    }))
  }

  private async toDto(manager: EntityManager, booking: BookingEntity, actor: SessionUser, knownItems?: BookingItemEntity[]): Promise<BookingDto> {
    const entities = knownItems ?? await manager.getRepository(BookingItemEntity).find({ where: { bookingId: booking.id, archivedAt: IsNull() }, order: { createdAt: "ASC" } })
    const items = entities.map(this.toDtoItem)
    const charged = await manager.getRepository(PaymentEntity).createQueryBuilder("payment").select("COALESCE(SUM(CASE WHEN payment.kind IN ('charge','adjustment') THEN payment.amount ELSE 0 END), 0)", "charged").addSelect("COALESCE(SUM(CASE WHEN payment.kind = 'refund' THEN payment.amount ELSE 0 END), 0)", "refunded").where("payment.booking_id = :bookingId", { bookingId: booking.id }).getRawOne<{ charged: string; refunded: string }>()
    const net = Number(charged?.charged ?? 0) - Number(charged?.refunded ?? 0)
    return { id: booking.id, version: booking.version, customerId: booking.customerId!, status: booking.status as BookingDto["status"], items, subtotal: { amountMinor: items.reduce((sum, item) => sum + item.price.amountMinor, 0), currency: booking.currency }, total: { amountMinor: booking.totalAmount, currency: booking.currency }, paymentState: this.paymentState(booking.totalAmount, net), createdAt: booking.createdAt.toISOString(), updatedAt: booking.updatedAt.toISOString(), capabilities: { canView: actor.capabilities.canView, canCreate: actor.capabilities.canCreate, canEdit: actor.capabilities.canEdit, canArchive: actor.capabilities.canArchive, canChangeStatus: actor.capabilities.canChangeStatus, canOverrideConflict: actor.capabilities.canOverrideConflict, canAddPayment: actor.capabilities.canAddPayment, canRefund: actor.capabilities.canRefund } }
  }

  private async projectionResources(query: BookingProjectionQuery, from: Date, until: Date): Promise<BookingProjectionResource[]> {
    const rows = await this.dataSource.query("SELECT id, code, name, kind, capacity_total FROM resources WHERE archived_at IS NULL ORDER BY name, id") as Array<{ id: string; code: string; name: string; kind: string; capacity_total: number }>
    const selected = rows.filter((row) => (query.resource === "all" || row.id === query.resource) && (query.category === "all" || this.category(row.kind) === query.category))
    if (selected.length === 0) return []
    const allocations = await this.dataSource.query("SELECT resource_id, quantity, capacity_impact FROM resource_allocations WHERE resource_id = ANY($1::uuid[]) AND status IN ('active','tentative') AND archived_at IS NULL AND start_at < $2 AND end_at > $3", [selected.map((row) => row.id), until, from]) as Array<{ resource_id: string; quantity: number; capacity_impact: number }>
    const occupied = new Map<string, number>()
    for (const allocation of allocations) occupied.set(allocation.resource_id, (occupied.get(allocation.resource_id) ?? 0) + (allocation.capacity_impact ?? allocation.quantity ?? 0))
    return selected.map((row) => ({ id: row.id, code: row.code, name: row.name, category: this.category(row.kind), capacity: row.capacity_total, occupied: occupied.get(row.id) ?? 0 }))
  }

  private projectionBooking(row: ProjectionRow, payments: Array<{ kind: string; amount: number }>): BookingProjectionBooking | null {
    if (!row?.item_id || !row.start_at || !row.end_at) return null
    const start = new Date(row.start_at)
    const end = new Date(row.end_at)
    const startParts = this.localParts(start)
    const endParts = this.localParts(end)
    const category = this.category(row.resource_kind ?? row.item_type)
    const charged = payments.filter((payment) => payment.kind === "charge" || payment.kind === "adjustment" || payment.kind === "payment").reduce((sum, payment) => sum + payment.amount, 0)
    const refunded = payments.filter((payment) => payment.kind === "refund").reduce((sum, payment) => sum + payment.amount, 0)
    const paid = Math.max(0, charged - refunded)
    const paymentState = this.paymentState(row.total_amount, charged - refunded)
    const hasConflict = Boolean(row.has_conflict)
    const status: BookingProjectionBooking["status"] = hasConflict ? "conflict" : row.status === "cancelled" || row.status === "archived" ? "cancelled" : row.status === "draft" ? "draft" : paid > row.total_amount ? "paid" : paid === row.total_amount ? "paid" : paid <= 0 ? "unpaid" : "debt"
    const snapshot = row.snapshot ?? {}
    const source = this.stringValue(snapshot.source) || this.stringValue(row.lead_source)
    const utm = this.stringValue(snapshot.utm) || this.stringValue((row.lead_utm ?? {})["utm_source"])
    const promo = this.stringValue(snapshot.promo)
    const assignees = Array.isArray(snapshot.assignees) ? snapshot.assignees.filter((item): item is { id: string; initials: string; name: string } => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" && /^[0-9a-f-]{36}$/i.test(String((item as Record<string, unknown>).id)) && typeof (item as Record<string, unknown>).initials === "string" && typeof (item as Record<string, unknown>).name === "string")).map((item) => ({ id: item.id, initials: item.initials, name: item.name })) : []
    const guestCount = Number(snapshot.guestCount ?? snapshot.guests ?? row.quantity ?? 0)
    return {
      id: row.id, code: row.code, version: row.version, customerId: row.customer_id, clientName: row.client_name ?? "Клиент", phone: row.phone ?? "",
      resourceId: row.resource_id, resourceName: row.resource_name ?? "Без ресурса", category, date: startParts.date, startAt: start.toISOString(), endAt: end.toISOString(),
      startHour: startParts.hour, endHour: endParts.hour === 0 && endParts.date !== startParts.date ? 24 : endParts.hour, preparationEndHour: Math.min(24, endParts.hour + Math.ceil((row.preparation_minutes ?? 0) / 60)), guestCount: Number.isFinite(guestCount) ? guestCount : 0,
      status, lifecycleStatus: row.status as BookingProjectionBooking["lifecycleStatus"], amount: row.total_amount, paid, paymentState, source, utm, promo, sourceLeadId: row.source_lead_id, assignees,
      itemId: row.item_id, hasConflict,
    }
  }

  private projectionOperations(booking: BookingProjectionBooking, from: Date, until: Date): BookingProjectionOperation[] {
    if (!booking.resourceId) return []
    const values: BookingProjectionOperation[] = []
    const add = (kind: BookingProjectionOperation["kind"], at: string) => { const date = new Date(at); if (date >= from && date < until) values.push({ id: `${booking.itemId ?? booking.id}-${kind}`, bookingId: booking.id, resourceId: booking.resourceId!, kind, time: at, timeLabel: this.localParts(date).label, clientName: booking.clientName, status: booking.status }) }
    add("arrival", booking.startAt)
    add("departure", booking.endAt)
    if (booking.preparationEndHour > booking.endHour) add("preparation", booking.endAt)
    return values
  }

  private emptyProjection(booking: BookingEntity, base: BookingDto, item: BookingItemEntity | null): BookingProjectionBooking {
    const start = item?.startAt ?? booking.createdAt
    const end = item?.endAt ?? new Date(start.getTime() + 60 * 60 * 1000)
    const row = { id: booking.id, code: booking.code, version: booking.version, customer_id: booking.customerId, status: booking.status, currency: booking.currency, total_amount: booking.totalAmount, snapshot: booking.snapshot, client_name: "Клиент", phone: "", item_id: item?.id ?? null, item_type: item?.type ?? "other", resource_id: item?.resourceId ?? null, start_at: start, end_at: end, quantity: item?.quantity ?? 1, preparation_minutes: item?.preparationMinutes ?? 0, resource_code: null, resource_kind: null, resource_name: null, capacity_total: null, source_lead_id: null, lead_source: null, lead_utm: {}, has_conflict: false } satisfies ProjectionRow
    return this.projectionBooking(row, []) ?? { id: booking.id, code: booking.code, version: booking.version, customerId: booking.customerId, clientName: "Клиент", phone: "", resourceId: null, resourceName: "Без ресурса", category: "other", date: start.toISOString().slice(0, 10), startAt: start.toISOString(), endAt: end.toISOString(), startHour: start.getHours(), endHour: end.getHours(), preparationEndHour: end.getHours(), guestCount: 0, status: "draft", lifecycleStatus: base.status, amount: base.total.amountMinor, paid: 0, paymentState: base.paymentState, source: "", utm: "", promo: "", sourceLeadId: null, assignees: [], itemId: item?.id ?? null, hasConflict: false }
  }

  private category(kind: string | null | undefined): BookingProjectionCategory {
    if (kind === "house" || kind === "houses" || kind === "accommodation") return "houses"
    if (kind === "camp" || kind === "camping") return "camping"
    if (kind === "tent" || kind === "tents") return "tents"
    if (kind === "bath" || kind === "sauna") return "bath"
    if (kind === "venue" || kind === "venues") return "venues"
    return "other"
  }

  private stringValue(value: unknown): string { return typeof value === "string" ? value : "" }
  private localParts(value: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value)
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00"
    const date = `${get("year")}-${get("month")}-${get("day")}`
    const hour = Number(get("hour"))
    return { date, hour, label: `${String(hour).padStart(2, "0")}:${get("minute")}` }
  }

  private async retrySerializable<T>(operation: () => Promise<T>, remaining = 2): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      const code = error instanceof QueryFailedError ? (error.driverError as { code?: string }).code : undefined
      if (remaining > 0 && (code === "40001" || code === "40P01")) return this.retrySerializable(operation, remaining - 1)
      throw error
    }
  }

  private paymentState(total: number, net: number): BookingDto["paymentState"] { if (net < 0) return "refund"; if (net === 0) return total === 0 ? "paid" : "unpaid"; if (net < total) return "partial"; if (net === total) return "paid"; return "overpaid" }
  private fromEntity = (item: BookingItemEntity): ItemInput => ({ type: item.type as ItemInput["type"], resourceId: item.resourceId, startAt: item.startAt.toISOString(), endAt: item.endAt.toISOString(), quantity: item.quantity, price: { amountMinor: item.priceAmount, currency: item.currency }, discount: { amountMinor: item.discountAmount, currency: item.currency }, preparationMinutes: item.preparationMinutes })
  private toDtoItem = (item: BookingItemEntity): BookingDto["items"][number] => ({ id: item.id, type: item.type as BookingDto["items"][number]["type"], resourceId: item.resourceId, startAt: item.startAt.toISOString(), endAt: item.endAt.toISOString(), quantity: item.quantity, price: { amountMinor: item.priceAmount, currency: item.currency }, discount: { amountMinor: item.discountAmount, currency: item.currency }, preparationMinutes: item.preparationMinutes })
  private toAllocation = (allocation: ResourceAllocationEntity): AvailabilityAllocation => ({ id: allocation.id, resourceId: allocation.resourceId, sourceId: allocation.sourceId, startAt: allocation.startAt, endAt: allocation.endAt, quantity: allocation.quantity, capacityImpact: allocation.capacityImpact, status: allocation.status as AvailabilityAllocation["status"] })
  private snapshot(booking: BookingEntity, items: BookingItemEntity[]) { return { id: booking.id, version: booking.version, customerId: booking.customerId, status: booking.status, totalAmount: booking.totalAmount, itemIds: items.map((item) => item.id) } }
  private async recordMutation(manager: EntityManager, booking: BookingEntity, action: string, actorId: string, requestId: string, changes: Record<string, unknown>) { const now = new Date(); await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "booking", entityId: booking.id, action, actorId, requestId, changes, createdAt: now })); await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `booking.${action}`, aggregateType: "booking", aggregateId: booking.id, payload: { bookingId: booking.id, version: booking.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now })) }
  private assert(actor: SessionUser, capability: keyof SessionUser["capabilities"]) { if (!actor.capabilities[capability]) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: `Capability ${capability} is required` }) }
  private versionConflict(booking: BookingEntity) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Бронь была изменена другим сотрудником", details: { entityId: booking.id, serverVersion: booking.version } }) }
  private assertTransition(current: string, next: string) { const allowed: Record<string, string[]> = { draft: ["unconfirmed", "cancelled", "archived"], unconfirmed: ["draft", "confirmed", "cancelled", "archived"], confirmed: ["in_progress", "cancelled", "archived"], in_progress: ["completed", "cancelled", "archived"], completed: ["archived"], cancelled: ["archived"], archived: [] }; if (!allowed[current]?.includes(next)) throw new ConflictException({ code: "INVALID_STATE_TRANSITION", message: `Нельзя перевести бронь из ${current} в ${next}` }) }
}
