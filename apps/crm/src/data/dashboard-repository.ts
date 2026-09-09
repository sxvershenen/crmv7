import type { DashboardData, DashboardItem, DashboardScope } from "@app/entities/dashboard"
import { dashboardFixture } from "@app/fixtures/dashboard"
import { BookingDtoSchema, BookingProjectionResponseSchema, EventDtoSchema, LeadDtoSchema, ProgramOccurrenceDtoSchema, SessionUserSchema, TaskDtoSchema } from "@crm/contracts"
import type { Assignee } from "@crm/ui"
import { z } from "zod"

import { apiClient } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"

export interface DashboardRepository {
  assign(item: DashboardItem): Promise<void>
  getOverview(scope: DashboardScope): Promise<DashboardData>
}

function filterData(data: DashboardData, scope: DashboardScope): DashboardData {
  if (scope === "all") return structuredClone(data)

  const filterSections = (sections: DashboardData["attention"]) =>
    sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.assignedToMe),
      }))
      .filter((section) => section.items.length > 0)

  return {
    attention: filterSections(data.attention),
    today: filterSections(data.today),
  }
}

export class FixtureDashboardRepository implements DashboardRepository {
  private readonly data = structuredClone(dashboardFixture)

  async getOverview(scope: DashboardScope): Promise<DashboardData> {
    return Promise.resolve(filterData(this.data, scope))
  }

  async assign(item: DashboardItem) {
    const candidate = [...this.data.attention, ...this.data.today]
      .flatMap((section) => section.items)
      .find((entry) => entry.id === item.id)
    if (!candidate) throw new Error("Запись не найдена")
    candidate.assignedToMe = true
    if (!candidate.assignees.some((person) => person.id === "demo-manager")) {
      candidate.assignees = [...candidate.assignees, { id: "demo-manager", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }]
    }
  }
}

export type ApiDashboardRepositoryOptions = {
  client?: Pick<typeof apiClient, "get" | "post">
  now?: () => Date
}

type ApiDashboardClient = Pick<typeof apiClient, "get" | "post">

const eventListSchema = z.object({ items: z.array(EventDtoSchema), nextCursor: z.string().nullable() }).strict()
const sessionSchema = z.object({ user: SessionUserSchema }).strict()

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
}

function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00`)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

function dateTimeLabel(value: string | null | undefined) {
  if (!value) return ""
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

function timeLabel(value: string | null | undefined) {
  if (!value) return ""
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

function dateOnlyLabel(value: string | null | undefined) {
  if (!value) return ""
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(new Date(value))
}

function assignees(value: Array<{ id: string; initials: string; name: string }> | undefined): Assignee[] {
  return (value ?? []).map((person) => ({ id: person.id, initials: person.initials, name: person.name }))
}

function assignedToMe(value: Array<{ id: string }> | Array<string> | undefined, currentUserId: string | null) {
  return Boolean(currentUserId && value?.some((person) => (typeof person === "string" ? person : person.id) === currentUserId))
}

function payment(paid: number, total: number) {
  return total > paid ? { paid, total } : undefined
}

export class ApiDashboardRepository implements DashboardRepository {
  private readonly client: ApiDashboardClient
  private readonly now: () => Date

  constructor(options: ApiDashboardRepositoryOptions = {}) {
    this.client = options.client ?? apiClient
    this.now = options.now ?? (() => new Date())
  }

  async assign(item: DashboardItem) {
    if (item.assignment?.kind === "unsupported") throw new Error(item.assignment.reason)
    if (!item.assignment || item.assignment.kind !== "self") throw new Error("Назначение недоступно")

    if (item.assignment.entityType === "lead") {
      await this.client.post(`/leads/${encodeURIComponent(item.entityId)}/assign-self`, { version: item.assignment.version }, LeadDtoSchema)
    } else if (item.assignment.entityType === "task") {
      await this.client.post(`/tasks/${encodeURIComponent(item.entityId)}/assign-self`, { version: item.assignment.version }, TaskDtoSchema)
    } else {
      await this.client.post(`/bookings/${encodeURIComponent(item.entityId)}/assign-self`, { expectedVersion: item.assignment.version, operationId: crypto.randomUUID(), idempotencyKey: `dashboard-booking-assign-${crypto.randomUUID()}` }, BookingDtoSchema)
    }
  }

  async getOverview(scope: DashboardScope): Promise<DashboardData> {
    const today = dateKey(this.now())
    const rangeEnd = addDays(today, 365)
    const currentUserId = scope === "mine" ? (await this.client.get("/auth/session", sessionSchema)).user.id : null
    const [tasks, leads, bookingProjection, eventPage, occurrencePage] = await Promise.all([
      this.client.get("/tasks?archived=false&limit=100&order=dueAsc", TaskDtoSchema.array()),
      this.client.get("/leads?archived=false&limit=100&order=nextContactAsc", LeadDtoSchema.array()),
      this.client.get(`/bookings/projection?date=${today}&rangeEnd=${rangeEnd}&category=all&resource=all&source=all&amountFrom=0&debtFrom=0&utm=all&promo=all&conflictOnly=false&overpayOnly=false&sort=arrival&order=asc`, BookingProjectionResponseSchema),
      this.client.get(`/events?from=${today}T00%3A00%3A00.000Z&to=${addDays(today, 1)}T00%3A00%3A00.000Z&archived=false&limit=100`, eventListSchema),
      this.client.get(`/programs/occurrences?from=${today}T00%3A00%3A00.000Z&to=${addDays(today, 1)}T00%3A00%3A00.000Z&archived=false&limit=100`, zPage(ProgramOccurrenceDtoSchema)),
    ])

    const now = this.now()
    const attention = [
      section("conflicts", "Конфликты", "conflict", "danger", bookingProjection.bookings.filter((booking) => booking.hasConflict).map((booking) => this.bookingItem(booking, "conflict", today, currentUserId))),
      section("overdue-leads", "Просроченные заявки", "lead", "warning", leads.filter((lead) => lead.nextContactAt && new Date(lead.nextContactAt) < now).map((lead) => this.leadItem(lead, "overdue", currentUserId))),
      section("debts", "Неоплачено и долги", "payment", "warning", bookingProjection.bookings.filter((booking) => booking.amount > booking.paid && booking.paymentState !== "paid").map((booking) => this.bookingItem(booking, "debt", today, currentUserId))),
      section("overdue-tasks", "Просроченные задачи", "task", "task", tasks.filter((task) => task.dueAt && new Date(task.dueAt) < now && !["completed", "cancelled", "done"].includes(task.status)).map((task) => this.taskItem(task, currentUserId))),
      section("cancellations", "Отмены", "cancel", "neutral", bookingProjection.bookings.filter((booking) => booking.status === "cancelled").map((booking) => this.bookingItem(booking, "cancelled", today, currentUserId))),
    ].filter((item): item is NonNullable<typeof item> => item !== null)
    const todaySections = [
      section("new-leads", "Новые заявки", "lead", "info", leads.filter((lead) => lead.status === "new" && dateKey(new Date(lead.createdAt)) === today).map((lead) => this.leadItem(lead, "new", currentUserId))),
      section("arrivals", "Заезды сегодня", "arrival", "stay", bookingProjection.bookings.filter((booking) => booking.startAt.slice(0, 10) === today).map((booking) => this.bookingItem(booking, "arrival", today, currentUserId))),
      section("departures", "Выезды сегодня", "exit", "stay", bookingProjection.bookings.filter((booking) => booking.endAt.slice(0, 10) === today).map((booking) => this.bookingItem(booking, "departure", today, currentUserId))),
      section("programs", "Программы сегодня", "program", "program", occurrencePage.items.filter((run) => run.startsAt.slice(0, 10) === today).map((run) => this.programItem(run, currentUserId))),
      section("events", "Мероприятия сегодня", "event", "event", eventPage.items.filter((event) => event.startsAt.slice(0, 10) === today).map((event) => this.eventItem(event, currentUserId))),
    ].filter((item): item is NonNullable<typeof item> => item !== null)

    return filterData({ attention, today: todaySections }, scope)
  }

  private bookingItem(booking: ReturnType<typeof BookingProjectionResponseSchema.parse>["bookings"][number], variant: "conflict" | "debt" | "cancelled" | "arrival" | "departure", today: string, currentUserId: string | null): DashboardData["attention"][number]["items"][number] {
    const date = variant === "departure" ? booking.endAt : booking.startAt
    const isToday = date.slice(0, 10) === today
    const paidSummary = payment(booking.paid, booking.amount)
    return {
      id: `${variant}-${booking.id}`,
      entityId: booking.id,
      href: `/bookings/${booking.id}`,
      title: `#${booking.code} · ${booking.clientName}`,
      subtitle: variant === "conflict" ? "Нужна проверка пересечения" : variant === "cancelled" ? "Бронь отменена" : `${booking.resourceName || "Без ресурса"} · ${booking.guestCount} человек`,
      ...(variant === "conflict" ? { detail: "Интервал пересекается с другой ресурсной операцией" } : {}),
      primaryMeta: variant === "departure" ? timeLabel(booking.endAt) : timeLabel(booking.startAt),
      secondaryMeta: isToday ? "Сегодня" : dateOnlyLabel(date),
      contentSummary: { value: booking.resourceName || "Без ресурса", peopleCount: booking.guestCount },
      assignees: assignees(booking.assignees),
      assignedToMe: assignedToMe(booking.assignees, currentUserId),
      assignment: { kind: "self" as const, entityType: "booking" as const, version: booking.version },
      ...(paidSummary ? { payment: paidSummary } : {}),
      ...(variant === "conflict" ? { badge: { label: "Конфликт", tone: "conflict" as const } } : variant === "cancelled" ? { badge: { label: "Отмена", tone: "neutral" as const } } : {}),
    }
  }

  private leadItem(lead: ReturnType<typeof LeadDtoSchema.parse>, variant: "overdue" | "new", currentUserId: string | null) {
    return {
      id: `${variant}-${lead.id}`, entityId: lead.id, href: `/leads/${lead.id}`,
      title: `#${lead.id} · ${lead.name}`,
      subtitle: variant === "new" && !lead.desiredStartAt ? "Дата ещё не определена" : variant === "new" ? dateTimeLabel(lead.desiredStartAt) : "Нужна обработка заявки",
      ...(lead.requestedItem ? { contentSummary: { value: lead.requestedItem, ...(lead.guestCount > 0 ? { peopleCount: lead.guestCount } : {}) } } : {}),
      ...(lead.nextContactAt ? { primaryMeta: dateTimeLabel(lead.nextContactAt) } : {}),
      ...(lead.nextContactAt && variant === "overdue" ? { secondaryMeta: "контакт" } : {}),
      assignees: assignees(lead.assignees), assignedToMe: assignedToMe(lead.assignees, currentUserId), assignment: { kind: "self" as const, entityType: "lead" as const, version: lead.version },
      ...(variant === "overdue" ? { badge: { label: "Просрочено", tone: "danger" as const } } : {}),
    }
  }

  private taskItem(task: ReturnType<typeof TaskDtoSchema.parse>, currentUserId: string | null) {
    return { id: `task-${task.id}`, entityId: task.id, href: `/tasks/${task.id}`, title: task.title, subtitle: `#${task.id}`, primaryMeta: dateTimeLabel(task.dueAt), secondaryMeta: "срок", assignees: assignees(task.assignees), assignedToMe: assignedToMe(task.assignees, currentUserId), assignment: { kind: "self" as const, entityType: "task" as const, version: task.version }, badge: { label: "Просрочено", tone: "danger" as const } }
  }

  private programItem(run: ReturnType<typeof ProgramOccurrenceDtoSchema.parse>, currentUserId: string | null) {
    return { id: `program-${run.id}`, entityId: run.id, href: `/programs/runs/${run.id}`, title: run.name, subtitle: timeLabel(run.startsAt), contentSummary: { value: `${run.registrationCount} регистрации`, peopleCount: run.participantCount }, assignees: [], assignedToMe: assignedToMe(run.assigneeIds, currentUserId), assignment: { kind: "unsupported" as const, reason: "Назначение проведения пока недоступно из обзора" } }
  }

  private eventItem(event: ReturnType<typeof EventDtoSchema.parse>, currentUserId: string | null) {
    return { id: `event-${event.id}`, entityId: event.id, href: `/events/${event.id}`, title: event.name, subtitle: timeLabel(event.startsAt), contentSummary: { value: "Мероприятие", peopleCount: event.guestCount }, assignees: [], assignedToMe: assignedToMe(event.assigneeIds, currentUserId), assignment: { kind: "unsupported" as const, reason: "Назначение мероприятия пока недоступно из обзора" }, ...(event.requiresAction ? { badge: { label: "Нужно действие", tone: "warning" as const } } : {}) }
  }
}

function zPage<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), nextCursor: z.string().nullable() }).strict()
}

function section(id: string, title: string, iconKey: DashboardData["attention"][number]["iconKey"], tone: DashboardData["attention"][number]["tone"], items: DashboardData["attention"][number]["items"]) {
  return items.length === 0 ? null : { id, title, iconKey, tone, column: ["new-leads", "arrivals", "departures", "programs", "events"].includes(id) ? "today" as const : "attention" as const, items }
}

export const fixtureDashboardRepository: DashboardRepository = new FixtureDashboardRepository()
export const dashboardRepository: DashboardRepository = useFixtureData ? fixtureDashboardRepository : new ApiDashboardRepository()
