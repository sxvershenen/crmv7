import { ForbiddenException, Inject, Injectable } from "@nestjs/common"
import { DataSource } from "typeorm"

import type { SessionUser } from "@crm/contracts"
import type { FinanceDatasetDto, FinanceOperationDto, FinanceQuery } from "@crm/contracts/finance"

type BookingRow = {
  id: string; code: string; version: number; total_amount: number; currency: string; created_at: Date;
  snapshot: Record<string, unknown>; client_name: string | null; item_type: string | null;
  starts_at: Date | null; resource_id: string | null; resource_kind: string | null; resource_name: string | null;
}
type PaymentRow = {
  id: string; booking_id: string; kind: string; amount: number; currency: string; method: string;
  source_payment_id: string | null; created_at: Date;
}
type FinanceCategory = FinanceOperationDto["category"]
type OperationValue = Omit<Pick<FinanceOperationDto, "id" | "type" | "amountMinor" | "method" | "sourcePaymentId" | "refundableMinor">, never> & { date: Date }

const categoryLabels: Record<FinanceCategory, string> = {
  houses: "Домики", bath: "Баня и чан", venues: "Площадки", camping: "Кемпинг", programs: "Программы", events: "Мероприятия",
}

@Injectable()
export class FinanceService {
  constructor(@Inject(DataSource) private readonly dataSource: DataSource) {}

  async get(query: FinanceQuery, actor: SessionUser): Promise<FinanceDatasetDto> {
    if (!actor.capabilities.canViewFinance) throw new ForbiddenException({ code: "PERMISSION_DENIED", message: "Недостаточно прав для просмотра финансов" })
    const from = new Date(`${query.date}T00:00:00+03:00`)
    const until = new Date(`${query.rangeEnd}T00:00:00+03:00`); until.setUTCDate(until.getUTCDate() + 1)
    const bookings = await this.dataSource.query(`
      SELECT b.id, b.code, b.version, b.total_amount, b.currency, b.created_at, b.snapshot,
             c.name AS client_name, item.type AS item_type, item.start_at AS starts_at,
             item.resource_id, resource.kind AS resource_kind, resource.name AS resource_name
      FROM bookings b
      LEFT JOIN customers c ON c.id = b.customer_id
      LEFT JOIN LATERAL (
        SELECT bi.type, bi.start_at, bi.resource_id
        FROM booking_items bi
        WHERE bi.booking_id = b.id AND bi.archived_at IS NULL
        ORDER BY bi.start_at, bi.id LIMIT 1
      ) item ON true
      LEFT JOIN resources resource ON resource.id = item.resource_id
      WHERE b.archived_at IS NULL
        AND (b.created_at < $2 OR (item.start_at >= $1 AND item.start_at < $2))
      ORDER BY b.created_at, b.id
    `, [from, until]) as BookingRow[]
    if (bookings.length === 0) return this.empty(query)

    const payments = await this.dataSource.query(`
      SELECT id, booking_id, kind, amount, currency, method, source_payment_id, created_at
      FROM payments WHERE booking_id = ANY($1::uuid[]) ORDER BY created_at, id
    `, [bookings.map((booking) => booking.id)]) as PaymentRow[]
    const paymentsByBooking = new Map<string, PaymentRow[]>()
    for (const payment of payments) paymentsByBooking.set(payment.booking_id, [...(paymentsByBooking.get(payment.booking_id) ?? []), payment])

    const operations: FinanceOperationDto[] = []
    for (const booking of bookings) {
      if (booking.created_at >= from && booking.created_at < until) operations.push(this.accrual(booking))
      const bookingPayments = paymentsByBooking.get(booking.id) ?? []
      for (const payment of bookingPayments) {
        if (payment.created_at < from || payment.created_at >= until) continue
        operations.push(this.payment(payment, booking, bookingPayments))
      }
    }
    const filtered = operations.filter((operation) => this.matches(operation, query))
    const sorted = [...filtered].sort((left, right) => this.compare(left, right, query))
    const total = sorted.length
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
    const page = Math.min(query.page, totalPages)
    const start = (page - 1) * query.pageSize

    const expected = bookings.flatMap((booking) => {
      const bookingPayments = paymentsByBooking.get(booking.id) ?? []
      const charged = bookingPayments.filter((item) => item.kind === "charge" || item.kind === "adjustment").reduce((sum, item) => sum + item.amount, 0)
      const refunded = bookingPayments.filter((item) => item.kind === "refund").reduce((sum, item) => sum + item.amount, 0)
      const paid = Math.max(0, charged - refunded)
      if (paid >= booking.total_amount) return []
      const dueAt = booking.starts_at
      return [{ id: booking.id, dueAt: dueAt?.toISOString() ?? null, clientName: booking.client_name ?? "Клиент", relationLabel: `Бронь #${booking.code}`, totalMinor: booking.total_amount, paidMinor: paid, overdue: dueAt !== null && dueAt < new Date() }]
    })
    const breakdown = this.breakdown(filtered, (operation) => operation.category, categoryLabels)
    const sourceBreakdown = this.breakdown(filtered, (operation) => operation.source)
    const breakdownDetails = this.breakdownDetails(filtered, bookings)
    const points = this.points(filtered)
    const accruedMinor = filtered.filter((item) => item.type === "accrual" || item.type === "adjustment").reduce((sum, item) => sum + Math.max(0, item.amountMinor), 0)
    const paidMinor = filtered.filter((item) => item.type === "payment").reduce((sum, item) => sum + item.amountMinor, 0)
    const refundsMinor = Math.abs(filtered.filter((item) => item.type === "refund").reduce((sum, item) => sum + item.amountMinor, 0))
    const paymentCount = filtered.filter((item) => item.type === "payment").length
    const expectedMinor = expected.reduce((sum, item) => sum + Math.max(0, item.totalMinor - item.paidMinor), 0)
    const overdueMinor = expected.filter((item) => item.overdue).reduce((sum, item) => sum + Math.max(0, item.totalMinor - item.paidMinor), 0)

    return {
      operations: sorted.slice(start, start + query.pageSize), expected, breakdown, breakdownDetails, sourceBreakdown, points,
      pagination: { page, pageSize: query.pageSize, total, totalPages, from: total ? start + 1 : 0, to: Math.min(total, start + query.pageSize) },
      summary: { accruedMinor, paidMinor, debtMinor: Math.max(0, accruedMinor - paidMinor + refundsMinor), refundsMinor, averageMinor: paymentCount ? Math.round(paidMinor / paymentCount) : 0, expectedMinor, overdueMinor },
    }
  }

  private accrual(booking: BookingRow): FinanceOperationDto {
    return this.base(booking, { id: `accrual:${booking.id}`, date: booking.created_at, type: "accrual", amountMinor: booking.total_amount, method: "transfer", sourcePaymentId: null, refundableMinor: 0 })
  }

  private payment(payment: PaymentRow, booking: BookingRow, bookingPayments: PaymentRow[]): FinanceOperationDto {
    const refunded = payment.kind === "charge" ? bookingPayments.filter((item) => item.kind === "refund" && item.source_payment_id === payment.id).reduce((sum, item) => sum + item.amount, 0) : 0
    return this.base(booking, {
      id: payment.id, date: payment.created_at, type: payment.kind === "charge" ? "payment" : payment.kind as "refund" | "adjustment",
      amountMinor: payment.kind === "refund" ? -payment.amount : payment.amount, method: this.method(payment.method),
      sourcePaymentId: payment.source_payment_id, refundableMinor: payment.kind === "charge" ? Math.max(0, payment.amount - refunded) : 0,
    })
  }

  private base(booking: BookingRow, value: OperationValue): FinanceOperationDto {
    const assignees = Array.isArray(booking.snapshot.assignees) ? booking.snapshot.assignees.filter((item): item is { id: string; name: string; initials: string } => {
      if (!item || typeof item !== "object") return false
      const candidate = item as Record<string, unknown>
      return typeof candidate.id === "string" && typeof candidate.name === "string" && typeof candidate.initials === "string"
    }) : []
    return {
      id: value.id, type: value.type, amountMinor: value.amountMinor, method: value.method, sourcePaymentId: value.sourcePaymentId, refundableMinor: value.refundableMinor,
      bookingId: booking.id, bookingVersion: booking.version, currency: booking.currency,
      date: value.date.toISOString(), clientName: booking.client_name ?? "Клиент", relationLabel: `Бронь #${booking.code}`,
      relationHref: `/bookings/${booking.code}`, category: this.category(booking),
      source: typeof booking.snapshot.source === "string" && booking.snapshot.source ? booking.snapshot.source : "CRM", assignees,
    }
  }

  private category(booking: BookingRow): FinanceCategory {
    const snapshotCategory = booking.snapshot.category
    if (["houses", "bath", "venues", "camping", "programs", "events"].includes(String(snapshotCategory))) return snapshotCategory as FinanceCategory
    if (["houses", "bath", "venues", "camping"].includes(booking.resource_kind ?? "")) return booking.resource_kind as FinanceCategory
    return booking.item_type === "program" ? "programs" : "events"
  }

  private method(method: string): FinanceOperationDto["method"] {
    if (method === "cash" || method === "card") return method
    return "transfer"
  }

  private matches(operation: FinanceOperationDto, query: FinanceQuery) {
    if (!["summary", "dynamics", "sources"].includes(query.section) && operation.category !== query.section) return false
    if (query.type !== "all" && operation.type !== query.type) return false
    if (query.method !== "all" && operation.method !== query.method) return false
    if (query.refundsOnly && operation.type !== "refund") return false
    return true
  }

  private compare(left: FinanceOperationDto, right: FinanceOperationDto, query: FinanceQuery) {
    const assignee = (item: FinanceOperationDto) => item.assignees[0]?.name ?? ""
    const value = (item: FinanceOperationDto): string | number => ({ date: item.date, type: item.type, amount: item.amountMinor, client: item.clientName, relation: item.relationLabel, method: item.method, source: item.source, assignee: assignee(item) })[query.sort]
    const a = value(left); const b = value(right)
    const result = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "ru-RU", { numeric: true })
    return result * (query.order === "asc" ? 1 : -1)
  }

  private breakdown(operations: FinanceOperationDto[], key: (operation: FinanceOperationDto) => string, labels: Record<string, string> = {}) {
    const rows = new Map<string, { id: string; label: string; accruedMinor: number; paidMinor: number }>()
    for (const operation of operations) {
      const id = key(operation); const row = rows.get(id) ?? { id, label: labels[id] ?? id, accruedMinor: 0, paidMinor: 0 }
      if (operation.type === "payment") row.paidMinor += operation.amountMinor
      else if ((operation.type === "accrual" || operation.type === "adjustment") && operation.amountMinor > 0) row.accruedMinor += operation.amountMinor
      rows.set(id, row)
    }
    return [...rows.values()]
  }

  private breakdownDetails(operations: FinanceOperationDto[], bookings: BookingRow[]) {
    const resourceByBooking = new Map(bookings.map((booking) => [booking.id, { id: booking.resource_id, name: booking.resource_name }]))
    const rows = new Map<string, FinanceDatasetDto["breakdownDetails"][number]>()
    for (const operation of operations) {
      const resource = resourceByBooking.get(operation.bookingId)
      const id = resource?.id ?? operation.category
      const row = rows.get(id) ?? { id, label: resource?.name ?? categoryLabels[operation.category], section: operation.category, accruedMinor: 0, paidMinor: 0, href: resource?.id ? `/resources/${operation.category}/${resource.id}` : "/finance" }
      if (operation.type === "payment") row.paidMinor += operation.amountMinor
      else if ((operation.type === "accrual" || operation.type === "adjustment") && operation.amountMinor > 0) row.accruedMinor += operation.amountMinor
      rows.set(id, row)
    }
    return [...rows.values()]
  }

  private points(operations: FinanceOperationDto[]) {
    const rows = new Map<string, FinanceDatasetDto["points"][number]>()
    for (const operation of operations) {
      const label = operation.date.slice(0, 10)
      const row = rows.get(label) ?? { label, accruedMinor: 0, paidMinor: 0, refundsMinor: 0, debtMinor: 0, paymentCount: 0 }
      if (operation.type === "payment") { row.paidMinor += operation.amountMinor; row.paymentCount += 1 }
      else if (operation.type === "refund") row.refundsMinor += Math.abs(operation.amountMinor)
      else if ((operation.type === "accrual" || operation.type === "adjustment") && operation.amountMinor > 0) row.accruedMinor += operation.amountMinor
      row.debtMinor = Math.max(0, row.accruedMinor - row.paidMinor + row.refundsMinor)
      rows.set(label, row)
    }
    return [...rows.values()].sort((left, right) => left.label.localeCompare(right.label))
  }

  private empty(query: FinanceQuery): FinanceDatasetDto {
    return { operations: [], expected: [], breakdown: [], breakdownDetails: [], sourceBreakdown: [], points: [], pagination: { page: 1, pageSize: query.pageSize, total: 0, totalPages: 1, from: 0, to: 0 }, summary: { accruedMinor: 0, paidMinor: 0, debtMinor: 0, refundsMinor: 0, averageMinor: 0, expectedMinor: 0, overdueMinor: 0 } }
  }
}
