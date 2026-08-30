import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconArchive,
  IconCalendarEvent,
  IconCopy,
  IconDotsVertical,
  IconReceipt,
  IconUsers,
} from "@tabler/icons-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  AssigneePicker,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EditorFrame,
  EditorSection,
  FilterSelect,
  FormField,
  FormSelect,
  Input,
  ListRow,
  OperationalSummary,
  PageNav,
  PageState,
  Skeleton,
  Textarea,
  type EditorSaveState,
} from "@crm/ui";

import { useEditorLayoutChrome } from "@app/app/editor-layout-context";
import {
  createPreviewMarketing,
  type MarketingAttributionDraft,
} from "@app/components/shared/editor-preview-data";
import {
  EditorMarketingAttribution,
  EditorPreviewHistory,
  EditorPreviewOrders,
  EditorPreviewPayments,
  EditorPreviewTasks,
  EditorPreviewVisits,
} from "@app/components/shared/editor-preview-tabs";
import {
  customerRepository,
  type CustomerEditorRepository,
} from "@app/data/customers-repository";
import { useDirectoryAssignees } from "@app/features/use-directory-data";
import type {
  Customer,
  CustomerChannel,
  CustomerType,
} from "@app/entities/customers";
import {
  customerChannels,
  customerTypeLabels,
  customerTypes,
  duplicateRiskLabels,
} from "@app/entities/customers";

const tabs = [
  "main",
  "orders",
  "visits",
  "payments",
  "tasks",
  "marketing",
  "history",
] as const;
type CustomerEditorTab = (typeof tabs)[number];
type CustomerDraft = Customer & {
  additionalPhone: string;
  birthday: string;
  email: string;
  marketing: MarketingAttributionDraft;
  preferredChannel: CustomerChannel;
  preferences: string;
};

const tabItems = [
  { value: "main", label: "Основное" },
  { value: "orders", label: "Заявки и брони" },
  { value: "visits", label: "Посещения" },
  { value: "payments", label: "Оплаты" },
  { value: "tasks", label: "Задачи" },
  { value: "marketing", label: "Маркетинг" },
  { value: "history", label: "История" },
];
const typeOptions = customerTypes.map((value) => ({
  value,
  label: customerTypeLabels[value],
}));
const channelOptions = customerChannels.map((value) => ({
  value,
  label: value,
}));
const recordStateOptions = [
  { value: "active", label: "Активен" },
  { value: "archive", label: "В архиве" },
];
const emptyCustomer: Customer = {
  id: "new",
  name: "Новый клиент",
  phone: "",
  type: "person",
  channels: ["Телефон"],
  leadCount: 0,
  activeLeadCount: 0,
  bookingCount: 0,
  futureBookingCount: 0,
  taskCount: 0,
  turnover: 0,
  debt: 0,
  duplicateRisk: "none",
  nextContactAt: null,
  nextContactLabel: null,
  lastVisitDaysAgo: 0,
  hasActive: false,
  archived: false,
  assignees: [],
};

function oneOf<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T {
  return value && options.includes(value as T) ? (value as T) : fallback;
}
function toDraft(customer: Customer): CustomerDraft {
  return {
    ...customer,
    additionalPhone: "",
    birthday: "",
    email: "",
    marketing: createPreviewMarketing(
      customer.channels[0] ?? "Сайт",
      "organic",
    ),
    preferredChannel: customer.channels[0] ?? "Телефон",
    preferences: "",
  };
}

export function CustomerEditorPage({
  repository = customerRepository,
}: {
  repository?: CustomerEditorRepository;
}) {
  const navigate = useNavigate();
  const { id = "new" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = oneOf(params.get("tab"), tabs, "main");
  const [draft, setDraft] = useState<CustomerDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    if (id === "new") {
      setDraft(toDraft(emptyCustomer));
      setLoading(false);
      return () => {
        active = false;
      };
    }
    repository
      .get(id)
      .then((customer) => {
        if (!active) return;
        if (!customer) {
          setError("Клиент не найден");
          setLoading(false);
          return;
        }
        setDraft(toDraft(customer));
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить клиента",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, repository]);

  const update = useCallback(
    <K extends keyof CustomerDraft>(key: K, value: CustomerDraft[K]) => {
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
          ? { ...current, marketing: { ...current.marketing, [key]: value } }
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

  const draftArchived = draft?.archived;
  const statusControl = useMemo(
    () =>
      draftArchived === undefined ? undefined : (
        <FilterSelect
          className="w-28 max-w-28 sm:w-36 sm:max-w-36"
          label="Состояние клиента"
          onValueChange={(value) => update("archived", value === "archive")}
          options={recordStateOptions}
          value={draftArchived ? "archive" : "active"}
        />
      ),
    [draftArchived, update],
  );
  const title = draft?.name ?? "Клиент";
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
      ariaLabel="Разделы редактора клиента"
      items={tabItems}
      onValueChange={(value) =>
        setParams(value === "main" ? {} : { tab: value })
      }
      value={tab}
    />
  );
  return (
    <EditorFrame
      actions={
        draft ? (
          <>
            {statusControl}
            <CustomerOverflowActions
              archived={draft.archived}
              onArchiveChange={(archived) => update("archived", archived)}
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
          <CustomerOverflowActions
            archived={draft.archived}
            onArchiveChange={(archived) => update("archived", archived)}
          />
        ) : null
      }
      navigation={navigation}
      saveState={saveState}
      sidebar={
        draft ? (
          <CustomerSidebar draft={draft} update={update} />
        ) : (
          <Skeleton className="h-72 rounded-xl" />
        )
      }
    >
      {loading ? <CustomerEditorLoading /> : null}
      {error ? (
        <div className="rounded-xl border bg-background">
          <PageState
            icon={IconAlertTriangle}
            title="Клиент не открылся"
            tone="danger"
          >
            {error}
          </PageState>
        </div>
      ) : null}
      {draft && tab === "main" ? (
        <CustomerMain draft={draft} update={update} />
      ) : null}
      {draft && tab !== "main" ? (
        <CustomerRelatedTab
          draft={draft}
          tab={tab}
          updateMarketing={updateMarketing}
        />
      ) : null}
    </EditorFrame>
  );
}

function CustomerOverflowActions({
  archived,
  onArchiveChange,
}: {
  archived: boolean;
  onArchiveChange: (archived: boolean) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия клиента"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onArchiveChange(!archived)}>
          <IconArchive aria-hidden="true" />
          {archived ? "Вернуть из архива" : "В архив"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CustomerMain({
  draft,
  update,
}: {
  draft: CustomerDraft;
  update: <K extends keyof CustomerDraft>(
    key: K,
    value: CustomerDraft[K],
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <EditorSection title="Основные данные">
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-4"
            htmlFor="customer-name"
            label="Имя или название"
          >
            <Input
              id="customer-name"
              onChange={(event) => update("name", event.target.value)}
              value={draft.name}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="customer-type"
            label="Тип"
          >
            <FormSelect
              id="customer-type"
              label="Тип клиента"
              onValueChange={(value) => update("type", value as CustomerType)}
              options={typeOptions}
              value={draft.type}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="customer-birthday"
            label="Дата рождения"
          >
            <Input
              id="customer-birthday"
              onChange={(event) => update("birthday", event.target.value)}
              type="date"
              value={draft.birthday}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="customer-preferences"
            label="Предпочтения и заметки"
          >
            <Textarea
              id="customer-preferences"
              onChange={(event) => update("preferences", event.target.value)}
              placeholder="Что важно учитывать при следующем обращении и внутренние заметки команды"
              rows={4}
              value={draft.preferences}
            />
          </FormField>
        </div>
      </EditorSection>
      <EditorSection title="Контакты">
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-3"
            htmlFor="customer-phone"
            label="Основной телефон"
          >
            <Input
              id="customer-phone"
              inputMode="tel"
              onChange={(event) => update("phone", event.target.value)}
              value={draft.phone}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="customer-phone-extra"
            label="Доп. телефон"
          >
            <Input
              id="customer-phone-extra"
              inputMode="tel"
              onChange={(event) =>
                update("additionalPhone", event.target.value)
              }
              placeholder="Не указан"
              value={draft.additionalPhone}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="customer-email"
            label="E-mail"
          >
            <Input
              id="customer-email"
              inputMode="email"
              onChange={(event) => update("email", event.target.value)}
              placeholder="Не указан"
              type="email"
              value={draft.email}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor="customer-channel"
            label="Предпочтительный канал"
          >
            <FormSelect
              id="customer-channel"
              label="Предпочтительный канал"
              onValueChange={(value) =>
                update("preferredChannel", value as CustomerChannel)
              }
              options={channelOptions}
              value={draft.preferredChannel}
            />
          </FormField>
        </div>
      </EditorSection>
    </div>
  );
}

function CustomerSidebar({
  draft,
  update,
}: {
  draft: CustomerDraft;
  update: <K extends keyof CustomerDraft>(
    key: K,
    value: CustomerDraft[K],
  ) => void;
}) {
  const customerAssignees = useDirectoryAssignees("customer");
  return (
    <OperationalSummary
      critical={<><ListRow><SummaryRow icon={IconCopy} label="Риск дубля" value={duplicateRiskLabels[draft.duplicateRisk]} /></ListRow><ListRow><SummaryRow icon={IconReceipt} label="Долг" value={draft.debt > 0 ? moneyFormatter.format(draft.debt) : "Нет"} /></ListRow></>}
      criticalCount={2}
      details={<>
        <ListRow>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-xs text-muted-foreground">Ответственные</span>
            <AssigneePicker
              label="Изменить ответственных клиента"
              onPeopleChange={(people) => update("assignees", people)}
              onValueChange={(person) =>
                update("assignees", person ? [person] : [])
              }
              options={customerAssignees}
              people={draft.assignees}
            />
          </div>
        </ListRow>
        <ListRow>
          <SummaryRow
            icon={IconCalendarEvent}
            label="Следующий контакт"
            value={draft.nextContactLabel ?? "Не назначен"}
          />
        </ListRow>
        <ListRow>
          <SummaryRow
            icon={IconReceipt}
            label="Оборот"
            value={moneyFormatter.format(draft.turnover)}
          />
        </ListRow>
      </>}
      detailsCount={3}
      icon={IconUsers}
      tone="info"
    />
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

function CustomerRelatedTab({
  draft,
  tab,
  updateMarketing,
}: {
  draft: CustomerDraft;
  tab: Exclude<CustomerEditorTab, "main">;
  updateMarketing: <K extends keyof MarketingAttributionDraft>(
    key: K,
    value: MarketingAttributionDraft[K],
  ) => void;
}) {
  if (tab === "orders") return <EditorPreviewOrders clientName={draft.name} />;
  if (tab === "visits") return <EditorPreviewVisits clientName={draft.name} />;
  if (tab === "payments")
    return (
      <EditorPreviewPayments
        paid={Math.max(0, draft.turnover - draft.debt)}
        total={draft.turnover}
      />
    );
  if (tab === "tasks")
    return <EditorPreviewTasks relationLabel={`Клиент #${draft.id}`} />;
  if (tab === "marketing")
    return (
      <EditorMarketingAttribution
        idPrefix="customer-marketing"
        onChange={updateMarketing}
        value={draft.marketing}
      />
    );
  return <EditorPreviewHistory entityLabel="Карточка клиента" />;
}

function CustomerEditorLoading() {
  return (
    <div
      aria-label="Загрузка редактора клиента"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
  style: "currency",
  currency: "RUB",
});
