import type { Assignee, IconBoxVariant, StatusTone } from "@crm/ui"

export type DashboardScope = "all" | "mine"
export type DashboardColumn = "attention" | "today"

export type PaymentSummary = {
  paid: number
  total: number
}

export type DashboardAssignment =
  | { kind: "self"; entityType: "booking" | "lead" | "task"; version: number }
  | { kind: "unsupported"; reason: string }

export type DashboardContentSummary = {
  label?: "Хотят"
  value: string
  peopleCount?: number
}

export type DashboardItem = {
  id: string
  entityId: string
  href: string
  title: string
  subtitle: string
  detail?: string
  primaryMeta?: string
  secondaryMeta?: string
  contentSummary?: DashboardContentSummary
  assignees: Assignee[]
  assignedToMe: boolean
  assignment?: DashboardAssignment
  payment?: PaymentSummary
  badge?: {
    label: string
    tone: StatusTone
  }
}

export type DashboardSection = {
  column: DashboardColumn
  iconKey: "alert" | "cancel" | "conflict" | "event" | "exit" | "lead" | "payment" | "program" | "task" | "update" | "arrival"
  id: string
  items: DashboardItem[]
  title: string
  tone: IconBoxVariant
}

export type DashboardData = {
  attention: DashboardSection[]
  today: DashboardSection[]
}
