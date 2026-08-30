import type { Assignee, StatusTone } from "@crm/ui"

export const taskViews = ["dashboard", "kanban", "table", "problems", "archive"] as const
export const taskStatuses = ["todo", "in_progress", "review", "done"] as const
export const taskPriorities = ["low", "normal", "high", "urgent"] as const
export const taskRelationTypes = ["lead", "booking", "customer", "program", "event", "internal"] as const
export const taskOrders = ["dueAsc", "priorityDesc", "createdDesc"] as const
export const taskSortKeys = ["title", "due", "relation", "priority", "status", "assignee"] as const

export type TaskView = (typeof taskViews)[number]
export type TaskStatus = (typeof taskStatuses)[number]
export type TaskPriority = (typeof taskPriorities)[number]
export type TaskRelationType = (typeof taskRelationTypes)[number]
export type TaskOrder = (typeof taskOrders)[number]
export type TaskSortKey = (typeof taskSortKeys)[number]
export type TaskSortDirection = "asc" | "desc"

export type TaskRelation = {
  type: TaskRelationType
  label: string
  href: string
}

export type CrmTask = {
  id: string
  title: string
  details: string
  status: TaskStatus
  priority: TaskPriority
  dueAt: string | null
  dueLabel: string
  createdAt: string
  relation: TaskRelation
  assignees: Assignee[]
  commentCount: number
  latestComment: string | null
  blocked: boolean
  archived: boolean
}

export type TaskEditorRecord = CrmTask & {
  reminderMinutes: string
}

export type TaskQuery = {
  view: TaskView
  assignee: "all" | "mine" | "unassigned"
  priority: TaskPriority | "all"
  relation: TaskRelationType | "all"
  order: TaskOrder
  sort: { key: TaskSortKey; direction: TaskSortDirection } | null
}

export const taskViewLabels: Record<TaskView, string> = {
  dashboard: "Дашборд",
  kanban: "Канбан",
  table: "Таблица",
  problems: "Проблемы",
  archive: "Архив",
}

export const taskStatusMeta: Record<TaskStatus, { label: string; tone: StatusTone }> = {
  todo: { label: "Задачи", tone: "neutral" },
  in_progress: { label: "В работе", tone: "info" },
  review: { label: "Проверка", tone: "warning" },
  done: { label: "Выполнено", tone: "success" },
}

export const taskPriorityMeta: Record<TaskPriority, { label: string; tone: StatusTone }> = {
  low: { label: "Низкий", tone: "neutral" },
  normal: { label: "Обычный", tone: "info" },
  high: { label: "Высокий", tone: "warning" },
  urgent: { label: "Срочно", tone: "danger" },
}

export const taskRelationLabels: Record<TaskRelationType, string> = {
  lead: "Заявка",
  booking: "Бронирование",
  customer: "Клиент",
  program: "Программа",
  event: "Мероприятие",
  internal: "Внутренняя",
}

export const taskOrderLabels: Record<TaskOrder, string> = {
  dueAsc: "Сначала ближайшие",
  priorityDesc: "Сначала важные",
  createdDesc: "Сначала новые",
}

export function isTaskOverdue(task: CrmTask, reference?: Date | number) {
  const now = reference instanceof Date ? reference : new Date()
  return task.status !== "done" && task.dueAt !== null && new Date(task.dueAt).getTime() < now.getTime()
}

export function isTaskProblem(task: CrmTask) {
  return isTaskOverdue(task) || task.blocked || task.assignees.length === 0
}
