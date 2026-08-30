import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconDotsVertical,
  IconExternalLink,
  IconLink,
  IconPlus,
  IconReceipt,
  IconTrash,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  AssigneePicker,
  Button,
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
  Progress,
  Skeleton,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
  type Assignee,
  type EditorSaveState,
} from "@crm/ui";

import { useEditorLayoutChrome } from "@app/app/editor-layout-context";
import {
  EditorPreviewHistory,
  EditorPreviewTasks,
} from "@app/components/shared/editor-preview-tabs";
import { formatProgramDateTime } from "@app/components/programs/program-format";
import { ProgramIcon } from "@app/components/programs/program-presentation";
import {
  createEmptyProgramRun,
  programsRepository,
  type ProgramRunEditorRepository,
} from "@app/data/programs-repository";
import { useDirectoryAssignees, useDirectoryCustomers } from "@app/features/use-directory-data";
import {
  programRegistrationStatuses,
  programRegistrationStatusMeta,
  programRunStatuses,
  programRunStatusMeta,
  type ProgramRunEditorRecord,
  type ProgramRunEditorRegistration,
  type ProgramRunResourceBooking,
  type ProgramRunResourceOption,
  type ProgramRunStatus,
  type ProgramTemplate,
} from "@app/entities/programs";

const tabs = [
  "main",
  "registrations",
  "payments",
  "resources",
  "tasks",
  "history",
] as const;
const tabItems = [
  { value: "main", label: "Основное" },
  { value: "registrations", label: "Регистрации" },
  { value: "payments", label: "Оплата" },
  { value: "resources", label: "Ресурсы" },
  { value: "tasks", label: "Задачи" },
  { value: "history", label: "История" },
];
const statusOptions = programRunStatuses.map((value) => ({
  value,
  label: programRunStatusMeta[value].label,
}));
const registrationStatusOptions = programRegistrationStatuses.map((value) => ({
  value,
  label: programRegistrationStatusMeta[value].label,
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

export function ProgramRunEditorPage({
  repository = programsRepository,
}: {
  repository?: ProgramRunEditorRepository;
}) {
  const programAssignees = useDirectoryAssignees("program");
  const navigate = useNavigate();
  const { id = "new" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = oneOf(params.get("tab"), tabs, "main");
  const requestedTemplateId = params.get("template");
  const [draft, setDraft] = useState<ProgramRunEditorRecord | null>(null);
  const [templates, setTemplates] = useState<ProgramTemplate[]>([]);
  const [resources, setResources] = useState<ProgramRunResourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([repository.listRunTemplates(), repository.listRunResources()])
      .then(async ([nextTemplates, nextResources]) => {
        const initialTemplate =
          nextTemplates.find(
            (template) => template.id === requestedTemplateId,
          ) ?? nextTemplates[0];
        const run =
          id === "new"
            ? createEmptyProgramRun(initialTemplate)
            : await repository.getRun(id);
        if (!active) return;
        setTemplates(nextTemplates);
        setResources(nextResources);
        if (!run) {
          setError("Проведение программы не найдено");
          setLoading(false);
          return;
        }
        setDraft(run);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить проведение",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, repository, requestedTemplateId]);

  const update = useCallback(
    <K extends keyof ProgramRunEditorRecord>(
      key: K,
      value: ProgramRunEditorRecord[K],
    ) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
      setSaveState("dirty");
    },
    [],
  );
  const setAssignee = useCallback(
    (person: Assignee | null) => update("assignees", person ? [person] : []),
    [update],
  );
  const setStatus = useCallback(
    (status: ProgramRunStatus) => update("status", status),
    [update],
  );
  const setTemplate = useCallback(
    (templateId: string) => {
      const template = templates.find((item) => item.id === templateId);
      if (!template) return;
      setDraft((current) =>
        current
          ? {
              ...current,
              categoryIcon: template.categoryIcon,
              categoryId: template.categoryId,
              categoryTone: template.categoryTone,
              name: template.name,
              participantLimit: template.participantLimit,
              registrationLimit: template.participantLimit,
              templateId,
            }
          : current,
      );
      setSaveState("dirty");
    },
    [templates],
  );
  const addRegistration = useCallback(
    (
      registration: Omit<
        ProgramRunEditorRegistration,
        | "assignees"
        | "categoryIcon"
        | "categoryTone"
        | "debt"
        | "id"
        | "programName"
        | "programStartsAt"
        | "runId"
      >,
    ) => {
      setDraft((current) => {
        if (!current) return current;
        const next: ProgramRunEditorRegistration = {
          ...registration,
          assignees: current.assignees,
          categoryIcon: current.categoryIcon,
          categoryTone: current.categoryTone,
          debt: Math.max(0, registration.total - registration.paid),
          id: `registration-${Date.now()}`,
          programName: current.name,
          programStartsAt: current.startsAt,
          runId: current.id,
        };
        return {
          ...current,
          paid: current.paid + next.paid,
          participantCount:
            current.participantCount + (next.participantCount ?? 0),
          registrationCount: current.registrationCount + 1,
          registrations: [next, ...current.registrations],
          revenue: current.revenue + next.total,
        };
      });
      setSaveState("dirty");
    },
    [],
  );
  const updateRegistrationStatus = useCallback(
    (
      registrationId: string,
      status: ProgramRunEditorRegistration["status"],
    ) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              registrations: current.registrations.map((item) =>
                item.id === registrationId ? { ...item, status } : item,
              ),
            }
          : current,
      );
      setSaveState("dirty");
    },
    [],
  );
  const deleteRegistration = useCallback((registrationId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const removed = current.registrations.find(
        (item) => item.id === registrationId,
      );
      if (!removed) return current;
      return {
        ...current,
        paid: Math.max(0, current.paid - removed.paid),
        participantCount: Math.max(
          0,
          current.participantCount - (removed.participantCount ?? 0),
        ),
        registrationCount: Math.max(0, current.registrationCount - 1),
        registrations: current.registrations.filter(
          (item) => item.id !== registrationId,
        ),
        revenue: Math.max(0, current.revenue - removed.total),
      };
    });
    setSaveState("dirty");
  }, []);
  const addResourceBooking = useCallback(
    (booking: Omit<ProgramRunResourceBooking, "id" | "resourceName">) => {
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
                  id: `run-resource-${Date.now()}`,
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
  const deleteResourceBooking = useCallback((bookingId: string) => {
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
  const save = async () => {
    if (!draft) return;
    setSaveState("saving");
    try {
      await repository.saveRun(draft);
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
          label="Статус проведения"
          onValueChange={(value) => setStatus(value as ProgramRunStatus)}
          options={statusOptions}
          value={draftStatus}
        />
      ) : undefined,
    [draftStatus, setStatus],
  );
  const title = draft?.name ?? "Проведение";
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
      ariaLabel="Разделы редактора проведения"
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
  const openTemplate = () => {
    if (draft?.templateId) navigate(`/programs/${draft.templateId}`);
  };

  return (
    <EditorFrame
      actions={
        draft ? (
          <>
            {statusControl}
            <AssigneePicker
              label="Сменить ответственного проведения"
              onPeopleChange={(people) => update("assignees", people)}
              onValueChange={setAssignee}
              options={programAssignees}
              people={draft.assignees}
            />
            <RunOverflow
              cancelled={draft.status === "cancelled"}
              onCancel={() => setStatus("cancelled")}
              onOpenTemplate={openTemplate}
            />
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
          <RunMobileActions
            cancelled={draft.status === "cancelled"}
            onAssigneeChange={setAssignee}
            onCancel={() => setStatus("cancelled")}
            onOpenTemplate={openTemplate}
          />
        ) : null
      }
      navigation={navigation}
      saveState={saveState}
      sidebar={
        draft ? (
          <ProgramRunSidebar
            draft={draft}
            onAssigneeChange={setAssignee}
            onAssigneesChange={(people) => update("assignees", people)}
            onOpenTemplate={openTemplate}
          />
        ) : (
          <Skeleton className="h-96 rounded-xl" />
        )
      }
    >
      {loading ? <ProgramRunEditorLoading /> : null}
      {error ? (
        <div className="rounded-xl border bg-background">
          <PageState
            icon={IconAlertTriangle}
            title="Проведение не открылось"
            tone="danger"
          >
            {error}
          </PageState>
        </div>
      ) : null}
      {draft && tab === "main" ? (
        <ProgramRunMain
          draft={draft}
          onTemplateChange={setTemplate}
          templates={templates}
          update={update}
        />
      ) : null}
      {draft && tab === "registrations" ? (
        <ProgramRunRegistrations
          draft={draft}
          onAdd={addRegistration}
          onDelete={deleteRegistration}
          onStatusChange={updateRegistrationStatus}
        />
      ) : null}
      {draft && tab === "payments" ? (
        <ProgramRunPayments draft={draft} />
      ) : null}
      {draft && tab === "resources" ? (
        <ProgramRunResources
          draft={draft}
          onAdd={addResourceBooking}
          onDelete={deleteResourceBooking}
          resources={resources}
        />
      ) : null}
      {draft && tab === "tasks" ? (
        <EditorPreviewTasks relationLabel={`Проведение #${draft.id}`} />
      ) : null}
      {draft && tab === "history" ? (
        <EditorPreviewHistory entityLabel="Проведение программы" />
      ) : null}
    </EditorFrame>
  );
}

function RunOverflow({
  cancelled,
  onCancel,
  onOpenTemplate,
}: {
  cancelled: boolean;
  onCancel: () => void;
  onOpenTemplate: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия проведения"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpenTemplate}>
          <IconExternalLink aria-hidden="true" />
          Открыть шаблон
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={cancelled} onClick={onCancel}>
          <IconAlertTriangle aria-hidden="true" />
          {cancelled ? "Проведение отменено" : "Отменить проведение"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function RunMobileActions({
  cancelled,
  onAssigneeChange,
  onCancel,
  onOpenTemplate,
}: {
  cancelled: boolean;
  onAssigneeChange: (person: Assignee | null) => void;
  onCancel: () => void;
  onOpenTemplate: () => void;
}) {
  const programAssignees = useDirectoryAssignees("program");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия проведения"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {programAssignees.map((person) => (
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
        <DropdownMenuItem onClick={onOpenTemplate}>
          <IconExternalLink aria-hidden="true" />
          Открыть шаблон
        </DropdownMenuItem>
        <DropdownMenuItem disabled={cancelled} onClick={onCancel}>
          <IconAlertTriangle aria-hidden="true" />
          {cancelled ? "Проведение отменено" : "Отменить проведение"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProgramRunMain({
  draft,
  onTemplateChange,
  templates,
  update,
}: {
  draft: ProgramRunEditorRecord;
  onTemplateChange: (id: string) => void;
  templates: ProgramTemplate[];
  update: <K extends keyof ProgramRunEditorRecord>(
    key: K,
    value: ProgramRunEditorRecord[K],
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <EditorSection title="Основные данные">
        <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/25 p-3">
          <ProgramIcon
            icon={draft.categoryIcon}
            size="md"
            tone={draft.categoryTone}
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{draft.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              Проведение #{draft.id}
            </p>
          </div>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-4"
            htmlFor="run-template"
            label="Шаблон программы"
          >
            <EntityCombobox
              label="Шаблон программы"
              onValueChange={onTemplateChange}
              options={templates.map((template) => ({
                label: template.name,
                secondary: `до ${template.participantLimit} участников`,
                value: template.id,
              }))}
              searchPlaceholder="Найти программу…"
              value={draft.templateId}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="run-name"
            label="Название проведения"
          >
            <Input
              id="run-name"
              onChange={(event) => update("name", event.target.value)}
              value={draft.name}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="run-start"
            label="Начало"
          >
            <DateTimePicker
              id="run-start"
              label="Начало проведения"
              onValueChange={(value) =>
                update("startsAt", storedDateTime(value, draft.startsAt))
              }
              value={editorDateTime(draft.startsAt)}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="run-end"
            label="Окончание"
          >
            <DateTimePicker
              id="run-end"
              label="Окончание проведения"
              onValueChange={(value) =>
                update("endsAt", storedDateTime(value, draft.endsAt))
              }
              value={editorDateTime(draft.endsAt)}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="run-participant-limit"
            label="Лимит участников"
          >
            <Input
              id="run-participant-limit"
              min="1"
              onChange={(event) =>
                update("participantLimit", inputNumber(event.target.value))
              }
              type="number"
              value={draft.participantLimit}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="run-registration-limit"
            label="Лимит регистраций"
          >
            <Input
              id="run-registration-limit"
              min="1"
              onChange={(event) =>
                update("registrationLimit", inputNumber(event.target.value))
              }
              type="number"
              value={draft.registrationLimit}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="run-comment"
            label="Комментарий"
          >
            <Textarea
              id="run-comment"
              onChange={(event) => update("comment", event.target.value)}
              placeholder="Организационные детали проведения"
              value={draft.comment}
            />
          </FormField>
        </div>
      </EditorSection>
    </div>
  );
}

type RegistrationDraft = Omit<
  ProgramRunEditorRegistration,
  | "assignees"
  | "categoryIcon"
  | "categoryTone"
  | "debt"
  | "id"
  | "programName"
  | "programStartsAt"
  | "runId"
>;

function ProgramRunRegistrations({
  draft,
  onAdd,
  onDelete,
  onStatusChange,
}: {
  draft: ProgramRunEditorRecord;
  onAdd: (registration: RegistrationDraft) => void;
  onDelete: (id: string) => void;
  onStatusChange: (
    id: string,
    status: ProgramRunEditorRegistration["status"],
  ) => void;
}) {
  const customers = useDirectoryCustomers();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [participants, setParticipants] = useState("1");
  const [participantNames, setParticipantNames] = useState("");
  const [comment, setComment] = useState("");
  const [total, setTotal] = useState("");
  const [discount, setDiscount] = useState("");
  const [promo, setPromo] = useState("");
  const [paid, setPaid] = useState("");
  const [status, setStatus] =
    useState<ProgramRunEditorRegistration["status"]>("new");
  const [source, setSource] = useState("");
  const submit = () => {
    if (!clientName.trim()) return;
    onAdd({
      clientName: clientName.trim(),
      comment: comment.trim(),
      discount: inputNumber(discount),
      paid: inputNumber(paid),
      participantCount: inputNumber(participants),
      participantNames: participantNames.trim(),
      phone: phone.trim(),
      promo: promo.trim(),
      source: source.trim(),
      status,
      total: inputNumber(total),
    });
    setClientName("");
    setPhone("");
    setParticipants("1");
    setParticipantNames("");
    setComment("");
    setTotal("");
    setDiscount("");
    setPromo("");
    setPaid("");
    setStatus("new");
    setSource("");
  };
  const selectedCustomer = customers.find(
    (customer) => customer.name === clientName || customer.phone === phone,
  );
  return (
    <div className="space-y-3">
      <EditorSection
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              onClick={() =>
                navigate(`/programs/registrations/new?run=${draft.id}`)
              }
              size="sm"
            >
              <IconExternalLink aria-hidden="true" />
              Открыть редактор
            </Button>
            <Button
              onClick={() => navigate("/customers/new")}
              size="sm"
              variant="outline"
            >
              <IconPlus aria-hidden="true" />
              Новый клиент
            </Button>
          </div>
        }
        subtitle="Итоги пересчитываются локально только для демонстрации; серверная цена и вместимость появятся на backend-этапе."
        title="Новая регистрация"
      >
        <Button
          className="w-full sm:hidden"
          onClick={() => setFormOpen((current) => !current)}
          size="sm"
          variant="outline"
        >
          <IconPlus aria-hidden="true" />
          {formOpen ? "Свернуть форму" : "Заполнить регистрацию"}
        </Button>
        <div
          className={cn(
            "items-end gap-4 sm:grid-cols-6",
            formOpen ? "mt-4 grid" : "hidden sm:grid",
          )}
        >
          <FormField
            className="sm:col-span-3"
            htmlFor="registration-client"
            label="Клиент"
          >
            <EntityCombobox
              label="Клиент регистрации"
              onValueChange={(customerId) => {
                const customer = customers.find(
                  (item) => item.id === customerId,
                );
                if (customer) {
                  setClientName(customer.name);
                  setPhone(customer.phone);
                }
              }}
              options={customers.map((customer) => ({
                label: customer.name,
                secondary: customer.phone,
                value: customer.id,
              }))}
              value={selectedCustomer?.id ?? ""}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="registration-phone"
            label="Телефон"
          >
            <Input
              id="registration-phone"
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              value={phone}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-participants"
            label="Участников"
          >
            <Input
              id="registration-participants"
              min="1"
              onChange={(event) => setParticipants(event.target.value)}
              type="number"
              value={participants}
            />
          </FormField>
          <FormField
            className="sm:col-span-4"
            htmlFor="registration-names"
            label="Имена участников"
          >
            <Input
              id="registration-names"
              onChange={(event) => setParticipantNames(event.target.value)}
              placeholder="Через запятую"
              value={participantNames}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-total"
            label="Стоимость"
          >
            <Input
              id="registration-total"
              min="0"
              onChange={(event) => setTotal(event.target.value)}
              type="number"
              value={total}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-discount"
            label="Скидка, %"
          >
            <Input
              id="registration-discount"
              max="100"
              min="0"
              onChange={(event) => setDiscount(event.target.value)}
              type="number"
              value={discount}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-paid"
            label="Оплачено"
          >
            <Input
              id="registration-paid"
              min="0"
              onChange={(event) => setPaid(event.target.value)}
              type="number"
              value={paid}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-promo"
            label="Промокод"
          >
            <Input
              id="registration-promo"
              onChange={(event) => setPromo(event.target.value)}
              value={promo}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-source"
            label="Источник"
          >
            <FormSelect
              id="registration-source"
              label="Источник регистрации"
              onValueChange={setSource}
              options={[
                { value: "Сайт", label: "Сайт" },
                { value: "Телефон", label: "Телефон" },
                { value: "VK", label: "VK" },
                { value: "Рекомендация", label: "Рекомендация" },
                { value: "Вручную", label: "Вручную" },
              ]}
              value={source || "Вручную"}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-status"
            label="Статус"
          >
            <FormSelect
              id="registration-status"
              label="Статус новой регистрации"
              onValueChange={(value) =>
                setStatus(value as ProgramRunEditorRegistration["status"])
              }
              options={registrationStatusOptions}
              value={status}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="registration-comment"
            label="Комментарий"
          >
            <Input
              id="registration-comment"
              onChange={(event) => setComment(event.target.value)}
              placeholder="Необязательно"
              value={comment}
            />
          </FormField>
          <Button
            className="sm:col-span-2"
            disabled={!clientName.trim()}
            onClick={submit}
            size="sm"
          >
            <IconPlus aria-hidden="true" />
            Добавить регистрацию
          </Button>
        </div>
      </EditorSection>
      <EditorSection title="Участники и регистрации">
        {draft.registrations.length ? (
          <div className="divide-y rounded-lg border">
            {draft.registrations.map((registration) => (
              <RegistrationRow
                key={registration.id}
                onDelete={() => onDelete(registration.id)}
                onOpen={() =>
                  navigate(`/programs/registrations/${registration.id}`)
                }
                onStatusChange={(status) =>
                  onStatusChange(registration.id, status)
                }
                registration={registration}
              />
            ))}
          </div>
        ) : (
          <PageState icon={IconUsers} title="Регистраций пока нет">
            Добавьте клиента и параметры участия выше.
          </PageState>
        )}
      </EditorSection>
    </div>
  );
}

function RegistrationRow({
  onDelete,
  onOpen,
  onStatusChange,
  registration,
}: {
  onDelete: () => void;
  onOpen: () => void;
  onStatusChange: (status: ProgramRunEditorRegistration["status"]) => void;
  registration: ProgramRunEditorRegistration;
}) {
  return (
    <article className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">
          {registration.clientName}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {registration.phone || "Телефон не указан"}
          {registration.participantCount
            ? ` · ${registration.participantCount} участ.`
            : ""}
          {registration.participantNames
            ? ` · ${registration.participantNames}`
            : ""}
        </p>
        <p className="mt-1 truncate text-[10px] text-muted-foreground">
          {registration.comment || "Без комментария"}
        </p>
      </div>
      <PaymentProgress paid={registration.paid} total={registration.total} />
      <div className="flex items-center justify-end gap-1">
        <FormSelect
          id={`${registration.id}-status`}
          label={`Статус регистрации ${registration.clientName}`}
          onValueChange={(value) =>
            onStatusChange(value as ProgramRunEditorRegistration["status"])
          }
          options={registrationStatusOptions}
          value={registration.status}
        />
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={`Открыть регистрацию ${registration.clientName}`}
                onClick={onOpen}
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <IconExternalLink aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Открыть регистрацию</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={`Удалить регистрацию ${registration.clientName}`}
                onClick={onDelete}
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <IconTrash aria-hidden="true" />
          </TooltipTrigger>
          <TooltipContent>Удалить регистрацию</TooltipContent>
        </Tooltip>
      </div>
    </article>
  );
}

function ProgramRunPayments({ draft }: { draft: ProgramRunEditorRecord }) {
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <EditorSection title="Финансовая сводка">
        <PaymentProgress
          className="w-full"
          paid={draft.paid}
          total={Math.max(draft.revenue, 1)}
        />
        <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground">Начислено</p>
            <p className="mt-1">{money.format(draft.revenue)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Оплачено</p>
            <p className="mt-1">{money.format(draft.paid)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Долг</p>
            <p className="mt-1">
              {money.format(Math.max(0, draft.revenue - draft.paid))}
            </p>
          </div>
        </div>
      </EditorSection>
      <EditorSection
        subtitle="Кто и сколько оплатил по каждой регистрации."
        title="Оплата регистрантов"
      >
        {draft.registrations.length ? (
          <div className="divide-y rounded-lg border">
            {draft.registrations.map((registration) => (
              <Button
                className="grid h-auto w-full justify-stretch gap-3 rounded-none p-3 text-left hover:bg-muted/45 sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)_auto] sm:items-center"
                key={registration.id}
                onClick={() =>
                  navigate(`/programs/registrations/${registration.id}`)
                }
                variant="ghost"
              >
                <span className="min-w-0">
                  <span className="block truncate text-xs">
                    {registration.clientName}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {registration.participantCount ?? 0} участ. ·{" "}
                    {money.format(registration.paid)} из{" "}
                    {money.format(registration.total)}
                  </span>
                </span>
                <PaymentProgress
                  className="w-full"
                  paid={registration.paid}
                  total={Math.max(registration.total, 1)}
                />
                <IconExternalLink aria-hidden="true" className="size-4" />
              </Button>
            ))}
          </div>
        ) : (
          <PageState icon={IconReceipt} title="Регистрантов пока нет">
            Добавьте регистрации, чтобы увидеть распределение оплат.
          </PageState>
        )}
      </EditorSection>
    </div>
  );
}

function ProgramRunResources({
  draft,
  onAdd,
  onDelete,
  resources,
}: {
  draft: ProgramRunEditorRecord;
  onAdd: (
    booking: Omit<ProgramRunResourceBooking, "id" | "resourceName">,
  ) => void;
  onDelete: (id: string) => void;
  resources: ProgramRunResourceOption[];
}) {
  const navigate = useNavigate();
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? "");
  const [startAt, setStartAt] = useState(editorDateTime(draft.startsAt));
  const [endAt, setEndAt] = useState(editorDateTime(draft.endsAt));
  const [guestCount, setGuestCount] = useState(String(draft.participantLimit));
  useEffect(() => {
    if (!resourceId && resources[0]) setResourceId(resources[0].id);
  }, [resourceId, resources]);
  const submit = () => {
    if (!resourceId) return;
    onAdd({
      endAt: storedDateTime(endAt, draft.endsAt),
      guestCount: inputNumber(guestCount),
      resourceId,
      startAt: storedDateTime(startAt, draft.startsAt),
    });
  };
  const openBooking = (booking: ProgramRunResourceBooking) => {
    const date = booking.startAt.slice(0, 10);
    const start = new Date(booking.startAt).getHours();
    navigate(
      `/bookings/new?resource=${booking.resourceId}&date=${date}&start=${start}`,
    );
  };
  return (
    <div className="space-y-3">
      <EditorSection
        subtitle="Бронь создаётся как связь-заготовка; доступность и конфликты проверит backend."
        title="Быстрое бронирование ресурса"
      >
        <div className="grid items-end gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-6"
            htmlFor="run-resource"
            label="Ресурс"
          >
            <EntityCombobox
              label="Ресурс проведения"
              onValueChange={setResourceId}
              options={resources.map((resource) => ({
                label: resource.name,
                secondary: `до ${resource.capacity} гостей`,
                value: resource.id,
              }))}
              value={resourceId}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="run-resource-start"
            label="Начало"
          >
            <DateTimePicker
              id="run-resource-start"
              label="Начало брони"
              onValueChange={setStartAt}
              value={startAt}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="run-resource-end"
            label="Окончание"
          >
            <DateTimePicker
              id="run-resource-end"
              label="Окончание брони"
              onValueChange={setEndAt}
              value={endAt}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="run-resource-guests"
            label="Гостей"
          >
            <Input
              id="run-resource-guests"
              min="1"
              onChange={(event) => setGuestCount(event.target.value)}
              type="number"
              value={guestCount}
            />
          </FormField>
          <Button
            className="sm:col-span-2"
            disabled={!resourceId}
            onClick={submit}
            size="sm"
          >
            <IconPlus aria-hidden="true" />
            Добавить бронь
          </Button>
        </div>
      </EditorSection>
      <EditorSection title="Ресурсы проведения">
        {draft.resourceBookings.length ? (
          <div className="divide-y rounded-lg border">
            {draft.resourceBookings.map((booking) => (
              <article className="flex items-center gap-3 p-3" key={booking.id}>
                <IconReceipt
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {booking.resourceName}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {formatProgramDateTime(booking.startAt)} —{" "}
                    {formatProgramDateTime(booking.endAt)} ·{" "}
                    {booking.guestCount} гостей
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label={`Открыть бронь ${booking.resourceName}`}
                        onClick={() => openBooking(booking)}
                        size="icon-sm"
                        variant="ghost"
                      />
                    }
                  >
                    <IconExternalLink aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Открыть бронь</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        aria-label={`Удалить бронь ${booking.resourceName}`}
                        onClick={() => onDelete(booking.id)}
                        size="icon-sm"
                        variant="ghost"
                      />
                    }
                  >
                    <IconTrash aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Удалить связь</TooltipContent>
                </Tooltip>
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

function ProgramRunSidebar({
  draft,
  onAssigneeChange,
  onAssigneesChange,
  onOpenTemplate,
}: {
  draft: ProgramRunEditorRecord;
  onAssigneeChange: (person: Assignee | null) => void;
  onAssigneesChange: (people: Assignee[]) => void;
  onOpenTemplate: () => void;
}) {
  const programAssignees = useDirectoryAssignees("program");
  const participantPercent =
    draft.participantLimit > 0
      ? (draft.participantCount / draft.participantLimit) * 100
      : 0;
  const registrationPercent =
    draft.registrationLimit > 0
      ? (draft.registrationCount / draft.registrationLimit) * 100
      : 0;
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
                label="Сменить ответственного проведения в сводке"
                onPeopleChange={onAssigneesChange}
                onValueChange={onAssigneeChange}
                options={programAssignees}
                people={draft.assignees}
              />
            </div>
          </ListRow>
          <ListRow>
            <Button
              className="h-auto w-full justify-start rounded-none px-4 py-3 text-left text-xs"
              onClick={onOpenTemplate}
              variant="ghost"
            >
              <IconLink
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 text-muted-foreground">
                Шаблон
              </span>
              <span className="max-w-40 truncate">
                {draft.templateId || "Не выбран"}
              </span>
            </Button>
          </ListRow>
          <ListRow>
            <SummaryRow
              icon={IconCalendarEvent}
              label="Начало"
              value={formatProgramDateTime(draft.startsAt)}
            />
          </ListRow>
        </>}
        detailsCount={3}
        icon={IconCalendarEvent}
        tone="program"
      />
      <EditorSection title="Заполняемость">
        <div className="space-y-4">
          <ProgressSummary
            label="Участники"
            percent={participantPercent}
            value={`${draft.participantCount} из ${draft.participantLimit}`}
          />
          <ProgressSummary
            label="Регистрации"
            percent={registrationPercent}
            value={`${draft.registrationCount} из ${draft.registrationLimit}`}
          />
        </div>
      </EditorSection>
      <EditorSection title="Оплата">
        <PaymentProgress
          className="w-full"
          paid={draft.paid}
          total={draft.revenue}
        />
        <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs">
          <span className="text-muted-foreground">Долг</span>
          <span className="tabular-nums">
            {money.format(Math.max(0, draft.revenue - draft.paid))}
          </span>
        </div>
      </EditorSection>
    </div>
  );
}

function ProgressSummary({
  label,
  percent,
  value,
}: {
  label: string;
  percent: number;
  value: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <Progress aria-label={`${label}: ${value}`} value={percent} />
    </div>
  );
}
function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 text-xs">
      <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
      <span className="min-w-0 flex-1 text-muted-foreground">{label}</span>
      <span className="max-w-40 truncate text-right tabular-nums" title={value}>
        {value}
      </span>
    </div>
  );
}
function ProgramRunEditorLoading() {
  return (
    <div
      aria-label="Загрузка редактора проведения"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
