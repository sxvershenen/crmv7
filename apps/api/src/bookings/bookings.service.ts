import { randomUUID } from "node:crypto"

import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common"
import { Brackets, DataSource, IsNull, QueryFailedError, type EntityManager } from "typeorm"

import { InternalOfferingQuoteResultSchema, type BookingDetailResponse, type BookingItemInput, type BookingIntervalUpdate, type BookingLeadLinkHistoryResponse, type BookingLeadLinkInput, type BookingLeadLinkResponse, type BookingLeadUnlinkInput, type BookingProjectionBooking, type BookingProjectionQuery, type BookingProjectionResponse, type SessionUser } from "@crm/contracts"
import { AcceptedOfferingQuoteLinkEntity, BookingEntity, BookingItemEntity, BookingLeadLinkEntity, ChangeLogEntity, CustomerEntity, IdempotencyKeyEntity, LeadEntity, OfferingQuoteSnapshotEntity, OutboxEventEntity, PaymentEntity, ResourceAllocationEntity, ResourceEntity } from "@crm/db"
import { assertAvailable, checkAvailability, createInterval } from "@crm/domain"

import { canonicalSha256 } from "../offerings/offering-mutation-support.js"
import { type BookingPromotion, type BookingPromotionPreview, type BookingPromotionPreviewResult } from "@crm/contracts"
import { calculateBookingPromotion, type PromotionLine } from "@crm/domain"
import { MarketingService } from "../marketing/marketing.service.js"
import { OperationalQuoteAcceptanceService } from "../offerings/operational-quote-acceptance.service.js"
import type { BookingArchive, BookingAssignSelf, BookingCreate, BookingDto, BookingListQuery, BookingTransition, BookingUpdate } from "./bookings.contracts.js"
import {
  bookingSnapshot,
  category,
  emptyProjection,
  fromEntity,
  projectionBooking,
  projectionOperations,
  projectionResources,
  snapshotAssignees,
  storedPromotion,
  toAllocation,
  toBookingDto,
  toLeadLink,
  type ProjectionRow,
} from "./bookings-read-projection.js"

type ItemInput = BookingItemInput

@Injectable()
export class BookingsService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource, @Inject(OperationalQuoteAcceptanceService) private readonly quoteAcceptance: OperationalQuoteAcceptanceService, @Inject(MarketingService) private readonly marketing: MarketingService) {}

  async previewPromotion(input: BookingPromotionPreview, actor: SessionUser): Promise<BookingPromotionPreviewResult> {
    this.assert(actor, "canView")
    return this.dataSource.transaction(async manager => {
      const items = this.normalizeItems(input.items)
      this.assertCurrency(items, "RUB")
      const promotion = await this.applyPromotion(manager, input.promoCode, items)
      return { promotion, total: { amountMinor: this.total(items) - promotion.discountAmountMinor, currency: "RUB" } }
    })
  }


  private async applyPromotion(manager: EntityManager, code: string, items: readonly ItemInput[]): Promise<BookingPromotion> {
    this.assertCurrency(items, "RUB")
    const promotion = await this.marketing.findByCode(manager, code)
    const lines: PromotionLine[] = []
    for (const item of items) {
      const addons = await this.authoritativeAddOnSelections(manager, item)
      const bindings = item.resourceId ? await manager.query(`SELECT offering_id FROM offering_bindings WHERE resource_id = $1 AND role = 'primary' AND archived_at IS NULL ORDER BY offering_id`, [item.resourceId]) as Array<{ offering_id: string }> : []
      // Ambiguous legacy bindings never grant an offering-scoped promotion.
      lines.push({ resourceId: item.resourceId, offeringId: bindings.length === 1 ? bindings[0]!.offering_id : null, amountMinor: item.price.amountMinor - addons.reduce((sum, addon) => sum + addon.price.amountMinor, 0) })
      lines.push(...addons.map(addon => ({ resourceId: null, offeringId: addon.addOnOfferingId, amountMinor: addon.price.amountMinor })))
    }
    return calculateBookingPromotion(promotion, lines, items.reduce((sum, item) => sum + item.discount.amountMinor, 0), new Date())
  }

  async list(query: BookingListQuery, actor: SessionUser): Promise<BookingDto[]> {
    this.assert(actor, "canView")
    const builder = this.dataSource.getRepository(BookingEntity).createQueryBuilder("booking")
      .where(query.archived === true ? "booking.archived_at IS NOT NULL" : "booking.archived_at IS NULL")
    if (query.status) builder.andWhere("booking.status = :status", { status: query.status })
    if (query.customerId) builder.andWhere("booking.customer_id = :customerId", { customerId: query.customerId })
    builder.orderBy("booking.created_at", "DESC").take(query.limit)
    const bookings = await builder.getMany()
    return Promise.all(bookings.map((booking) => toBookingDto(this.dataSource.manager, booking, actor)))
  }

  async get(idOrCode: string, actor: SessionUser): Promise<BookingDto> {
    this.assert(actor, "canView")
    const booking = await this.find(this.dataSource.manager, idOrCode)
    return toBookingDto(this.dataSource.manager, booking, actor)
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
      const mapped = projectionBooking(row, paymentByBooking.get(row.id) ?? [])
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
    const resources = await projectionResources(this.dataSource, query, from, until)
    const resourceIds = new Set(resources.map((resource) => resource.id))
    const visibleBookings = bookings.filter((booking) => booking.resourceId === null || resourceIds.has(booking.resourceId))
    const operations = visibleBookings.flatMap((booking) => projectionOperations(booking, from, until))
    const direction = query.order === "asc" ? 1 : -1
    const value = (booking: BookingProjectionBooking): string | number => ({ id: booking.code, client: booking.clientName, arrival: booking.startAt, resource: booking.resourceName, status: booking.status, total: booking.amount, assignee: booking.assignees[0]?.name ?? "" })[query.sort]
    visibleBookings.sort((left, right) => { const a = value(left); const b = value(right); return (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ru")) * direction })
    operations.sort((left, right) => left.time.localeCompare(right.time) || (left.status === "cancelled" ? 1 : 0) - (right.status === "cancelled" ? 1 : 0))
    return { bookings: visibleBookings, operations, resources, window: { from: query.date, to: query.rangeEnd, canAppendBefore: true, canAppendAfter: true } }
  }

  async getDetail(idOrCode: string, actor: SessionUser): Promise<BookingDetailResponse> {
    this.assert(actor, "canView")
    const booking = await this.find(this.dataSource.manager, idOrCode)
    const base = await toBookingDto(this.dataSource.manager, booking, actor)
    const customer = booking.customerId ? await this.dataSource.query("SELECT id, name, COALESCE(phones->>0, '') AS phone, email FROM customers WHERE id = $1", [booking.customerId]) as Array<{ id: string; name: string; phone: string; email: string | null }> : []
    const item = await this.dataSource.getRepository(BookingItemEntity).findOne({ where: { bookingId: booking.id, archivedAt: IsNull() }, order: { startAt: "ASC" } })
    const resource = item?.resourceId ? await this.dataSource.query("SELECT id, code, name, kind, capacity_total FROM resources WHERE id = $1", [item.resourceId]) as Array<{ id: string; code: string; name: string; kind: string; capacity_total: number }> : []
    const payments = await this.dataSource.getRepository(PaymentEntity).find({ where: { bookingId: booking.id }, order: { createdAt: "ASC" } })
    const projectionRow = item ? await this.dataSource.query("SELECT b.id, b.code, b.version, b.customer_id, b.status, b.currency, b.total_amount, b.snapshot, c.name AS client_name, COALESCE(c.phones->>0, '') AS phone, bi.id AS item_id, bi.type AS item_type, bi.resource_id, bi.start_at, bi.end_at, bi.quantity, bi.preparation_minutes, r.code AS resource_code, r.kind AS resource_kind, r.name AS resource_name, r.capacity_total, active_link.lead_id AS source_lead_id, lead.source AS lead_source, lead.utm AS lead_utm, false AS has_conflict FROM bookings b LEFT JOIN customers c ON c.id = b.customer_id JOIN booking_items bi ON bi.booking_id = b.id AND bi.id = $2 LEFT JOIN resources r ON r.id = bi.resource_id LEFT JOIN booking_lead_links active_link ON active_link.booking_id = b.id AND active_link.unlinked_at IS NULL LEFT JOIN leads lead ON lead.id = active_link.lead_id AND lead.archived_at IS NULL WHERE b.id = $1", [booking.id, item.id]) as ProjectionRow[] : []
    const projection = projectionBooking(projectionRow[0]!, payments.map((payment) => ({ kind: payment.kind, amount: payment.amount }))) ?? emptyProjection(booking, base, item)
    const marketing = typeof booking.snapshot.marketing === "object" && booking.snapshot.marketing !== null ? booking.snapshot.marketing as Record<string, unknown> : {}
    const leadLink = await this.activeLeadLink(this.dataSource.manager, booking.id)
return { ...projection, promotion: storedPromotion(booking), sourceLeadId: leadLink?.leadId ?? projection.sourceLeadId, leadLink: leadLink ? toLeadLink(leadLink) : null, customer: customer[0] ? { id: customer[0].id, name: customer[0].name, phone: customer[0].phone || null, email: customer[0].email } : null, resource: resource[0] ? { id: resource[0].id, code: resource[0].code, name: resource[0].name, category: category(resource[0].kind), capacity: resource[0].capacity_total } : null, items: base.items, payments: payments.map((payment) => ({ id: payment.id, operationId: payment.operationId, kind: payment.kind as "charge" | "refund" | "adjustment" | "payment", amount: payment.amount, currency: payment.currency, method: payment.method, sourcePaymentId: payment.sourcePaymentId, reason: payment.reason, createdAt: payment.createdAt.toISOString(), createdBy: payment.createdBy })), note: typeof booking.snapshot.note === "string" ? booking.snapshot.note : null, comments: Array.isArray(booking.snapshot.comments) ? booking.snapshot.comments : [], marketing }
  }

  async linkLead(idOrCode: string, input: BookingLeadLinkInput, actor: SessionUser, requestId: string): Promise<BookingLeadLinkResponse> {
    this.assert(actor, "canEdit")
    const resolved = await this.find(this.dataSource.manager, idOrCode)
    const scope = `booking:${resolved.id}:lead-link`
    const method = input.method ?? "manual"
    const requestHash = canonicalSha256({ command: "booking.lead-link", bookingId: resolved.id, expectedVersion: input.expectedVersion, leadId: input.leadId, method })
    try {
      return await this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
        const replay = await this.idempotentReplay<BookingLeadLinkResponse>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
        if (replay) return replay
        const booking = await this.find(manager, resolved.id, true)
        if (booking.version !== input.expectedVersion) throw this.versionConflict(booking)
        const lead = await manager.getRepository(LeadEntity).findOne({ where: { id: input.leadId }, lock: { mode: "pessimistic_read" } })
        if (!lead || lead.archivedAt) throw new NotFoundException({ code: "LEAD_NOT_FOUND", message: "Лид не найден" })
        const links = manager.getRepository(BookingLeadLinkEntity)
        const active = await this.activeLeadLink(manager, booking.id, true)
        if (active?.leadId === lead.id) {
          const response: BookingLeadLinkResponse = { link: toLeadLink(active), bookingVersion: booking.version }
          await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
          return response
        }
        const now = new Date()
        if (active) await links.update({ id: active.id }, { unlinkedAt: now, unlinkedBy: actor.id })
        const created = await links.save(links.create({ id: randomUUID(), bookingId: booking.id, leadId: lead.id, method, linkedAt: now, linkedBy: actor.id, unlinkedAt: null, unlinkedBy: null }))
        const updated = await this.bumpBookingVersion(manager, booking, actor.id)
        await this.recordMutation(manager, updated, active ? "lead_relinked" : "lead_linked", actor.id, requestId, { before: active ? toLeadLink(active) : null, after: toLeadLink(created) })
        const response: BookingLeadLinkResponse = { link: toLeadLink(created), bookingVersion: updated.version }
        await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
        return response
      }))
    } catch (error) {
      if (!this.isActiveLeadLinkUniqueConflict(error)) throw error
      throw this.versionConflict(await this.find(this.dataSource.manager, resolved.id))
    }
  }

  async unlinkLead(idOrCode: string, input: BookingLeadUnlinkInput, actor: SessionUser, requestId: string): Promise<BookingLeadLinkResponse> {
    this.assert(actor, "canEdit")
    const resolved = await this.find(this.dataSource.manager, idOrCode)
    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `booking:${resolved.id}:lead-link`
      const requestHash = canonicalSha256({ command: "booking.lead-unlink", bookingId: resolved.id, expectedVersion: input.expectedVersion })
      const replay = await this.idempotentReplay<BookingLeadLinkResponse>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const booking = await this.find(manager, resolved.id, true)
      if (booking.version !== input.expectedVersion) throw this.versionConflict(booking)
      const active = await this.activeLeadLink(manager, booking.id, true)
      if (!active) {
        const response: BookingLeadLinkResponse = { link: null, bookingVersion: booking.version }
        await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
        return response
      }
      const now = new Date()
      await manager.getRepository(BookingLeadLinkEntity).update({ id: active.id }, { unlinkedAt: now, unlinkedBy: actor.id })
      const updated = await this.bumpBookingVersion(manager, booking, actor.id)
      await this.recordMutation(manager, updated, "lead_unlinked", actor.id, requestId, { before: toLeadLink(active), after: null })
      const response: BookingLeadLinkResponse = { link: null, bookingVersion: updated.version }
      await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    }))
  }

  async leadLinkHistory(idOrCode: string, actor: SessionUser): Promise<BookingLeadLinkHistoryResponse> {
    this.assert(actor, "canView")
    const booking = await this.find(this.dataSource.manager, idOrCode)
    const items = await this.dataSource.getRepository(BookingLeadLinkEntity).find({ where: { bookingId: booking.id }, order: { linkedAt: "ASC", id: "ASC" } })
    return { items: items.map((item) => toLeadLink(item)) }
  }

  async updateInterval(idOrCode: string, input: BookingIntervalUpdate, actor: SessionUser, requestId: string): Promise<BookingDto> {
    return this.update(idOrCode, { ...input, itemId: input.itemId, items: undefined }, actor, requestId)
  }

  async create(input: BookingCreate, actor: SessionUser, requestId: string): Promise<BookingDto> {
    this.assert(actor, "canCreate")
    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = "booking:create"
      const requestHash = JSON.stringify(input)
      const replay = await this.idempotentReplay<BookingDto>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const normalized = this.normalizeItems(input.items)
      const currency = normalized[0]!.price.currency
      this.assertCurrency(normalized, currency)
      const promotion = input.promoCode ? await this.applyPromotion(manager, input.promoCode, normalized) : null
      await this.assertCustomer(manager, input.customerId)
      const [{ nextval }] = await manager.query(`SELECT nextval('booking_code_seq')::text AS nextval`) as [{ nextval: string }]
      const booking = manager.create(BookingEntity, {
        id: randomUUID(), code: `B-${nextval}`, customerId: input.customerId, status: "draft", currency,
        totalAmount: this.total(normalized) - (promotion?.discountAmountMinor ?? 0), snapshot: { note: input.note, assignees: input.assignees, promotion, promo: promotion?.code ?? "" }, createdBy: actor.id, updatedBy: actor.id, archivedAt: null,
      })
      const saved = await manager.save(booking)
      const items = await this.replaceItems(manager, saved, normalized, actor)
      await this.allocateItems(manager, saved, items, actor, input.overrideConflict)
      await this.recordMutation(manager, saved, "created", actor.id, requestId, { after: bookingSnapshot(saved, items) })
      const response = await toBookingDto(manager, saved, actor, items)
      await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    }))
  }

  async update(idOrCode: string, input: BookingUpdate, actor: SessionUser, requestId: string): Promise<BookingDto> {
    this.assert(actor, "canEdit")
    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `booking:${idOrCode}:update`
      const requestHash = JSON.stringify(input)
      const replay = await this.idempotentReplay<BookingDto>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const current = await this.find(manager, idOrCode, true)
      if (current.version !== input.expectedVersion) throw this.versionConflict(current)
      if (input.customerId !== undefined) await this.assertCustomer(manager, input.customerId)
      const beforeItems = await manager.getRepository(BookingItemEntity).find({ where: { bookingId: current.id, archivedAt: IsNull() }, order: { createdAt: "ASC" } })
      let items = beforeItems
      if (input.itemId) {
        if (!input.startAt || !input.endAt) throw new ConflictException({ code: "INVALID_INTERVAL", message: "Для переноса нужны начало и окончание интервала", fieldErrors: { startAt: ["Обязательное поле"], endAt: ["Обязательное поле"] } })
        const target = beforeItems.find((item) => item.id === input.itemId)
        if (!target) throw new NotFoundException({ code: "BOOKING_ITEM_NOT_FOUND", message: "Позиция бронирования не найдена" })
        await this.assertCompositionMutable(manager, beforeItems)
        const normalized = beforeItems.map((item) => item.id === target.id ? { ...fromEntity(item), startAt: input.startAt!, endAt: input.endAt!, resourceId: input.resourceId === undefined ? item.resourceId : input.resourceId } : fromEntity(item))
        await this.cancelAllocations(manager, beforeItems, actor)
        await manager.getRepository(BookingItemEntity).update({ bookingId: current.id, archivedAt: IsNull() }, { archivedAt: new Date(), updatedBy: actor.id })
        items = await this.replaceItems(manager, current, this.normalizeItems(normalized), actor)
        await this.allocateItems(manager, current, items, actor, input.overrideConflict)
      } else if (input.items) {
        const normalized = this.normalizeItems(input.items)
        this.assertCurrency(normalized, normalized[0]!.price.currency)
        if (normalized[0]!.price.currency !== current.currency) throw new ConflictException({ code: "CURRENCY_MISMATCH", message: "Валюта брони неизменяема" })
        if (!this.sameItems(beforeItems, normalized)) {
          await this.assertCompositionMutable(manager, beforeItems)
          await this.cancelAllocations(manager, beforeItems, actor)
          await manager.getRepository(BookingItemEntity).update({ bookingId: current.id, archivedAt: IsNull() }, { archivedAt: new Date(), updatedBy: actor.id })
          items = await this.replaceItems(manager, current, normalized, actor)
          await this.allocateItems(manager, current, items, actor, input.overrideConflict)
        }
      }
      const previousPromotion = storedPromotion(current)
      const promoCode = input.promoCode === undefined ? previousPromotion?.code ?? null : input.promoCode
      const compositionChanged = items !== beforeItems
      const promotionChanged = promoCode !== (previousPromotion?.code ?? null)
      if (compositionChanged && previousPromotion && !["draft", "unconfirmed"].includes(current.status)) throw new ConflictException({ code: "BOOKING_PROMOTION_IMMUTABLE", message: "Состав подтверждённой брони с промокодом зафиксирован. Изменение требует новой брони." })
      if (promotionChanged && !["draft", "unconfirmed"].includes(current.status)) throw new ConflictException({ code: "BOOKING_PROMOTION_IMMUTABLE", message: "Промокод подтверждённой брони зафиксирован. Изменение требует новой брони." })
      const promotion = !compositionChanged && !promotionChanged ? previousPromotion : promoCode ? await this.applyPromotion(manager, promoCode, items.map(fromEntity)) : null
      const result = await manager.createQueryBuilder().update(BookingEntity).set({
        ...(input.customerId === undefined ? {} : { customerId: input.customerId }),
        snapshot: { ...current.snapshot, promotion, promo: promotion?.code ?? "", ...(input.note === undefined ? {} : { note: input.note }), ...(input.assignees === undefined ? {} : { assignees: input.assignees }) },
        totalAmount: this.total(items.map(fromEntity)) - (promotion?.discountAmountMinor ?? 0),
        updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()",
      }).where("id = :id AND version = :version", { id: current.id, version: input.expectedVersion }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(BookingEntity, { id: current.id }))
      const saved = await manager.findOneByOrFail(BookingEntity, { id: current.id })
      await this.recordMutation(manager, saved, "updated", actor.id, requestId, { before: bookingSnapshot(current, beforeItems), after: bookingSnapshot(saved, items) })
      const response = await toBookingDto(manager, saved, actor, items)
      await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    }))
  }

  async transition(idOrCode: string, input: BookingTransition, actor: SessionUser, requestId: string): Promise<BookingDto> {
    this.assert(actor, "canChangeStatus")
    // Resolve aliases before establishing the idempotency scope.  A code and its
    // UUID must serialize through the same command key.
    const resolved = await this.find(this.dataSource.manager, idOrCode)
    return this.retrySerializable(() => this.dataSource.transaction("SERIALIZABLE", async (manager) => {
      const scope = `booking:${resolved.id}:transition`
      const requestHash = canonicalSha256({ command: "booking.transition", bookingId: resolved.id, input })
      const replay = await this.idempotentReplay<BookingDto>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const current = await this.find(manager, resolved.id, true)
      if (current.version !== input.expectedVersion) throw this.versionConflict(current)
      this.assertTransition(current.status, input.status)
      const result = await manager.createQueryBuilder().update(BookingEntity).set({ status: input.status, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: current.id, version: input.expectedVersion }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(BookingEntity, { id: current.id }))
      const saved = await manager.findOneByOrFail(BookingEntity, { id: current.id })
      if (input.quoteAcceptances?.length) await this.quoteAcceptance.acceptBookingItems(manager, saved, input.quoteAcceptances, actor, requestId, input.operationId)
      await this.syncAllocationsForStatus(manager, saved.id, input.status, actor)
      await this.recordMutation(manager, saved, "status_changed", actor.id, requestId, { before: current.status, after: saved.status })
      const response = await toBookingDto(manager, saved, actor)
      await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    }))
  }

  async archive(idOrCode: string, input: BookingArchive, actor: SessionUser, requestId: string): Promise<BookingDto> {
    this.assert(actor, "canArchive")
    return this.transition(idOrCode, { operationId: input.operationId, idempotencyKey: input.idempotencyKey, expectedVersion: input.expectedVersion, status: "archived" }, actor, requestId)
  }

  async assignSelf(idOrCode: string, input: BookingAssignSelf, actor: SessionUser, requestId: string): Promise<BookingDto> {
    this.assert(actor, "canAssign")
    return this.dataSource.transaction(async (manager) => {
      const scope = `booking:${idOrCode}:assign-self`
      const requestHash = JSON.stringify(input)
      const replay = await this.idempotentReplay<BookingDto>(manager, scope, input.operationId, input.idempotencyKey, requestHash)
      if (replay) return replay
      const current = await this.find(manager, idOrCode, true)
      if (current.version !== input.expectedVersion) throw this.versionConflict(current)
      const currentAssignees = snapshotAssignees(current.snapshot)
      if (currentAssignees.some((person) => person.id === actor.id)) {
        const response = await toBookingDto(manager, current, actor)
        await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
        return response
      }
      const initials = actor.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("ru-RU") ?? "").join("") || "?"
      const assignees = [...currentAssignees, { id: actor.id, initials, name: actor.name }]
      const result = await manager.createQueryBuilder().update(BookingEntity).set({ snapshot: { ...current.snapshot, assignees }, updatedBy: actor.id, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: current.id, version: input.expectedVersion }).execute()
      if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(BookingEntity, { id: current.id }))
      const saved = await manager.findOneByOrFail(BookingEntity, { id: current.id })
      await this.recordMutation(manager, saved, "assigned", actor.id, requestId, { before: currentAssignees, after: assignees })
      const response = await toBookingDto(manager, saved, actor)
      await this.storeIdempotentResponse(manager, scope, input.operationId, input.idempotencyKey, requestHash, response)
      return response
    })
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

  private sameItems(current: readonly BookingItemEntity[], requested: readonly ItemInput[]) {
    if (current.length !== requested.length) return false
    return current.every((item, index) => JSON.stringify(fromEntity(item)) === JSON.stringify(requested[index]))
  }

  private async assertCompositionMutable(manager: EntityManager, items: readonly BookingItemEntity[]) {
    if (items.length === 0) return
    const accepted = await manager.createQueryBuilder(AcceptedOfferingQuoteLinkEntity, "link")
      .where("link.booking_item_id IN (:...itemIds)", { itemIds: items.map((item) => item.id) })
      .getOne()
    if (accepted) throw new ConflictException({
      code: "BOOKING_ACCEPTED_QUOTE_IMMUTABLE",
      message: "Состав подтверждённой брони зафиксирован расчётом; для изменения отмените бронь и создайте новую",
      details: { bookingItemId: accepted.bookingItemId, quoteSnapshotId: accepted.quoteSnapshotId },
    })
  }

  private async replaceItems(manager: EntityManager, booking: BookingEntity, items: readonly ItemInput[], actor: SessionUser) {
    const entities: BookingItemEntity[] = []
    for (const item of items) {
      const addOnSelections = await this.authoritativeAddOnSelections(manager, item)
      entities.push(manager.create(BookingItemEntity, {
        id: randomUUID(), bookingId: booking.id, type: item.type, resourceId: item.resourceId, startAt: new Date(item.startAt), endAt: new Date(item.endAt), quantity: item.quantity,
        priceAmount: item.price.amountMinor, discountAmount: item.discount.amountMinor, currency: item.price.currency, preparationMinutes: item.preparationMinutes,
        quoteSnapshotId: item.quoteSnapshotId, addOnSelections,
        createdBy: actor.id, updatedBy: actor.id, archivedAt: null,
      }))
    }
    return manager.getRepository(BookingItemEntity).save(entities)
  }

  private async authoritativeAddOnSelections(manager: EntityManager, item: ItemInput): Promise<BookingItemEntity["addOnSelections"]> {
    if (item.addOns.length === 0) {
      if (item.quoteSnapshotId !== null) throw new ConflictException({ code: "BOOKING_QUOTE_UNUSED", message: "Расчёт указан без выбранных дополнительных услуг" })
      return []
    }
    if (!item.quoteSnapshotId || !item.resourceId) throw new ConflictException({ code: "BOOKING_ADDON_QUOTE_REQUIRED", message: "Для дополнительных услуг нужен расчёт выбранного ресурса" })
    const quote = await manager.createQueryBuilder(OfferingQuoteSnapshotEntity, "quote").setLock("pessimistic_read").where("quote.id = :id", { id: item.quoteSnapshotId }).getOne()
    if (!quote || quote.validUntil <= new Date()) throw new ConflictException({ code: "BOOKING_QUOTE_EXPIRED", message: "Расчёт цены устарел; обновите состав брони" })
    const operational = quote.operationalContext as { primaryResourceId?: unknown } | null
    const quotedResource = typeof operational?.primaryResourceId === "string"
      ? operational.primaryResourceId
      : (await manager.query(`SELECT resource_id FROM offering_bindings WHERE offering_id = $1 AND role = 'primary' AND archived_at IS NULL ORDER BY id`, [quote.offeringId]) as Array<{ resource_id: string | null }>).map((row) => row.resource_id).filter((id): id is string => id !== null).at(0)
    if (quotedResource !== item.resourceId) throw new ConflictException({ code: "BOOKING_QUOTE_RESOURCE_MISMATCH", message: "Расчёт цены относится к другому ресурсу" })
    const request = quote.requestPayload as { period?: { arrivalDate?: unknown; departureDate?: unknown }; quantities?: { guests?: unknown; units?: unknown }; addOns?: unknown }
    if (request.period?.arrivalDate !== item.startAt.slice(0, 10) || request.period?.departureDate !== item.endAt.slice(0, 10)) throw new ConflictException({ code: "BOOKING_QUOTE_PERIOD_MISMATCH", message: "Даты брони изменились; обновите расчёт цены" })
    const quotedQuantity = typeof request.quantities?.guests === "number" ? request.quantities.guests : request.quantities?.units
    if (quotedQuantity !== item.quantity) throw new ConflictException({ code: "BOOKING_QUOTE_QUANTITY_MISMATCH", message: "Количество гостей или мест изменилось; обновите расчёт цены" })
    const requested = Array.isArray(request.addOns) ? request.addOns as Array<{ assignmentId?: unknown; quantity?: unknown }> : []
    const normalizedRequest = [...item.addOns].sort((left, right) => left.assignmentId.localeCompare(right.assignmentId))
    const quotedRequest = requested.map((selection) => ({ assignmentId: selection.assignmentId, quantity: selection.quantity })).sort((left, right) => String(left.assignmentId).localeCompare(String(right.assignmentId)))
    if (JSON.stringify(normalizedRequest) !== JSON.stringify(quotedRequest)) throw new ConflictException({ code: "BOOKING_QUOTE_ADDONS_MISMATCH", message: "Состав дополнительных услуг изменился; обновите расчёт цены" })
    const result = InternalOfferingQuoteResultSchema.parse(quote.resultPayload)
    if (result.total.amountMinor !== item.price.amountMinor || result.currency !== item.price.currency) throw new ConflictException({ code: "BOOKING_QUOTE_AMOUNT_MISMATCH", message: "Стоимость брони не совпадает с серверным расчётом" })
    const provenance = new Map((result.provenance.addOns ?? []).map((entry) => [entry.assignmentId, entry]))
    const lines = result.lines.filter((line) => line.kind === "addon")
    if (lines.length !== item.addOns.length) throw new ConflictException({ code: "BOOKING_QUOTE_ADDONS_MISMATCH", message: "Расчёт не содержит все дополнительные услуги" })
    return lines.map((line) => {
      const assignmentId = line.addOnAssignmentId
      const source = assignmentId ? provenance.get(assignmentId) : undefined
      if (!assignmentId || !source || !line.addOnOfferingId) throw new ConflictException({ code: "BOOKING_QUOTE_ADDONS_MISMATCH", message: "Расчёт дополнительной услуги повреждён" })
      return { assignmentId, addOnOfferingId: line.addOnOfferingId, label: line.label, serviceType: source.serviceType, quantity: line.quantity, price: line.amount }
    })
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
      const result = checkAvailability({ resourceId: resource.id, startAt: start, endAt: new Date(item.endAt), quantity: item.quantity }, existing.map(toAllocation), resource.capacityMode === "shared" ? { capacity: resource.capacityTotal } : {})
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
    const query = repository.createQueryBuilder("booking")
      .where(/^[0-9a-f-]{36}$/i.test(idOrCode) ? "booking.id = :idOrCode" : "booking.code = :idOrCode", { idOrCode })
    if (lock) query.setLock("pessimistic_write")
    const booking = await query.getOne()
    if (!booking) throw new NotFoundException({ code: "BOOKING_NOT_FOUND", message: "Бронь не найдена" })
    return booking
  }

  private async idempotentReplay<T>(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string): Promise<T | null> {
    for (const lock of [`key:${scope}:${idempotencyKey}`, `operation:${scope}:${operationId}`].sort()) await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock])
    const existing = await manager.getRepository(IdempotencyKeyEntity).createQueryBuilder("idempotency")
      .where("idempotency.scope = :scope", { scope })
      .andWhere(new Brackets((query) => query.where("idempotency.operation_id = :operationId", { operationId }).orWhere("idempotency.idempotency_key = :idempotencyKey", { idempotencyKey })))
      .getOne()
    if (!existing) return null
    if (existing.operationId !== operationId || existing.idempotencyKey !== idempotencyKey) {
      throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Operation ID и ключ идемпотентности должны повторяться вместе" })
    }
    if (existing.requestHash !== requestHash) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Ключ идемпотентности уже использован с другими данными" })
    if (!existing.responseBody) throw new ConflictException({ code: "IDEMPOTENCY_CONFLICT", message: "Операция с этим ключом ещё выполняется" })
    return existing.responseBody as T
  }

  private async storeIdempotentResponse<T>(manager: EntityManager, scope: string, operationId: string, idempotencyKey: string, requestHash: string, response: T) {
    await manager.getRepository(IdempotencyKeyEntity).save(manager.create(IdempotencyKeyEntity, {
      id: randomUUID(), scope, operationId, idempotencyKey, requestHash, responseStatus: 201,
      responseBody: response as unknown as Record<string, unknown>, createdAt: new Date(),
    }))
  }

  private async activeLeadLink(manager: EntityManager, bookingId: string, lock = false): Promise<BookingLeadLinkEntity | null> {
    const query = manager.getRepository(BookingLeadLinkEntity).createQueryBuilder("link")
      .where("link.booking_id = :bookingId AND link.unlinked_at IS NULL", { bookingId })
    if (lock) query.setLock("pessimistic_write")
    return query.orderBy("link.linked_at", "DESC").addOrderBy("link.id", "DESC").getOne()
  }

  private isActiveLeadLinkUniqueConflict(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false
    const driverError = error.driverError as { code?: string; constraint?: string }
    return driverError.code === "23505" && driverError.constraint === "booking_lead_links_active_booking_unique"
  }

  private async assertCustomer(manager: EntityManager, customerId: string): Promise<void> {
    const customer = await manager.getRepository(CustomerEntity).findOneBy({ id: customerId })
    if (!customer || customer.archivedAt) throw new NotFoundException({ code: "CUSTOMER_NOT_FOUND", message: "Клиент не найден" })
  }


  private async bumpBookingVersion(manager: EntityManager, booking: BookingEntity, actorId: string): Promise<BookingEntity> {
    const result = await manager.createQueryBuilder().update(BookingEntity).set({ updatedBy: actorId, version: () => '"version" + 1', updatedAt: () => "now()" }).where("id = :id AND version = :version", { id: booking.id, version: booking.version }).execute()
    if (result.affected !== 1) throw this.versionConflict(await manager.findOneByOrFail(BookingEntity, { id: booking.id }))
    return manager.findOneByOrFail(BookingEntity, { id: booking.id })
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

  private async recordMutation(manager: EntityManager, booking: BookingEntity, action: string, actorId: string, requestId: string, changes: Record<string, unknown>) { const now = new Date(); await manager.getRepository(ChangeLogEntity).save(manager.create(ChangeLogEntity, { id: randomUUID(), entityType: "booking", entityId: booking.id, action, actorId, requestId, changes, createdAt: now })); await manager.getRepository(OutboxEventEntity).save(manager.create(OutboxEventEntity, { id: randomUUID(), topic: `booking.${action}`, aggregateType: "booking", aggregateId: booking.id, payload: { bookingId: booking.id, version: booking.version }, availableAt: now, processedAt: null, attempts: 0, createdAt: now })) }
  private assert(actor: SessionUser, capability: keyof SessionUser["capabilities"]) { if (!actor.capabilities[capability]) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: `Capability ${capability} is required` }) }
  private versionConflict(booking: BookingEntity) { return new ConflictException({ code: "VERSION_CONFLICT", message: "Бронь была изменена другим сотрудником", details: { entityId: booking.id, serverVersion: booking.version } }) }
  private assertTransition(current: string, next: string) { const allowed: Record<string, string[]> = { draft: ["unconfirmed", "cancelled", "archived"], unconfirmed: ["draft", "confirmed", "cancelled", "archived"], confirmed: ["in_progress", "cancelled", "archived"], in_progress: ["completed", "cancelled", "archived"], completed: ["archived"], cancelled: ["archived"], archived: [] }; if (!allowed[current]?.includes(next)) throw new ConflictException({ code: "INVALID_STATE_TRANSITION", message: `Нельзя перевести бронь из ${current} в ${next}` }) }
}
