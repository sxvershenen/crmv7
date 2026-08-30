import type { Assignee } from "@crm/ui"

export const leadStages = ["new", "work", "waiting", "success", "rejected", "archive"] as const
export const leadBoardStages = ["new", "work", "waiting", "success", "rejected"] as const

export type LeadStage = (typeof leadStages)[number]
export type LeadBoardStage = (typeof leadBoardStages)[number]
export type LeadScope = "all" | "mine" | "overdue"
export type LeadView = "cards" | "table"
export type LeadSortKey = "id" | "client" | "direction" | "planned" | "nextContact" | "assignee"
export type SortDirection = "asc" | "desc"

export type Lead = {
  id: string
  clientName: string
  phone: string
  requestedItem: string
  guestCount: number
  direction: string
  source: string
  promo: string
  utm: string
  plannedAt: string
  plannedLabel: string
  nextContactAt: string
  nextContactLabel: string
  assignees: Assignee[]
  assignedToMe: boolean
  overdue: boolean
  stage: LeadStage
  /** Fixture-adapter failure flag used to verify optimistic rollback without backend authority. */
  demoRejectMove?: boolean
}

export type LeadFilters = {
  scope: LeadScope
  stage: LeadStage | "all"
  direction: string
  source: string
  promo: string
  utm: string
}

export type LeadSort = {
  key: LeadSortKey
  direction: SortDirection
}

export type LeadQuery = LeadFilters & {
  sort: LeadSort
}

export const leadStageMeta: Record<LeadStage, { label: string; accentClass: string }> = {
  new: { label: "Новое", accentClass: "border-t-sky-400" },
  work: { label: "Работа", accentClass: "border-t-slate-400" },
  waiting: { label: "Ожидание", accentClass: "border-t-amber-400" },
  success: { label: "Успех", accentClass: "border-t-emerald-400" },
  rejected: { label: "Отказ", accentClass: "border-t-rose-400" },
  archive: { label: "Архив", accentClass: "border-t-zinc-400" },
}

export const leadScopeLabels: Record<LeadScope, string> = {
  all: "Все",
  mine: "Мои",
  overdue: "Просрочено",
}
