import type { Assignee } from "@crm/ui"

export const financeSections = ["summary", "dynamics", "houses", "bath", "venues", "camping", "programs", "events", "sources"] as const
export const financeOperationTypes = ["accrual", "payment", "refund", "adjustment"] as const
export const financeMethods = ["card", "transfer", "cash"] as const
export const financePeriods = ["today", "week", "month", "quarter"] as const
export const financeSortKeys = ["date", "type", "amount", "client", "relation", "method", "source", "assignee"] as const

export type FinanceSection = (typeof financeSections)[number]
export type FinanceOperationType = (typeof financeOperationTypes)[number]
export type FinanceMethod = (typeof financeMethods)[number]
export type FinancePeriod = (typeof financePeriods)[number]
export type FinanceSortKey = (typeof financeSortKeys)[number]
export type FinanceSortDirection = "asc" | "desc"

export type FinanceOperation = {
  id: string
  date: string
  dateLabel: string
  type: FinanceOperationType
  amount: number
  clientName: string
  relationLabel: string
  relationHref: string
  category: Exclude<FinanceSection, "summary" | "dynamics" | "sources">
  method: FinanceMethod
  source: string
  assignees: Assignee[]
  sourcePaymentId?: string
}

export type FinanceExpectedPayment = {
  id: string
  dueLabel: string
  clientName: string
  relationLabel: string
  total: number
  paid: number
  overdue: boolean
}

export type FinanceBreakdown = { id: string; label: string; accrued: number; paid: number }
export type FinanceBreakdownDetail = { id: string; label: string; section: Exclude<FinanceSection, "summary" | "dynamics" | "sources">; accrued: number; paid: number; href: string }
export type FinancePoint = { label: string; accrued: number; paid: number; refunds: number; debt: number; paymentCount: number }
export type FinanceSummary = { accrued: number; paid: number; debt: number; refunds: number; average: number; expected: number; overdue: number }
export type FinancePagination = { page: number; pageSize: number; total: number; totalPages: number; from: number; to: number }

export type FinanceDataset = {
  operations: FinanceOperation[]
  expected: FinanceExpectedPayment[]
  breakdown: FinanceBreakdown[]
  breakdownDetails: FinanceBreakdownDetail[]
  sourceBreakdown: FinanceBreakdown[]
  points: FinancePoint[]
  pagination: FinancePagination
  summary: FinanceSummary
}

export type FinanceQuery = {
  section: FinanceSection
  date: string
  rangeEnd: string
  type: FinanceOperationType | "all"
  method: FinanceMethod | "all"
  refundsOnly: boolean
  page: number
  pageSize: number
  sort: { key: FinanceSortKey; direction: FinanceSortDirection }
}

export const financeSectionLabels: Record<FinanceSection, string> = { summary: "Сводка", dynamics: "Динамика", houses: "Домики", bath: "Баня и чан", venues: "Площадки", camping: "Кемпинг", programs: "Программы", events: "Мероприятия", sources: "Источники" }
export const financeOperationTypeLabels: Record<FinanceOperationType, string> = { accrual: "Начисление", payment: "Оплата", refund: "Возврат", adjustment: "Корректировка" }
export const financeMethodLabels: Record<FinanceMethod, string> = { card: "Карта", transfer: "Перевод", cash: "Наличные" }
export const financePeriodLabels: Record<FinancePeriod, string> = { today: "Сегодня", week: "Неделя", month: "Месяц", quarter: "Квартал" }
