import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  DateTimePicker,
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
import type { BookingLookup, DirectoryData, LeadLookup, ResourceLookup } from "@app/data/directory-repository";
import {
  normalizePhone,
  normalizeSearchText,
} from "@app/data/search-normalization";
import { useDirectoryAssignees, useDirectoryBookings, useDirectoryCustomers, useDirectoryData, useDirectoryLeads, useDirectoryResources } from "@app/features/use-directory-data";
import type {
  BookingCategory,
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
const statusOptions = bookingStatuses.map((value) => ({
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
  maximumFractionDigits: 0,
  style: "currency",
});

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
function createPosition(
  resources: ResourceLookup[],
  resourceId = resources[0]!.id,
  date = "2026-08-24",
  startHour = 10,
): BookingEditorPosition {
  const resource =
    resources.find((item) => item.id === resourceId) ??
    resources[0]!;
  return {
    basePrice: 0,
    category: resource.category,
    discount: 0,
    endAt: `${date}T${String(Math.min(23, startHour + 1)).padStart(2, "0")}:00`,
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
    : "2026-08-24";
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
    promo: "Без промокода",
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
  return {
    ...record,
    positions,
    amount: positions.reduce((sum, position) => sum + position.total, 0),
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
}: {
  repository?: BookingEditorRepository;
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
            next.total = Math.round(
              next.basePrice *
                (1 - Math.min(100, Math.max(0, next.discount)) / 100),
            );
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
            createPosition(directory!.resources, current.resourceId, current.date, current.startHour),
            ...current.positions,
          ])
        : current,
    );
    setSaveState("dirty");
  }, [directory]);
  const duplicatePosition = useCallback((position: BookingEditorPosition) => {
    setDraft((current) =>
      current
        ? withPositions(current, [
            { ...position, id: `position-${Date.now()}-copy` },
            ...current.positions,
          ])
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
      if (!refund) return current;
      return {
        ...current,
        paid: current.paid + refund.amount,
        payments: current.payments.filter((item) => item.id !== refundId),
      };
    });
    setSaveState("dirty");
  }, []);
  const save = async () => {
    if (!draft) return;
    setSaveState("saving");
    try {
      await repository.save(draft);
      setSaveState("saved");
    } catch {
      setSaveState("conflict");
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
            disabled={!draft || saveState === "saving"}
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
            onPromoChange={(promo) => update("promo", promo)}
            onRefund={refundPayment}
            onSourceLeadChange={(sourceLeadId) =>
              update("sourceLeadId", sourceLeadId)
            }
          />
        ) : (
          <Skeleton className="h-96 rounded-xl" />
        )
      }
    >
      {loading ? <BookingEditorLoading /> : null}
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
          draft={draft}
          onAdd={addPosition}
          onDelete={deletePosition}
          onDuplicate={duplicatePosition}
          onResourceChange={changeResource}
          updatePosition={updatePosition}
        />
      ) : null}
      {draft && tab === "marketing" ? (
        <BookingMarketing draft={draft} updateMarketing={updateMarketing} />
      ) : null}
      {draft && !["main", "composition", "marketing"].includes(tab) ? (
        <BookingRelatedTab
          draft={draft}
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
  const leads = useDirectoryLeads();
  const bookings = useDirectoryBookings();
  const selectedCustomer = customers.find(
    (customer) =>
      customer.name === draft.clientName || customer.phone === draft.phone,
  );
  const navigate = useNavigate();
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
            className="sm:col-span-3"
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
            className="sm:col-span-3"
            htmlFor="booking-lead"
            label="Исходная заявка"
          >
            <ManualRelationPicker
              addLabel="Связать с заявкой"
              emptyLabel="Исходная заявка не привязана"
              label="Найти и связать заявку"
              onOpen={(href) => navigate(href)}
              onValuesChange={(values) =>
                update("sourceLeadId", values[0] ?? null)
              }
              options={getLeadRelationOptions(draft, leads, bookings)}
              shortcut
              values={draft.sourceLeadId ? [draft.sourceLeadId] : []}
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
  draft,
  onAdd,
  onDelete,
  onDuplicate,
  onResourceChange,
  updatePosition,
}: {
  draft: BookingEditorRecord;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (position: BookingEditorPosition) => void;
  onResourceChange: (id: string, resourceId: string) => void;
  updatePosition: <K extends keyof BookingEditorPosition>(
    id: string,
    key: K,
    value: BookingEditorPosition[K],
  ) => void;
}) {
  const resources = useDirectoryResources();
  const resourceOptions = resources.map((resource) => ({ value: resource.id, label: resource.name }));
  return (
    <EditorSection
      actions={
        <Button onClick={onAdd} size="sm">
          <IconPlus aria-hidden="true" />
          Добавить сверху
        </Button>
      }
      subtitle="Количество гостей задаётся для каждой услуги отдельно; скидка автоматически пересчитывает итог."
      title="Состав брони"
    >
      {draft.positions.length ? (
        <div className="divide-y rounded-lg border">
          {draft.positions.map((position, index) => (
            <article className="p-3" key={position.id}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-medium">
                  {index === 0 && position.basePrice === 0
                    ? "Новая позиция"
                    : `Позиция ${index + 1}`}
                </p>
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
              </div>
              <div className="grid items-start gap-3 sm:grid-cols-6">
                <FormField
                  className="sm:col-span-2"
                  htmlFor={`${position.id}-type`}
                  label="Тип позиции"
                >
                  <FormSelect
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
                  className="sm:col-span-3"
                  htmlFor={`${position.id}-resource`}
                  label="Ресурс"
                >
                  <FormSelect
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
                  className="sm:col-span-1"
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
                <FormField
                  className="sm:col-span-3"
                  htmlFor={`${position.id}-start`}
                  label="Начало"
                >
                  <DateTimePicker
                    id={`${position.id}-start`}
                    label={`Начало позиции ${index + 1}`}
                    onValueChange={(value) =>
                      updatePosition(position.id, "startAt", value)
                    }
                    value={position.startAt}
                  />
                </FormField>
                <FormField
                  className="sm:col-span-3"
                  htmlFor={`${position.id}-end`}
                  label="Окончание"
                >
                  <DateTimePicker
                    id={`${position.id}-end`}
                    label={`Окончание позиции ${index + 1}`}
                    onValueChange={(value) =>
                      updatePosition(position.id, "endAt", value)
                    }
                    value={position.endAt}
                  />
                </FormField>
                <FormField
                  className="sm:col-span-2"
                  htmlFor={`${position.id}-base`}
                  label="Базовая цена"
                >
                  <Input
                    id={`${position.id}-base`}
                    min="0"
                    onChange={(event) =>
                      updatePosition(
                        position.id,
                        "basePrice",
                        inputNumber(event.target.value),
                      )
                    }
                    type="number"
                    value={position.basePrice}
                  />
                </FormField>
                <FormField
                  className="sm:col-span-2"
                  htmlFor={`${position.id}-discount`}
                  label="Скидка, %"
                >
                  <Input
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
                  className="sm:col-span-2"
                  htmlFor={`${position.id}-total`}
                  label="Итого"
                >
                  <Input
                    id={`${position.id}-total`}
                    readOnly
                    type="number"
                    value={position.total}
                  />
                </FormField>
              </div>
            </article>
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
    </EditorSection>
  );
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
  tab,
}: {
  draft: BookingEditorRecord;
  tab: Exclude<BookingEditorTab, "main" | "composition" | "marketing">;
}) {
  if (tab === "communications")
    return <EditorPreviewCommunications phone={draft.phone} />;
  if (tab === "tasks")
    return <EditorPreviewTasks relationLabel={`Бронирование #${draft.id}`} />;
  if (tab === "visits")
    return <EditorPreviewVisits clientName={draft.clientName} />;
  return <EditorPreviewHistory entityLabel="Бронь" />;
}

function BookingSidebar({
  draft,
  onAddPayment,
  onAssigneeChange,
  onAssigneesChange,
  onCancelRefund,
  onPromoChange,
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
  onRefund: (id: string) => void;
  onSourceLeadChange: (leadId: string | null) => void;
}) {
  const navigate = useNavigate();
  const bookingAssignees = useDirectoryAssignees("booking");
  const leads = useDirectoryLeads();
  const bookings = useDirectoryBookings();
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
          <ListRow>
            <div className="grid gap-1.5 px-4 py-3">
              <span className="text-xs font-medium">Промокод</span>
              <Input
                aria-label="Промокод бронирования"
                onChange={(event) => onPromoChange(event.target.value)}
                value={draft.promo}
              />
            </div>
          </ListRow>
        </>}
        detailsCount={3}
        icon={IconUsers}
        tone="stay"
      />
      <PaymentEditor
        booking={draft}
        onAdd={onAddPayment}
        onCancelRefund={onCancelRefund}
        onRefund={onRefund}
      />
    </div>
  );
}

function PaymentEditor({
  booking,
  onAdd,
  onCancelRefund,
  onRefund,
}: {
  booking: BookingEditorRecord;
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
  const debt = Math.max(0, booking.amount - booking.paid);
  return (
    <EditorSection title="Оплата">
      <div className="space-y-4">
        <PaymentProgress
          className="w-full"
          paid={booking.paid}
          total={Math.max(booking.amount, 1)}
        />
        <div className="grid grid-cols-2 gap-3 border-t pt-3 text-xs">
          <div>
            <span className="text-muted-foreground">Долг</span>
            <p className="mt-1 tabular-nums">{money.format(debt)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Промокод</span>
            <p className="mt-1 truncate">{booking.promo}</p>
          </div>
        </div>
        <div className="grid gap-3">
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
                  ) : (
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
                  )}
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
