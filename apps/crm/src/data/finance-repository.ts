import type { FinanceDataset, FinanceOperation, FinanceQuery, FinanceSortKey } from "@app/entities/finance"
import { financeBreakdownDetailsFixture, financeBreakdownFixture, financeExpectedFixture, financeOperationsFixture, financePointsFixture } from "@app/fixtures/finance"
import { FinanceDatasetDtoSchema, type FinanceDatasetDto, type FinanceOperationDto } from "@crm/contracts/finance"
import { PaymentDtoSchema } from "@crm/contracts/payments"
import { apiClient } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"

export interface FinanceRepository {
  get(query: FinanceQuery): Promise<FinanceDataset>
  refund(operationId: string): Promise<FinanceOperation>
}
const collator = new Intl.Collator("ru-RU", { numeric: true, sensitivity: "base" })
const sortValue: Record<FinanceSortKey, (item: FinanceOperation) => string | number> = { date: (item) => item.date, type: (item) => item.type, amount: (item) => item.amount, client: (item) => item.clientName, relation: (item) => item.relationLabel, method: (item) => item.method, source: (item) => item.source, assignee: (item) => item.assignees[0]?.name ?? "" }

export function selectFinance(query: FinanceQuery, source: FinanceOperation[] = financeOperationsFixture): FinanceDataset {
  const sign = query.sort.direction === "asc" ? 1 : -1
  const filteredOperations = structuredClone(source).filter((item) => {
    const day = item.date.slice(0, 10)
    if (day < query.date || day > query.rangeEnd) return false
    if (!["summary", "dynamics", "sources"].includes(query.section) && item.category !== query.section) return false
    if (query.type !== "all" && item.type !== query.type) return false
    if (query.method !== "all" && item.method !== query.method) return false
    if (query.refundsOnly && item.type !== "refund") return false
    return true
  }).sort((left, right) => {
    const a = sortValue[query.sort.key](left); const b = sortValue[query.sort.key](right)
    return (typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b))) * sign
  })
  const total = filteredOperations.length
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize))
  const page = Math.min(totalPages, Math.max(1, query.page))
  const fromIndex = (page - 1) * query.pageSize
  const operations = filteredOperations.slice(fromIndex, fromIndex + query.pageSize)
  const accrued = filteredOperations.filter((item) => item.type === "accrual" || item.type === "adjustment").reduce((sum, item) => sum + Math.max(0, item.amount), 0)
  const paid = filteredOperations.filter((item) => item.type === "payment").reduce((sum, item) => sum + item.amount, 0)
  const refunds = Math.abs(filteredOperations.filter((item) => item.type === "refund").reduce((sum, item) => sum + item.amount, 0))
  const payments = filteredOperations.filter((item) => item.type === "payment")
  const sourceBreakdown = Object.values(filteredOperations.reduce<Record<string, { id: string; label: string; accrued: number; paid: number }>>((result, item) => {
    const row = result[item.source] ?? { id: item.source, label: item.source, accrued: 0, paid: 0 }
    if (item.type === "payment") row.paid += item.amount
    else if ((item.type === "accrual" || item.type === "adjustment") && item.amount > 0) row.accrued += item.amount
    result[item.source] = row
    return result
  }, {}))
  const expected = financeExpectedFixture.reduce((sum, item) => sum + Math.max(0, item.total - item.paid), 0)
  const overdue = financeExpectedFixture.filter((item) => item.overdue).reduce((sum, item) => sum + Math.max(0, item.total - item.paid), 0)
  return { operations, expected: structuredClone(financeExpectedFixture), breakdown: structuredClone(financeBreakdownFixture), breakdownDetails: structuredClone(financeBreakdownDetailsFixture), sourceBreakdown, points: structuredClone(financePointsFixture), pagination: { page, pageSize: query.pageSize, total, totalPages, from: total ? fromIndex + 1 : 0, to: Math.min(total, fromIndex + query.pageSize) }, summary: { accrued, paid, debt: Math.max(0, accrued - paid + refunds), refunds, average: payments.length ? Math.round(paid / payments.length) : 0, expected, overdue } }
}

export class FixtureFinanceRepository implements FinanceRepository {
  private operations = structuredClone(financeOperationsFixture)

  async get(query: FinanceQuery) {
    return Promise.resolve(selectFinance(query, this.operations))
  }

  async refund(operationId: string): Promise<FinanceOperation> {
    const payment = this.operations.find((item) => item.id === operationId && item.type === "payment")
    if (!payment) throw new Error("Исходная оплата не найдена")
    const existing = this.operations.find((item) => item.type === "refund" && item.sourcePaymentId === operationId)
    if (existing) return Promise.resolve(structuredClone(existing))
    const now = new Date()
    const refund: FinanceOperation = {
      ...structuredClone(payment),
      amount: -Math.abs(payment.amount),
      date: now.toISOString(),
      dateLabel: "Только что",
      id: `R-${operationId}`,
      sourcePaymentId: operationId,
      type: "refund",
    }
    this.operations.unshift(refund)
    return Promise.resolve(structuredClone(refund))
  }
}

type RefundContext = FinanceOperationDto

export class ApiFinanceRepository implements FinanceRepository {
  private readonly refunds = new Map<string, RefundContext>()

  constructor(private readonly client: Pick<typeof apiClient, "get" | "post"> = apiClient) {}

  async get(query: FinanceQuery) {
    const params = new URLSearchParams({
      section: query.section, date: query.date, rangeEnd: query.rangeEnd, type: query.type,
      method: query.method, refundsOnly: String(query.refundsOnly), page: String(query.page),
      pageSize: String(query.pageSize), sort: query.sort.key, order: query.sort.direction,
    })
    const dto = await this.client.get(`/finance?${params.toString()}`, FinanceDatasetDtoSchema)
    for (const operation of dto.operations) {
      if (operation.type === "payment" && operation.refundableMinor > 0) this.refunds.set(operation.id, operation)
    }
    return mapFinanceDataset(dto)
  }

  async refund(operationId: string): Promise<FinanceOperation> {
    const context = this.refunds.get(operationId)
    if (!context || context.refundableMinor <= 0) throw new Error("Для этой оплаты нет доступной суммы возврата")
    const operationIdempotency = crypto.randomUUID()
    const payment = await this.client.post("/payments", {
      operationId: operationIdempotency,
      idempotencyKey: `finance-refund-${operationIdempotency}`,
      expectedVersion: context.bookingVersion,
      bookingId: context.bookingId,
      type: "refund",
      amount: { amountMinor: context.refundableMinor, currency: context.currency },
      method: context.method === "transfer" ? "bank_transfer" : context.method,
      reason: "Возврат из реестра финансов",
      sourcePaymentId: operationId,
    }, PaymentDtoSchema)
    this.refunds.delete(operationId)
    const method: FinanceOperation["method"] = payment.method === "bank_transfer" || payment.method === "online" || payment.method === "other" ? "transfer" : payment.method
    return {
      id: payment.id, date: payment.createdAt, dateLabel: "Только что", type: "refund", amount: -fromMinor(payment.amount.amountMinor),
      clientName: context.clientName, relationLabel: context.relationLabel, relationHref: context.relationHref,
      category: context.category, method,
      source: context.source, assignees: context.assignees, ...(payment.sourcePaymentId ? { sourcePaymentId: payment.sourcePaymentId } : {}),
    }
  }
}

function fromMinor(value: number) { return value / 100 }
function dateLabel(value: string | null) {
  if (!value) return "Без срока"
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value))
}
function mapFinanceDataset(dto: FinanceDatasetDto): FinanceDataset {
  return {
    operations: dto.operations.map((item) => ({
      id: item.id, date: item.date, dateLabel: dateLabel(item.date), type: item.type, amount: fromMinor(item.amountMinor),
      clientName: item.clientName, relationLabel: item.relationLabel, relationHref: item.relationHref, category: item.category,
      method: item.method, source: item.source, assignees: item.assignees,
      ...(item.sourcePaymentId ? { sourcePaymentId: item.sourcePaymentId } : {}),
    })),
    expected: dto.expected.map((item) => ({ id: item.id, dueLabel: dateLabel(item.dueAt), clientName: item.clientName, relationLabel: item.relationLabel, total: fromMinor(item.totalMinor), paid: fromMinor(item.paidMinor), overdue: item.overdue })),
    breakdown: dto.breakdown.map((item) => ({ id: item.id, label: item.label, accrued: fromMinor(item.accruedMinor), paid: fromMinor(item.paidMinor) })),
    breakdownDetails: dto.breakdownDetails.map((item) => ({ id: item.id, label: item.label, section: item.section, accrued: fromMinor(item.accruedMinor), paid: fromMinor(item.paidMinor), href: item.href })),
    sourceBreakdown: dto.sourceBreakdown.map((item) => ({ id: item.id, label: item.label, accrued: fromMinor(item.accruedMinor), paid: fromMinor(item.paidMinor) })),
    points: dto.points.map((item) => ({ label: item.label, accrued: fromMinor(item.accruedMinor), paid: fromMinor(item.paidMinor), refunds: fromMinor(item.refundsMinor), debt: fromMinor(item.debtMinor), paymentCount: item.paymentCount })),
    pagination: dto.pagination,
    summary: { accrued: fromMinor(dto.summary.accruedMinor), paid: fromMinor(dto.summary.paidMinor), debt: fromMinor(dto.summary.debtMinor), refunds: fromMinor(dto.summary.refundsMinor), average: fromMinor(dto.summary.averageMinor), expected: fromMinor(dto.summary.expectedMinor), overdue: fromMinor(dto.summary.overdueMinor) },
  }
}

export const fixtureFinanceRepository: FinanceRepository = new FixtureFinanceRepository()
export const financeRepository: FinanceRepository = useFixtureData ? fixtureFinanceRepository : new ApiFinanceRepository()
