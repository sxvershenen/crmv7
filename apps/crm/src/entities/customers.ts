import type { Assignee } from "@crm/ui"

export const customerTypes = ["person", "company", "organizer"] as const
export const customerFlags = ["active", "debt", "duplicates", "archive"] as const
export const customerSortKeys = ["client", "leads", "bookings", "tasks", "turnover", "debt", "duplicateRisk", "nextContact", "assignee"] as const
export const customerChannels = ["Сайт", "Телефон", "Telegram", "VK", "Email"] as const

export type CustomerType = (typeof customerTypes)[number]
export type CustomerFlag = (typeof customerFlags)[number]
export type CustomerSortKey = (typeof customerSortKeys)[number]
export type CustomerSortDirection = "asc" | "desc"
export type CustomerDuplicateRisk = "none" | "possible" | "high"
export type CustomerChannel = (typeof customerChannels)[number]

export type Customer = {
  id: string
  name: string
  phone: string
  type: CustomerType
  channels: CustomerChannel[]
  leadCount: number
  activeLeadCount: number
  bookingCount: number
  futureBookingCount: number
  taskCount: number
  turnover: number
  debt: number
  duplicateRisk: CustomerDuplicateRisk
  nextContactAt: string | null
  nextContactLabel: string | null
  lastVisitDaysAgo: number
  hasActive: boolean
  archived: boolean
  assignees: Assignee[]
}

export type CustomerQuery = {
  type: CustomerType | "all"
  channel: CustomerChannel | "all"
  flags: CustomerFlag[]
  lastVisitDays: 30 | 60 | 90 | null
  sort: { key: CustomerSortKey; direction: CustomerSortDirection }
}

export const customerTypeLabels: Record<CustomerType, string> = {
  person: "Физлицо",
  company: "Компания",
  organizer: "Организатор",
}

export const customerFlagLabels: Record<CustomerFlag, string> = {
  active: "Есть активные",
  debt: "Есть долг",
  duplicates: "Есть риск дубля",
  archive: "Архивные",
}

export const duplicateRiskLabels: Record<CustomerDuplicateRisk, string> = {
  none: "Нет признаков",
  possible: "Возможный дубль",
  high: "Высокий риск",
}
