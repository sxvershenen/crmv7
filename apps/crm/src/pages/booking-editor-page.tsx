import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bookingPriceKey } from "@app/lib/booking-pricing";
import {
  IconAlertTriangle,
  IconArchive,
  IconCash,
  IconCopy,
  IconDotsVertical,
  IconExternalLink,
  IconLink,
  IconPlus,
  IconReceipt,
  IconRotateClockwise,
  IconTrash,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  AssigneePicker,
  Button,
  CommentThread,
  ConfirmationDialog,
  DatePicker,
  DateTimeRangePicker,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EditorFrame,
  EditorSection,
  EntityCombobox,
  FilterSelect,
  FormField,
  FormSelect,
  Input,
  ListRow,
  OperationalSummary,
  PageNav,
  PageState,
  PaymentProgress,
  Skeleton,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type Assignee,
  type CommentThreadItem,
  type EditorSaveState,
} from "@crm/ui";

import { useEditorLayoutChrome } from "@app/app/editor-layout-context";
import {
  createPreviewMarketing,
  type MarketingAttributionDraft,
} from "@app/components/shared/editor-preview-data";
import { ManualRelationPicker } from "@app/components/shared/manual-relation-picker";
import {
  EditorMarketingAttribution,
  EditorPreviewCommunications,
  EditorPreviewHistory,
  EditorPreviewTasks,
  EditorPreviewVisits,
} from "@app/components/shared/editor-preview-tabs";
import {
  bookingRepository,
  type BookingEditorRepository,
} from "@app/data/bookings-repository";
import { ApiClientError } from "@app/lib/api-client";
import { houseOfferingGateway } from "@app/data/house-offerings-repository";
import type { BookingLeadLink, InternalOfferingQuoteResult, ResourceStayOfferingQuotePreviewBody } from "@crm/contracts";
import type { BookingLookup, DirectoryData, LeadLookup, ResourceLookup } from "@app/data/directory-repository";
import {
  normalizePhone,
  normalizeSearchText,
} from "@app/data/search-normalization";
import { useDirectoryAssignees, useDirectoryBookings, useDirectoryCustomers, useDirectoryData, useDirectoryLeads, useDirectoryResources } from "@app/features/use-directory-data";
import type {
  BookingCategory,
  BookingEditorAddOn,
  BookingEditorPosition,
  BookingEditorRecord,
  BookingPaymentMethod,
  BookingStatus,
} from "@app/entities/bookings";
import {
  bookingCategories,
  bookingCategoryLabels,
  bookingPaymentMethodLabels,
  bookingStatuses,
  bookingStatusMeta,
} from "@app/entities/bookings";

const tabs = [
  "main",
  "composition",
  "communications",
  "tasks",
  "visits",
  "marketing",
  "history",
] as const;
type BookingEditorTab = (typeof tabs)[number];
const tabItems = [
  { value: "main", label: "Основное" },
  { value: "composition", label: "Состав" },
  { value: "communications", label: "Коммуникации" },
  { value: "tasks", label: "Задачи" },
  { value: "visits", label: "Посещения" },
  { value: "marketing", label: "Маркетинг" },
  { value: "history", label: "История" },
];
const statusOptions = bookingStatuses.filter((value) => value === "draft" || value === "confirmed" || value === "cancelled").map((value) => ({
  value,
  label: bookingStatusMeta[value].label,
}));
const categoryOptions = bookingCategories
  .filter((value) => value !== "all")
  .map((value) => ({ value, label: bookingCategoryLabels[value] }));
const paymentMethodOptions = (["cash", "card", "transfer"] as const).map(
  (value) => ({ value, label: bookingPaymentMethodLabels[value] }),
);
function getLeadRelationOptions(draft: BookingEditorRecord, leads: LeadLookup[], bookings: BookingLookup[]) {
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
const money = new Intl.NumberFormat("ru-RU", {
  currency: "RUB",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
  style: "currency",
});
const PRICE_PENDING_MESSAGE = "Стоимость ещё рассчитывается. Проверьте позиции в «Составе» и дождитесь завершения расчёта.";

function bookingErrorFieldLabel(field: string) {
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

function bookingMutationMessage(reason: unknown, fallback: string) {
  if (!(reason instanceof Error)) return fallback;
  if (!(reason instanceof ApiClientError) || !reason.fieldErrors) return reason.message;
  const fields = Object.entries(reason.fieldErrors).flatMap(([field, messages]) =>
    messages.map((message) => `${bookingErrorFieldLabel(field)}: ${message}`),
  );
  return fields.length > 0 ? fields.join(" · ") : reason.message;
}

function oneOf<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T {
  return value && options.includes(value as T) ? (value as T) : fallback;
}
function inputNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function dateLabel(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(`${value}T12:00:00`))
    .replace(" г.", "");
}
function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function isStayCategory(value: BookingEditorPosition["category"]) {
  return value === "houses" || value === "camping" || value === "tents";
}
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export type ResourceStayQuoteGateway = {
  previewResourceStayQuote(resourceId: string, input: ResourceStayOfferingQuotePreviewBody): Promise<InternalOfferingQuoteResult>;
};

function createPosition(
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
function createEmptyBooking(params: URLSearchParams, directory: DirectoryData): BookingEditorRecord {
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

function withPositions(
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

export function BookingEditorPage({
  repository = bookingRepository,
  pricingGateway = houseOfferingGateway,
}: {
  repository?: BookingEditorRepository;
  pricingGateway?: ResourceStayQuoteGateway;
}) {
  const { data: directory, error: directoryError } = useDirectoryData();
  const bookingAssignees = directory?.assignees.booking ?? [];
  const navigate = useNavigate();
  const { id = "new" } = useParams();
  const [params, setParams] = useSearchParams();
  const createParamsRef = useRef(params);
  const tab = oneOf(params.get("tab"), tabs, "main");
  const [draft, setDraft] = useState<BookingEditorRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");
  const [newComment, setNewComment] = useState("");
  const [promoPending, setPromoPending] = useState(false);
  const [relationPending, setRelationPending] = useState(false);
  const [leadHistoryRevision, setLeadHistoryRevision] = useState(0);
  const [leadHistory, setLeadHistory] = useState<
    | { status: "idle" | "loading" }
    | { status: "ready"; items: BookingLeadLink[] }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const [mutationError, setMutationError] = useState<string | null>(null);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;

  useEffect(() => {
    if (!directory) return;
    let active = true;
    setLoading(true);
    setError(null);
    if (id === "new") {
      setDraft(createEmptyBooking(createParamsRef.current, directory));
      setLoading(false);
      return () => {
        active = false;
      };
    }
    repository
      .get(id)
      .then((booking) => {
        if (!active) return;
        if (!booking) {
          setError("Бронирование не найдено");
          setLoading(false);
          return;
        }
        setDraft(booking);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить бронирование",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [directory, id, repository]);

  useEffect(() => {
    if (directoryError) { setError(directoryError); setLoading(false); }
  }, [directoryError]);

  useEffect(() => {
    if (tab !== "history") return;
    if (id === "new" || !repository.leadLinkHistory) {
      setLeadHistory({ status: "ready", items: [] });
      return;
    }
    let active = true;
    setLeadHistory({ status: "loading" });
    repository.leadLinkHistory(id).then(({ items }) => {
      if (active) setLeadHistory({ status: "ready", items });
    }).catch((reason: unknown) => {
      if (active) setLeadHistory({ status: "error", message: bookingMutationMessage(reason, "Не удалось загрузить историю связей") });
    });
    return () => { active = false; };
  }, [id, leadHistoryRevision, repository, tab]);

  const update = useCallback(
    <K extends keyof BookingEditorRecord>(
      key: K,
      value: BookingEditorRecord[K],
    ) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
      setSaveState("dirty");
    },
    [],
  );
  const updateMarketing = useCallback(
    <K extends keyof MarketingAttributionDraft>(
      key: K,
      value: MarketingAttributionDraft[K],
    ) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              marketing: { ...current.marketing, [key]: value },
              ...(key === "source" ? { source: value } : {}),
              ...(key === "utmSource" ? { utm: value } : {}),
            }
          : current,
      );
      setSaveState("dirty");
    },
    [],
  );
  const setStatus = useCallback(
    (status: BookingStatus) => update("status", status),
    [update],
  );
  const setAssignee = useCallback(
    (person: Assignee | null) => update("assignees", person ? [person] : []),
    [update],
  );
  const updatePosition = useCallback(
    <K extends keyof BookingEditorPosition>(
      positionId: string,
      key: K,
      value: BookingEditorPosition[K],
    ) => {
      setDraft((current) => {
        if (!current) return current;
        const positions = current.positions.map((position) => {
          if (position.id !== positionId) return position;
          const next = { ...position, [key]: value };
          if (key === "basePrice" || key === "discount")
            next.total = (Math.round(next.basePrice * 100) - Math.round(Math.round(next.basePrice * 100) * Math.min(100, Math.max(0, next.discount)) / 100)) / 100;
          return next;
        });
        return withPositions(current, positions);
      });
      setSaveState("dirty");
    },
    [],
  );
  const changeResource = useCallback(
    (positionId: string, resourceId: string) => {
      const resource = directory?.resources.find(
        (item) => item.id === resourceId,
      );
      if (!resource) return;
      setDraft((current) =>
        current
          ? withPositions(
              current,
              current.positions.map((position) =>
                position.id === positionId
                  ? {
                      ...position,
                      category: resource.category,
                      resourceId,
                      resourceName: resource.name,
                      addOns: [],
                      quoteSnapshotId: null,
                    }
                  : position,
              ),
            )
          : current,
      );
      setSaveState("dirty");
    },
    [directory],
  );
  const addPosition = useCallback(() => {
    setDraft((current) =>
      current
        ? withPositions(current, [
            ...current.positions,
            createPosition(directory!.resources, current.resourceId, current.date, current.startHour),
          ])
        : current,
    );
    setSaveState("dirty");
  }, [directory]);
  const duplicatePosition = useCallback((position: BookingEditorPosition) => {
    setDraft((current) =>
      current
        ? withPositions(current, current.positions.flatMap((item) => item.id === position.id
            ? [item, { ...position, id: `position-${crypto.randomUUID()}-copy`, quoteSnapshotId: null, calculatedInputKey: null }]
            : [item]))
        : current,
    );
    setSaveState("dirty");
  }, []);
  const deletePosition = useCallback((positionId: string) => {
    setDraft((current) =>
      current
        ? withPositions(
            current,
            current.positions.filter((position) => position.id !== positionId),
          )
        : current,
    );
    setSaveState("dirty");
  }, []);
  const addComment = useCallback(() => {
    const text = newComment.trim();
    if (!text) return;
    const comment: CommentThreadItem = {
      author: "Марина Кириллова",
      createdLabel: "Только что",
      id: `comment-${Date.now()}`,
      text,
    };
    setDraft((current) =>
      current
        ? { ...current, comments: [comment, ...current.comments] }
        : current,
    );
    setNewComment("");
    setSaveState("dirty");
  }, [newComment]);
  const addPayment = useCallback(
    (
      amount: number,
      method: BookingPaymentMethod,
      date: string,
      comment: string,
    ) => {
      if (amount <= 0) return;
      setDraft((current) =>
        current
          ? {
              ...current,
              paid: current.paid + amount,
              payments: [
                {
                  amount,
                  assignee: current.assignees[0] ?? null,
                  comment,
                  date,
                  dateLabel: dateLabel(date),
                  id: `payment-${Date.now()}`,
                  kind: "payment",
                  method,
                },
                ...current.payments,
              ],
            }
          : current,
      );
      setSaveState("dirty");
    },
    [],
  );
  const refundPayment = useCallback((paymentId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const payment = current.payments.find((item) => item.id === paymentId);
      const alreadyRefunded = current.payments.some(
        (item) => item.kind === "refund" && item.sourcePaymentId === paymentId,
      );
      if (!payment || payment.kind === "refund" || alreadyRefunded)
        return current;
      return {
        ...current,
        paid: Math.max(0, current.paid - payment.amount),
        payments: [
          {
            ...payment,
            date: new Date().toISOString().slice(0, 10),
            dateLabel: "Сегодня",
            id: `refund-${Date.now()}`,
            kind: "refund",
            sourcePaymentId: payment.id,
          },
          ...current.payments,
        ],
      };
    });
    setSaveState("dirty");
  }, []);
  const cancelRefund = useCallback((refundId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const refund = current.payments.find(
        (item) => item.id === refundId && item.kind === "refund",
      );
      if (!refund || !refund.id.startsWith("refund-")) return current;
      return {
        ...current,
        paid: current.paid + refund.amount,
        payments: current.payments.filter((item) => item.id !== refundId),
      };
    });
    setSaveState("dirty");
  }, []);
  const pricePending = Boolean(draft?.positions.some(position => isUuid(position.resourceId) && isStayCategory(position.category) &&
    (id === "new" || Boolean(position.addOns?.length) || position.calculatedInputKey != null) && position.calculatedInputKey !== bookingPriceKey(position)));
  useEffect(() => {
    if (!pricePending) setMutationError((current) => current === PRICE_PENDING_MESSAGE ? null : current);
  }, [pricePending]);
  const showPendingPrice = () => {
    setMutationError(PRICE_PENDING_MESSAGE);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set("tab", "composition");
      return next;
    });
  };
  const applyPromo = async () => {
    if (!draft || !repository.previewPromotion) return;
    if (pricePending) { showPendingPrice(); return; }
    const input = draft;
    setPromoPending(true);
    setMutationError(null);
    try {
      const result = await repository.previewPromotion(input);
      if (currentDraft.current?.promo !== input.promo || JSON.stringify(currentDraft.current.positions) !== JSON.stringify(input.positions)) return;
      setDraft(current => current ? { ...current, promotion: result.promotion, promo: result.promotion.code, amount: result.total.amountMinor / 100 } : current);
      setSaveState("dirty");
    } catch (reason) { setMutationError(bookingMutationMessage(reason, "Не удалось применить промокод")); }
    finally { setPromoPending(false); }
  };
  const changePromo = (promo: string) => {
    setDraft(current => current ? { ...current, promo, promotion: null, amount: current.positions.reduce((sum, position) => sum + position.total, 0) } : current);
    setSaveState("dirty");
    setMutationError(null);
  };
  const changeSourceLead = async (sourceLeadId: string | null) => {
    const current = currentDraft.current;
    if (!current || current.sourceLeadId === sourceLeadId) return;
    if (current.id === "new") {
      update("sourceLeadId", sourceLeadId);
      return;
    }
    if (current.version === undefined || !repository.linkLead || !repository.unlinkLead) {
      setMutationError("Изменение связи с заявкой недоступно.");
      return;
    }
    setRelationPending(true);
    setMutationError(null);
    try {
      const result = sourceLeadId
        ? await repository.linkLead(current.id, sourceLeadId, current.version, "manual")
        : await repository.unlinkLead(current.id, current.version);
      setDraft((latest) => latest ? {
        ...latest,
        sourceLeadId: result.link?.leadId ?? null,
        version: result.bookingVersion,
      } : latest);
      setLeadHistory({ status: "idle" });
      setLeadHistoryRevision((revision) => revision + 1);
    } catch (reason) {
      if (reason instanceof ApiClientError && reason.isConflict) setSaveState("conflict");
      setMutationError(bookingMutationMessage(reason, "Не удалось изменить связь с заявкой"));
    } finally {
      setRelationPending(false);
    }
  };
  const save = async () => {
    if (!draft) return;
    if (pricePending) { showPendingPrice(); return; }
    if (draft.positions.some((position) => position.addOns?.length && position.discount !== 0)) return;
    setSaveState("saving");
    setMutationError(null);
    try {
      const saved = await repository.save(draft);
      setDraft(saved);
      setSaveState("saved");
    } catch (reason) {
      setSaveState("conflict");
      setMutationError(bookingMutationMessage(reason, "Не удалось сохранить бронирование"));
    }
  };

  const draftStatus = draft?.status;
  const statusControl = useMemo(
    () =>
      draftStatus ? (
        <FilterSelect
          className="w-28 max-w-28 sm:w-36 sm:max-w-36"
          label="Статус бронирования"
          onValueChange={(value) => setStatus(value as BookingStatus)}
          options={statusOptions}
          value={draftStatus}
        />
      ) : undefined,
    [draftStatus, setStatus],
  );
  const title = draft?.clientName ?? "Бронирование";
  const editorChrome = useMemo(
    () => ({
      idLabel: `#${id}`,
      mobileStatus: statusControl,
      onBack: () => navigate(-1),
      title,
    }),
    [id, navigate, statusControl, title],
  );
  useEditorLayoutChrome(editorChrome);

  const navigation = (
    <PageNav
      ariaLabel="Разделы редактора бронирования"
      items={tabItems}
      onValueChange={(value) =>
        setParams((current) => {
          const next = new URLSearchParams(current);
          if (value === "main") next.delete("tab");
          else next.set("tab", value);
          return next;
        })
      }
      value={tab}
    />
  );
  const desktopActions = draft ? (
    <>
      {statusControl}
      <AssigneePicker
        label="Сменить ответственного бронирования"
        onPeopleChange={(people) => update("assignees", people)}
        onValueChange={setAssignee}
        options={bookingAssignees}
        people={draft.assignees}
      />
      <BookingOverflow
        cancelled={draft.status === "cancelled"}
        onCancel={() => setStatus("cancelled")}
      />
    </>
  ) : null;
  const mobileActions = draft ? (
    <BookingMobileActions
      cancelled={draft.status === "cancelled"}
      onAssigneeChange={setAssignee}
      onCancel={() => setStatus("cancelled")}
    />
  ) : null;
  return (
    <EditorFrame
      actions={desktopActions}
      footerActions={
        <>
          <Button onClick={() => navigate(-1)} size="sm" variant="outline">
            Закрыть
          </Button>
          <Button
            disabled={!draft || saveState === "saving" || promoPending || relationPending || Boolean(repository.previewPromotion && draft.promo && draft.promo !== "Без промокода" && !draft.promotion) || draft.positions.some((position) => position.addOns?.length && position.discount !== 0)}
            onClick={() => void save()}
            size="sm"
          >
            Сохранить
          </Button>
        </>
      }
      mobileActions={mobileActions}
      navigation={navigation}
      saveState={saveState}
      sidebar={
        draft ? (
          <BookingSidebar
            draft={draft}
            onAddPayment={addPayment}
            onAssigneeChange={setAssignee}
            onAssigneesChange={(people) => update("assignees", people)}
            onCancelRefund={cancelRefund}
            onPromoChange={changePromo}
            onApplyPromo={repository.previewPromotion ? () => void applyPromo() : undefined}
            promoPending={promoPending}
            onRefund={refundPayment}
            onSourceLeadChange={(sourceLeadId) => void changeSourceLead(sourceLeadId)}
            relationPending={relationPending}
          />
        ) : (
          <Skeleton className="h-96 rounded-xl" />
        )
      }
    >
      {loading ? <BookingEditorLoading /> : null}
      {mutationError ? <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">{mutationError}</p> : null}
      {error ? (
        <div className="rounded-xl border bg-background">
          <PageState
            icon={IconAlertTriangle}
            title="Бронирование не открылось"
            tone="danger"
          >
            {error}
          </PageState>
        </div>
      ) : null}
      {draft && tab === "main" ? (
        <BookingMain
          draft={draft}
          newComment={newComment}
          onAddComment={addComment}
          onCommentChange={setNewComment}
          update={update}
        />
      ) : null}
      {draft && tab === "composition" ? (
        <BookingComposition
          autoPrice={id === "new"}
          draft={draft}
          onAdd={addPosition}
          onDelete={deletePosition}
          onDuplicate={duplicatePosition}
          onResourceChange={changeResource}
          pricingGateway={pricingGateway}
          updatePosition={updatePosition}
        />
      ) : null}
      {draft && tab === "marketing" ? (
        <BookingMarketing draft={draft} updateMarketing={updateMarketing} />
      ) : null}
      {draft && !["main", "composition", "marketing"].includes(tab) ? (
        <BookingRelatedTab
          draft={draft}
          leadHistory={leadHistory}
          tab={
            tab as Exclude<
              BookingEditorTab,
              "main" | "composition" | "marketing"
            >
          }
        />
      ) : null}
    </EditorFrame>
  );
}

function BookingOverflow({
  cancelled,
  onCancel,
}: {
  cancelled: boolean;
  onCancel: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия бронирования"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={cancelled} onClick={onCancel}>
          <IconArchive aria-hidden="true" />
          {cancelled ? "Бронирование отменено" : "Отменить бронирование"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function BookingMobileActions({
  cancelled,
  onAssigneeChange,
  onCancel,
}: {
  cancelled: boolean;
  onAssigneeChange: (person: Assignee | null) => void;
  onCancel: () => void;
}) {
  const bookingAssignees = useDirectoryAssignees("booking");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия бронирования"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {bookingAssignees.map((person) => (
          <DropdownMenuItem
            key={person.id}
            onClick={() => onAssigneeChange(person)}
          >
            <IconUsers aria-hidden="true" />
            {person.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => onAssigneeChange(null)}>
          <IconUsers aria-hidden="true" />
          Без ответственного
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={cancelled} onClick={onCancel}>
          <IconArchive aria-hidden="true" />
          {cancelled ? "Бронирование отменено" : "Отменить бронирование"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BookingMain({
  draft,
  newComment,
  onAddComment,
  onCommentChange,
  update,
}: {
  draft: BookingEditorRecord;
  newComment: string;
  onAddComment: () => void;
  onCommentChange: (value: string) => void;
  update: <K extends keyof BookingEditorRecord>(
    key: K,
    value: BookingEditorRecord[K],
  ) => void;
}) {
  const customers = useDirectoryCustomers();
  const selectedCustomer = customers.find(
    (customer) =>
      customer.name === draft.clientName || customer.phone === draft.phone,
  );
  return (
    <div className="space-y-3">
      <EditorSection title="Основные данные">
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-4"
            htmlFor="booking-client"
            label="Клиент"
          >
            <EntityCombobox
              label="Клиент бронирования"
              {...(selectedCustomer
                ? {
                    onOpenSelected: () => {
                      window.location.href = `/customers/${selectedCustomer.id}`;
                    },
                  }
                : {})}
              onValueChange={(customerId) => {
                const customer = customers.find(
                  (item) => item.id === customerId,
                );
                if (customer) {
                  update("clientName", customer.name);
                  update("phone", customer.phone);
                }
              }}
              options={customers.map((customer) => ({
                value: customer.id,
                label: customer.name,
                secondary: customer.phone,
              }))}
              placeholder={draft.clientName || "Выберите клиента"}
              value={selectedCustomer?.id ?? ""}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="booking-phone"
            label="Телефон"
          >
            <Input
              id="booking-phone"
              inputMode="tel"
              onChange={(event) => update("phone", event.target.value)}
              value={draft.phone}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="booking-message"
            label="Сообщение от клиента"
          >
            <Textarea
              id="booking-message"
              onChange={(event) => update("clientMessage", event.target.value)}
              placeholder="Сообщение отсутствует"
              value={draft.clientMessage}
            />
          </FormField>
        </div>
      </EditorSection>
      <EditorSection title="Комментарии менеджеров">
        <CommentThread
          comments={draft.comments}
          draft={newComment}
          onAdd={onAddComment}
          onDraftChange={onCommentChange}
        />
      </EditorSection>
    </div>
  );
}

function BookingComposition({
  autoPrice,
  draft,
  onAdd,
  onDelete,
  onDuplicate,
  onResourceChange,
  pricingGateway,
  updatePosition,
}: {
  autoPrice: boolean;
  draft: BookingEditorRecord;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (position: BookingEditorPosition) => void;
  onResourceChange: (id: string, resourceId: string) => void;
  pricingGateway: ResourceStayQuoteGateway;
  updatePosition: <K extends keyof BookingEditorPosition>(
    id: string,
    key: K,
    value: BookingEditorPosition[K],
  ) => void;
}) {
  const resources = useDirectoryResources();
  const resourceOptions = resources.map((resource) => ({ value: resource.id, label: resource.name }));
  const [quoteState, setQuoteState] = useState<Record<string, "loading" | "ready" | "error">>({});
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [quoteRetry, setQuoteRetry] = useState(0);
  const [catalogs, setCatalogs] = useState<Record<string, { assignmentId: string; addOnOfferingId: string; label: string; serviceType: "quantity_service" | "person_service"; available: boolean; requestOnly: boolean; blocker?: string }[]>>({});
  const quotedInputs = useRef(new Map<string, string>());
  const dirtyAddOnPositions = useRef(new Set<string>());
  const catalogTargetsKey = JSON.stringify(draft.positions
    .filter((position) => isStayCategory(position.category) && isUuid(position.resourceId))
    .map(({ id, resourceId }) => ({ id, resourceId })));

  useEffect(() => {
    let active = true;
    const catalogTargets = JSON.parse(catalogTargetsKey) as Array<{ id: string; resourceId: string }>;
    for (const position of catalogTargets) {
      setCatalogs((current) => ({ ...current, [position.id]: [] }));
      void houseOfferingGateway.resolvePrimaryStayOffering(position.resourceId).then(async (resolved) => {
        if (resolved.resolution !== "linked") return;
        const editor = resolved.offering.kind === "house" ? await houseOfferingGateway.getHouseEditor(resolved.offering.offeringId) : await houseOfferingGateway.getCampgroundEditor(resolved.offering.offeringId);
        if (!active || !editor) return;
        const next = editor.addOnAssignments.filter((assignment) => assignment.enabled).map((assignment) => {
          const item = editor.addOnCatalog.find((candidate) => candidate.offering.id === assignment.addOnOfferingId);
          const blocker = item?.availability.blocker === "active_price_book_missing" ? "Нет цены" : item?.availability.blocker === "archived" ? "В архиве" : item?.availability.blocker === "not_active" ? "Не активен" : undefined;
          const serviceType: "quantity_service" | "person_service" = item?.serviceType === "person_service" ? "person_service" : "quantity_service";
          const requestOnly = item?.offering.salesMode === "request_only";
          const supported = item?.serviceType === "quantity_service" || item?.serviceType === "person_service";
          return { assignmentId: assignment.id, addOnOfferingId: assignment.addOnOfferingId, label: assignment.labelOverride ?? item?.offering.operationalName ?? "Дополнительная услуга", serviceType, requestOnly, available: supported && !requestOnly && item?.availability.status !== "blocked", ...(!supported ? { blocker: "Нужен выбор времени" } : blocker ? { blocker } : {}) };
        });
        setCatalogs((current) => ({ ...current, [position.id]: next }));
      }).catch(() => { if (active) setCatalogs((current) => ({ ...current, [position.id]: [] })); });
    }
    return () => { active = false; };
  }, [catalogTargetsKey]);

  useEffect(() => {
    let active = true;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const pendingInputs = new Map<string, string>();
    const cachedInputs = quotedInputs.current;
    for (const position of draft.positions) {
      if (!isStayCategory(position.category) || !isUuid(position.resourceId)) continue;
      if (!autoPrice && !position.addOns?.length && position.calculatedInputKey == null && !dirtyAddOnPositions.current.has(position.id)) continue;
      const arrivalDate = position.startAt.slice(0, 10);
      const departureDate = position.endAt.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivalDate) || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate) || arrivalDate >= departureDate || position.guestCount < 1) continue;
      const inputKey = bookingPriceKey(position);
      if (position.calculatedInputKey === inputKey) continue;
      if (quotedInputs.current.get(position.id) === inputKey) continue;
      setQuoteState((current) => ({ ...current, [position.id]: "loading" }));
      timers.push(setTimeout(() => {
        quotedInputs.current.set(position.id, inputKey);
        pendingInputs.set(position.id, inputKey);
        const input = {
          arrivalDate,
          currency: "RUB" as const,
          departureDate,
          idempotencyKey: `booking-quote-${crypto.randomUUID()}`,
          operationId: crypto.randomUUID(),
          quantity: position.guestCount,
          addOns: (position.addOns ?? []).map(({ assignmentId, quantity }) => ({ assignmentId, quantity })),
        };
        void pricingGateway.previewResourceStayQuote(position.resourceId, input).then((quote) => {
          if (!active || quotedInputs.current.get(position.id) !== inputKey) return;
          pendingInputs.delete(position.id);
          setQuoteState((current) => ({ ...current, [position.id]: "ready" }));
          dirtyAddOnPositions.current.delete(position.id);
          updatePosition(position.id, "basePrice", quote.total.amountMinor / 100);
          updatePosition(position.id, "quoteSnapshotId", (position.addOns ?? []).length ? quote.quoteId : null);
          const prices = new Map((quote.lines ?? []).filter((line) => line.kind === "addon" && line.addOnAssignmentId).map((line) => [line.addOnAssignmentId!, line.amount.amountMinor / 100]));
          updatePosition(position.id, "addOns", (position.addOns ?? []).map((addon) => ({ ...addon, price: prices.get(addon.assignmentId) ?? addon.price })));
          updatePosition(position.id, "calculatedInputKey", inputKey);
        }).catch((reason: unknown) => {
          if (!active || quotedInputs.current.get(position.id) !== inputKey) return;
          pendingInputs.delete(position.id);
          setQuoteState((current) => ({ ...current, [position.id]: "error" }));
          setQuoteErrors((current) => ({ ...current, [position.id]: reason instanceof Error ? reason.message : "Сервис расчёта недоступен" }));
        });
      }, 250));
    }
    return () => {
      active = false;
      timers.forEach(clearTimeout);
      // A changed position can cancel an in-flight request. Do not cache an
      // input whose result was discarded, or the retry will stay loading.
      for (const [positionId, inputKey] of pendingInputs) {
        if (cachedInputs.get(positionId) === inputKey) cachedInputs.delete(positionId);
      }
    };
  }, [autoPrice, draft.positions, pricingGateway, quoteRetry, updatePosition]);

  return (
    <div className="min-w-0 space-y-3" data-slot="booking-composition">
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Состав <span className="ml-1 text-muted-foreground">{draft.positions.length}</span></h2>
        <Button className="min-h-11 sm:min-h-8" onClick={onAdd} size="sm">
          <IconPlus aria-hidden="true" />
          Добавить позицию
        </Button>
      </div>
      {draft.positions.length ? (
        <div className="min-w-0 space-y-3">
          {draft.positions.map((position, index) => (
            <EditorSection className="min-w-0" key={position.id} title={`Позиция ${index + 1}`} actions={
                <div className="flex items-center gap-1">
                  <PositionAction
                    icon={IconCopy}
                    label={`Дублировать позицию ${index + 1}`}
                    onClick={() => onDuplicate(position)}
                  />
                  <PositionAction
                    icon={IconTrash}
                    label={`Удалить позицию ${index + 1}`}
                    onClick={() => onDelete(position.id)}
                  />
                </div>
              }>
              <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_5rem] items-start gap-3 sm:grid-cols-6 [&_button]:min-h-11 [&_input]:min-h-11 sm:[&_button]:min-h-9 sm:[&_input]:min-h-9">
                <FormField
                  className="col-span-2 min-w-0 sm:col-span-2"
                  htmlFor={`${position.id}-type`}
                  label="Тип позиции"
                >
                  <FormSelect
                    className="min-w-0 [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
                    id={`${position.id}-type`}
                    label={`Тип позиции ${index + 1}`}
                    onValueChange={(value) =>
                      updatePosition(
                        position.id,
                        "category",
                        value as Exclude<BookingCategory, "all">,
                      )
                    }
                    options={categoryOptions}
                    value={position.category}
                  />
                </FormField>
                <FormField
                  className="min-w-0 sm:col-span-3"
                  htmlFor={`${position.id}-resource`}
                  label="Ресурс"
                >
                  <FormSelect
                    className="min-w-0 [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
                    id={`${position.id}-resource`}
                    label={`Ресурс позиции ${index + 1}`}
                    onValueChange={(value) =>
                      onResourceChange(position.id, value)
                    }
                    options={resourceOptions.filter(
                      (option) =>
                        resources.find(
                          (resource) => resource.id === option.value,
                        )?.category === position.category,
                    )}
                    value={position.resourceId}
                  />
                </FormField>
                <FormField
                  className="min-w-0 sm:col-span-1"
                  htmlFor={`${position.id}-guests`}
                  label="Гостей"
                >
                  <Input
                    id={`${position.id}-guests`}
                    min="1"
                    onChange={(event) =>
                      updatePosition(
                        position.id,
                        "guestCount",
                        inputNumber(event.target.value),
                      )
                    }
                    type="number"
                    value={position.guestCount}
                  />
                </FormField>
                <FormField className="col-span-2 min-w-0 sm:col-span-4" htmlFor={`${position.id}-period`} label="Период">
                  <DateTimeRangePicker id={`${position.id}-period`} label={`Период позиции ${index + 1}`} onValueChange={(value) => {
                    updatePosition(position.id, "startAt", value.from);
                    updatePosition(position.id, "endAt", value.to);
                  }} value={{ from: position.startAt, to: position.endAt }} />
                </FormField>
              </div>
              {isStayCategory(position.category) && catalogs[position.id]?.length ? <BookingAddOns position={position} options={catalogs[position.id]!} onChange={(addOns) => { dirtyAddOnPositions.current.add(position.id); updatePosition(position.id, "addOns", addOns); updatePosition(position.id, "quoteSnapshotId", null); }} /> : null}
              <div className="mt-3 grid min-w-0 grid-cols-2 items-start gap-3 border-t pt-3 sm:grid-cols-6 [&_input]:min-h-11 sm:[&_input]:min-h-9">
                <FormField
                  className="min-w-0 sm:col-span-3"
                  htmlFor={`${position.id}-base`}
                  label="Стоимость, ₽"
                >
                  <div><Input
                      id={`${position.id}-base`}
                      min="0"
                      onChange={(event) =>
                        updatePosition(
                          position.id,
                          "basePrice",
                          inputNumber(event.target.value),
                        )
                      }
                      readOnly={isStayCategory(position.category) && (autoPrice || Boolean(position.addOns?.length))}
                      type="number"
                      value={position.basePrice}
                    />{(autoPrice || Boolean(position.addOns?.length) || dirtyAddOnPositions.current.has(position.id)) && isStayCategory(position.category) ? <div aria-live="polite" className={`mt-1 text-[11px] ${quoteState[position.id] === "error" ? "text-danger-foreground" : "text-muted-foreground"}`}>
                      {quoteState[position.id] === "loading" ? "Рассчитываем по датам…" : quoteState[position.id] === "ready" ? "Рассчитано по ценам ресурса" : quoteState[position.id] === "error" ? <><p className="break-words">Не удалось рассчитать: {quoteErrors[position.id]}</p><Button aria-label={`Повторить расчёт позиции ${index + 1}`} className="mt-1 min-h-11 sm:min-h-8" onClick={() => { quotedInputs.current.delete(position.id); setQuoteRetry((current) => current + 1); }} size="sm" variant="outline"><IconRotateClockwise aria-hidden="true" />Повторить расчёт</Button></> : "Укажите даты заезда и выезда"}
                    </div> : null}{position.addOns?.length ? <p className="mt-1 text-[11px] text-muted-foreground">Допуслуги включены в стоимость</p> : null}</div>
                </FormField>
                <FormField
                  className="min-w-0 sm:col-span-1"
                  htmlFor={`${position.id}-discount`}
                  label="Скидка, %"
                >
                  <Input
                    aria-describedby={position.addOns?.length ? `${position.id}-discount-help` : undefined}
                    disabled={Boolean(position.addOns?.length)}
                    id={`${position.id}-discount`}
                    max="100"
                    min="0"
                    onChange={(event) =>
                      updatePosition(
                        position.id,
                        "discount",
                        inputNumber(event.target.value),
                      )
                    }
                    type="number"
                    value={position.discount}
                  />
                </FormField>
                <FormField
                  className="col-span-2 min-w-0 sm:col-span-2"
                  htmlFor={`${position.id}-total`}
                  label="Итого"
                >
                  <output
                    aria-label={`Итого позиции ${index + 1}`}
                    className="flex min-h-11 items-center text-lg font-semibold tabular-nums sm:min-h-9"
                    id={`${position.id}-total`}
                  >{money.format(position.total)}</output>
                </FormField>
              </div>
              {position.addOns?.length ? <div className="mt-2 text-[11px] text-muted-foreground" id={`${position.id}-discount-help`}>
                {position.discount !== 0 ? <><p role="alert" className="text-danger-foreground">Сохранение недоступно: для позиции с допуслугами скидка должна быть 0%. Уберите скидку или допуслуги.</p><Button className="mt-1 min-h-11 sm:min-h-8" onClick={() => updatePosition(position.id, "discount", 0)} size="sm" variant="outline">Убрать скидку</Button></> : "Ручная скидка недоступна для позиции с допуслугами."}
              </div> : null}
            </EditorSection>
          ))}
        </div>
      ) : (
        <PageState
          actionLabel="Добавить позицию"
          icon={IconReceipt}
          onAction={onAdd}
          title="Состав пока пуст"
        >
          Добавьте ресурс, время, количество гостей и цену.
        </PageState>
      )}
    </div>
  );
}

function BookingAddOns({ position, options, onChange }: { position: BookingEditorPosition; options: { assignmentId: string; addOnOfferingId: string; label: string; serviceType: "quantity_service" | "person_service"; available: boolean; requestOnly: boolean; blocker?: string }[]; onChange: (value: BookingEditorAddOn[]) => void }) {
  const selected = position.addOns ?? [];
  return <div className="mt-3 min-w-0 border-t pt-3" data-slot="booking-addons">
    <p className="mb-2 text-xs font-medium">Дополнительные услуги</p>
    <div className="divide-y">
      {options.map((option) => {
        const current = selected.find((item) => item.assignmentId === option.assignmentId);
        return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]" key={option.assignmentId}>
          <span className="min-w-0 break-words [overflow-wrap:anywhere]">{option.label}</span>
          <Button className="min-h-11 sm:order-last sm:min-h-8" disabled={!current && !option.available} onClick={() => onChange(current ? selected.filter((item) => item.assignmentId !== option.assignmentId) : [...selected, { assignmentId: option.assignmentId, addOnOfferingId: option.addOnOfferingId, label: option.label, serviceType: option.serviceType, quantity: 1, price: 0 }])} size="sm" variant={current ? "secondary" : "outline"}>{current ? "Убрать" : "Добавить"}</Button>
          {current ? <Input aria-label={`Количество ${option.label}`} className="min-h-11 w-20 sm:min-h-8" min="1" onChange={(event) => onChange(selected.map((item) => item.assignmentId === option.assignmentId ? { ...item, quantity: Math.max(1, inputNumber(event.target.value)) } : item))} type="number" value={current.quantity} /> : <span className="hidden sm:block" />}
          <span className="min-w-0 text-right text-[11px] tabular-nums text-muted-foreground">{option.requestOnly ? "По запросу" : option.blocker ?? (current ? money.format(current.price) : "")}</span>
        </div>;
      })}
    </div>
  </div>;
}
function PositionAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            className="size-11 sm:size-8"
            onClick={onClick}
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <Icon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function BookingMarketing({
  draft,
  updateMarketing,
}: {
  draft: BookingEditorRecord;
  updateMarketing: <K extends keyof MarketingAttributionDraft>(
    key: K,
    value: MarketingAttributionDraft[K],
  ) => void;
}) {
  return (
    <EditorMarketingAttribution
      idPrefix="booking-marketing"
      onChange={updateMarketing}
      value={draft.marketing}
    />
  );
}

function BookingRelatedTab({
  draft,
  leadHistory,
  tab,
}: {
  draft: BookingEditorRecord;
  leadHistory:
    | { status: "idle" | "loading" }
    | { status: "ready"; items: BookingLeadLink[] }
    | { status: "error"; message: string };
  tab: Exclude<BookingEditorTab, "main" | "composition" | "marketing">;
}) {
  if (tab === "communications")
    return <EditorPreviewCommunications phone={draft.phone} />;
  if (tab === "tasks")
    return <EditorPreviewTasks relationLabel={`Бронирование #${draft.id}`} />;
  if (tab === "visits")
    return <EditorPreviewVisits clientName={draft.clientName} />;
  return <div className="space-y-3">
    <EditorSection title="История связи с заявкой">
      {leadHistory.status === "idle" || leadHistory.status === "loading" ? <p className="text-sm text-muted-foreground">Загрузка истории…</p> : null}
      {leadHistory.status === "error" ? <p role="alert" className="text-sm text-destructive">{leadHistory.message}</p> : null}
      {leadHistory.status === "ready" && leadHistory.items.length === 0 ? <p className="text-sm text-muted-foreground">Связей с заявками ещё не было.</p> : null}
      {leadHistory.status === "ready" && leadHistory.items.length > 0 ? <div className="divide-y">
        {leadHistory.items.map((item) => <div className="grid gap-1 py-2 text-sm" key={item.id}>
          <span>Заявка #{item.leadId} · {item.method === "from_lead" ? "создание из заявки" : "ручная связь"}</span>
          <span className="text-xs text-muted-foreground">{new Date(item.linkedAt).toLocaleString("ru-RU")}{item.unlinkedAt ? ` · отвязана ${new Date(item.unlinkedAt).toLocaleString("ru-RU")}` : " · активна"}</span>
        </div>)}
      </div> : null}
    </EditorSection>
    <EditorPreviewHistory entityLabel="Бронь" />
  </div>;
}

function BookingSidebar({
  draft,
  onAddPayment,
  onAssigneeChange,
  onAssigneesChange,
  onCancelRefund,
  onPromoChange,
  onApplyPromo,
  promoPending,
  relationPending,
  onRefund,
  onSourceLeadChange,
}: {
  draft: BookingEditorRecord;
  onAddPayment: (
    amount: number,
    method: BookingPaymentMethod,
    date: string,
    comment: string,
  ) => void;
  onAssigneeChange: (person: Assignee | null) => void;
  onAssigneesChange: (people: Assignee[]) => void;
  onCancelRefund: (id: string) => void;
  onPromoChange: (value: string) => void;
  onApplyPromo?: (() => void) | undefined;
  promoPending: boolean;
  relationPending: boolean;
  onRefund: (id: string) => void;
  onSourceLeadChange: (leadId: string | null) => void;
}) {
  const navigate = useNavigate();
  const bookingAssignees = useDirectoryAssignees("booking");
  const leads = useDirectoryLeads();
  const bookings = useDirectoryBookings();
  const promoReadonly = Boolean(draft.lifecycleStatus && !["draft", "unconfirmed"].includes(draft.lifecycleStatus));
  return (
    <div className="space-y-3">
      <OperationalSummary
        details={<>
          <ListRow>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Ответственные
              </span>
              <AssigneePicker
                label="Сменить ответственного бронирования в сводке"
                onPeopleChange={onAssigneesChange}
                onValueChange={onAssigneeChange}
                options={bookingAssignees}
                people={draft.assignees}
              />
            </div>
          </ListRow>
          <ListRow>
            <div className="grid gap-2 px-4 py-3">
              <div className="flex items-center gap-2 text-xs">
                <IconLink
                  aria-hidden="true"
                  className="size-3.5 text-muted-foreground"
                />
                <span className="text-muted-foreground">Исходная заявка</span>
              </div>
              <ManualRelationPicker
                addLabel="Связать с заявкой"
                disabled={relationPending}
                emptyLabel="Не привязана"
                label="Найти и связать заявку"
                onOpen={(href) => navigate(href)}
                onValuesChange={(values) =>
                  onSourceLeadChange(values[0] ?? null)
                }
                options={getLeadRelationOptions(draft, leads, bookings)}
                values={draft.sourceLeadId ? [draft.sourceLeadId] : []}
              />
            </div>
          </ListRow>
        </>}
        detailsCount={2}
        icon={IconUsers}
        tone="stay"
      />
      <PaymentEditor
        booking={draft}
        promoControl={<div className="grid gap-2 border-t pt-3">
              <span className="text-xs font-medium">Промокод</span>
              <Input
                aria-label="Промокод бронирования"
                disabled={promoReadonly || promoPending}
                onChange={(event) => onPromoChange(event.target.value)}
                value={draft.promo === "Без промокода" ? "" : draft.promo}
                placeholder="Например, SUMMER10"
              />
              {onApplyPromo ? <>
                <div className="flex gap-2">
                  <Button disabled={promoReadonly || promoPending || !draft.promo.trim() || Boolean(draft.promotion)} onClick={onApplyPromo} size="sm" variant="outline">{promoPending ? "Проверяем…" : "Применить"}</Button>
                  {draft.promo ? <Button disabled={promoReadonly || promoPending} onClick={() => onPromoChange("")} size="sm" variant="ghost">Убрать код</Button> : null}
                </div>
                <p className="text-xs text-muted-foreground" aria-live="polite">{draft.promotion ? `Скидка по коду: −${money.format(draft.promotion.discountAmountMinor / 100)}. Итого: ${money.format(draft.amount)}` : draft.promo ? "Проверьте код для текущего состава перед сохранением. С ручной скидкой не суммируется." : "Скидка применяется только после проверки кода."}</p>
              </> : <p className="text-xs text-muted-foreground">Проверка промокодов недоступна в демонстрационном режиме.</p>}
            </div>}
        onAdd={onAddPayment}
        onCancelRefund={onCancelRefund}
        onRefund={onRefund}
      />
    </div>
  );
}

function PaymentEditor({
  booking,
  promoControl,
  onAdd,
  onCancelRefund,
  onRefund,
}: {
  booking: BookingEditorRecord;
  promoControl: React.ReactNode;
  onAdd: (
    amount: number,
    method: BookingPaymentMethod,
    date: string,
    comment: string,
  ) => void;
  onCancelRefund: (id: string) => void;
  onRefund: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<BookingPaymentMethod>("card");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState("");
  const [refundTargetId, setRefundTargetId] = useState<string | null>(null);
  const refundTarget = booking.payments.find(
    (payment) => payment.id === refundTargetId,
  );
  const submit = () => {
    const value = inputNumber(amount);
    if (value <= 0) return;
    onAdd(value, method, date, comment);
    setAmount("");
    setComment("");
  };
  const debt = Math.abs(booking.amount - booking.paid);
  return (
    <EditorSection title="Оплата">
      <div className="space-y-4">
        <PaymentProgress
          className="w-full"
          paid={booking.paid}
          total={booking.amount}
        />
        <div className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
          <div>
            <span className="text-muted-foreground">{booking.paid > booking.amount ? "Переплата" : "Долг"}</span>
            <p className="mt-1 tabular-nums">{money.format(debt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Скидка по коду</span>
            <p className="mt-1 tabular-nums">{money.format((booking.promotion?.discountAmountMinor ?? 0) / 100)}</p>
          </div>
        </div>
        <div className="grid gap-3">
          {promoControl}
          <FormField htmlFor="payment-amount" label="Сумма">
            <Input
              id="payment-amount"
              min="0"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              type="number"
              value={amount}
            />
          </FormField>
          <FormField htmlFor="payment-method" label="Способ оплаты">
            <FormSelect
              id="payment-method"
              label="Способ оплаты"
              onValueChange={(value) =>
                setMethod(value as BookingPaymentMethod)
              }
              options={paymentMethodOptions}
              value={method}
            />
          </FormField>
          <FormField htmlFor="payment-date" label="Дата">
            <DatePicker
              className="w-full max-w-none"
              density="form"
              id="payment-date"
              label="Дата оплаты"
              onValueChange={(next) =>
                next && setDate(next.toISOString().slice(0, 10))
              }
              value={new Date(`${date}T12:00:00`)}
            />
          </FormField>
          <FormField htmlFor="payment-comment" label="Комментарий">
            <Input
              id="payment-comment"
              onChange={(event) => setComment(event.target.value)}
              placeholder="Необязательно"
              value={comment}
            />
          </FormField>
          <Button
            disabled={inputNumber(amount) <= 0}
            onClick={submit}
            size="sm"
          >
            <IconCash aria-hidden="true" />
            Добавить оплату
          </Button>
        </div>
        {booking.payments.length ? (
          <div className="divide-y border-t">
            {booking.payments.map((payment) => {
              const refunded =
                payment.kind === "payment" &&
                booking.payments.some(
                  (item) =>
                    item.kind === "refund" &&
                    item.sourcePaymentId === payment.id,
                );
              return (
                <div
                  className="flex items-center gap-2 py-3 text-xs"
                  key={payment.id}
                >
                  <span
                    className={
                      payment.kind === "refund"
                        ? "text-danger-foreground"
                        : "text-success-foreground"
                    }
                  >
                    {payment.kind === "refund" ? "−" : "+"}
                  </span>
                  <Button
                    className="h-auto min-w-0 flex-1 justify-start rounded-none p-0 text-left"
                    onClick={() => navigate(`/bookings/${booking.id}`)}
                    variant="ghost"
                  >
                    <span className="min-w-0"><span className="block tabular-nums">
                      {money.format(payment.amount)}
                      {refunded ? (
                        <span className="ml-1.5 text-[10px] text-muted-foreground">
                          возвращено
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {payment.dateLabel} ·{" "}
                      {bookingPaymentMethodLabels[payment.method]} · бронь #
                      {booking.id}
                      {payment.comment ? ` · ${payment.comment}` : ""}
                    </span></span>
                  </Button>
                  <Button
                    aria-label={`Открыть бронь #${booking.id}`}
                    onClick={() => navigate(`/bookings/${booking.id}`)}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <IconExternalLink aria-hidden="true" />
                  </Button>
                  {payment.kind === "payment" ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            aria-label={`Оформить возврат ${money.format(payment.amount)}`}
                            disabled={refunded}
                            onClick={() => setRefundTargetId(payment.id)}
                            size="icon-xs"
                            variant="ghost"
                          />
                        }
                      >
                        <IconRotateClockwise aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>
                        {refunded ? "Возврат уже оформлен" : "Оформить возврат"}
                      </TooltipContent>
                    </Tooltip>
                  ) : payment.id.startsWith("refund-") ? (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            aria-label={`Отменить возврат ${money.format(payment.amount)}`}
                            onClick={() => onCancelRefund(payment.id)}
                            size="icon-xs"
                            variant="ghost"
                          />
                        }
                      >
                        <IconX aria-hidden="true" />
                      </TooltipTrigger>
                      <TooltipContent>Отменить возврат</TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="border-t pt-3 text-center text-[11px] text-muted-foreground">
            Операций пока нет
          </p>
        )}
      </div>
      <ConfirmationDialog
        confirmLabel="Оформить возврат"
        description={`Вернуть ${money.format(refundTarget?.amount ?? 0)} по этой операции? Оплаченная сумма брони уменьшится на размер возврата.`}
        destructive
        onConfirm={() => refundTargetId && onRefund(refundTargetId)}
        onOpenChange={(open) => {
          if (!open) setRefundTargetId(null);
        }}
        open={refundTargetId !== null}
        title="Подтвердить возврат"
      />
    </EditorSection>
  );
}

function BookingEditorLoading() {
  return (
    <div
      aria-label="Загрузка редактора бронирования"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-52 rounded-xl" />
    </div>
  );
}
