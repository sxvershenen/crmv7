import { IsNull, type DataSource, type EntityManager } from "typeorm"

import { BookingPromotionSchema, type BookingDto, type BookingItemInput, type BookingLeadLink, type BookingProjectionBooking, type BookingProjectionCategory, type BookingProjectionOperation, type BookingProjectionQuery, type BookingProjectionResource, type SessionUser } from "@crm/contracts"
import { BookingEntity, BookingItemEntity, BookingLeadLinkEntity, PaymentEntity, ResourceAllocationEntity } from "@crm/db"
import type { AvailabilityAllocation } from "@crm/domain"
import type { BookingPromotion } from "@crm/contracts"

type ItemInput = BookingItemInput

export type ProjectionRow = {
  id: string; code: string; version: number; customer_id: string | null; status: string; currency: string; total_amount: number; snapshot: Record<string, unknown> | null;
  client_name: string | null; phone: string | null; item_id: string | null; item_type: string | null; resource_id: string | null; start_at: Date | string | null; end_at: Date | string | null;
  quantity: number | null; preparation_minutes: number | null; resource_code: string | null; resource_kind: string | null; resource_name: string | null; capacity_total: number | null;
  source_lead_id: string | null; lead_source: string | null; lead_utm: Record<string, string> | null; has_conflict: boolean;
}


export function storedPromotion(booking: BookingEntity): BookingPromotion | null {
    const parsed = BookingPromotionSchema.safeParse(booking.snapshot.promotion)
    return parsed.success ? parsed.data : null
  }
export function toLeadLink(link: BookingLeadLinkEntity): BookingLeadLink {
    return { id: link.id, bookingId: link.bookingId, leadId: link.leadId, method: link.method as BookingLeadLink["method"], linkedAt: link.linkedAt.toISOString(), linkedBy: link.linkedBy, unlinkedAt: link.unlinkedAt?.toISOString() ?? null, unlinkedBy: link.unlinkedBy }
  }
export async function toBookingDto(manager: EntityManager, booking: BookingEntity, actor: SessionUser, knownItems?: BookingItemEntity[]): Promise<BookingDto> {
    const entities = knownItems ?? await manager.getRepository(BookingItemEntity).find({ where: { bookingId: booking.id, archivedAt: IsNull() }, order: { createdAt: "ASC" } })
    const items = entities.map(toDtoItem)
    const charged = await manager.getRepository(PaymentEntity).createQueryBuilder("payment").select("COALESCE(SUM(CASE WHEN payment.kind IN ('charge','adjustment') THEN payment.amount ELSE 0 END), 0)", "charged").addSelect("COALESCE(SUM(CASE WHEN payment.kind = 'refund' THEN payment.amount ELSE 0 END), 0)", "refunded").where("payment.booking_id = :bookingId", { bookingId: booking.id }).getRawOne<{ charged: string; refunded: string }>()
    const net = Number(charged?.charged ?? 0) - Number(charged?.refunded ?? 0)
    return { id: booking.id, version: booking.version, customerId: booking.customerId!, status: booking.status as BookingDto["status"], items, promotion: storedPromotion(booking), subtotal: { amountMinor: items.reduce((sum, item) => sum + item.price.amountMinor, 0), currency: booking.currency }, total: { amountMinor: booking.totalAmount, currency: booking.currency }, paymentState: paymentState(booking.totalAmount, net), createdAt: booking.createdAt.toISOString(), updatedAt: booking.updatedAt.toISOString(), capabilities: { canView: actor.capabilities.canView, canCreate: actor.capabilities.canCreate, canEdit: actor.capabilities.canEdit, canArchive: actor.capabilities.canArchive, canChangeStatus: actor.capabilities.canChangeStatus, canOverrideConflict: actor.capabilities.canOverrideConflict, canAddPayment: actor.capabilities.canAddPayment, canRefund: actor.capabilities.canRefund } }
  }
export async function projectionResources(dataSource: DataSource, query: BookingProjectionQuery, from: Date, until: Date): Promise<BookingProjectionResource[]> {
    const rows = await dataSource.query("SELECT id, code, name, kind, capacity_total FROM resources WHERE archived_at IS NULL ORDER BY name, id") as Array<{ id: string; code: string; name: string; kind: string; capacity_total: number }>
    const selected = rows.filter((row) => (query.resource === "all" || row.id === query.resource) && (query.category === "all" || category(row.kind) === query.category))
    if (selected.length === 0) return []
    const allocations = await dataSource.query("SELECT resource_id, quantity, capacity_impact FROM resource_allocations WHERE resource_id = ANY($1::uuid[]) AND status IN ('active','tentative') AND archived_at IS NULL AND start_at < $2 AND end_at > $3", [selected.map((row) => row.id), until, from]) as Array<{ resource_id: string; quantity: number; capacity_impact: number }>
    const occupied = new Map<string, number>()
    for (const allocation of allocations) occupied.set(allocation.resource_id, (occupied.get(allocation.resource_id) ?? 0) + (allocation.capacity_impact ?? allocation.quantity ?? 0))
    return selected.map((row) => ({ id: row.id, code: row.code, name: row.name, category: category(row.kind), capacity: row.capacity_total, occupied: occupied.get(row.id) ?? 0 }))
  }
export function projectionBooking(row: ProjectionRow, payments: Array<{ kind: string; amount: number }>): BookingProjectionBooking | null {
    if (!row?.item_id || !row.start_at || !row.end_at) return null
    const start = new Date(row.start_at)
    const end = new Date(row.end_at)
    const startParts = localParts(start)
    const endParts = localParts(end)
    const bookingCategory = category(row.resource_kind ?? row.item_type)
    const charged = payments.filter((payment) => payment.kind === "charge" || payment.kind === "adjustment" || payment.kind === "payment").reduce((sum, payment) => sum + payment.amount, 0)
    const refunded = payments.filter((payment) => payment.kind === "refund").reduce((sum, payment) => sum + payment.amount, 0)
    const paid = Math.max(0, charged - refunded)
    const bookingPaymentState = paymentState(row.total_amount, charged - refunded)
    const hasConflict = Boolean(row.has_conflict)
    const status: BookingProjectionBooking["status"] = hasConflict ? "conflict" : row.status === "cancelled" || row.status === "archived" ? "cancelled" : row.status === "draft" ? "draft" : paid > row.total_amount ? "paid" : paid === row.total_amount ? "paid" : paid <= 0 ? "unpaid" : "debt"
    const snapshot = row.snapshot ?? {}
    const source = stringValue(snapshot.source) || stringValue(row.lead_source)
    const utm = stringValue(snapshot.utm) || stringValue((row.lead_utm ?? {})["utm_source"])
    const promo = stringValue(snapshot.promo)
    const assignees = Array.isArray(snapshot.assignees) ? snapshot.assignees.filter((item): item is { id: string; initials: string; name: string } => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" && /^[0-9a-f-]{36}$/i.test(String((item as Record<string, unknown>).id)) && typeof (item as Record<string, unknown>).initials === "string" && typeof (item as Record<string, unknown>).name === "string")).map((item) => ({ id: item.id, initials: item.initials, name: item.name })) : []
    const guestCount = Number(snapshot.guestCount ?? snapshot.guests ?? row.quantity ?? 0)
    return {
      id: row.id, code: row.code, version: row.version, customerId: row.customer_id, clientName: row.client_name ?? "Клиент", phone: row.phone ?? "",
      resourceId: row.resource_id, resourceName: row.resource_name ?? "Без ресурса", category: bookingCategory, date: startParts.date, startAt: start.toISOString(), endAt: end.toISOString(),
      startHour: startParts.hour, endHour: endParts.hour === 0 && endParts.date !== startParts.date ? 24 : endParts.hour, preparationEndHour: Math.min(24, endParts.hour + Math.ceil((row.preparation_minutes ?? 0) / 60)), guestCount: Number.isFinite(guestCount) ? guestCount : 0,
      status, lifecycleStatus: row.status as BookingProjectionBooking["lifecycleStatus"], amount: row.total_amount, paid, paymentState: bookingPaymentState, source, utm, promo, sourceLeadId: row.source_lead_id, assignees,
      itemId: row.item_id, hasConflict,
    }
  }

export function projectionOperations(booking: BookingProjectionBooking, from: Date, until: Date): BookingProjectionOperation[] {
    if (!booking.resourceId) return []
    const values: BookingProjectionOperation[] = []
    const add = (kind: BookingProjectionOperation["kind"], at: string) => { const date = new Date(at); if (date >= from && date < until) values.push({ id: `${booking.itemId ?? booking.id}-${kind}`, bookingId: booking.id, resourceId: booking.resourceId!, kind, time: at, timeLabel: localParts(date).label, clientName: booking.clientName, status: booking.status }) }
    add("arrival", booking.startAt)
    add("departure", booking.endAt)
    if (booking.preparationEndHour > booking.endHour) add("preparation", booking.endAt)
    return values
  }
export function emptyProjection(booking: BookingEntity, base: BookingDto, item: BookingItemEntity | null): BookingProjectionBooking {
    const start = item?.startAt ?? booking.createdAt
    const end = item?.endAt ?? new Date(start.getTime() + 60 * 60 * 1000)
    const row = { id: booking.id, code: booking.code, version: booking.version, customer_id: booking.customerId, status: booking.status, currency: booking.currency, total_amount: booking.totalAmount, snapshot: booking.snapshot, client_name: "Клиент", phone: "", item_id: item?.id ?? null, item_type: item?.type ?? "other", resource_id: item?.resourceId ?? null, start_at: start, end_at: end, quantity: item?.quantity ?? 1, preparation_minutes: item?.preparationMinutes ?? 0, resource_code: null, resource_kind: null, resource_name: null, capacity_total: null, source_lead_id: null, lead_source: null, lead_utm: {}, has_conflict: false } satisfies ProjectionRow
    return projectionBooking(row, []) ?? { id: booking.id, code: booking.code, version: booking.version, customerId: booking.customerId, clientName: "Клиент", phone: "", resourceId: null, resourceName: "Без ресурса", category: "other", date: start.toISOString().slice(0, 10), startAt: start.toISOString(), endAt: end.toISOString(), startHour: start.getHours(), endHour: end.getHours(), preparationEndHour: end.getHours(), guestCount: 0, status: "draft", lifecycleStatus: base.status, amount: base.total.amountMinor, paid: 0, paymentState: base.paymentState, source: "", utm: "", promo: "", sourceLeadId: null, assignees: [], itemId: item?.id ?? null, hasConflict: false }
  }
export function category(kind: string | null | undefined): BookingProjectionCategory {
    if (kind === "house" || kind === "houses" || kind === "accommodation") return "houses"
    if (kind === "camp" || kind === "camping") return "camping"
    if (kind === "tent" || kind === "tents") return "tents"
    if (kind === "bath" || kind === "sauna") return "bath"
    if (kind === "venue" || kind === "venues") return "venues"
    return "other"
  }

export function stringValue(value: unknown): string { return typeof value === "string" ? value : "" }
export function snapshotAssignees(snapshot: Record<string, unknown> | null | undefined) {
    const value = snapshot?.assignees
    if (!Array.isArray(value)) return []
    return value.filter((item): item is { id: string; initials: string; name: string } => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" && typeof (item as Record<string, unknown>).initials === "string" && typeof (item as Record<string, unknown>).name === "string"))
  }
export function localParts(value: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value)
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00"
    const date = `${get("year")}-${get("month")}-${get("day")}`
    const hour = Number(get("hour"))
    return { date, hour, label: `${String(hour).padStart(2, "0")}:${get("minute")}` }
  }
export function paymentState(total: number, net: number): BookingDto["paymentState"] { if (net < 0) return "refund"; if (net === 0) return total === 0 ? "paid" : "unpaid"; if (net < total) return "partial"; if (net === total) return "paid"; return "overpaid" }
export const fromEntity = (item: BookingItemEntity): ItemInput => ({ type: item.type as ItemInput["type"], resourceId: item.resourceId, startAt: item.startAt.toISOString(), endAt: item.endAt.toISOString(), quantity: item.quantity, price: { amountMinor: item.priceAmount, currency: item.currency }, discount: { amountMinor: item.discountAmount, currency: item.currency }, preparationMinutes: item.preparationMinutes, quoteSnapshotId: item.quoteSnapshotId, addOns: item.addOnSelections.map(({ assignmentId, quantity }) => ({ assignmentId, quantity })) })
export const toDtoItem = (item: BookingItemEntity): BookingDto["items"][number] => ({ id: item.id, type: item.type as BookingDto["items"][number]["type"], resourceId: item.resourceId, startAt: item.startAt.toISOString(), endAt: item.endAt.toISOString(), quantity: item.quantity, price: { amountMinor: item.priceAmount, currency: item.currency }, discount: { amountMinor: item.discountAmount, currency: item.currency }, preparationMinutes: item.preparationMinutes, quoteSnapshotId: item.quoteSnapshotId, addOns: item.addOnSelections })
export const toAllocation = (allocation: ResourceAllocationEntity): AvailabilityAllocation => ({ id: allocation.id, resourceId: allocation.resourceId, sourceId: allocation.sourceId, startAt: allocation.startAt, endAt: allocation.endAt, quantity: allocation.quantity, capacityImpact: allocation.capacityImpact, status: allocation.status as AvailabilityAllocation["status"] })
export function bookingSnapshot(booking: BookingEntity, items: BookingItemEntity[]) { return { id: booking.id, version: booking.version, customerId: booking.customerId, status: booking.status, totalAmount: booking.totalAmount, promotion: storedPromotion(booking), itemIds: items.map((item) => item.id) } }
