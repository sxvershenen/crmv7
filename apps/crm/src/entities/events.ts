import type { Assignee, CommentThreadItem, StatusTone } from "@crm/ui"
import type { EventOrderQuoteResult, EventPricingMode } from "@crm/contracts"

export const eventStatuses = ["in_work", "booked", "completed", "cancelled", "archived"] as const
export const eventStatusFilters = ["all", ...eventStatuses] as const
export const eventViews = ["table", "scheduler"] as const
export const eventPeriods = ["3days", "week"] as const
export const eventSortKeys = ["name", "client", "date", "guests", "status", "payment", "risk", "assignee"] as const
export const eventCategoryIcons = ["heart", "building", "cake", "bus"] as const
export const eventCategoryTones = ["rose", "violet", "amber", "sky"] as const

export type EventStatus = (typeof eventStatuses)[number]
export type EventStatusFilter = (typeof eventStatusFilters)[number]
export type EventView = (typeof eventViews)[number]
export type EventPeriod = (typeof eventPeriods)[number]
export type EventSortKey = (typeof eventSortKeys)[number]
export type EventSortDirection = "asc" | "desc"
export type EventCategoryIcon = (typeof eventCategoryIcons)[number]
export type EventCategoryTone = (typeof eventCategoryTones)[number]

export type EventCategory = {
  id: string
  version?: number
  name: string
  description: string
  icon: EventCategoryIcon
  tone: EventCategoryTone
  eventCount: number
}

export type EventCategoryEditorRecord = EventCategory & { relatedEvents: CrmEvent[] }

export type CrmEvent = {
  id: string
  version?: number
  name: string
  categoryId: string
  categoryName: string
  categoryIcon: EventCategoryIcon
  categoryTone: EventCategoryTone
  commercialOfferingId?: string | null
  pricingMode?: EventPricingMode
  ratePlanKey?: string | null
  addOnSelections?: Array<{ assignmentId: string; quantity: number }>
  resourceSelections?: Array<{ resourceId: string }>
  acceptedQuote?: EventOrderQuoteResult | null
  clientName: string
  phone: string
  startsAt: string
  endsAt: string
  guestCount: number
  status: EventStatus
  total: number
  paid: number
  requiresAction: boolean
  hasConflict: boolean
  assignees: Assignee[]
}

export type EventScenarioStage = { id: string; name: string; durationMinutes: number; comment: string }
export type EventResourceOption = { id: string; name: string; category: string; capacity: number; version: number }
export type EventResourceBooking = { id: string; resourceId: string; resourceName: string; startsAt: string; endsAt: string; guestCount: number }
export type EventPaymentOperation = { id: string; amount: number; date: string; kind: "payment" | "refund"; method: "card" | "cash" | "transfer"; sourcePaymentId?: string }
export type EventEditorRecord = CrmEvent & {
  clientComment: string
  internalComments: CommentThreadItem[]
  paymentOperations: EventPaymentOperation[]
  resourceBookings: EventResourceBooking[]
  scenarioStages: EventScenarioStage[]
}

export type EventOrderQuote = EventOrderQuoteResult

export type EventQuery = {
  status: EventStatusFilter
  category: string
  assignee: string
  date: string
  rangeEnd: string
  nearest: boolean
  requiresAction: boolean
  unpaid: boolean
  conflict: boolean
  sort: { key: EventSortKey; direction: EventSortDirection }
}

export type EventsDataset = {
  categories: EventCategory[]
  events: CrmEvent[]
  assignees: Assignee[]
  counts: Record<EventStatus, number>
}

export const eventStatusMeta: Record<EventStatus, { label: string; tone: StatusTone }> = {
  in_work: { label: "В работе", tone: "info" },
  booked: { label: "Бронь", tone: "warning" },
  completed: { label: "Завершено", tone: "success" },
  cancelled: { label: "Отмена", tone: "danger" },
  archived: { label: "Архив", tone: "neutral" },
}

export const eventStatusFilterLabels: Record<EventStatusFilter, string> = {
  all: "Все",
  in_work: "В работе",
  booked: "Бронь",
  completed: "Завершено",
  cancelled: "Отмена",
  archived: "Архив",
}
