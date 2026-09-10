import { ApiClientError } from "@app/lib/api-client"
import { createPreviewMarketing } from "@app/components/shared/editor-preview-data"
import type { BookingLookup, DirectoryData, LeadLookup, ResourceLookup } from "@app/data/directory-repository"
import { normalizePhone, normalizeSearchText } from "@app/data/search-normalization"
import type { BookingEditorPosition, BookingEditorRecord } from "@app/entities/bookings"
import {
  bookingCategories,
  bookingCategoryLabels,
  bookingPaymentMethodLabels,
  bookingStatuses,
  bookingStatusMeta,
} from "@app/entities/bookings"
import type { InternalOfferingQuoteResult, ResourceStayOfferingQuotePreviewBody } from "@crm/contracts"

export const tabs = [
  "main",
  "composition",
  "communications",
  "tasks",
  "visits",
  "marketing",
  "history",
] as const;
export type BookingEditorTab = (typeof tabs)[number];
export const tabItems = [
  { value: "main", label: "Основное" },
  { value: "composition", label: "Состав" },
  { value: "communications", label: "Коммуникации" },
  { value: "tasks", label: "Задачи" },
  { value: "visits", label: "Посещения" },
  { value: "marketing", label: "Маркетинг" },
  { value: "history", label: "История" },
];
export const statusOptions = bookingStatuses.filter((value) => value === "draft" || value === "confirmed" || value === "cancelled").map((value) => ({
  value,
  label: bookingStatusMeta[value].label,
}));
export const categoryOptions = bookingCategories
  .filter((value) => value !== "all")
  .map((value) => ({ value, label: bookingCategoryLabels[value] }));
export const paymentMethodOptions = (["cash", "card", "transfer"] as const).map(
  (value) => ({ value, label: bookingPaymentMethodLabels[value] }),
);
export function getLeadRelationOptions(draft: BookingEditorRecord, leads: LeadLookup[], bookings: BookingLookup[]) {
  const phone = normalizePhone(draft.phone);
  const clientName = normalizeSearchText(draft.clientName);
  return leads.map((lead) => {
    const samePhone = Boolean(phone) && normalizePhone(lead.phone) === phone;
    const sameName = normalizeSearchText(lead.clientName) === clientName;
    const datesOverlap = lead.plannedAt.slice(0, 10) === draft.date;
    const linkedBooking = bookings.find(
      (booking) => booking.id !== draft.id && booking.sourceLeadId === lead.id,
    );
    const reasons = [
      samePhone ? "Тот же телефон" : null,
      sameName ? "То же имя" : null,
      datesOverlap ? "Пересекаются даты" : null,
    ].filter((reason): reason is string => Boolean(reason));
    return {
      group: samePhone ? "exact" as const : sameName || datesOverlap ? "similar" as const : "recent" as const,
      href: `/leads/${lead.id}`,
      id: lead.id,
      label: `Заявка #${lead.id} · ${lead.clientName}`,
      meta: `${lead.phone} · ${lead.requestedItem} · ${lead.plannedLabel}`,
      phone: lead.phone,
      reasons,
      ...(linkedBooking
        ? { risk: `Уже использована как источник брони #${linkedBooking.id}` }
        : {}),
    };
  });
}
export const money = new Intl.NumberFormat("ru-RU", {
  currency: "RUB",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency",
});
export const PRICE_PENDING_MESSAGE = "Стоимость ещё рассчитывается. Проверьте позиции в «Составе» и дождитесь завершения расчёта.";

export function bookingErrorFieldLabel(field: string) {
  if (field === "promoCode") return "Промокод";
  if (field === "items") return "Состав бронирования";
  const item = /^items\.(\d+)\.(.+)$/.exec(field);
  if (item) {
    const [, itemIndex = "0", itemProperty = "поле"] = item;
    const propertyLabels: Record<string, string> = {
      startAt: "начало",
      endAt: "окончание",
      quantity: "количество гостей",
      resourceId: "ресурс",
    };
    return `Позиция ${Number(itemIndex) + 1}, ${propertyLabels[itemProperty] ?? itemProperty}`;
  }
  return field === "form" ? "Форма" : field;
}

export function bookingMutationMessage(reason: unknown, fallback: string) {
  if (!(reason instanceof Error)) return fallback;
  if (!(reason instanceof ApiClientError) || !reason.fieldErrors) return reason.message;
  const fields = Object.entries(reason.fieldErrors).flatMap(([field, messages]) =>
    messages.map((message) => `${bookingErrorFieldLabel(field)}: ${message}`),
  );
  return fields.length > 0 ? fields.join(" · ") : reason.message;
}

export function oneOf<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T {
  return value && options.includes(value as T) ? (value as T) : fallback;
}
export function inputNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(`${value}T12:00:00`))
    .replace(" г.", "");
}
export function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function isStayCategory(value: BookingEditorPosition["category"]) {
  return value === "houses" || value === "camping" || value === "tents";
}
export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export type ResourceStayQuoteGateway = {
  previewResourceStayQuote(resourceId: string, input: ResourceStayOfferingQuotePreviewBody): Promise<InternalOfferingQuoteResult>;
};

export function createPosition(
  resources: ResourceLookup[],
  resourceId = resources[0]!.id,
  date = "2026-08-24",
  startHour = 10,
): BookingEditorPosition {
  const resource =
    resources.find((item) => item.id === resourceId) ??
    resources[0]!;
  const stay = isStayCategory(resource.category);
  return {
    basePrice: 0,
    category: resource.category,
    discount: 0,
    endAt: stay
      ? `${addCalendarDays(date, 1)}T12:00`
      : `${date}T${String(Math.min(23, startHour + 1)).padStart(2, "0")}:00`,
    guestCount: 1,
    id: `position-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    resourceId: resource.id,
    resourceName: resource.name,
    startAt: `${date}T${String(startHour).padStart(2, "0")}:00`,
    total: 0,
  };
}
export function createEmptyBooking(params: URLSearchParams, directory: DirectoryData): BookingEditorRecord {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "")
    ? params.get("date")!
    : new Date().toISOString().slice(0, 10);
  const resourceId = directory.resources.some(
    (resource) => resource.id === params.get("resource"),
  )
    ? params.get("resource")!
    : directory.resources[0]!.id;
  const startHour = Math.max(
    0,
    Math.min(22, Number(params.get("start")) || 10),
  );
  const position = createPosition(directory.resources, resourceId, date, startHour);
  const customerName = params.get("clientName") || "Новый клиент";
  const customer = directory.customers.find((item) => item.name === customerName);
  const leadId = params.get("leadId");
  return {
    amount: 0,
    assignees: [],
    category: position.category,
    clientMessage: "",
    clientName: customerName,
    comments: [
      {
        id: "booking-new-comment",
        author: "Марина Кириллова",
        createdLabel: "Сегодня, 13:48",
        text: leadId
          ? `Бронь создана из заявки #${leadId}.`
          : "Демонстрационный комментарий: уточнить время прибытия.",
      },
    ],
    date,
    endHour: startHour + 1,
    guestCount: 1,
    id: "new",
    marketing: createPreviewMarketing("Вручную", "direct"),
    paid: 0,
    payments: [],
    phone: customer?.phone ?? "",
    positions: [position],
    preparationEndHour: startHour + 2,
    promo: "",
    resourceId: position.resourceId,
    resourceName: position.resourceName,
    source: "Вручную",
    sourceLeadId: leadId,
    startHour,
    status: "draft",
    utm: "direct",
  };
}

export function withPositions(
  record: BookingEditorRecord,
  positions: BookingEditorPosition[],
): BookingEditorRecord {
  const primary = positions[0];
  const promotion = JSON.stringify(positions) === JSON.stringify(record.positions) ? record.promotion ?? null : null;
  return {
    ...record,
    positions,
    promotion,
    amount: positions.reduce((sum, position) => sum + position.total, 0) - (promotion?.discountAmountMinor ?? 0) / 100,
    guestCount: positions.reduce(
      (maximum, position) => Math.max(maximum, position.guestCount),
      0,
    ),
    ...(primary
      ? {
          category: primary.category,
          date: primary.startAt.slice(0, 10),
          resourceId: primary.resourceId,
          resourceName: primary.resourceName,
        }
      : {}),
  };
}
