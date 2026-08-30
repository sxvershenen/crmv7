import type { Assignee } from "@crm/ui"

import type { CrmEvent, EventCategory, EventCategoryEditorRecord, EventEditorRecord, EventQuery, EventResourceOption, EventSortKey, EventStatus, EventsDataset } from "@app/entities/events"
import { bookingResourcesFixture } from "@app/fixtures/bookings"
import { eventAssigneesFixture, eventCategoriesFixture, eventsFixture } from "@app/fixtures/events"
import { apiClient } from "@app/lib/api-client"
import { EventDtoSchema, SessionUserSchema } from "@crm/contracts"
import { z } from "zod"

export interface EventsRepository {
  list(query: EventQuery): Promise<EventsDataset>
  updateStatus(id: string, status: EventStatus): Promise<CrmEvent>
  assign(id: string, assignee: Assignee): Promise<CrmEvent>
}

export interface EventEditorRepository {
  get(id: string): Promise<EventEditorRecord | null>
  listCategories(): Promise<EventCategory[]>
  listResources(): Promise<EventResourceOption[]>
  save(event: EventEditorRecord): Promise<EventEditorRecord>
}

export interface EventCategoryEditorRepository {
  getCategory(id: string): Promise<EventCategoryEditorRecord | null>
  saveCategory(category: EventCategoryEditorRecord): Promise<EventCategoryEditorRecord>
}

export function createEmptyEventCategory(): EventCategoryEditorRecord {
  return { id: "new", name: "Новая категория", description: "", icon: "heart", tone: "rose", eventCount: 0, relatedEvents: [] }
}

function toEditorRecord(event: CrmEvent): EventEditorRecord {
  return {
    ...structuredClone(event),
    clientComment: "Просим предусмотреть место для детской зоны.",
    internalComments: [{ id: `event-comment-${event.id}-1`, author: "Марина Кириллова", createdLabel: "Сегодня, 13:48", text: "Клиент подтвердил тайминг и количество гостей." }, { id: `event-comment-${event.id}-2`, author: "Алексей Воронов", createdLabel: "23 авг, 18:12", text: "Согласовал базовый сценарий с ведущим." }],
    paymentOperations: event.paid > 0 ? [{ id: `event-payment-${event.id}-1`, amount: event.paid, date: "2026-08-23", kind: "payment", method: "card" }] : [],
    resourceBookings: [
      { id: `event-resource-${event.id}-1`, resourceId: "house-lake", resourceName: "Дом у озера с очень длинным названием", startsAt: event.startsAt, endsAt: event.endsAt, guestCount: Math.min(event.guestCount, 8) },
      { id: `event-resource-${event.id}-2`, resourceId: "camp-north", resourceName: "Кемпинг Север", startsAt: event.startsAt, endsAt: event.endsAt, guestCount: Math.min(event.guestCount, 16) },
    ],
    scenarioStages: [
      { id: `event-stage-${event.id}-1`, name: "Подготовка площадки и проверка оборудования", durationMinutes: 60, comment: "Ответственный приезжает заранее" },
      { id: `event-stage-${event.id}-2`, name: "Встреча и регистрация гостей", durationMinutes: 30, comment: "Два стола у главного входа" },
      { id: `event-stage-${event.id}-3`, name: "Основная программа", durationMinutes: 150, comment: "Заложен резерв 15 минут" },
    ],
  }
}

function toListRecord(record: EventEditorRecord): CrmEvent {
  const event: Partial<EventEditorRecord> = structuredClone(record)
  delete event.clientComment
  delete event.internalComments
  delete event.paymentOperations
  delete event.resourceBookings
  delete event.scenarioStages
  return event as CrmEvent
}

export function createEmptyEvent(category = eventCategoriesFixture[0]): EventEditorRecord {
  const now = new Date()
  now.setSeconds(0, 0)
  const end = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const selected = category ?? { id: "", name: "Без категории", icon: "heart" as const, tone: "rose" as const }
  return {
    id: "new", name: "Новое мероприятие", categoryId: selected.id, categoryName: selected.name, categoryIcon: selected.icon, categoryTone: selected.tone,
    clientName: "", phone: "", startsAt: now.toISOString(), endsAt: end.toISOString(), guestCount: 1, status: "in_work", total: 0, paid: 0,
    requiresAction: false, hasConflict: false, assignees: [], clientComment: "", internalComments: [{ id: "event-new-comment", author: "Марина Кириллова", createdLabel: "Сегодня, 13:48", text: "Демонстрационный комментарий для проверки длинной ленты." }], paymentOperations: [], resourceBookings: [], scenarioStages: [],
  }
}

const collator = new Intl.Collator("ru-RU", { numeric: true, sensitivity: "base" })
const sortValue: Record<EventSortKey, (item: CrmEvent) => string | number> = {
  name: (item) => item.name,
  client: (item) => item.clientName,
  date: (item) => item.startsAt,
  guests: (item) => item.guestCount,
  status: (item) => item.status,
  payment: (item) => item.total ? item.paid / item.total : 0,
  risk: (item) => Number(item.hasConflict),
  assignee: (item) => item.assignees[0]?.name ?? "",
}

function compare(left: string | number, right: string | number) {
  return typeof left === "number" && typeof right === "number" ? left - right : collator.compare(String(left), String(right))
}

export function selectEvents(source: CrmEvent[], query: EventQuery) {
  const cutoffDate = new Date(`${query.date}T12:00:00`)
  cutoffDate.setDate(cutoffDate.getDate() + 3)
  const nearestCutoff = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`
  const filtered = source.filter((item) => {
    if (query.status !== "all" && item.status !== query.status) return false
    if (query.category !== "all" && item.categoryId !== query.category) return false
    if (query.assignee !== "all" && !item.assignees.some((person) => person.id === query.assignee)) return false
    if (query.requiresAction && !item.requiresAction) return false
    if (query.unpaid && item.paid >= item.total) return false
    if (query.conflict && !item.hasConflict) return false
    const date = item.startsAt.slice(0, 10)
    if (query.nearest && date > nearestCutoff) return false
    return date >= query.date && date <= query.rangeEnd
  })
  const sign = query.sort.direction === "asc" ? 1 : -1
  return filtered.sort((left, right) => compare(sortValue[query.sort.key](left), sortValue[query.sort.key](right)) * sign)
}

export class FixtureEventsRepository implements EventsRepository, EventEditorRepository, EventCategoryEditorRepository {
  private events = structuredClone(eventsFixture)
  private categories = structuredClone(eventCategoriesFixture)
  private editorData = new Map<string, EventEditorRecord>()
  private categoryEditorData = new Map<string, EventCategoryEditorRecord>()

  async list(query: EventQuery): Promise<EventsDataset> {
    const counts = { in_work: 0, booked: 0, completed: 0, cancelled: 0, archived: 0 } satisfies Record<EventStatus, number>
    for (const event of this.events) counts[event.status] += 1
    return Promise.resolve({
      categories: structuredClone(this.categories),
      assignees: structuredClone(eventAssigneesFixture),
      counts,
      events: structuredClone(selectEvents(this.events, query)),
    })
  }

  async updateStatus(id: string, status: EventStatus) {
    const event = this.events.find((item) => item.id === id)
    if (!event) throw new Error("Мероприятие не найдено")
    event.status = status
    return Promise.resolve(structuredClone(event))
  }

  async assign(id: string, assignee: Assignee) {
    const event = this.events.find((item) => item.id === id)
    if (!event) throw new Error("Мероприятие не найдено")
    if (!event.assignees.some((item) => item.id === assignee.id)) event.assignees.push(structuredClone(assignee))
    return Promise.resolve(structuredClone(event))
  }

  async get(id: string) {
    const cached = this.editorData.get(id)
    if (cached) return Promise.resolve(structuredClone(cached))
    const event = this.events.find((item) => item.id === id)
    if (!event) return Promise.resolve(null)
    const editor = toEditorRecord(event)
    this.editorData.set(id, editor)
    return Promise.resolve(structuredClone(editor))
  }

  async listCategories() { return Promise.resolve(structuredClone(this.categories)) }

  async listResources(): Promise<EventResourceOption[]> {
    return Promise.resolve(bookingResourcesFixture.map(({ capacity, category, id, name }) => ({ capacity, category, id, name })))
  }

  async save(event: EventEditorRecord) {
    const next = structuredClone(event)
    this.editorData.set(next.id, next)
    const flat = toListRecord(next)
    const index = this.events.findIndex((item) => item.id === next.id)
    if (index >= 0) this.events[index] = flat
    else this.events.unshift(flat)
    return Promise.resolve(structuredClone(next))
  }

  async getCategory(id: string): Promise<EventCategoryEditorRecord | null> {
    const cached = this.categoryEditorData.get(id)
    if (cached) return Promise.resolve(structuredClone(cached))
    const category = this.categories.find((item) => item.id === id)
    if (!category) return Promise.resolve(null)
    const editor = { ...structuredClone(category), relatedEvents: structuredClone(this.events.filter((event) => event.categoryId === id)) }
    this.categoryEditorData.set(id, editor)
    return Promise.resolve(structuredClone(editor))
  }

  async saveCategory(category: EventCategoryEditorRecord): Promise<EventCategoryEditorRecord> {
    const next = structuredClone(category)
    next.eventCount = next.relatedEvents.length
    this.categoryEditorData.set(next.id, next)
    const flat: EventCategory = { id: next.id, name: next.name, description: next.description, icon: next.icon, tone: next.tone, eventCount: next.eventCount }
    const index = this.categories.findIndex((item) => item.id === next.id)
    if (index >= 0) this.categories[index] = flat
    else this.categories.unshift(flat)
    this.events = this.events.map((event) => event.categoryId === next.id ? { ...event, categoryIcon: next.icon, categoryName: next.name, categoryTone: next.tone } : event)
    return Promise.resolve(structuredClone(next))
  }
}

type ApiEventsClient = Pick<typeof apiClient, "get" | "getWithMeta" | "patch" | "post">
const eventPageSchema = z.object({ items: z.array(EventDtoSchema), nextCursor: z.string().nullable() }).strict()
const sessionResponseSchema = z.object({ user: SessionUserSchema }).strict()

const eventStatusToApi: Record<Exclude<EventStatus, "archived">, "inquiry" | "planning" | "booked" | "completed" | "cancelled"> = {
  in_work: "planning", booked: "booked", completed: "completed", cancelled: "cancelled",
}
const eventStatusFromApi: Record<"inquiry" | "planning" | "booked" | "completed" | "cancelled", Exclude<EventStatus, "archived">> = {
  inquiry: "in_work", planning: "in_work", booked: "booked", completed: "completed", cancelled: "cancelled",
}

function operationId() { return crypto.randomUUID() }
function idempotencyKey(scope: string) { return `${scope}-${crypto.randomUUID()}` }
function dateTimeStart(date: string) { return `${date}T00:00:00.000Z` }
function dateTimeEnd(date: string) { return `${date}T23:59:59.999Z` }
function assigneeFromId(id: string) { return { id, initials: id.slice(0, 2).toUpperCase(), name: id, colorClass: "bg-slate-100 text-slate-700" } }
function mapCategory(id: string | null): EventCategory {
  return { id: id ?? "uncategorized", name: id ?? "Без категории", description: "", icon: "heart", tone: "rose", eventCount: 0 }
}

function mapEvent(dto: ReturnType<typeof EventDtoSchema.parse>): CrmEvent {
  return {
    id: dto.id, name: dto.name, categoryId: dto.categoryId ?? "uncategorized", categoryName: dto.categoryId ?? "Без категории", categoryIcon: "heart", categoryTone: "rose",
    clientName: dto.customerId ?? "Без клиента", phone: dto.phone, startsAt: dto.startsAt, endsAt: dto.endsAt, guestCount: dto.guestCount,
    status: dto.archived ? "archived" : eventStatusFromApi[dto.status], total: dto.total.amountMinor / 100, paid: dto.paid.amountMinor / 100,
    requiresAction: dto.requiresAction, hasConflict: dto.hasConflict, assignees: dto.assigneeIds.map(assigneeFromId),
  }
}

export class ApiEventsRepository implements EventsRepository {
  private readonly records = new Map<string, ReturnType<typeof EventDtoSchema.parse>>()
  constructor(private readonly client: ApiEventsClient = apiClient) {}

  async list(query: EventQuery): Promise<EventsDataset> {
    const archived = query.status === "archived"
    const status = query.status !== "all" && query.status !== "archived" ? eventStatusToApi[query.status] : undefined
    const base = new URLSearchParams({ archived: String(archived), from: dateTimeStart(query.date), to: dateTimeEnd(query.rangeEnd), limit: "100" })
    if (status) base.set("status", status)
    if (query.category !== "all") base.set("categoryId", query.category)
    if (query.requiresAction) base.set("requiresAction", "true")
    if (query.unpaid) base.set("unpaid", "true")
    const allQuery = new URLSearchParams({ archived: String(archived), from: dateTimeStart(query.date), to: dateTimeEnd(query.rangeEnd), limit: "100" })
    const [items, allItems, session] = await Promise.all([
      this.listAll(`/events?${base.toString()}`),
      this.listAll(`/events?${allQuery.toString()}`),
      this.client.get("/auth/session", sessionResponseSchema),
    ])
    for (const dto of [...items, ...allItems]) this.records.set(dto.id, dto)
    const events = selectEvents(items.map(mapEvent), query)
    const counts = { in_work: 0, booked: 0, completed: 0, cancelled: 0, archived: 0 } satisfies Record<EventStatus, number>
    for (const item of allItems.map(mapEvent)) counts[item.status] += 1
    const assigneeIds = new Set(allItems.flatMap((item) => item.assigneeIds))
    assigneeIds.add(session.user.id)
    return { categories: this.categories(allItems.map(mapEvent)), events, assignees: [...assigneeIds].map(assigneeFromId), counts }
  }

  async updateStatus(id: string, status: EventStatus) {
    if (status === "archived") throw new Error("Архивирование мероприятия выполняется отдельной операцией")
    const current = await this.dto(id)
    const updated = await this.client.post(`/events/${encodeURIComponent(id)}/transition`, { version: current.version, operationId: operationId(), idempotencyKey: idempotencyKey(`event-transition-${id}`), status: eventStatusToApi[status] }, EventDtoSchema)
    this.records.set(updated.id, updated)
    return mapEvent(updated)
  }

  async assign(id: string, assignee: Assignee) {
    const current = await this.dto(id)
    const updated = await this.client.patch(`/events/${encodeURIComponent(id)}`, { version: current.version, operationId: operationId(), idempotencyKey: idempotencyKey(`event-assignee-${id}`), assigneeIds: [assignee.id] }, EventDtoSchema)
    this.records.set(updated.id, updated)
    return mapEvent(updated)
  }

  private async dto(id: string) { return this.records.get(id) ?? await this.client.get(`/events/${encodeURIComponent(id)}`, EventDtoSchema) }

  private categories(events: CrmEvent[]) {
    const categories = new Map<string, EventCategory>()
    for (const event of events) {
      const category = categories.get(event.categoryId) ?? mapCategory(event.categoryId)
      category.eventCount += 1
      categories.set(event.categoryId, category)
    }
    return [...categories.values()]
  }

  private async listAll(path: string): Promise<ReturnType<typeof EventDtoSchema.parse>[]> {
    const items: ReturnType<typeof EventDtoSchema.parse>[] = []
    const basePath = path
    for (let page = 0; page < 100; page += 1) {
      const response = await this.client.getWithMeta(path, eventPageSchema)
      items.push(...response.data.items)
      const cursor = response.headers.get("x-next-cursor") ?? response.data.nextCursor
      if (!cursor) return items
      path = `${basePath}&cursor=${encodeURIComponent(cursor)}`
    }
    throw new Error("Не удалось загрузить все мероприятия")
  }
}

export const eventsRepository: EventsRepository & EventEditorRepository & EventCategoryEditorRepository = new FixtureEventsRepository()
export const apiEventsRepository: EventsRepository = new ApiEventsRepository()
