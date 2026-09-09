import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconArchive,
  IconCalendarEvent,
  IconDotsVertical,
  IconLink,
  IconUsers,
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
  DropdownMenuTrigger,
  EditorFrame,
  EditorSection,
  EntityCombobox,
  FilterSelect,
  FormField,
  FormSelect,
  Input,
  ListRow,
  ListSection,
  PageNav,
  PageState,
  Skeleton,
  Textarea,
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
  EditorPreviewOrders,
  EditorPreviewTasks,
} from "@app/components/shared/editor-preview-tabs";
import {
  leadRepository,
  type LeadRepository,
} from "@app/data/leads-repository";
import {
  normalizePhone,
  normalizeSearchText,
} from "@app/data/search-normalization";
import type { BookingLookup } from "@app/data/directory-repository";
import { useDirectoryAssignees, useDirectoryBookings, useDirectoryCustomers, useDirectoryData } from "@app/features/use-directory-data";
import type { Lead, LeadStage } from "@app/entities/leads";
import { leadStageMeta, leadStages } from "@app/entities/leads";
import { useFixtureData } from "@app/lib/data-mode";
import { businessDateTimeToIso, toBusinessDateTimeInput } from "@app/lib/business-datetime";

// Vitest renders fixture-backed editors while production/dev API mode remains
// authoritative. This keeps the test/demo-only preview affordances isolated
// from the real API path.
const useFixtureEditorData = useFixtureData || import.meta.env.MODE === "test";

const tabs = [
  "main",
  "communications",
  "tasks",
  "bookings",
  "marketing",
  "history",
] as const;
type LeadEditorTab = (typeof tabs)[number];
type LeadDraft = Lead & {
  additionalPhone: string;
  comments: CommentThreadItem[];
  linkedBookingIds: string[];
  marketing: MarketingAttributionDraft;
  plannedEndAt: string;
};

const tabItems = [
  { value: "main", label: "Основное" },
  { value: "communications", label: "Коммуникации" },
  { value: "tasks", label: "Задачи" },
  { value: "bookings", label: "Брони" },
  { value: "marketing", label: "Маркетинг" },
  { value: "history", label: "История" },
];
const directionOptions = ["Проживание", "Баня", "Программы", "Мероприятия"].map(
  (value) => ({ value, label: value }),
);
const sourceOptions = [
  "Сайт",
  "Телефон",
  "Telegram",
  "VK",
  "MAX",
  "Повторное обращение",
  "Рекомендация",
  "Офлайн",
  "Вручную",
  "Другое",
].map((value) => ({ value, label: value }));
const stageOptions = leadStages.map((value) => ({
  value,
  label: leadStageMeta[value].label,
}));
function getBookingRelationOptions(draft: LeadDraft, bookings: BookingLookup[]) {
  const phone = normalizePhone(draft.phone);
  const clientName = normalizeSearchText(draft.clientName);
  const from = draft.plannedAt.slice(0, 10);
  const to = draft.plannedEndAt.slice(0, 10);
  return bookings.map((booking) => {
    const samePhone = Boolean(phone) && normalizePhone(booking.phone) === phone;
    const sameName = normalizeSearchText(booking.clientName) === clientName;
    const datesOverlap = booking.date >= from && booking.date <= to;
    const reasons = [
      samePhone ? "Тот же телефон" : null,
      sameName ? "То же имя" : null,
      datesOverlap ? "Дата в диапазоне запроса" : null,
    ].filter((reason): reason is string => Boolean(reason));
    return {
      group: samePhone ? "exact" as const : sameName || datesOverlap ? "similar" as const : "recent" as const,
      href: `/bookings/${booking.id}`,
      id: booking.id,
      label: `Бронь #${booking.id} · ${booking.clientName}`,
      meta: `${booking.phone} · ${booking.resourceName} · ${booking.date}`,
      phone: booking.phone,
      reasons,
      ...(booking.sourceLeadId && booking.sourceLeadId !== draft.id
        ? { risk: `Уже связана с заявкой #${booking.sourceLeadId}` }
        : {}),
    };
  });
}
const emptyLead: Lead = {
  id: "new",
  clientName: "Новый клиент",
  phone: "",
  requestedItem: "Новая заявка",
  guestCount: 1,
  direction: "Проживание",
  source: "Сайт",
  promo: "Без промокода",
  utm: "direct",
  plannedAt: "2026-08-24T12:00:00+03:00",
  plannedLabel: "24 авг, 12:00",
  nextContactAt: "2026-08-24T12:00:00+03:00",
  nextContactLabel: "Не назначен",
  assignees: [],
  assignedToMe: false,
  overdue: false,
  stage: "new",
};
const previewComments: CommentThreadItem[] = [
  {
    id: "lead-comment-1",
    text: "Клиенту важны тихое размещение и возможность раннего заезда.",
    author: "Марина Кириллова",
    createdLabel: "Сегодня, 13:48",
  },
  {
    id: "lead-comment-2",
    text: "Отправила подборку из двух вариантов и расчёт стоимости.",
    author: "Ольга Семёнова",
    createdLabel: "23 авг, 18:12",
  },
];

function marketingFromLead(lead: Lead): MarketingAttributionDraft {
  if (useFixtureEditorData) return createPreviewMarketing(lead.source, lead.utm);
  const utm = lead.utmData ?? {};
  return {
    channel: lead.channel || "crm",
    clientId: utm.clientId ?? "",
    maxDialogId: utm.maxDialogId ?? "",
    metricaClientId: utm.metricaClientId ?? "",
    source: lead.source,
    utmCampaign: utm.campaign ?? "",
    utmContent: utm.content ?? "",
    utmMedium: utm.medium ?? "",
    utmSource: utm.source ?? lead.utm,
    utmTerm: utm.term ?? "",
    vkLeadId: utm.vkLeadId ?? "",
  };
}

function commentsFromLead(lead: Lead): CommentThreadItem[] {
  if (useFixtureEditorData) return previewComments;
  return lead.comment?.trim()
    ? [{ id: `lead-${lead.id}-comment`, text: lead.comment, author: "CRM", createdLabel: "Сохранено" }]
    : [];
}

function oneOf<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T {
  return value && options.includes(value as T) ? (value as T) : fallback;
}
function dateFromIso(value: string) {
  return new Date(value);
}
function replaceDate(value: string, date: Date) {
  const original = new Date(value);
  original.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  return original.toISOString();
}
function moscowLocalDateTime(value: string) {
  return toBusinessDateTimeInput(value);
}
function moscowLocalToIso(value: string) {
  return businessDateTimeToIso(value);
}

export function LeadEditorPage({
  repository = leadRepository,
}: {
  repository?: LeadRepository;
}) {
  const { data: directory, error: directoryError } = useDirectoryData();
  const navigate = useNavigate();
  const { id = "new" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = oneOf(params.get("tab"), tabs, "main");
  const [draft, setDraft] = useState<LeadDraft | null>(null);
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
      setDraft({
        ...emptyLead,
        additionalPhone: "",
        comments: commentsFromLead(emptyLead),
        desiredEndAt: emptyLead.plannedAt,
        linkedBookingIds: [],
        marketing: marketingFromLead(emptyLead),
        plannedEndAt: emptyLead.desiredEndAt || emptyLead.plannedAt,
      });
      setLoading(false);
      return () => {
        active = false;
      };
    }
    repository
      .get(id)
      .then((lead) => {
        if (!active) return;
        if (!lead) {
          setError("Заявка не найдена");
          setLoading(false);
          return;
        }
        setDraft({
          ...lead,
          additionalPhone: "",
          comments: commentsFromLead(lead),
          linkedBookingIds: directory.bookings
            .filter((booking) => booking.sourceLeadId === lead.id)
            .map((booking) => booking.id),
          marketing: marketingFromLead(lead),
          plannedEndAt: lead.desiredEndAt || lead.plannedAt,
        });
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить заявку",
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
    <K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) => {
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
              ...(key === "channel" ? { channel: value } : {}),
              ...(key === "source" ? { source: value } : {}),
              ...(key.startsWith("utm") || ["clientId", "maxDialogId", "metricaClientId", "vkLeadId"].includes(key)
                ? {
                    utm: key === "utmSource" ? value : current.utm,
                    utmData: {
                      ...(current.utmData ?? {}),
                      clientId: key === "clientId" ? value : current.marketing.clientId,
                      maxDialogId: key === "maxDialogId" ? value : current.marketing.maxDialogId,
                      metricaClientId: key === "metricaClientId" ? value : current.marketing.metricaClientId,
                      campaign: key === "utmCampaign" ? value : current.marketing.utmCampaign,
                      content: key === "utmContent" ? value : current.marketing.utmContent,
                      medium: key === "utmMedium" ? value : current.marketing.utmMedium,
                      source: key === "utmSource" ? value : current.marketing.utmSource,
                      term: key === "utmTerm" ? value : current.marketing.utmTerm,
                      vkLeadId: key === "vkLeadId" ? value : current.marketing.vkLeadId,
                    },
                  }
                : {}),
            }
          : current,
      );
      setSaveState("dirty");
    },
    [],
  );
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
  const addComment = () => {
    const text = newComment.trim();
    if (!draft || !text) return;
    const comments = [{ id: `local-${Date.now()}`, text, author: "Марина Кириллова", createdLabel: "Только что" }, ...draft.comments];
    setDraft((current) => current ? { ...current, comment: comments.map((item) => item.text).join("\n\n"), comments } : current);
    setSaveState("dirty");
    setNewComment("");
  };

  const navigation = (
    <PageNav
      ariaLabel="Разделы редактора заявки"
      items={tabItems}
      onValueChange={(value) =>
        setParams(value === "main" ? {} : { tab: value })
      }
      value={tab}
    />
  );
  const title = draft?.clientName ?? "Заявка";
  const draftStage = draft?.stage;
  const statusControl = useMemo(
    () =>
      draftStage ? (
        <FilterSelect
          className="w-28 max-w-28 sm:w-36 sm:max-w-36"
          label="Статус заявки"
          onValueChange={(value) => update("stage", value as LeadStage)}
          options={stageOptions}
          value={draftStage}
        />
      ) : undefined,
    [draftStage, update],
  );
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

  return (
    <EditorFrame
      actions={
        draft ? (
          <>
            {statusControl}
            <LeadOverflowActions onArchive={() => update("stage", "archive")} />
          </>
        ) : null
      }
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
      mobileActions={
        draft ? (
          <LeadOverflowActions onArchive={() => update("stage", "archive")} />
        ) : null
      }
      navigation={navigation}
      saveState={saveState}
      sidebar={
        draft ? (
          <LeadSidebar draft={draft} update={update} />
        ) : (
          <Skeleton className="h-72 rounded-xl" />
        )
      }
    >
      {loading ? <LeadEditorLoading /> : null}
      {error ? (
        <div className="rounded-xl border bg-background">
          <PageState
            icon={IconAlertTriangle}
            title="Заявка не открылась"
            tone="danger"
          >
            {error}
          </PageState>
        </div>
      ) : null}
      {draft && tab === "main" ? (
        <LeadMain
          draft={draft}
          newComment={newComment}
          onAddComment={addComment}
          onCommentChange={setNewComment}
          update={update}
        />
      ) : null}
      {draft && tab !== "main" ? (
        <LeadRelatedTab
          draft={draft}
          tab={tab}
          updateMarketing={updateMarketing}
        />
      ) : null}
    </EditorFrame>
  );
}

function LeadOverflowActions({ onArchive }: { onArchive: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия заявки"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onArchive}>
          <IconArchive aria-hidden="true" />В архив
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LeadMain({
  draft,
  newComment,
  onAddComment,
  onCommentChange,
  update,
}: {
  draft: LeadDraft;
  newComment: string;
  onAddComment: () => void;
  onCommentChange: (value: string) => void;
  update: <K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) => void;
}) {
  const customers = useDirectoryCustomers();
  const selectedCustomer = customers.find(
    (customer) =>
      customer.name === draft.clientName || customer.phone === draft.phone,
  );
  return (
    <div className="space-y-3">
      <EditorSection title="Контакт и запрос">
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-6"
            htmlFor="lead-title"
            label="Что нужно"
          >
            <Input
              id="lead-title"
              onChange={(event) => update("requestedItem", event.target.value)}
              value={draft.requestedItem}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="lead-client"
            label="Клиент"
          >
            <EntityCombobox
              label="Клиент заявки"
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
            htmlFor="lead-phone"
            label="Телефон"
          >
            <Input
              id="lead-phone"
              inputMode="tel"
              onChange={(event) => update("phone", event.target.value)}
              value={draft.phone}
            />
          </FormField>
          {useFixtureEditorData ? (
            <FormField className="sm:col-span-3" htmlFor="lead-phone-extra" label="Доп. телефон">
              <Input id="lead-phone-extra" inputMode="tel" onChange={(event) => update("additionalPhone", event.target.value)} placeholder="Не указан" value={draft.additionalPhone} />
            </FormField>
          ) : null}
          <FormField
            className="sm:col-span-3"
            htmlFor="lead-direction"
            label="Направление"
          >
            <FormSelect
              id="lead-direction"
              label="Направление заявки"
              onValueChange={(value) => update("direction", value)}
              options={directionOptions}
              value={draft.direction}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="lead-guests"
            label="Количество гостей"
          >
            <Input
              id="lead-guests"
              min="1"
              onChange={(event) =>
                update("guestCount", Number(event.target.value))
              }
              type="number"
              value={draft.guestCount}
            />
          </FormField>
          <FormField className="sm:col-span-4" htmlFor="lead-dates" label="Желаемые даты">
            <DatePicker
              className="w-full max-w-none"
              density="form"
              id="lead-dates"
              label="Желаемые даты"
              mode="range"
              onValueChange={(range) => {
                if (!range?.from || !range.to) return;
                const end = replaceDate(draft.plannedEndAt, range.to);
                update("plannedAt", replaceDate(draft.plannedAt, range.from));
                update("plannedEndAt", end);
                update("desiredEndAt", end);
              }}
              value={{ from: dateFromIso(draft.plannedAt), to: dateFromIso(draft.plannedEndAt) }}
            />
          </FormField>
          <FormField className="sm:col-span-2" htmlFor="lead-next-contact" label="Следующий контакт">
            <DateTimePicker id="lead-next-contact" label="Следующий контакт" onValueChange={(value) => update("nextContactAt", moscowLocalToIso(value))} placeholder="Не назначен" value={moscowLocalDateTime(draft.nextContactAt)} />
          </FormField>
          <FormField className="sm:col-span-3" htmlFor="lead-source" label="Источник">
            <FormSelect id="lead-source" label="Источник заявки" onValueChange={(value) => update("source", value)} options={sourceOptions} value={draft.source} />
          </FormField>
          <FormField className="sm:col-span-3" htmlFor="lead-promo" label="Промокод">
            <Input id="lead-promo" aria-label="Промокод заявки" onChange={(event) => update("promo", event.target.value)} placeholder="Без промокода" value={draft.promo === "Без промокода" ? "" : draft.promo} />
          </FormField>
        </div>
      </EditorSection>
      <EditorSection title="Комментарии менеджеров">
        {useFixtureEditorData ? (
          <CommentThread comments={draft.comments} draft={newComment} onAdd={onAddComment} onDraftChange={onCommentChange} />
        ) : (
          <Textarea
            aria-label="Комментарий заявки"
            onChange={(event) => update("comment", event.target.value)}
            placeholder="Внутренний комментарий команды"
            rows={5}
            value={draft.comment ?? ""}
          />
        )}
      </EditorSection>
    </div>
  );
}

function LeadSidebar({
  draft,
  update,
}: {
  draft: LeadDraft;
  update: <K extends keyof LeadDraft>(key: K, value: LeadDraft[K]) => void;
}) {
  const navigate = useNavigate();
  const bookingOptions = useDirectoryBookings();
  const leadAssignees = useDirectoryAssignees("lead");
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <ListSection
        count={2}
        icon={IconUsers}
        title="Операционная сводка"
        tone="task"
      >
        <ListRow>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-xs text-muted-foreground">Ответственные</span>
            <AssigneePicker
              label="Изменить ответственных заявки"
              onPeopleChange={(people) => update("assignees", people)}
              onValueChange={(person) =>
                update("assignees", person ? [person] : [])
              }
              options={leadAssignees}
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
              <span className="text-muted-foreground">Связанные брони</span>
            </div>
            <ManualRelationPicker
              addLabel="Связать с бронью"
              emptyLabel="Связанных броней нет"
              label="Найти и связать бронь"
              multiple
              onOpen={(href) => navigate(href)}
              onValuesChange={(values) => update("linkedBookingIds", values)}
              options={getBookingRelationOptions(draft, bookingOptions)}
              shortcut
              values={draft.linkedBookingIds}
            />
          </div>
        </ListRow>
      </ListSection>
    </div>
  );
}

function LeadRelatedTab({
  draft,
  tab,
  updateMarketing,
}: {
  draft: LeadDraft;
  tab: Exclude<LeadEditorTab, "main">;
  updateMarketing: <K extends keyof MarketingAttributionDraft>(
    key: K,
    value: MarketingAttributionDraft[K],
  ) => void;
}) {
  const navigate = useNavigate();
  const [confirmBooking, setConfirmBooking] = useState(false);
  if (tab === "communications")
    return <EditorPreviewCommunications phone={draft.phone} />;
  if (tab === "tasks")
    return <EditorPreviewTasks relationLabel={`Заявка #${draft.id}`} />;
  if (tab === "bookings")
    return (
      <div className="space-y-3">
        <EditorSection
          actions={
            <Button onClick={() => setConfirmBooking(true)} size="sm">
              <IconCalendarEvent aria-hidden="true" />
              Создать бронь
            </Button>
          }
          subtitle="Новая бронь будет связана с текущей заявкой."
          title="Действия"
        >
          <div />
        </EditorSection>
        <EditorPreviewOrders clientName={draft.clientName} />
        <ConfirmationDialog
          confirmLabel="Создать бронь"
          description={`Создать бронь из заявки для клиента «${draft.clientName}»? Данные клиента и связь с заявкой будут перенесены автоматически.`}
          onConfirm={() =>
            navigate(
              `/bookings/new?leadId=${encodeURIComponent(draft.id)}&clientName=${encodeURIComponent(draft.clientName)}`,
            )
          }
          onOpenChange={setConfirmBooking}
          open={confirmBooking}
          title="Создать бронь из заявки?"
        />
      </div>
    );
  if (tab === "marketing")
    return (
      <EditorMarketingAttribution
        available
        idPrefix="lead-marketing"
        onChange={updateMarketing}
        value={draft.marketing}
      />
    );
  return <EditorPreviewHistory entityLabel="Заявка" />;
}

function LeadEditorLoading() {
  return (
    <div
      aria-label="Загрузка редактора заявки"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
