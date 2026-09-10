import type { Assignee } from "@crm/ui"

import type { CrmEvent, EventCategory, EventCategoryEditorRecord, EventEditorRecord, EventQuery, EventResourceBooking, EventResourceOption, EventSortKey, EventStatus, EventsDataset } from "@app/entities/events"
import { bookingResourcesFixture } from "@app/fixtures/bookings"
import { eventAssigneesFixture, eventCategoriesFixture, eventsFixture } from "@app/fixtures/events"
import { ApiClientError, apiClient } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"
import { CustomerDtoSchema, EventAllocationReplaceResultSchema, EventCategoryDetailSchema, EventCategorySchema, EventDtoSchema, EventOrderQuoteResultSchema, EventServiceTemplateRegistryResponseSchema, InternalOfferingEditorSchema, PaymentListResponseSchema, ResourceAllocationDtoSchema, ResourceDtoSchema, SessionUserSchema, type EventAllocationReplace, type EventOrderQuoteBody, type EventOrderQuoteResult, type EventServiceTemplateRegistryResponse, type InternalOfferingEditor } from "@crm/contracts"
import { z } from "zod"
import { fixtureAddOnPricing, FixtureEventServiceRepository } from "./event-services-repository"

const fixtureEventServiceRepository = new FixtureEventServiceRepository()

// Event fixtures use the booking fixture's readable keys internally, while the
// Event contract still carries UUID resource identities. Keep this translation
// local so the shared booking fixtures remain unchanged.
const eventFixtureResourceIds: Record<string, string> = {
  "house-pine": "10000000-0000-4000-8000-000000000001",
  "house-lake": "10000000-0000-4000-8000-000000000002",
  "camp-north": "10000000-0000-4000-8000-000000000003",
  "tent-meadow": "10000000-0000-4000-8000-000000000004",
  "house-birch": "10000000-0000-4000-8000-000000000005",
  "tent-river": "10000000-0000-4000-8000-000000000006",
  "bath-main": "10000000-0000-4000-8000-000000000007",
  "venue-meadow": "10000000-0000-4000-8000-000000000008",
}
const eventFixtureResourceKeys = new Map(Object.entries(eventFixtureResourceIds).map(([key, id]) => [id, key]))
const eventFixtureResourceModes: Record<string, "fixed" | "shared"> = {
  "house-pine": "fixed",
  "house-lake": "fixed",
  "camp-north": "shared",
  "tent-meadow": "shared",
  "house-birch": "fixed",
  "tent-river": "shared",
  "bath-main": "fixed",
  "venue-meadow": "fixed",
}

export function eventFixtureResourceId(resourceKey: string) {
  return eventFixtureResourceIds[resourceKey] ?? resourceKey
}

export function eventFixtureResourceKey(resourceId: string) {
  return eventFixtureResourceKeys.get(resourceId) ?? resourceId
}

type FixtureEventAllocation = {
  id: string
  eventId: string
  resourceId: string
  startAt: string
  endAt: string
  quantity: number
  capacityImpact: number
  status: "accepted" | "cancelled"
}

export interface EventsRepository {
  list(query: EventQuery): Promise<EventsDataset>
  updateStatus(id: string, status: EventStatus): Promise<CrmEvent>
  assign(id: string, assignee: Assignee): Promise<CrmEvent>
}

export interface EventEditorRepository {
  get(id: string): Promise<EventEditorRecord | null>
  listCategories(): Promise<EventCategory[]>
  listResources(): Promise<EventResourceOption[]>
  listCommercialOfferings?(): Promise<EventServiceTemplateRegistryResponse>
  getCommercialOffering?(offeringId: string): Promise<InternalOfferingEditor | null>
  save(event: EventEditorRecord): Promise<EventEditorRecord>
  quote?(eventId: string, input: Pick<EventOrderQuoteBody, "ratePlanKey" | "currency" | "addOns" | "resourceSelections">): Promise<EventOrderQuoteResult>
  acceptQuote?(eventId: string, quoteSnapshotId: string): Promise<EventEditorRecord>
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
    ...(event.resourceSelections === undefined ? {} : { resourceSelections: event.resourceSelections.map((selection) => ({ resourceId: eventFixtureResourceId(selection.resourceId) })) }),
    clientComment: "Просим предусмотреть место для детской зоны.",
    internalComments: [{ id: `event-comment-${event.id}-1`, author: "Марина Кириллова", createdLabel: "Сегодня, 13:48", text: "Клиент подтвердил тайминг и количество гостей." }, { id: `event-comment-${event.id}-2`, author: "Алексей Воронов", createdLabel: "23 авг, 18:12", text: "Согласовал базовый сценарий с ведущим." }],
    paymentOperations: event.paid > 0 ? [{ id: `event-payment-${event.id}-1`, amount: event.paid, date: "2026-08-23", kind: "payment", method: "card" }] : [],
    resourceBookings: [
      { id: `event-resource-${event.id}-1`, resourceId: eventFixtureResourceId("house-lake"), resourceName: "Дом у озера с очень длинным названием", startsAt: event.startsAt, endsAt: event.endsAt, guestCount: Math.min(event.guestCount, 8) },
      { id: `event-resource-${event.id}-2`, resourceId: eventFixtureResourceId("camp-north"), resourceName: "Кемпинг Север", startsAt: event.startsAt, endsAt: event.endsAt, guestCount: Math.min(event.guestCount, 16) },
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
  private quotes = new Map<string, EventOrderQuoteResult>()
  private resourceAllocations = new Map<string, FixtureEventAllocation[]>()
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
    const editor = this.editorData.get(id)
    if (editor) editor.status = status
    if (status === "cancelled") this.releaseEventResources(id)
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
    return Promise.resolve(bookingResourcesFixture.map(({ capacity, category, id, name }) => ({ capacity, category, id: eventFixtureResourceId(id), name, version: 1 })))
  }

  async listCommercialOfferings() { return fixtureEventServiceRepository.list({ state: "active", limit: 100 }) }

  async getCommercialOffering(offeringId: string) { return (await fixtureEventServiceRepository.getByOfferingId(offeringId))?.editor ?? null }

  async save(event: EventEditorRecord) {
    const next = structuredClone(event)
    if (next.id === "new") {
      next.id = crypto.randomUUID()
      next.version = 1
    } else {
      const previous = this.editorData.get(next.id)
      next.version = (previous?.version ?? next.version ?? 1) + 1
    }
    this.editorData.set(next.id, next)
    const flat = toListRecord(next)
    const index = this.events.findIndex((item) => item.id === next.id)
    if (index >= 0) this.events[index] = flat
    else this.events.unshift(flat)
    return Promise.resolve(structuredClone(next))
  }

  async quote(eventId: string, input: Pick<EventOrderQuoteBody, "ratePlanKey" | "currency" | "addOns" | "resourceSelections">): Promise<EventOrderQuoteResult> {
    const event = this.editorData.get(eventId) ?? await this.get(eventId)
    if (!event || event.pricingMode !== "quote_required" || !event.commercialOfferingId) throw new Error("Для этого мероприятия серверный расчёт недоступен")
    if (event.ratePlanKey !== input.ratePlanKey || JSON.stringify(event.addOnSelections ?? []) !== JSON.stringify(input.addOns) || JSON.stringify(event.resourceSelections ?? []) !== JSON.stringify(input.resourceSelections)) throw new Error("Состав мероприятия изменился. Сохраните изменения заново")
    const linked = await fixtureEventServiceRepository.getByOfferingId(event.commercialOfferingId)
    const resources = await this.listResources()
    const resourceById = new Map(resources.map((resource) => [resource.id, resource]))
    const resourcePins = input.resourceSelections.map((selection) => {
      if (eventFixtureResourceModes[eventFixtureResourceKey(selection.resourceId)] !== "fixed") throw new Error("Ресурсы с общей вместимостью пока не поддерживаются для этого заказа")
      const resource = resourceById.get(selection.resourceId)
      if (!resource) throw new Error("Выбранный ресурс недоступен")
      return { resourceId: resource.id, version: resource.version }
    })
    const assignments = linked?.editor.addOnAssignments.filter((assignment) => assignment.enabled) ?? []
    const assignmentById = new Map(assignments.map((assignment) => [assignment.id, assignment]))
    const selectedIds = new Set<string>()
    const addOnLines: EventOrderQuoteResult["lines"] = []
    const addOnProvenance: NonNullable<EventOrderQuoteResult["provenance"]>["addOns"] = []
    let addOnTotal = 0
    for (const selection of input.addOns) {
      if (selectedIds.has(selection.assignmentId)) throw new Error("Дополнительную услугу можно выбрать только один раз")
      selectedIds.add(selection.assignmentId)
      const assignment = assignmentById.get(selection.assignmentId)
      const pricing = assignment ? fixtureAddOnPricing[assignment.addOnOfferingId] : undefined
      if (!assignment || !pricing) throw new Error("Выбранная дополнительная услуга недоступна")
      const minimum = assignment.minQuantityOverride ?? 1
      const maximum = assignment.maxQuantityOverride ?? Number.MAX_SAFE_INTEGER
      if (selection.quantity < minimum || selection.quantity > maximum) throw new Error("Количество дополнительной услуги вне допустимого диапазона")
      if (pricing.serviceType === "person_service" && selection.quantity !== event.guestCount) throw new Error("Количество услуги на гостя должно совпадать с числом гостей")
      const serviceQuantity = selection.quantity
      const amountMinor = pricing.unitAmount * serviceQuantity
      addOnTotal += amountMinor
      addOnLines.push({ kind: "addon", label: pricing.label, serviceDate: "", quantity: serviceQuantity, unitAmount: { amountMinor: pricing.unitAmount, currency: input.currency }, amount: { amountMinor, currency: input.currency }, ratePlanId: pricing.ratePlanId, ratePlanVersion: 1, matchedRuleId: null, matchedRuleVersion: null, addOnAssignmentId: assignment.id, addOnOfferingId: assignment.addOnOfferingId, explanation: pricing.serviceType === "person_service" ? "per_person" : "per_unit" })
      addOnProvenance.push({ assignmentId: assignment.id, addOnOfferingId: assignment.addOnOfferingId, serviceType: pricing.serviceType, offeringVersion: 1, pricingVersion: 1, assignmentVersion: assignment.version, priceBookId: pricing.priceBookId, priceBookVersion: 1, businessCalendarId: "11111111-1111-4111-8111-111111111111", businessCalendarVersion: 1 })
    }
    const requiredMissing = assignments.some((assignment) => assignment.required && !selectedIds.has(assignment.id))
    if (requiredMissing) throw new Error("Не выбраны обязательные дополнительные услуги")
    const preview = await fixtureEventServiceRepository.previewQuote(event.commercialOfferingId, {
      quoteType: "event_service_preview", startsAt: event.startsAt, endsAt: event.endsAt, guests: event.guestCount, currency: input.currency, ratePlanKey: input.ratePlanKey,
      addOns: [], operationId: crypto.randomUUID(), idempotencyKey: `fixture-event-quote-${eventId}`,
    })
    const result = EventOrderQuoteResultSchema.parse({
      ...preview, quoteType: "event_order", acceptanceReady: true, eventId, eventVersion: event.version ?? 1, total: { amountMinor: preview.total.amountMinor + addOnTotal, currency: input.currency },
      inputs: { ...preview.inputs, addOns: input.addOns, resourceSelections: input.resourceSelections },
      lines: [...preview.lines, ...addOnLines.map((line) => ({ ...line, serviceDate: preview.inputs.serviceDate }))],
      provenance: { ...preview.provenance, addOns: addOnProvenance, resourceSelections: resourcePins }, immutableSnapshot: true,
    })
    this.quotes.set(result.quoteId, result)
    return structuredClone(result)
  }

  async acceptQuote(eventId: string, quoteSnapshotId: string): Promise<EventEditorRecord> {
    const current = this.editorData.get(eventId) ?? await this.get(eventId)
    if (!current) throw new Error("Мероприятие не найдено")
    const quote = this.quotes.get(quoteSnapshotId)
    if (!quote || quote.eventId !== eventId) throw new Error("Снимок расчёта не найден")
    if ((current.version ?? 1) !== quote.eventVersion || current.status === "booked") throw new Error("Расчёт устарел. Рассчитайте стоимость заново")
    if (Date.parse(quote.validUntil) <= Date.now()) throw new Error("Срок действия расчёта истёк. Рассчитайте стоимость заново")
    const resources = await this.listResources()
    const resourceById = new Map(resources.map((resource) => [resource.id, resource]))
    const allocations = quote.inputs.resourceSelections.map((selection) => {
      const resource = resourceById.get(selection.resourceId)
      if (!resource || quote.provenance.resourceSelections.find((pin) => pin.resourceId === selection.resourceId)?.version !== resource.version) throw new Error("Снимок ресурса устарел. Рассчитайте стоимость заново")
      const startAt = quote.provenance.preparationStartsAt
      const endAt = quote.provenance.preparationEndsAt
      const quantity = 1
      if (this.hasResourceConflict(selection.resourceId, startAt, endAt)) throw new Error("Выбранный ресурс уже занят в этом интервале")
      return { id: crypto.randomUUID(), eventId, resourceId: selection.resourceId, startAt, endAt, quantity, capacityImpact: quantity, status: "accepted" as const }
    })
    const resourceNames = new Map(resources.map((resource) => [resource.id, resource.name]))
    const acceptedResourceBookings: EventResourceBooking[] = allocations.map((allocation) => ({ id: allocation.id, resourceId: allocation.resourceId, resourceName: resourceNames.get(allocation.resourceId) ?? allocation.resourceId, startsAt: allocation.startAt, endsAt: allocation.endAt, guestCount: allocation.quantity }))
    const accepted = { ...current, status: "booked" as const, version: (current.version ?? 1) + 1, total: quote.total.amountMinor / 100, acceptedQuote: quote, resourceBookings: acceptedResourceBookings }
    this.resourceAllocations.set(eventId, allocations)
    this.editorData.set(eventId, accepted)
    const index = this.events.findIndex((item) => item.id === eventId)
    if (index >= 0) this.events[index] = toListRecord(accepted)
    return structuredClone(accepted)
  }

  private hasResourceConflict(resourceId: string, startAt: string, endAt: string) {
    const start = Date.parse(startAt)
    const end = Date.parse(endAt)
    return [...this.resourceAllocations.values()].flat().some((allocation) => allocation.status === "accepted" && allocation.resourceId === resourceId && start < Date.parse(allocation.endAt) && end > Date.parse(allocation.startAt))
  }

  private releaseEventResources(eventId: string) {
    const allocations = this.resourceAllocations.get(eventId)
    if (allocations) this.resourceAllocations.set(eventId, allocations.map((allocation) => ({ ...allocation, status: "cancelled" as const })))
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
    id: dto.id, version: dto.version, name: dto.name, categoryId: dto.categoryId ?? "uncategorized", categoryName: category?.name ?? dto.categoryId ?? "Без категории", categoryIcon: category?.icon ?? "heart", categoryTone: category?.tone ?? "rose", commercialOfferingId: dto.commercialOfferingId, pricingMode: dto.pricingMode, ratePlanKey: dto.ratePlanKey, addOnSelections: dto.addOnSelections, resourceSelections: dto.resourceSelections, acceptedQuote: dto.acceptedQuote,
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
  private readonly commandIntents = new Map<string, { fingerprint: string; operationId: string; idempotencyKey: string; expectedVersion?: number }>()
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

  async listCommercialOfferings() {
    return this.client.get("/event-services?state=active&limit=100", EventServiceTemplateRegistryResponseSchema)
  }

  async getCommercialOffering(offeringId: string) {
    try { return await this.client.get(`/offerings/${encodeURIComponent(offeringId)}/editor`, InternalOfferingEditorSchema) }
    catch (error) { if (error instanceof ApiClientError && error.status === 404) return null; throw error }
  }

  async save(record: EventEditorRecord): Promise<EventEditorRecord> {
    const money = (value: number) => ({ amountMinor: Math.round(value * 100), currency: "RUB" })
    const current = record.id === "new" ? null : await this.refreshDto(record.id)
    const chainScopes = new Set<string>()
    const customerId = await this.resolveCustomerId(record, current?.customerId ?? null)
    const priced = record.pricingMode === "quote_required"
    const common = {
      name: record.name,
      categoryId: canonicalId(record.categoryId === "uncategorized" ? null : record.categoryId),
      commercialOfferingId: record.commercialOfferingId ?? null,
      ratePlanKey: record.ratePlanKey ?? null,
      addOnSelections: record.addOnSelections ?? [],
      resourceSelections: record.resourceSelections ?? [],
      customerId,
      phone: record.phone,
      startsAt: record.startsAt,
      endsAt: record.endsAt,
      guestCount: Math.max(0, record.guestCount),
      ...(priced ? {} : { total: money(record.total) }),
      comment: record.clientComment,
      requiresAction: record.requiresAction,
      assigneeIds: record.assignees.map((assignee) => assignee.id),
      scenario: record.scenarioStages.map(({ id, name, durationMinutes, comment }) => ({ ...(canonicalId(id) ? { id } : {}), name, durationMinutes, comment })),
    }
    const desiredStatus = record.status === "in_work" || record.status === "archived" ? "planning" : eventStatusToApi[record.status]
    let updated: ReturnType<typeof EventDtoSchema.parse>
    if (record.id === "new") {
      const createShape = { ...common, pricingMode: record.pricingMode ?? "legacy_manual", currency: "RUB", status: desiredStatus }
      const createScope = "event-create"
      chainScopes.add(createScope)
      const intent = this.commandIntent(createScope, createShape)
      updated = await this.client.post("/events", { ...createShape, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey }, EventDtoSchema)
    } else {
      const saveScope = `event-save:${record.id}`
      chainScopes.add(saveScope)
      const intent = this.commandIntent(saveScope, common, current!.version)
      updated = await this.client.patch(`/events/${encodeURIComponent(record.id)}`, { ...common, version: intent.expectedVersion ?? current!.version, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey }, EventDtoSchema)
    }
    this.records.set(updated.id, updated)
    const transitionScope = record.id !== "new" && record.status !== "archived" ? `event-save-transition:${updated.id}:${desiredStatus}` : null
    if (transitionScope) chainScopes.add(transitionScope)
    if (transitionScope && eventStatusFromApi[updated.status] !== record.status) {
      const transitionShape = { status: desiredStatus }
      const intent = this.commandIntent(transitionScope, transitionShape, updated.version)
      updated = await this.client.post(`/events/${encodeURIComponent(updated.id)}/transition`, { version: intent.expectedVersion ?? updated.version, ...transitionShape, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey }, EventDtoSchema)
      this.records.set(updated.id, updated)
    }
    const archiveScope = record.status === "archived" ? `event-save-archive:${updated.id}` : null
    if (archiveScope) chainScopes.add(archiveScope)
    if (archiveScope && !updated.archived) {
      const archiveShape = { archived: true }
      const intent = this.commandIntent(archiveScope, archiveShape, updated.version)
      updated = await this.client.post(`/events/${encodeURIComponent(updated.id)}/archive`, { version: intent.expectedVersion ?? updated.version, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey }, EventDtoSchema)
      this.records.set(updated.id, updated)
    }
    if (record.pricingMode !== "quote_required") {
      chainScopes.add(`event-allocation-replace:${updated.id}`)
      await this.reconcileResourceBookings(updated.id, record.resourceBookings, updated.version)
    }
    await this.reconcilePayments(updated.id, record.paymentOperations)
    const authoritative = await this.dto(updated.id)
    const resourceBookings = await this.listResourceBookings(updated.id)
    const paymentOperations = await this.listPayments(updated.id)
    for (const scope of chainScopes) this.commandIntents.delete(scope)
    return toApiEditorRecord(authoritative, resourceBookings, paymentOperations)
  }

  async quote(eventId: string, input: Pick<EventOrderQuoteBody, "ratePlanKey" | "currency" | "addOns" | "resourceSelections">) {
    let current = await this.refreshDto(eventId)
    if (current.status === "inquiry") {
      const planningScope = `event-quote-planning:${eventId}`
      const planningShape = { status: "planning" as const }
      const planningIntent = this.commandIntent(planningScope, planningShape, current.version)
      const planned = await this.client.post(`/events/${encodeURIComponent(eventId)}/transition`, { version: planningIntent.expectedVersion ?? current.version, ...planningShape, operationId: planningIntent.operationId, idempotencyKey: planningIntent.idempotencyKey }, EventDtoSchema)
      this.commandIntents.delete(planningScope)
      this.records.set(planned.id, planned)
      current = planned
    } else {
      this.commandIntents.delete(`event-quote-planning:${eventId}`)
    }
    const scope = `event-quote:${eventId}`
    const shape = { ...input, eventId, quoteType: "event_order" as const }
    const intent = this.commandIntent(scope, shape, current.version)
    const request = { ...shape, expectedEventVersion: intent.expectedVersion ?? current.version }
    const result = await this.client.post(`/events/${encodeURIComponent(eventId)}/quote`, { ...request, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey }, EventOrderQuoteResultSchema)
    this.commandIntents.delete(scope)
    return result
  }

  async acceptQuote(eventId: string, quoteSnapshotId: string) {
    const current = await this.refreshDto(eventId)
    const shape = { status: "booked" as const, quoteAcceptance: { quoteSnapshotId } }
    const scope = `event-quote-accept:${eventId}`
    const intent = this.commandIntent(scope, shape, current.version)
    const input = { version: intent.expectedVersion ?? current.version, ...shape }
    const updated = await this.client.post(`/events/${encodeURIComponent(eventId)}/transition`, { ...input, operationId: intent.operationId, idempotencyKey: intent.idempotencyKey }, EventDtoSchema)
    this.records.set(updated.id, updated)
    const resourceBookings = await this.listResourceBookings(updated.id)
    const paymentOperations = await this.listPayments(updated.id)
    this.commandIntents.delete(scope)
    return toApiEditorRecord(updated, resourceBookings, paymentOperations)
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

  private async reconcileResourceBookings(sourceId: string, desired: EventEditorRecord["resourceBookings"], expectedEventVersion: number) {
    const current = await this.client.get(`/resources/allocations?sourceType=event&sourceId=${encodeURIComponent(sourceId)}&includeCancelled=false`, ResourceAllocationDtoSchema.array())
    const activeAllocations = Array.isArray(current) ? current : []
    const sortAllocation = (left: { resourceId: string; startAt: string; endAt: string; quantity: number; capacityImpact: number }, right: typeof left) =>
      `${left.resourceId}|${left.startAt}|${left.endAt}|${left.quantity}|${left.capacityImpact}`.localeCompare(`${right.resourceId}|${right.startAt}|${right.endAt}|${right.quantity}|${right.capacityImpact}`)
    const currentShape = activeAllocations.map((item) => ({ resourceId: item.resourceId, startAt: item.startAt, endAt: item.endAt, quantity: item.quantity, capacityImpact: item.capacityImpact })).sort(sortAllocation)
    const desiredShape: EventAllocationReplace["allocations"] = desired.map((booking) => ({ resourceId: booking.resourceId, startAt: booking.startsAt, endAt: booking.endsAt, quantity: booking.guestCount, capacityImpact: booking.guestCount })).sort(sortAllocation)
    if (JSON.stringify(currentShape) === JSON.stringify(desiredShape)) return
    const scope = `event-allocation-replace:${sourceId}`
    const intent = this.commandIntent(scope, { eventId: sourceId, allocations: desiredShape }, expectedEventVersion)
    await this.client.post("/resources/allocations/replace-event", {
      eventId: sourceId,
      expectedEventVersion: intent.expectedVersion ?? expectedEventVersion,
      allocations: desiredShape,
      operationId: intent.operationId,
      idempotencyKey: intent.idempotencyKey,
    }, EventAllocationReplaceResultSchema)
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

  private commandIntent(scope: string, input: unknown, expectedVersion?: number) {
    const fingerprint = JSON.stringify(input)
    const current = this.commandIntents.get(scope)
    if (current?.fingerprint === fingerprint) return current
    const next = { fingerprint, operationId: operationId(), idempotencyKey: idempotencyKey(scope), ...(expectedVersion === undefined ? {} : { expectedVersion }) }
    this.commandIntents.set(scope, next)
    return next
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
