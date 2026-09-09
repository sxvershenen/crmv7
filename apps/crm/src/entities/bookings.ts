import type { Assignee, StatusTone } from "@crm/ui"
import type { BookingPromotion } from "@crm/contracts"

export const bookingCategories = ["all", "houses", "camping", "tents", "bath", "venues"] as const
export const bookingViews = ["agenda", "scheduler", "table"] as const
export const bookingStatuses = ["draft", "confirmed", "unpaid", "debt", "paid", "cancelled", "conflict"] as const

export type BookingCategory = (typeof bookingCategories)[number]
export type BookingView = (typeof bookingViews)[number]
export type BookingStatus = (typeof bookingStatuses)[number]
export type BookingLifecycleStatus = "draft" | "unconfirmed" | "confirmed" | "in_progress" | "completed" | "cancelled" | "archived"
export type BookingSortKey = "id" | "client" | "arrival" | "resource" | "status" | "total" | "assignee"
export type SortDirection = "asc" | "desc"
export type BookingOperationKind = "arrival" | "preparation" | "departure" | "block"
export type BookingPaymentKind = "payment" | "refund"
export type BookingPaymentMethod = "cash" | "card" | "transfer"

export type BookingResource = {
  id: string
  name: string
  category: Exclude<BookingCategory, "all">
  capacity: number
  occupied: number
}

export type Booking = {
  id: string
  /** Backend optimistic-concurrency version (fixtures may omit it). */
  version?: number
  customerId?: string | null
  itemId?: string | null
  startAt?: string
  endAt?: string
  clientName: string
  phone: string
  resourceId: string
  resourceName: string
  category: Exclude<BookingCategory, "all">
  date: string
  startHour: number
  endHour: number
  preparationEndHour: number
  guestCount: number
  status: BookingStatus
  /** Authoritative operational lifecycle; payment-derived list status remains separate. */
  lifecycleStatus?: BookingLifecycleStatus
  amount: number
  paid: number
  source: string
  utm: string
  promo: string
  promotion?: BookingPromotion | null
  /** Nullable typed relation; display labels are derived from the linked lead. */
  sourceLeadId: string | null
  assignees: Assignee[]
  /** Presentation-only: makes an optimistic rollback inspectable before backend exists. */
  demoRejectMove?: boolean
}

export type BookingEditorPosition = {
  basePrice: number
  category: Exclude<BookingCategory, "all">
  discount: number
  endAt: string
  guestCount: number
  id: string
  resourceId: string
  resourceName: string
  startAt: string
  total: number
  /** Authoritative preparation buffer returned by the booking API. */
  preparationMinutes?: number
  quoteSnapshotId?: string | null
  calculatedInputKey?: string | null
  addOns?: BookingEditorAddOn[]
}

export type BookingEditorAddOn = {
  assignmentId: string
  addOnOfferingId: string
  label: string
  serviceType: "quantity_service" | "person_service"
  quantity: number
  price: number
}

export type BookingEditorComment = {
  author: string
  createdLabel: string
  id: string
  text: string
}

export type BookingPaymentOperation = {
  amount: number
  assignee: Assignee | null
  comment: string
  date: string
  dateLabel: string
  id: string
  kind: BookingPaymentKind
  method: BookingPaymentMethod
  sourcePaymentId?: string
}

export type BookingMarketingAttribution = {
  channel: string
  clientId: string
  maxDialogId: string
  metricaClientId: string
  source: string
  utmCampaign: string
  utmContent: string
  utmMedium: string
  utmSource: string
  utmTerm: string
  vkLeadId: string
}

export type BookingEditorRecord = Booking & {
  clientMessage: string
  comments: BookingEditorComment[]
  marketing: BookingMarketingAttribution
  payments: BookingPaymentOperation[]
  positions: BookingEditorPosition[]
}

export type BookingOperation = {
  id: string
  bookingId: string
  resourceId: string
  kind: BookingOperationKind
  time: string
  timeLabel: string
  clientName: string
  status: BookingStatus
}

export type BookingQuery = {
  category: BookingCategory
  date: string
  rangeEnd: string
  resource: string
  source: string
  amountFrom: number
  debtFrom: number
  utm: string
  promo: string
  conflictOnly: boolean
  overpayOnly: boolean
  sort: { key: BookingSortKey; direction: SortDirection }
}

export type BookingDataset = {
  bookings: Booking[]
  operations: BookingOperation[]
  resources: BookingResource[]
  window: { from: string; to: string; canAppendBefore: boolean; canAppendAfter: boolean }
}

export const bookingCategoryLabels: Record<BookingCategory, string> = {
  all: "Все",
  houses: "Дома",
  camping: "Кемпинг",
  tents: "Палатки",
  bath: "Бани",
  venues: "Площадки",
}

export const bookingStatusMeta: Record<BookingStatus, { label: string; tone: StatusTone }> = {
  draft: { label: "Черновик", tone: "neutral" },
  confirmed: { label: "Подтверждено", tone: "info" },
  unpaid: { label: "Неоплачено", tone: "warning" },
  debt: { label: "Долг", tone: "warning" },
  paid: { label: "Оплачено", tone: "success" },
  cancelled: { label: "Отмена", tone: "neutral" },
  conflict: { label: "Конфликт", tone: "danger" },
}

export const operationLabels: Record<BookingOperationKind, string> = {
  arrival: "Заезд",
  preparation: "Подготовка",
  departure: "Выезд",
  block: "Блокировка",
}

export const bookingPaymentMethodLabels: Record<BookingPaymentMethod, string> = {
  cash: "Наличные",
  card: "Карта",
  transfer: "Перевод",
}
