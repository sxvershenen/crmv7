import type { Assignee, CommentThreadItem, StatusTone } from "@crm/ui"

export const programSections = ["templates", "runs", "registrations"] as const
export const programRunViews = ["table", "scheduler"] as const
export const programPeriods = ["3days", "week"] as const
export const programRunStatuses = ["draft", "planned", "registration", "full", "completed", "cancelled"] as const
export const programRegistrationStatuses = ["new", "confirmed", "paid", "visited", "cancelled"] as const
export const programTemplateSortKeys = ["name", "category", "duration", "limit", "price", "publication", "nextRun"] as const
export const programRunSortKeys = ["name", "date", "participants", "registrations", "status", "revenue", "paid", "assignee"] as const
export const programRegistrationSortKeys = ["program", "client", "price", "status", "comment", "assignee"] as const

export type ProgramSection = (typeof programSections)[number]
export type ProgramRunView = (typeof programRunViews)[number]
export type ProgramPeriod = (typeof programPeriods)[number]
export type ProgramRunStatus = (typeof programRunStatuses)[number]
export type ProgramRegistrationStatus = (typeof programRegistrationStatuses)[number]
export type ProgramTemplateSortKey = (typeof programTemplateSortKeys)[number]
export type ProgramRunSortKey = (typeof programRunSortKeys)[number]
export type ProgramRegistrationSortKey = (typeof programRegistrationSortKeys)[number]
export type ProgramSortKey = ProgramTemplateSortKey | ProgramRunSortKey | ProgramRegistrationSortKey
export type ProgramSortDirection = "asc" | "desc"
export type ProgramCategoryIcon = "campfire" | "leaf" | "palette" | "snowflake" | "sparkles"
export type ProgramCategoryTone = "amber" | "emerald" | "violet" | "sky" | "rose"

export type ProgramCategory = {
  id: string
  version?: number
  name: string
  description: string
  icon: ProgramCategoryIcon
  tone: ProgramCategoryTone
  templateCount: number
}

export type ProgramCategoryEditorRecord = ProgramCategory & { relatedTemplates: ProgramTemplate[] }

export type ProgramTemplate = {
  id: string
  name: string
  version: number
  updatedAt: string
  categoryId: string
  categoryName: string
  categoryIcon: ProgramCategoryIcon
  categoryTone: ProgramCategoryTone
  durationMinutes: number
  participantLimit: number
  basePrice: number
  assignees: Assignee[]
  published: boolean
  nextRun: { id: string; startsAt: string } | null
  capabilities?: {
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canArchive: boolean
    canChangeStatus: boolean
  }
}

export type ProgramTemplateStage = {
  comment: string
  durationMinutes: number
  id: string
  name: string
}

export type ProgramTemplateEditorRecord = ProgramTemplate & {
  description: string
  minimumParticipants: number | null
  registrationCloseHours: number | null
  relatedRuns: ProgramRun[]
  stages: ProgramTemplateStage[]
}

export type ProgramRun = {
  id: string
  templateId: string
  name: string
  categoryId: string
  categoryIcon: ProgramCategoryIcon
  categoryTone: ProgramCategoryTone
  startsAt: string
  endsAt: string
  participantCount: number
  participantLimit: number
  registrationCount: number
  registrationLimit: number
  status: ProgramRunStatus
  revenue: number
  paid: number
  assignees: Assignee[]
}

export type ProgramRunEditorRegistration = ProgramRegistration & {
  discount: number
  paid: number
  participantCount: number | null
  participantNames: string
  promo: string
  source: string
}

export type ProgramRunResourceOption = {
  capacity: number
  category: string
  id: string
  name: string
  version: number
}

export type ProgramRunResourceBooking = {
  endAt: string
  guestCount: number
  id: string
  resourceId: string
  resourceName: string
  startAt: string
}

export type ProgramRunEditorRecord = ProgramRun & {
  comment: string
  registrations: ProgramRunEditorRegistration[]
  resourceBookings: ProgramRunResourceBooking[]
}

export type ProgramRegistration = {
  id: string
  runId: string
  programName: string
  programStartsAt: string
  categoryIcon: ProgramCategoryIcon
  categoryTone: ProgramCategoryTone
  clientName: string
  phone: string
  total: number
  debt: number
  status: ProgramRegistrationStatus
  comment: string
  assignees: Assignee[]
}

export type ProgramRegistrationPaymentMethod = "cash" | "card" | "transfer"
export type ProgramRegistrationPaymentKind = "payment" | "refund"

export type ProgramRegistrationPayment = {
  amount: number
  comment: string
  date: string
  id: string
  kind: ProgramRegistrationPaymentKind
  method: ProgramRegistrationPaymentMethod
  sourcePaymentId?: string
}

export type ProgramRegistrationEditorRecord = ProgramRunEditorRegistration & {
  customerId: string | null
  internalComments: CommentThreadItem[]
  payments: ProgramRegistrationPayment[]
  run: ProgramRun | null
}

export type ProgramQuery = {
  section: ProgramSection
  category: string
  status: string
  date: string
  rangeEnd: string
  sort: { key: ProgramSortKey; direction: ProgramSortDirection }
}

export type ProgramsDataset = {
  categories: ProgramCategory[]
  templates: ProgramTemplate[]
  runs: ProgramRun[]
  registrations: ProgramRegistration[]
}

export const programSectionLabels: Record<ProgramSection, string> = {
  templates: "Шаблоны",
  runs: "Проведения",
  registrations: "Регистрации",
}

export const programRunStatusMeta: Record<ProgramRunStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Черновик", tone: "neutral" },
  planned: { label: "Запланировано", tone: "info" },
  registration: { label: "Идёт регистрация", tone: "success" },
  full: { label: "Мест нет", tone: "warning" },
  completed: { label: "Завершено", tone: "neutral" },
  cancelled: { label: "Отменено", tone: "danger" },
}

export const programRegistrationStatusMeta: Record<ProgramRegistrationStatus, { label: string; tone: StatusTone }> = {
  new: { label: "Новая", tone: "info" },
  confirmed: { label: "Подтверждена", tone: "success" },
  paid: { label: "Оплачена", tone: "success" },
  visited: { label: "Посетил", tone: "neutral" },
  cancelled: { label: "Отменена", tone: "neutral" },
}
