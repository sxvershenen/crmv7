import type { Booking, BookingDataset, BookingEditorRecord, BookingLifecycleStatus, BookingQuery, BookingSortKey, BookingStatus } from "@app/entities/bookings"
import { bookingOperationsFixture, bookingResourcesFixture, bookingsFixture } from "@app/fixtures/bookings"
import { BookingDetailResponseSchema, BookingDtoSchema, BookingLeadLinkHistoryResponseSchema, BookingLeadLinkResponseSchema, BookingProjectionResponseSchema, PaymentListResponseSchema, type BookingDetailResponse, type BookingLeadLinkHistoryResponse, type BookingLeadLinkMethod, type BookingLeadLinkResponse, type BookingProjectionBooking } from "@crm/contracts"
import { apiClient, type ApiClientError } from "@app/lib/api-client"
import { useFixtureData } from "@app/lib/data-mode"
import { bookingPriceKey } from "@app/lib/booking-pricing"
import { businessDateTimeToIso, toBusinessDateTimeInput } from "@app/lib/business-datetime"
import { BookingPromotionPreviewResultSchema, type BookingItemInput, type BookingPromotionPreviewResult } from "@crm/contracts"

export interface BookingRepository {
  assignSelf(id: string): Promise<Booking>
  list(query: BookingQuery): Promise<BookingDataset>
  updateInterval?(id: string, startHour: number, endHour: number, resourceId?: string | null): Promise<Booking>
}

export interface BookingEditorRepository {
  get(id: string): Promise<BookingEditorRecord | null>
  save(booking: BookingEditorRecord): Promise<BookingEditorRecord>
  linkLead?(id: string, leadId: string, expectedVersion: number, method?: BookingLeadLinkMethod): Promise<BookingLeadLinkResponse>
  unlinkLead?(id: string, expectedVersion: number): Promise<BookingLeadLinkResponse>
  leadLinkHistory?(id: string): Promise<BookingLeadLinkHistoryResponse>
  previewPromotion?(booking: BookingEditorRecord): Promise<BookingPromotionPreviewResult>
}

export function bookingItemsForApi(booking: BookingEditorRecord): BookingItemInput[] {
  return booking.positions.map(position => {
    const priceAmountMinor = majorToMinor(Math.max(0, position.basePrice))
    const discountPercent = Math.min(100, Math.max(0, position.discount))
    return { type: position.category === "houses" ? "accommodation" : position.category === "bath" ? "bath" : position.category === "venues" ? "venue" : position.category === "camping" || position.category === "tents" ? "camping" : "other", resourceId: isUuid(position.resourceId) ? position.resourceId : null, startAt: bookingWallClockToIso(position.startAt), endAt: bookingWallClockToIso(position.endAt), quantity: Math.max(1, position.guestCount), price: { amountMinor: priceAmountMinor, currency: "RUB" }, discount: { amountMinor: Math.round(priceAmountMinor * discountPercent / 100), currency: "RUB" }, preparationMinutes: position.preparationMinutes ?? 0, quoteSnapshotId: position.quoteSnapshotId ?? null, addOns: (position.addOns ?? []).map(({ assignmentId, quantity }) => ({ assignmentId, quantity: Math.max(1, quantity) })) }
  })
}

/** Booking editors use Moscow business time; datetime-local values have no browser timezone. */
export function bookingWallClockToIso(value: string) {
  return businessDateTimeToIso(value)
}

export type ApiBookingRepositoryOptions = {
  client?: Pick<typeof apiClient, "get" | "patch" | "post">
}

const collator = new Intl.Collator("ru-RU", { numeric: true, sensitivity: "base" })
const sortValue: Record<BookingSortKey, (booking: Booking) => string | number> = {
  id: (booking) => booking.id,
  client: (booking) => booking.clientName,
  arrival: (booking) => `${booking.date}-${booking.startHour}`,
  resource: (booking) => booking.resourceName,
  status: (booking) => booking.status,
  total: (booking) => booking.amount,
  assignee: (booking) => booking.assignees[0]?.name ?? "",
}

export function selectBookings(data: Booking[], query: BookingQuery): Booking[] {
  const sign = query.sort.direction === "asc" ? 1 : -1
  return data
    .filter((booking) => {
      if (booking.date < query.date || booking.date > query.rangeEnd) return false
      if (query.category !== "all" && booking.category !== query.category) return false
      if (query.resource !== "all" && booking.resourceId !== query.resource) return false
      if (query.source !== "all" && booking.source !== query.source) return false
      if (booking.amount < query.amountFrom) return false
      if (booking.amount - booking.paid < query.debtFrom) return false
      if (query.utm !== "all" && booking.utm !== query.utm) return false
      if (query.promo !== "all" && booking.promo !== query.promo) return false
      if (query.conflictOnly && booking.status !== "conflict") return false
      if (query.overpayOnly && booking.paid <= booking.amount) return false
      return true
    })
    .sort((left, right) => {
      const a = sortValue[query.sort.key](left)
      const b = sortValue[query.sort.key](right)
      return (typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b))) * sign
    })
}

export class FixtureBookingRepository implements BookingRepository, BookingEditorRepository {
  private data = structuredClone(bookingsFixture)
  private editorData = new Map<string, BookingEditorRecord>()
  private leadHistory = new Map<string, BookingLeadLinkHistoryResponse["items"]>()

  async list(query: BookingQuery): Promise<BookingDataset> {
    const bookings = selectBookings(structuredClone(this.data), query)
    const bookingIds = new Set(bookings.map((booking) => booking.id))
    const resources = structuredClone(bookingResourcesFixture).filter((resource) => query.category === "all" || resource.category === query.category)
    const operations = structuredClone(bookingOperationsFixture)
      .filter((item) => bookingIds.has(item.bookingId))
      .sort((left, right) => {
        if (left.status === "cancelled" && right.status !== "cancelled") return 1
        if (right.status === "cancelled" && left.status !== "cancelled") return -1
        return left.time.localeCompare(right.time)
      })
    return Promise.resolve({
      bookings,
      operations,
      resources,
      window: { from: query.date, to: query.rangeEnd, canAppendBefore: true, canAppendAfter: true },
    })
  }

  async assignSelf(id: string): Promise<Booking> {
    const booking = this.data.find((item) => item.id === id)
    if (!booking) throw new Error("Бронирование не найдено")
    if (!booking.assignees.some((person) => person.id === "demo-manager")) {
      booking.assignees = [...booking.assignees, { id: "demo-manager", initials: "МК", name: "Марина Кириллова", colorClass: "bg-sky-100 text-sky-700" }]
    }
    return structuredClone(booking)
  }

  async get(id: string): Promise<BookingEditorRecord | null> {
    const cached = this.editorData.get(id)
    if (cached) return Promise.resolve(structuredClone(cached))
    const booking = this.data.find((item) => item.id === id)
    if (!booking) return Promise.resolve(null)
    const record = toEditorRecord(booking)
    this.editorData.set(id, record)
    return Promise.resolve(structuredClone(record))
  }

  async save(booking: BookingEditorRecord): Promise<BookingEditorRecord> {
    const next = structuredClone(booking)
    this.editorData.set(next.id, next)
    const flat = toListBooking(next)
    const index = this.data.findIndex((item) => item.id === next.id)
    if (index >= 0) this.data[index] = flat
    else this.data.unshift(flat)
    return Promise.resolve(structuredClone(next))
  }

  async linkLead(id: string, leadId: string, expectedVersion: number, method: BookingLeadLinkMethod = "manual"): Promise<BookingLeadLinkResponse> {
    const booking = await this.get(id)
    if (!booking) throw new Error("Бронирование не найдено")
    const history = this.leadHistory.get(id) ?? []
    const existing = [...history].reverse().find((item) => item.leadId === leadId && item.unlinkedAt === null)
    if (booking.sourceLeadId === leadId && existing) return { link: structuredClone(existing), bookingVersion: booking.version ?? expectedVersion }
    const now = new Date().toISOString()
    const closed = history.map((item) => item.unlinkedAt === null ? { ...item, unlinkedAt: now } : item)
    const bookingVersion = Math.max(expectedVersion, booking.version ?? expectedVersion) + 1
    const link = { id: crypto.randomUUID(), bookingId: id, leadId, method, linkedAt: now, linkedBy: null, unlinkedAt: null, unlinkedBy: null }
    this.leadHistory.set(id, [...closed, link])
    const next = { ...booking, sourceLeadId: leadId, version: bookingVersion }
    await this.save(next)
    return { link, bookingVersion }
  }

  async unlinkLead(id: string, expectedVersion: number): Promise<BookingLeadLinkResponse> {
    const booking = await this.get(id)
    if (!booking) throw new Error("Бронирование не найдено")
    const bookingVersion = Math.max(expectedVersion, booking.version ?? expectedVersion) + (booking.sourceLeadId ? 1 : 0)
    if (booking.sourceLeadId) {
      const now = new Date().toISOString()
      this.leadHistory.set(id, (this.leadHistory.get(id) ?? []).map((item) => item.unlinkedAt === null ? { ...item, unlinkedAt: now } : item))
    }
    await this.save({ ...booking, sourceLeadId: null, version: bookingVersion })
    return { link: null, bookingVersion }
  }

  async leadLinkHistory(id: string): Promise<BookingLeadLinkHistoryResponse> {
    return { items: structuredClone(this.leadHistory.get(id) ?? []) }
  }

  async updateInterval(id: string, startHour: number, endHour: number, resourceId?: string | null): Promise<Booking> {
    const booking = this.data.find((item) => item.id === id)
    if (!booking) throw new Error("Бронирование не найдено")
    if (booking.demoRejectMove) throw new Error(`Конфликт #${id}: demo-проверка отклонила изменение, прежний интервал восстановлен.`)
    const resource = this.data.length > 0 ? bookingResourcesFixture.find((item) => item.id === (resourceId ?? booking.resourceId)) : undefined
    Object.assign(booking, { startHour, endHour, preparationEndHour: Math.min(24, endHour + 1), ...(resource ? { resourceId: resource.id, resourceName: resource.name, category: resource.category } : {}) })
    return structuredClone(booking)
  }
}

function toEditorRecord(booking: Booking): BookingEditorRecord {
  return {
    ...structuredClone(booking),
    version: booking.version ?? 0,
    clientMessage: "Просим тихий дом и возможность приехать немного раньше.",
    comments: [{ id: `comment-${booking.id}-1`, author: "Марина Кириллова", createdLabel: "Сегодня, 13:48", text: "Подтвердили состав гостей, ранний заезд пока на проверке." }, { id: `comment-${booking.id}-2`, author: "Алексей Воронов", createdLabel: "23 авг, 18:12", text: "Отправил памятку и схему проезда." }],
    marketing: { channel: "site", clientId: `crm_${booking.id}_20260824`, maxDialogId: "", metricaClientId: "1756038123456789012", source: booking.source, utmCampaign: "late_summer_2026", utmContent: "hero_family_offer", utmMedium: booking.utm.includes("cpc") ? "cpc" : "organic", utmSource: booking.utm, utmTerm: "отдых с семьёй ленобласть", vkLeadId: "vk_9128841" },
    payments: booking.paid > 0 ? [{ amount: booking.paid, assignee: booking.assignees[0] ?? null, comment: "Предоплата", date: "2026-08-23", dateLabel: "23 авг", id: `payment-${booking.id}-1`, kind: "payment", method: "card" }] : [],
    positions: [{
      basePrice: booking.amount,
      category: booking.category,
      discount: 0,
      endAt: `${booking.date}T${String(booking.endHour).padStart(2, "0")}:00`,
      guestCount: booking.guestCount,
      id: `position-${booking.id}-1`,
      resourceId: booking.resourceId,
      resourceName: booking.resourceName,
      startAt: `${booking.date}T${String(booking.startHour).padStart(2, "0")}:00`,
      total: booking.amount,
    }],
  }
}

function toListBooking(record: BookingEditorRecord): Booking {
  const positions = record.positions
  const flatRecord = structuredClone(record) as BookingEditorRecord & Record<string, unknown>
  for (const key of ["clientMessage", "comments", "marketing", "payments", "positions"]) delete flatRecord[key]
  const booking = flatRecord as unknown as Booking
  const primary = positions[0]
  if (!primary) return booking
  return {
    ...booking,
    amount: positions.reduce((sum, position) => sum + position.total, 0),
    category: primary.category,
    date: primary.startAt.slice(0, 10),
    endHour: Number(primary.endAt.slice(11, 13)),
    guestCount: primary.guestCount,
    preparationEndHour: Math.min(24, Number(primary.endAt.slice(11, 13)) + 1),
    resourceId: primary.resourceId,
    resourceName: primary.resourceName,
    startHour: Number(primary.startAt.slice(11, 13)),
  }
}

function mapProjection(dto: BookingProjectionBooking): Booking {
  return {
    id: dto.id,
    version: dto.version,
    itemId: dto.itemId,
    customerId: dto.customerId,
    startAt: dto.startAt,
    endAt: dto.endAt,
    clientName: dto.clientName,
    phone: dto.phone,
    resourceId: dto.resourceId ?? "",
    resourceName: dto.resourceName,
    category: dto.category as Booking["category"],
    date: dto.date,
    startHour: dto.startHour,
    endHour: dto.endHour,
    preparationEndHour: dto.preparationEndHour,
    guestCount: dto.guestCount,
    status: dto.status,
    lifecycleStatus: dto.lifecycleStatus,
    amount: minorToMajor(dto.amount),
    paid: minorToMajor(dto.paid),
    source: dto.source,
    utm: dto.utm,
    promo: dto.promo,
    sourceLeadId: dto.sourceLeadId,
    assignees: dto.assignees.map((person) => ({ ...person })),
  }
}

function mapDetail(dto: BookingDetailResponse): BookingEditorRecord {
  const booking = mapProjection(dto)
  const items = dto.items ?? []
  const editorStatus: BookingStatus = dto.lifecycleStatus === "cancelled" || dto.lifecycleStatus === "archived"
    ? "cancelled"
    : dto.lifecycleStatus === "confirmed" || dto.lifecycleStatus === "in_progress" || dto.lifecycleStatus === "completed"
      ? "confirmed"
      : "draft"
  return {
    ...booking,
    status: editorStatus,
    sourceLeadId: dto.leadLink?.leadId ?? dto.sourceLeadId,
    promotion: dto.promotion ?? null,
    clientMessage: dto.note ?? "",
    comments: dto.comments.filter((item): item is BookingEditorRecord["comments"][number] => Boolean(item && typeof item === "object" && typeof (item as Record<string, unknown>).id === "string" && typeof (item as Record<string, unknown>).author === "string" && typeof (item as Record<string, unknown>).text === "string" && typeof (item as Record<string, unknown>).createdLabel === "string")),
    marketing: {
      channel: typeof dto.marketing.channel === "string" ? dto.marketing.channel : "",
      clientId: typeof dto.marketing.clientId === "string" ? dto.marketing.clientId : "",
      maxDialogId: typeof dto.marketing.maxDialogId === "string" ? dto.marketing.maxDialogId : "",
      metricaClientId: typeof dto.marketing.metricaClientId === "string" ? dto.marketing.metricaClientId : "",
      source: booking.source, utmCampaign: typeof dto.marketing.utmCampaign === "string" ? dto.marketing.utmCampaign : "", utmContent: typeof dto.marketing.utmContent === "string" ? dto.marketing.utmContent : "", utmMedium: typeof dto.marketing.utmMedium === "string" ? dto.marketing.utmMedium : "", utmSource: booking.utm, utmTerm: typeof dto.marketing.utmTerm === "string" ? dto.marketing.utmTerm : "", vkLeadId: typeof dto.marketing.vkLeadId === "string" ? dto.marketing.vkLeadId : "",
    },
    payments: dto.payments.map((payment) => ({ amount: minorToMajor(payment.amount), assignee: null, comment: payment.reason, date: payment.createdAt.slice(0, 10), dateLabel: payment.createdAt.slice(0, 10), id: payment.id, kind: payment.kind === "refund" ? "refund" : "payment", method: payment.method === "cash" || payment.method === "transfer" ? payment.method : "card", ...(payment.sourcePaymentId ? { sourcePaymentId: payment.sourcePaymentId } : {}) })),
    positions: items.map((item) => {
      const basePrice = minorToMajor(item.price.amountMinor)
      const discount = item.price.amountMinor > 0 ? item.discount.amountMinor / item.price.amountMinor * 100 : 0
      const position = { basePrice, category: (item.type === "accommodation" ? "houses" : item.type === "bath" ? "bath" : item.type === "camping" ? "camping" : item.type === "venue" ? "venues" : "houses") as BookingEditorRecord["positions"][number]["category"], discount, endAt: toBusinessDateTimeInput(item.endAt), guestCount: item.quantity, id: item.id, resourceId: item.resourceId ?? "", resourceName: dto.resource?.name ?? "Без ресурса", startAt: toBusinessDateTimeInput(item.startAt), total: minorToMajor(item.price.amountMinor - item.discount.amountMinor), preparationMinutes: item.preparationMinutes, quoteSnapshotId: item.quoteSnapshotId ?? null, addOns: (item.addOns ?? []).map((addon) => ({ ...addon, price: minorToMajor(addon.price.amountMinor) })) }
      return { ...position, calculatedInputKey: item.quoteSnapshotId ? bookingPriceKey(position) : null }
    }),
  }
}

export class ApiBookingRepository implements BookingRepository, BookingEditorRepository {
  private readonly client: Pick<typeof apiClient, "get" | "patch" | "post">
  private readonly loadedLeadIds = new Map<string, string | null>()
  private readonly leadIntents = new Map<string, { operationId: string; idempotencyKey: string }>()

  constructor(options: ApiBookingRepositoryOptions = {}) { this.client = options.client ?? apiClient }

  async previewPromotion(booking: BookingEditorRecord) {
    return this.client.post("/bookings/promotion-preview", { promoCode: booking.promo.trim(), items: bookingItemsForApi(booking) }, BookingPromotionPreviewResultSchema)
  }

  async list(query: BookingQuery): Promise<BookingDataset> {
    const params = new URLSearchParams({ date: query.date, rangeEnd: query.rangeEnd, category: query.category, resource: query.resource, source: query.source, amountFrom: String(query.amountFrom), debtFrom: String(query.debtFrom), utm: query.utm, promo: query.promo, conflictOnly: String(query.conflictOnly), overpayOnly: String(query.overpayOnly), sort: query.sort.key, order: query.sort.direction })
    const dto = await this.client.get(`/bookings/projection?${params.toString()}`, BookingProjectionResponseSchema)
    return { bookings: dto.bookings.map(mapProjection), operations: dto.operations.map((operation) => ({ ...operation, status: operation.status, timeLabel: operation.timeLabel })), resources: dto.resources.map((resource) => ({ id: resource.id, name: resource.name, category: resource.category as Booking["category"], capacity: resource.capacity, occupied: resource.occupied })), window: dto.window }
  }

  async assignSelf(id: string): Promise<Booking> {
    const current = await this.get(id)
    if (!current || current.version === undefined) throw new Error("Бронирование не найдено")
    await this.client.post(`/bookings/${encodeURIComponent(id)}/assign-self`, {
      expectedVersion: current.version,
      operationId: crypto.randomUUID(),
      idempotencyKey: `booking-assign-${crypto.randomUUID()}`,
    }, BookingDtoSchema)
    const updated = await this.get(id)
    if (!updated) throw new Error("Изменённое бронирование не найдено")
    return updated
  }

  async get(id: string): Promise<BookingEditorRecord | null> {
    try {
      const dto = await this.client.get(`/bookings/${encodeURIComponent(id)}`, BookingDetailResponseSchema)
      const record = mapDetail(dto)
      this.loadedLeadIds.set(record.id, record.sourceLeadId)
      return record
    } catch (error) {
      if (error instanceof Error && "code" in error && (error as ApiClientError).code === "NOT_FOUND") return null
      throw error
    }
  }

  async linkLead(id: string, leadId: string, expectedVersion: number, method: BookingLeadLinkMethod = "manual") {
    const intentKey = `${id}:${expectedVersion}:link:${leadId}:${method}`
    const intent = this.leadIntent(intentKey, "link")
    const response = await this.client.post(`/bookings/${encodeURIComponent(id)}/lead-link`, { leadId, method, expectedVersion, ...intent }, BookingLeadLinkResponseSchema)
    this.leadIntents.delete(intentKey)
    this.loadedLeadIds.set(id, response.link?.leadId ?? null)
    return response
  }

  async unlinkLead(id: string, expectedVersion: number) {
    const intentKey = `${id}:${expectedVersion}:unlink`
    const intent = this.leadIntent(intentKey, "unlink")
    const response = await this.client.post(`/bookings/${encodeURIComponent(id)}/lead-link/unlink`, { expectedVersion, ...intent }, BookingLeadLinkResponseSchema)
    this.leadIntents.delete(intentKey)
    this.loadedLeadIds.set(id, null)
    return response
  }

  async leadLinkHistory(id: string) {
    return this.client.get(`/bookings/${encodeURIComponent(id)}/lead-link/history`, BookingLeadLinkHistoryResponseSchema)
  }

  async save(booking: BookingEditorRecord): Promise<BookingEditorRecord> {
    const items = bookingItemsForApi(booking)
    const promoCode = booking.promo && booking.promo !== "Без промокода" ? booking.promo.trim().toUpperCase() : null
    if (promoCode && booking.promotion?.code !== promoCode) throw new Error("Сначала примените промокод к текущему составу")
    const customerId = isUuid(booking.customerId) ? booking.customerId : null
    if (!customerId) throw new Error("Выберите клиента перед сохранением бронирования")
    if (booking.id === "new") {
      const created = await this.client.post("/bookings", { customerId, items, promoCode, note: booking.clientMessage || null, assignees: booking.assignees.map(({ id, initials, name }) => ({ id, initials, name })), operationId: crypto.randomUUID(), idempotencyKey: `booking-create-${crypto.randomUUID()}`, overrideConflict: false }, BookingDtoSchema)
      if (booking.sourceLeadId && isUuid(booking.sourceLeadId)) {
        await this.linkLead(created.id, booking.sourceLeadId, created.version, "from_lead")
      }
      let detail = await this.get(created.id)
      if (!detail) throw new Error("Созданное бронирование не найдено")
      detail = await this.reconcileLifecycle(detail, booking.status)
      await this.reconcilePayments(detail, booking.payments)
      const authoritative = await this.get(created.id)
      if (!authoritative) throw new Error("Созданное бронирование не найдено")
      return authoritative
    }
    if (booking.version === undefined) throw new Error("Неизвестная версия бронирования")
    const loadedLeadId = this.loadedLeadIds.get(booking.id)
    if (loadedLeadId !== undefined && loadedLeadId !== booking.sourceLeadId) throw new Error("Связь с заявкой ещё не сохранена. Повторите изменение связи перед сохранением бронирования.")
    await this.client.patch(`/bookings/${encodeURIComponent(booking.id)}`, { expectedVersion: booking.version, customerId, items, promoCode, note: booking.clientMessage || null, assignees: booking.assignees.map(({ id, initials, name }) => ({ id, initials, name })), operationId: crypto.randomUUID(), idempotencyKey: `booking-update-${crypto.randomUUID()}`, overrideConflict: false }, BookingDtoSchema)
    let detail = await this.get(booking.id)
    if (!detail) throw new Error("Изменённое бронирование не найдено")
    detail = await this.reconcileLifecycle(detail, booking.status)
    await this.reconcilePayments(detail, booking.payments)
    const authoritative = await this.get(booking.id)
    if (!authoritative) throw new Error("Изменённое бронирование не найдено")
    return authoritative
  }

  private leadIntent(key: string, kind: "link" | "unlink") {
    const existing = this.leadIntents.get(key)
    if (existing) return existing
    const intent = { operationId: crypto.randomUUID(), idempotencyKey: `booking-lead-${kind}-${crypto.randomUUID()}` }
    this.leadIntents.set(key, intent)
    return intent
  }

  private async reconcileLifecycle(current: BookingEditorRecord, desiredStatus: BookingStatus): Promise<BookingEditorRecord> {
    let lifecycle = current.lifecycleStatus ?? "draft"
    let version = current.version
    if (version === undefined) throw new Error("Неизвестная версия бронирования")
    const transition = async (status: BookingLifecycleStatus, acceptQuotes = false) => {
      const quoteAcceptances = acceptQuotes
        ? current.positions.flatMap((position) => position.quoteSnapshotId ? [{ bookingItemId: position.id, quoteSnapshotId: position.quoteSnapshotId }] : [])
        : []
      const updated = await this.client.post(`/bookings/${encodeURIComponent(current.id)}/transition`, {
        expectedVersion: version,
        operationId: crypto.randomUUID(),
        idempotencyKey: `booking-transition-${crypto.randomUUID()}`,
        status,
        ...(quoteAcceptances.length > 0 ? { quoteAcceptances } : {}),
      }, BookingDtoSchema)
      version = updated.version
      lifecycle = updated.status
    }

    if (desiredStatus === "confirmed" && lifecycle === "draft") await transition("unconfirmed")
    if (desiredStatus === "confirmed" && lifecycle === "unconfirmed") await transition("confirmed", true)
    if (desiredStatus === "draft" && lifecycle === "unconfirmed") await transition("draft")
    if (desiredStatus === "cancelled" && !["cancelled", "archived", "completed"].includes(lifecycle)) await transition("cancelled")

    if (version === current.version) return current
    const refreshed = await this.get(current.id)
    if (!refreshed) throw new Error("Бронирование после смены статуса не найдено")
    return refreshed
  }

  private async reconcilePayments(current: BookingEditorRecord, desired: BookingEditorRecord["payments"]) {
    const persisted = new Set(current.payments.map((payment) => payment.id))
    const pending = desired.filter((payment) => !persisted.has(payment.id))
    const ids = new Map<string, string>()
    let version = current.version
    if (version === undefined) throw new Error("Неизвестная версия бронирования")
    for (const payment of pending.filter((payment) => payment.kind === "payment")) {
      const saved = await this.client.post("/payments", { target: { type: "booking", id: current.id }, type: "charge", amount: { amountMinor: majorToMinor(payment.amount), currency: "RUB" }, method: payment.method === "transfer" ? "bank_transfer" : payment.method, reason: payment.comment || null, sourcePaymentId: null, expectedVersion: version, operationId: crypto.randomUUID(), idempotencyKey: `booking-payment-${crypto.randomUUID()}` }, PaymentListResponseSchema.shape.items.element)
      ids.set(payment.id, saved.id)
      version += 1
    }
    for (const payment of pending.filter((payment) => payment.kind === "refund")) {
      const sourcePaymentId = payment.sourcePaymentId ? ids.get(payment.sourcePaymentId) ?? payment.sourcePaymentId : undefined
      if (!sourcePaymentId) throw new Error("Для возврата нужна сохранённая исходная оплата")
      await this.client.post("/payments", { target: { type: "booking", id: current.id }, type: "refund", amount: { amountMinor: majorToMinor(payment.amount), currency: "RUB" }, method: payment.method === "transfer" ? "bank_transfer" : payment.method, reason: payment.comment || null, sourcePaymentId, expectedVersion: version, operationId: crypto.randomUUID(), idempotencyKey: `booking-refund-${crypto.randomUUID()}` }, PaymentListResponseSchema.shape.items.element)
      version += 1
    }
  }

  async updateInterval(id: string, startHour: number, endHour: number, resourceId?: string | null): Promise<Booking> {
    const detail = await this.get(id)
    if (!detail || !detail.itemId || detail.version === undefined) throw new Error("Бронирование не найдено")
    const date = detail.date
    const iso = (hour: number) => new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+03:00`).toISOString()
    const result = await this.client.patch(`/bookings/${encodeURIComponent(id)}/interval`, { expectedVersion: detail.version, operationId: crypto.randomUUID(), idempotencyKey: `booking-interval-${crypto.randomUUID()}`, itemId: detail.itemId, startAt: iso(startHour), endAt: iso(endHour), resourceId: (resourceId ?? detail.resourceId) || null, overrideConflict: false }, BookingDtoSchema)
    const next: Booking = { ...detail, version: result.version, startAt: iso(startHour), endAt: iso(endHour), date, startHour, endHour, preparationEndHour: Math.min(24, endHour + 1), resourceId: resourceId ?? detail.resourceId }
    return next
  }
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function minorToMajor(value: number) {
  return value / 100
}

function majorToMinor(value: number) {
  return Math.round(value * 100)
}

export const fixtureBookingRepository: BookingRepository & BookingEditorRepository = new FixtureBookingRepository()
export const apiBookingRepository: BookingRepository & BookingEditorRepository = new ApiBookingRepository()
/** Production and tests default to the API unless the shared explicit fixture mode is enabled. */
export const bookingRepository: BookingRepository & BookingEditorRepository = useFixtureData ? fixtureBookingRepository : apiBookingRepository
