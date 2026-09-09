import type { Assignee } from "@crm/ui"

import type { CrmEvent, EventCategory, EventCategoryEditorRecord, EventEditorRecord, EventQuery, EventResourceBooking, EventResourceOption, EventSortKey, EventStatus, EventsDataset } from "@app/entities/events"
import { bookingResourcesFixture } from "@app/fixtures/bookings"
import { eventAssigneesFixture, eventCategoriesFixture, eventsFixture } from "@app/fixtures/events"
import { ApiClientError, apiClient } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"
import { CustomerDtoSchema, EventCategoryDetailSchema, EventCategorySchema, EventDtoSchema, PaymentListResponseSchema, ResourceAllocationDtoSchema, ResourceDtoSchema, SessionUserSchema } from "@crm/contracts"
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
    return Promise.resolve(bookingResourcesFixture.map(({ capacity, category, id, name }) => ({ capacity, category, id, name, version: 1 })))
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
const eventCategoryPageSchema = z.object({ items: z.array(EventCategorySchema), nextCursor: z.string().nullable() }).strict()

const eventStatusToApi: Record<Exclude<EventStatus, "archived">, "inquiry" | "planning" | "booked" | "completed" | "cancelled"> = {
  in_work: "planning", booked: "booked", completed: "completed", cancelled: "cancelled",
}
const eventStatusFromApi: Record<"inquiry" | "planning" | "booked" | "completed" | "cancelled", Exclude<EventStatus, "archived">> = {
  inquiry: "in_work", planning: "in_work", booked: "booked", completed: "completed", cancelled: "cancelled",
}

function operationId() { return crypto.randomUUID() }
function idempotencyKey(scope: string) { return `${scope}-${crypto.randomUUID()}` }
function canonicalId(value: string | null | undefined) { return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null }
function dateTimeStart(date: string) { return `${date}T00:00:00.000Z` }
function dateTimeEnd(date: string) { return `${date}T23:59:59.999Z` }
function assigneeFromId(id: string) { return { id, initials: id.slice(0, 2).toUpperCase(), name: id, colorClass: "bg-slate-100 text-slate-700" } }
function mapApiCategory(dto: ReturnType<typeof EventCategorySchema.parse>): EventCategory {
  return { id: dto.id, version: dto.version, name: dto.name, description: dto.description, icon: dto.icon, tone: dto.tone, eventCount: dto.eventCount }
}

function mapApiCategoryDetail(dto: ReturnType<typeof EventCategoryDetailSchema.parse>): EventCategoryEditorRecord {
  return { ...mapApiCategory(dto), relatedEvents: dto.relatedEvents.map((event) => ({ id: event.id, name: event.name, categoryId: dto.id, categoryName: dto.name, categoryIcon: dto.icon, categoryTone: dto.tone, clientName: event.clientName, phone: "", startsAt: event.startsAt, endsAt: event.startsAt, guestCount: 0, status: "in_work", total: 0, paid: 0, requiresAction: false, hasConflict: false, assignees: [] })) }
}

function mapEvent(dto: ReturnType<typeof EventDtoSchema.parse>, category?: EventCategory): CrmEvent {
  return {
    id: dto.id, name: dto.name, categoryId: dto.categoryId ?? "uncategorized", categoryName: category?.name ?? dto.categoryId ?? "Без категории", categoryIcon: category?.icon ?? "heart", categoryTone: category?.tone ?? "rose",
    clientName: dto.customerId ?? "Без клиента", phone: dto.phone, startsAt: dto.startsAt, endsAt: dto.endsAt, guestCount: dto.guestCount,
    status: dto.archived ? "archived" : eventStatusFromApi[dto.status], total: dto.total.amountMinor / 100, paid: dto.paid.amountMinor / 100,
    requiresAction: dto.requiresAction, hasConflict: dto.hasConflict, assignees: dto.assigneeIds.map(assigneeFromId),
  }
}

function toApiEditorRecord(dto: ReturnType<typeof EventDtoSchema.parse>, resourceBookings: EventResourceBooking[] = [], paymentOperations: EventEditorRecord["paymentOperations"] = []): EventEditorRecord {
  const event = mapEvent(dto)
  return {
    ...event,
    clientComment: dto.comment,
    internalComments: [],
    paymentOperations,
    resourceBookings,
    scenarioStages: dto.scenario.map((stage) => ({ ...stage })),
  }
}

export class ApiEventsRepository implements EventsRepository, EventEditorRepository, EventCategoryEditorRepository {
  private readonly records = new Map<string, ReturnType<typeof EventDtoSchema.parse>>()
  constructor(private readonly client: ApiEventsClient = apiClient) {}

  async list(query: EventQuery): Promise<EventsDataset> {
    const archived = query.status === "archived"
    const status = query.status !== "all" && query.status !== "archived" ? eventStatusToApi[query.status] : undefined
    const base = new URLSearchParams({ archived: String(archived), from: dateTimeStart(query.date), to: dateTimeEnd(query.rangeEnd), limit: "100" })
    // UI groups canonical inquiry and planning as one "in_work" state. Let
    // the client-side selector combine both instead of dropping inquiries.
    if (status && query.status !== "in_work") base.set("status", status)
    if (query.category !== "all") base.set("categoryId", query.category)
    if (query.requiresAction) base.set("requiresAction", "true")
    if (query.unpaid) base.set("unpaid", "true")
    const allQuery = new URLSearchParams({ archived: String(archived), from: dateTimeStart(query.date), to: dateTimeEnd(query.rangeEnd), limit: "100" })
    const [items, allItems, session, categories] = await Promise.all([
      this.listAll(`/events?${base.toString()}`),
      this.listAll(`/events?${allQuery.toString()}`),
      this.client.get("/auth/session", sessionResponseSchema),
      this.listCategories(),
    ])
    for (const dto of [...items, ...allItems]) this.records.set(dto.id, dto)
    const categoryById = new Map(categories.map((category) => [category.id, category]))
    const events = selectEvents(items.map((dto) => mapEvent(dto, categoryById.get(dto.categoryId ?? ""))), query)
    const counts = { in_work: 0, booked: 0, completed: 0, cancelled: 0, archived: 0 } satisfies Record<EventStatus, number>
    for (const item of allItems.map((dto) => mapEvent(dto, categoryById.get(dto.categoryId ?? "")))) counts[item.status] += 1
    const assigneeIds = new Set(allItems.flatMap((item) => item.assigneeIds))
    assigneeIds.add(session.user.id)
    return { categories, events, assignees: [...assigneeIds].map(assigneeFromId), counts }
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

  async get(id: string): Promise<EventEditorRecord | null> {
    const dto = await this.dto(id).catch((error) => {
      if (error instanceof ApiClientError && error.status === 404) return null
      throw error
    })
    if (!dto) return null
    return toApiEditorRecord(dto, await this.listResourceBookings(dto.id), await this.listPayments(dto.id))
  }

  async listCategories(): Promise<EventCategory[]> {
    return (await this.listAllCategories("/events/categories?archived=false&limit=100")).map(mapApiCategory)
  }

  async listResources(): Promise<EventResourceOption[]> {
    const resources = await this.client.get("/resources?archived=false&limit=100", ResourceDtoSchema.array())
    return Array.isArray(resources) ? resources.map((resource) => ({ id: resource.id, name: resource.name, category: resource.kind, capacity: resource.capacityTotal, version: resource.version })) : []
  }

  async save(record: EventEditorRecord): Promise<EventEditorRecord> {
    const money = (value: number) => ({ amountMinor: Math.round(value * 100), currency: "RUB" })
    const current = record.id === "new" ? null : await this.dto(record.id)
    const customerId = await this.resolveCustomerId(record, current?.customerId ?? null)
    const common = {
      name: record.name,
      categoryId: canonicalId(record.categoryId === "uncategorized" ? null : record.categoryId),
      customerId,
      phone: record.phone,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      guestCount: Math.max(0, record.guestCount),
      total: money(record.total),
      comment: record.clientComment,
      requiresAction: record.requiresAction,
      assigneeIds: record.assignees.map((assignee) => assignee.id),
      scenario: record.scenarioStages.map(({ id, name, durationMinutes, comment }) => ({ ...(canonicalId(id) ? { id } : {}), name, durationMinutes, comment })),
    }
    let updated = record.id === "new"
      ? await this.client.post("/events", { ...common, status: record.status === "booked" ? "booked" : record.status === "completed" ? "completed" : record.status === "cancelled" ? "cancelled" : "inquiry", operationId: operationId(), idempotencyKey: idempotencyKey("event-create") }, EventDtoSchema)
      : await this.client.patch(`/events/${encodeURIComponent(record.id)}`, { ...common, version: current!.version, operationId: operationId(), idempotencyKey: idempotencyKey(`event-${record.id}`) }, EventDtoSchema)
    this.records.set(updated.id, updated)
    if (record.id !== "new" && record.status !== "archived" && eventStatusFromApi[updated.status] !== record.status) {
      updated = await this.client.post(`/events/${encodeURIComponent(updated.id)}/transition`, { version: updated.version, operationId: operationId(), idempotencyKey: idempotencyKey(`event-transition-${updated.id}`), status: eventStatusToApi[record.status] }, EventDtoSchema)
      this.records.set(updated.id, updated)
    }
    if (record.status === "archived" && !updated.archived) {
      updated = await this.client.post(`/events/${encodeURIComponent(updated.id)}/archive`, { version: updated.version, operationId: operationId(), idempotencyKey: idempotencyKey(`event-archive-${updated.id}`) }, EventDtoSchema)
      this.records.set(updated.id, updated)
    }
    await this.reconcileResourceBookings(updated.id, record.resourceBookings)
    await this.reconcilePayments(updated.id, record.paymentOperations)
    const authoritative = await this.dto(updated.id)
    return toApiEditorRecord(authoritative, await this.listResourceBookings(updated.id), await this.listPayments(updated.id))
  }

  private async listPayments(eventId: string): Promise<EventEditorRecord["paymentOperations"]> {
    const query = new URLSearchParams({ "target[type]": "event", "target[id]": eventId, limit: "100" })
    const page = await this.client.get(`/payments?${query.toString()}`, PaymentListResponseSchema)
    return (page?.items ?? []).map((payment) => ({ id: payment.id, amount: payment.amount.amountMinor / 100, date: payment.createdAt.slice(0, 10), kind: payment.type === "refund" ? "refund" : "payment", method: payment.method === "cash" || payment.method === "bank_transfer" ? payment.method === "bank_transfer" ? "transfer" : "cash" : "card", ...(payment.sourcePaymentId ? { sourcePaymentId: payment.sourcePaymentId } : {}) }))
  }

  private async reconcilePayments(eventId: string, desired: EventEditorRecord["paymentOperations"]) {
    const persisted = await this.listPayments(eventId)
    const existing = new Set(persisted.map((payment) => payment.id))
    const temp = desired.filter((payment) => !existing.has(payment.id))
    const ids = new Map<string, string>()
    for (const payment of temp.filter((payment) => payment.kind === "payment")) {
      const current = await this.refreshDto(eventId)
      const saved = await this.client.post("/payments", { target: { type: "event", id: eventId }, type: "charge", amount: { amountMinor: Math.round(payment.amount * 100), currency: "RUB" }, method: payment.method === "transfer" ? "bank_transfer" : payment.method, reason: null, sourcePaymentId: null, expectedVersion: current.version, operationId: operationId(), idempotencyKey: idempotencyKey(`event-payment-${eventId}`) }, PaymentListResponseSchema.shape.items.element)
      ids.set(payment.id, saved.id)
    }
    for (const payment of temp.filter((payment) => payment.kind === "refund")) {
      const sourcePaymentId = payment.sourcePaymentId ? ids.get(payment.sourcePaymentId) ?? payment.sourcePaymentId : undefined
      if (!sourcePaymentId) throw new Error("Для возврата нужна сохранённая исходная оплата")
      const current = await this.refreshDto(eventId)
      await this.client.post("/payments", { target: { type: "event", id: eventId }, type: "refund", amount: { amountMinor: Math.round(payment.amount * 100), currency: "RUB" }, method: payment.method === "transfer" ? "bank_transfer" : payment.method, reason: null, sourcePaymentId, expectedVersion: current.version, operationId: operationId(), idempotencyKey: idempotencyKey(`event-refund-${eventId}`) }, PaymentListResponseSchema.shape.items.element)
    }
  }

  private async listResourceBookings(sourceId: string): Promise<EventResourceBooking[]> {
    const [allocations, resources] = await Promise.all([
      this.client.get(`/resources/allocations?sourceType=event&sourceId=${encodeURIComponent(sourceId)}&includeCancelled=false`, ResourceAllocationDtoSchema.array()),
      this.listResources(),
    ])
    const names = new Map(resources.map((resource) => [resource.id, resource.name]))
    return Array.isArray(allocations) ? allocations.map((allocation) => ({ id: allocation.id, resourceId: allocation.resourceId, resourceName: names.get(allocation.resourceId) ?? allocation.resourceId, startsAt: allocation.startAt, endsAt: allocation.endAt, guestCount: allocation.quantity })) : []
  }

  private async reconcileResourceBookings(sourceId: string, desired: EventEditorRecord["resourceBookings"]) {
    const current = await this.client.get(`/resources/allocations?sourceType=event&sourceId=${encodeURIComponent(sourceId)}&includeCancelled=false`, ResourceAllocationDtoSchema.array())
    const activeAllocations = Array.isArray(current) ? current : []
    const desiredIds = new Set(desired.filter((booking) => {
      const existing = activeAllocations.find((item) => item.id === booking.id)
      return Boolean(existing && existing.resourceId === booking.resourceId && existing.startAt === booking.startsAt && existing.endAt === booking.endsAt && existing.quantity === booking.guestCount)
    }).map((booking) => booking.id))
    for (const allocation of activeAllocations.filter((item) => !desiredIds.has(item.id))) {
      const resource = (await this.listResources()).find((item) => item.id === allocation.resourceId)
      if (!resource) continue
      await this.client.post(`/resources/allocations/${encodeURIComponent(allocation.id)}/cancel`, { expectedVersion: resource.version, operationId: operationId(), idempotencyKey: idempotencyKey(`event-allocation-cancel-${allocation.id}`) }, ResourceAllocationDtoSchema)
    }
    for (const booking of desired) {
      if (desiredIds.has(booking.id)) continue
      const resource = (await this.listResources()).find((item) => item.id === booking.resourceId)
      if (!resource) throw new Error("Выбранный ресурс недоступен")
      await this.client.post("/resources/allocations", { resourceId: resource.id, sourceType: "event", sourceId, startAt: booking.startsAt, endAt: booking.endsAt, quantity: booking.guestCount, capacityImpact: booking.guestCount, status: "tentative", operationId: operationId(), expectedVersion: resource.version, overrideConflict: false }, ResourceAllocationDtoSchema)
    }
  }

  async getCategory(id: string): Promise<EventCategoryEditorRecord | null> {
    if (id === "new") return null
    return mapApiCategoryDetail(await this.client.get(`/events/categories/${encodeURIComponent(id)}`, EventCategoryDetailSchema))
  }
  async saveCategory(category: EventCategoryEditorRecord): Promise<EventCategoryEditorRecord> {
    const common = { name: category.name, description: category.description, icon: category.icon, tone: category.tone, operationId: operationId(), idempotencyKey: idempotencyKey("event-category") }
    const response = category.id === "new"
      ? await this.client.post("/events/categories", common, EventCategoryDetailSchema)
      : await this.client.patch(`/events/categories/${encodeURIComponent(category.id)}`, { ...common, version: category.version ?? 1 }, EventCategoryDetailSchema)
    return mapApiCategoryDetail(response)
  }

  private async resolveCustomerId(record: EventEditorRecord, fallback: string | null) {
    const search = record.phone.trim() || record.clientName.trim()
    if (!search) return fallback
    try {
      const candidates = await this.client.get(`/customers?search=${encodeURIComponent(search)}&archived=false&limit=100`, CustomerDtoSchema.array())
      if (!Array.isArray(candidates)) return fallback
      const match = candidates.find((customer) => customer.name === record.clientName || customer.phones.includes(record.phone))
      return match?.id ?? fallback
    } catch {
      return fallback
    }
  }

  private async dto(id: string) {
    const cached = this.records.get(id)
    if (cached) return cached
    const value = await this.client.get(`/events/${encodeURIComponent(id)}`, EventDtoSchema)
    this.records.set(value.id, value)
    return value
  }
  private async refreshDto(id: string) {
    const value = await this.client.get(`/events/${encodeURIComponent(id)}`, EventDtoSchema)
    this.records.set(value.id, value)
    return value
  }

  private async listAllCategories(path: string) {
    const items: ReturnType<typeof EventCategorySchema.parse>[] = []
    const basePath = path
    for (let page = 0; page < 100; page += 1) {
      const response = await this.client.getWithMeta(path, eventCategoryPageSchema)
      items.push(...response.data.items)
      const cursor = response.headers.get("x-next-cursor") ?? response.data.nextCursor
      if (!cursor) return items
      path = `${basePath}&cursor=${encodeURIComponent(cursor)}`
    }
    throw new Error("Не удалось загрузить категории мероприятий")
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

export type FullEventsRepository = EventsRepository & EventEditorRepository & EventCategoryEditorRepository
export const fixtureEventsRepository: FullEventsRepository = new FixtureEventsRepository()
export const apiEventsRepository: FullEventsRepository = new ApiEventsRepository()
export const eventsRepository: FullEventsRepository = useFixtureData ? fixtureEventsRepository : apiEventsRepository
