import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconDotsVertical,
  IconExternalLink,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconUser,
} from "@tabler/icons-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  AssigneePicker,
  Button,
  Checkbox,
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
  type EditorSaveState,
} from "@crm/ui";

import { useEditorLayoutChrome } from "@app/app/editor-layout-context";
import { formatEventDateTime } from "@app/components/events/event-format";
import { EventIcon } from "@app/components/events/event-presentation";
import { OrderedStageList } from "@app/components/shared/ordered-stage-list";
import {
  EditorPreviewCommunications,
  EditorPreviewHistory,
  EditorPreviewTasks,
} from "@app/components/shared/editor-preview-tabs";
import {
  createEmptyEvent,
  eventsRepository,
  type EventEditorRepository,
} from "@app/data/events-repository";
import { useDirectoryAssignees, useDirectoryCustomers } from "@app/features/use-directory-data";
import {
  eventStatuses,
  eventStatusMeta,
  type EventCategory,
  type EventEditorRecord,
  type EventResourceBooking,
  type EventResourceOption,
  type EventScenarioStage,
  type EventStatus,
} from "@app/entities/events";

const tabs = [
  "main",
  "resources",
  "scenario",
  "communications",
  "tasks",
  "history",
] as const;
const tabItems = [
  { value: "main", label: "Основное" },
  { value: "resources", label: "Ресурсы" },
  { value: "scenario", label: "Сценарий" },
  { value: "communications", label: "Коммуникации" },
  { value: "tasks", label: "Задачи" },
  { value: "history", label: "История" },
];
const statusOptions = eventStatuses.map((value) => ({
  value,
  label: eventStatusMeta[value].label,
}));
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
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
function editorDateTime(value: string) {
  return value.slice(0, 16);
}
function storedDateTime(value: string, fallback: string) {
  return value ? `${value}:00+03:00` : fallback;
}
function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

export function EventEditorPage({
  repository = eventsRepository,
}: {
  repository?: EventEditorRepository;
}) {
  const eventAssignees = useDirectoryAssignees("event");
  const navigate = useNavigate();
  const { id = "new" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = oneOf(params.get("tab"), tabs, "main");
  const requestedCategoryId = params.get("category");
  const [draft, setDraft] = useState<EventEditorRecord | null>(null);
  const [categories, setCategories] = useState<EventCategory[]>([]);
  const [resources, setResources] = useState<EventResourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([repository.listCategories(), repository.listResources()])
      .then(async ([nextCategories, nextResources]) => {
        const requestedCategory =
          nextCategories.find(
            (category) => category.id === requestedCategoryId,
          ) ?? nextCategories[0];
        const event =
          id === "new"
            ? createEmptyEvent(requestedCategory)
            : await repository.get(id);
        if (!active) return;
        setCategories(nextCategories);
        setResources(nextResources);
        if (!event) {
          setError("Мероприятие не найдено");
          setLoading(false);
          return;
        }
        setDraft(event);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить мероприятие",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, repository, requestedCategoryId]);

  const update = useCallback(
    <K extends keyof EventEditorRecord>(
      key: K,
      value: EventEditorRecord[K],
    ) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
      setSaveState("dirty");
    },
    [],
  );
  const setStatus = useCallback(
    (status: EventStatus) => update("status", status),
    [update],
  );
  const setAssignee = useCallback(
    (person: Assignee | null) => update("assignees", person ? [person] : []),
    [update],
  );
  const setCategory = useCallback(
    (categoryId: string) => {
      const category = categories.find((item) => item.id === categoryId);
      if (!category) return;
      setDraft((current) =>
        current
          ? {
              ...current,
              categoryIcon: category.icon,
              categoryId,
              categoryName: category.name,
              categoryTone: category.tone,
            }
          : current,
      );
      setSaveState("dirty");
    },
    [categories],
  );
  const addBooking = useCallback(
    (booking: Omit<EventResourceBooking, "id" | "resourceName">) => {
      const resource = resources.find((item) => item.id === booking.resourceId);
      if (!resource) return;
      setDraft((current) =>
        current
          ? {
              ...current,
              resourceBookings: [
                ...current.resourceBookings,
                {
                  ...booking,
                  id: `event-resource-${Date.now()}`,
                  resourceName: resource.name,
                },
              ],
            }
          : current,
      );
      setSaveState("dirty");
    },
    [resources],
  );
  const removeBooking = useCallback((bookingId: string) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            resourceBookings: current.resourceBookings.filter(
              (item) => item.id !== bookingId,
            ),
          }
        : current,
    );
    setSaveState("dirty");
  }, []);
  const setStages = useCallback(
    (change: (stages: EventScenarioStage[]) => EventScenarioStage[]) => {
      setDraft((current) =>
        current
          ? { ...current, scenarioStages: change(current.scenarioStages) }
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

  const draftStatus = draft?.status;
  const statusControl = useMemo(
    () =>
      draftStatus ? (
        <FilterSelect
          className="w-32 max-w-32 sm:w-40 sm:max-w-40"
          label="Статус мероприятия"
          onValueChange={(value) => setStatus(value as EventStatus)}
          options={statusOptions}
          value={draftStatus}
        />
      ) : undefined,
    [draftStatus, setStatus],
  );
  useEditorLayoutChrome(
    useMemo(
      () => ({
        idLabel: `#${id}`,
        mobileStatus: statusControl,
        onBack: () => navigate(-1),
        title: draft?.name ?? "Мероприятие",
      }),
      [draft?.name, id, navigate, statusControl],
    ),
  );

  const navigation = (
    <PageNav
      ariaLabel="Разделы редактора мероприятия"
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
  const cancel = () => setStatus("cancelled");
  const overflow = (
    <EventOverflow
      cancelled={draft?.status === "cancelled"}
      onCancel={cancel}
      onCategories={() => navigate("/events/categories")}
    />
  );

  return (
    <EditorFrame
      actions={
        draft ? (
          <>
            {statusControl}
            <AssigneePicker
              label="Сменить ответственного мероприятия"
              onPeopleChange={(people) => update("assignees", people)}
              onValueChange={setAssignee}
              options={eventAssignees}
              people={draft.assignees}
            />
            {overflow}
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
          <EventMobileActions
            cancelled={draft.status === "cancelled"}
            onAssigneeChange={setAssignee}
            onCancel={cancel}
            onCategories={() => navigate("/events/categories")}
          />
        ) : null
      }
      navigation={navigation}
      saveState={saveState}
      sidebar={
        draft ? (
          <EventSidebar
            draft={draft}
            onAssigneeChange={setAssignee}
            update={update}
          />
        ) : (
          <Skeleton className="h-96 rounded-xl" />
        )
      }
    >
      {loading ? <EventEditorLoading /> : null}
      {error ? (
        <div className="rounded-xl border bg-background">
          <PageState
            icon={IconAlertTriangle}
            title="Мероприятие не открылось"
            tone="danger"
          >
            {error}
          </PageState>
        </div>
      ) : null}
      {draft && tab === "main" ? (
        <EventMain
          categories={categories}
          draft={draft}
          onCategoryChange={setCategory}
          update={update}
        />
      ) : null}
      {draft && tab === "resources" ? (
        <EventResources
          draft={draft}
          onAdd={addBooking}
          onDelete={removeBooking}
          resources={resources}
        />
      ) : null}
      {draft && tab === "scenario" ? (
        <EventScenario draft={draft} setStages={setStages} />
      ) : null}
      {draft && tab === "communications" ? (
        <EditorPreviewCommunications phone={draft.phone} />
      ) : null}
      {draft && tab === "tasks" ? (
        <EditorPreviewTasks relationLabel={`Мероприятие #${draft.id}`} />
      ) : null}
      {draft && tab === "history" ? (
        <EditorPreviewHistory entityLabel="Мероприятие" />
      ) : null}
    </EditorFrame>
  );
}

function EventOverflow({
  cancelled,
  onCancel,
  onCategories,
}: {
  cancelled: boolean;
  onCancel: () => void;
  onCategories: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия мероприятия"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onCategories}>
          <IconExternalLink aria-hidden="true" />
          Категории мероприятий
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={cancelled} onClick={onCancel}>
          <IconAlertTriangle aria-hidden="true" />
          {cancelled ? "Мероприятие отменено" : "Отменить мероприятие"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function EventMobileActions({
  cancelled,
  onAssigneeChange,
  onCancel,
  onCategories,
}: {
  cancelled: boolean;
  onAssigneeChange: (person: Assignee | null) => void;
  onCancel: () => void;
  onCategories: () => void;
}) {
  const eventAssignees = useDirectoryAssignees("event");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия мероприятия"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {eventAssignees.map((person) => (
          <DropdownMenuItem
            key={person.id}
            onClick={() => onAssigneeChange(person)}
          >
            <IconUser aria-hidden="true" />
            {person.name}
          </DropdownMenuItem>
        ))}
        <DropdownMenuItem onClick={() => onAssigneeChange(null)}>
          <IconUser aria-hidden="true" />
          Без ответственного
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCategories}>
          <IconExternalLink aria-hidden="true" />
          Категории мероприятий
        </DropdownMenuItem>
        <DropdownMenuItem disabled={cancelled} onClick={onCancel}>
          <IconAlertTriangle aria-hidden="true" />
          {cancelled ? "Мероприятие отменено" : "Отменить мероприятие"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EventMain({
  categories,
  draft,
  onCategoryChange,
  update,
}: {
  categories: EventCategory[];
  draft: EventEditorRecord;
  onCategoryChange: (id: string) => void;
  update: <K extends keyof EventEditorRecord>(
    key: K,
    value: EventEditorRecord[K],
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
        <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/25 p-3">
          <EventIcon
            icon={draft.categoryIcon}
            size="md"
            tone={draft.categoryTone}
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{draft.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {draft.categoryName} · #{draft.id}
            </p>
          </div>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-2"
            htmlFor="event-category"
            label="Категория"
          >
            <FormSelect
              id="event-category"
              label="Категория мероприятия"
              onValueChange={onCategoryChange}
              options={categories.map((category) => ({
                label: category.name,
                value: category.id,
              }))}
              value={draft.categoryId}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="event-name"
            label="Название"
          >
            <Input
              id="event-name"
              onChange={(event) => update("name", event.target.value)}
              value={draft.name}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="event-client"
            label="Клиент"
          >
            <EntityCombobox
              label="Клиент мероприятия"
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
            htmlFor="event-phone"
            label="Телефон"
          >
            <Input
              id="event-phone"
              inputMode="tel"
              onChange={(event) => update("phone", event.target.value)}
              value={draft.phone}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="event-start"
            label="Начало"
          >
            <DateTimePicker
              id="event-start"
              label="Начало мероприятия"
              onValueChange={(value) =>
                update("startsAt", storedDateTime(value, draft.startsAt))
              }
              value={editorDateTime(draft.startsAt)}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="event-end"
            label="Окончание"
          >
            <DateTimePicker
              id="event-end"
              label="Окончание мероприятия"
              onValueChange={(value) =>
                update("endsAt", storedDateTime(value, draft.endsAt))
              }
              value={editorDateTime(draft.endsAt)}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="event-guests"
            label="Гостей"
          >
            <Input
              id="event-guests"
              min="1"
              onChange={(event) =>
                update("guestCount", inputNumber(event.target.value))
              }
              type="number"
              value={draft.guestCount}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="event-client-comment"
            label="Комментарий клиента"
          >
            <Textarea
              id="event-client-comment"
              onChange={(event) => update("clientComment", event.target.value)}
              placeholder="Пожелания и важные детали"
              value={draft.clientComment}
            />
          </FormField>
          <label className="flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs sm:col-span-3">
            <Checkbox
              checked={draft.requiresAction}
              onCheckedChange={(checked) =>
                update("requiresAction", checked === true)
              }
            />
            Требует внимания
          </label>
        </div>
      </EditorSection>
    </div>
  );
}

function EventResources({
  draft,
  onAdd,
  onDelete,
  resources,
}: {
  draft: EventEditorRecord;
  onAdd: (booking: Omit<EventResourceBooking, "id" | "resourceName">) => void;
  onDelete: (id: string) => void;
  resources: EventResourceOption[];
}) {
  const navigate = useNavigate();
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? "");
  const [startsAt, setStartsAt] = useState(editorDateTime(draft.startsAt));
  const [endsAt, setEndsAt] = useState(editorDateTime(draft.endsAt));
  const [guests, setGuests] = useState(String(draft.guestCount));
  useEffect(() => {
    if (!resourceId && resources[0]) setResourceId(resources[0].id);
  }, [resourceId, resources]);
  const submit = () => {
    if (resourceId)
      onAdd({
        resourceId,
        startsAt: storedDateTime(startsAt, draft.startsAt),
        endsAt: storedDateTime(endsAt, draft.endsAt),
        guestCount: inputNumber(guests),
      });
  };
  const openBooking = (booking: EventResourceBooking) =>
    navigate(
      `/bookings/new?resource=${booking.resourceId}&date=${booking.startsAt.slice(0, 10)}&start=${new Date(booking.startsAt).getHours()}`,
    );
  return (
    <div className="space-y-3">
      <EditorSection
        subtitle="Сначала задайте ресурс и интервал; связанная бронь откроется с этими данными."
        title="Новая бронь ресурса"
      >
        <div className="grid items-end gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-6"
            htmlFor="event-resource"
            label="Ресурс"
          >
            <EntityCombobox
              label="Ресурс мероприятия"
              onValueChange={setResourceId}
              options={resources.map((resource) => ({
                label: resource.name,
                secondary: `${resource.category} · до ${resource.capacity}`,
                value: resource.id,
              }))}
              value={resourceId}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="event-resource-start"
            label="Начало"
          >
            <DateTimePicker
              id="event-resource-start"
              label="Начало брони ресурса"
              onValueChange={setStartsAt}
              value={startsAt}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="event-resource-end"
            label="Окончание"
          >
            <DateTimePicker
              id="event-resource-end"
              label="Окончание брони ресурса"
              onValueChange={setEndsAt}
              value={endsAt}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="event-resource-guests"
            label="Гостей"
          >
            <Input
              id="event-resource-guests"
              min="1"
              onChange={(event) => setGuests(event.target.value)}
              type="number"
              value={guests}
            />
          </FormField>
          <Button
            className="sm:col-span-2"
            disabled={!resourceId || !startsAt || !endsAt}
            onClick={submit}
            size="sm"
          >
            <IconPlus aria-hidden="true" />
            Добавить бронь
          </Button>
        </div>
      </EditorSection>
      <EditorSection title="Ресурсы мероприятия">
        {draft.resourceBookings.length ? (
          <div className="divide-y rounded-lg border">
            {draft.resourceBookings.map((booking) => (
              <article className="flex items-center gap-3 p-3" key={booking.id}>
                <Button
                  className="h-auto min-w-0 flex-1 justify-start gap-3 rounded-none p-0 text-left"
                  onClick={() => openBooking(booking)}
                  variant="ghost"
                >
                  <IconReceipt
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {booking.resourceName}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {formatEventDateTime(booking.startsAt)} —{" "}
                      {formatEventDateTime(booking.endsAt)} ·{" "}
                      {booking.guestCount} гостей
                    </span>
                  </span>
                  <IconExternalLink aria-hidden="true" className="size-4" />
                </Button>
                <IconAction
                  icon={IconTrash}
                  label={`Удалить бронь ${booking.resourceName}`}
                  onClick={() => onDelete(booking.id)}
                />
              </article>
            ))}
          </div>
        ) : (
          <PageState icon={IconReceipt} title="Ресурсы не добавлены">
            Выберите ресурс и время, чтобы подготовить связанную бронь.
          </PageState>
        )}
      </EditorSection>
    </div>
  );
}

function EventScenario({
  draft,
  setStages,
}: {
  draft: EventEditorRecord;
  setStages: (
    change: (stages: EventScenarioStage[]) => EventScenarioStage[],
  ) => void;
}) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("30");
  const [comment, setComment] = useState("");
  const add = () => {
    if (!name.trim()) return;
    setStages((stages) => [
      ...stages,
      {
        id: `event-stage-${Date.now()}`,
        name: name.trim(),
        durationMinutes: inputNumber(duration),
        comment: comment.trim(),
      },
    ]);
    setName("");
    setDuration("30");
    setComment("");
  };
  const change = <K extends keyof EventScenarioStage>(
    id: string,
    key: K,
    value: EventScenarioStage[K],
  ) =>
    setStages((stages) =>
      stages.map((stage) =>
        stage.id === id ? { ...stage, [key]: value } : stage,
      ),
    );
  return (
    <div className="space-y-3">
      <EditorSection title="Быстрое добавление этапа">
        <div className="grid items-end gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-5"
            htmlFor="event-stage-name"
            label="Название этапа"
          >
            <Input
              id="event-stage-name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </FormField>
          <FormField
            className="sm:col-span-1"
            htmlFor="event-stage-duration"
            label="Длительность, минут"
          >
            <Input
              id="event-stage-duration"
              min="0"
              onChange={(event) => setDuration(event.target.value)}
              type="number"
              value={duration}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="event-stage-comment"
            label="Комментарий"
          >
            <Textarea
              id="event-stage-comment"
              onChange={(event) => setComment(event.target.value)}
              placeholder="Необязательно"
              rows={3}
              value={comment}
            />
          </FormField>
          <Button
            className="sm:col-span-2"
            disabled={!name.trim()}
            onClick={add}
            size="sm"
          >
            <IconPlus aria-hidden="true" />
            Добавить этап
          </Button>
        </div>
      </EditorSection>
      <EditorSection
        subtitle="Перетаскивайте этапы за ручку или используйте кнопки вверх и вниз."
        title="Сценарий мероприятия"
      >
        {draft.scenarioStages.length ? (
          <OrderedStageList
            onChange={change}
            onDelete={(id) =>
              setStages((stages) => stages.filter((stage) => stage.id !== id))
            }
            onDuplicate={(stage) =>
              setStages((stages) => [
                ...stages,
                {
                  ...stage,
                  id: `event-stage-${Date.now()}`,
                  name: `${stage.name} — копия`,
                },
              ])
            }
            onMove={(from, to) =>
              setStages((stages) => moveItem(stages, from, to))
            }
            stages={draft.scenarioStages}
            testId="event-scenario-list"
          />
        ) : (
          <PageState
            actionLabel="Перейти к добавлению"
            icon={IconCalendarEvent}
            onAction={() =>
              document.getElementById("event-stage-name")?.focus()
            }
            title="Сценарий пока пуст"
          >
            Добавьте этапы и выстройте их в нужном порядке.
          </PageState>
        )}
      </EditorSection>
    </div>
  );
}

function EventSidebar({
  draft,
  onAssigneeChange,
  update,
}: {
  draft: EventEditorRecord;
  onAssigneeChange: (person: Assignee | null) => void;
  update: <K extends keyof EventEditorRecord>(
    key: K,
    value: EventEditorRecord[K],
  ) => void;
}) {
  const eventAssignees = useDirectoryAssignees("event");
  return (
    <div className="space-y-3">
      <OperationalSummary
        critical={<ListRow><SummaryRow label="Риски" value={draft.hasConflict ? "Есть конфликт" : draft.requiresAction ? "Требует внимания" : "Нет"} /></ListRow>}
        criticalCount={1}
        details={<>
          <ListRow>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-xs text-muted-foreground">
                Ответственные
              </span>
              <AssigneePicker
                label="Сменить ответственного мероприятия в сводке"
                onPeopleChange={(people) => update("assignees", people)}
                onValueChange={onAssigneeChange}
                options={eventAssignees}
                people={draft.assignees}
              />
            </div>
          </ListRow>
          <ListRow>
            <SummaryRow label="Категория" value={draft.categoryName} />
          </ListRow>
          <ListRow>
            <SummaryRow
              label="Начало"
              value={formatEventDateTime(draft.startsAt)}
            />
          </ListRow>
          <ListRow>
            <SummaryRow label="Гостей" value={String(draft.guestCount)} />
          </ListRow>
        </>}
        detailsCount={4}
        icon={IconCalendarEvent}
        tone="event"
      />
      <EventPaymentEditor draft={draft} update={update} />
    </div>
  );
}

function EventPaymentEditor({
  draft,
  update,
}: {
  draft: EventEditorRecord;
  update: <K extends keyof EventEditorRecord>(
    key: K,
    value: EventEditorRecord[K],
  ) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("card");
  const [date, setDate] = useState("2026-08-25");
  const [refundId, setRefundId] = useState<string | null>(null);
  const refund = draft.paymentOperations.find(
    (operation) => operation.id === refundId,
  );
  const add = () => {
    const value = inputNumber(amount);
    if (!value) return;
    update("paid", draft.paid + value);
    update("paymentOperations", [
      {
        id: `event-payment-${Date.now()}`,
        amount: value,
        date,
        kind: "payment",
        method: method as "card" | "cash" | "transfer",
      },
      ...draft.paymentOperations,
    ]);
    setAmount("");
  };
  const confirmRefund = () => {
    if (!refund) return;
    update("paid", Math.max(0, draft.paid - refund.amount));
    update("paymentOperations", [
      { ...refund, id: `event-refund-${Date.now()}`, kind: "refund", date },
      ...draft.paymentOperations,
    ]);
  };
  return (
    <EditorSection title="Оплата">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <FormField htmlFor="event-total" label="Стоимость">
            <Input
              id="event-total"
              min="0"
              onChange={(event) =>
                update("total", inputNumber(event.target.value))
              }
              type="number"
              value={draft.total}
            />
          </FormField>
          <FormField htmlFor="event-paid" label="Оплачено">
            <Input
              id="event-paid"
              min="0"
              onChange={(event) =>
                update("paid", inputNumber(event.target.value))
              }
              type="number"
              value={draft.paid}
            />
          </FormField>
        </div>
        <PaymentProgress
          className="w-full"
          paid={draft.paid}
          total={Math.max(draft.total, 1)}
        />
        <div className="flex items-center justify-between border-t pt-3 text-xs">
          <span className="text-muted-foreground">Долг</span>
          <span className="tabular-nums">
            {money.format(Math.max(0, draft.total - draft.paid))}
          </span>
        </div>
        <div className="grid gap-2">
          <Input
            aria-label="Сумма новой оплаты"
            min="0"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="Сумма оплаты"
            type="number"
            value={amount}
          />
          <FormSelect
            id="event-payment-method"
            label="Способ оплаты"
            onValueChange={setMethod}
            options={[
              { value: "card", label: "Карта" },
              { value: "cash", label: "Наличные" },
              { value: "transfer", label: "Перевод" },
            ]}
            value={method}
          />
          <DatePicker
            className="w-full max-w-none"
            density="form"
            label="Дата оплаты"
            onValueChange={(next) =>
              next && setDate(next.toISOString().slice(0, 10))
            }
            value={new Date(`${date}T12:00:00`)}
          />
          <Button disabled={!inputNumber(amount)} onClick={add} size="sm">
            Добавить оплату
          </Button>
        </div>
        {draft.paymentOperations.length ? (
          <div className="divide-y border-t">
            {draft.paymentOperations.map((operation) => (
              <div
                className="flex items-center gap-2 py-2 text-xs"
                key={operation.id}
              >
                <span
                  className={
                    operation.kind === "refund"
                      ? "text-danger-foreground"
                      : "text-success-foreground"
                  }
                >
                  {operation.kind === "refund" ? "−" : "+"}
                </span>
                <div className="min-w-0 flex-1">
                  <p>{money.format(operation.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {operation.date} · {operation.method}
                  </p>
                </div>
                {operation.kind === "payment" ? (
                  <Button
                    aria-label={`Вернуть ${money.format(operation.amount)}`}
                    onClick={() => setRefundId(operation.id)}
                    size="icon-xs"
                    variant="ghost"
                  >
                    <IconReceipt aria-hidden="true" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <ConfirmationDialog
        confirmLabel="Оформить возврат"
        description={`Вернуть ${money.format(refund?.amount ?? 0)} по выбранной оплате?`}
        destructive
        onConfirm={confirmRefund}
        onOpenChange={(open) => {
          if (!open) setRefundId(null);
        }}
        open={refundId !== null}
        title="Подтвердить возврат"
      />
    </EditorSection>
  );
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-44 truncate text-right tabular-nums" title={value}>
        {value}
      </span>
    </div>
  );
}
function IconAction({
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
function EventEditorLoading() {
  return (
    <div
      aria-label="Загрузка редактора мероприятия"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
