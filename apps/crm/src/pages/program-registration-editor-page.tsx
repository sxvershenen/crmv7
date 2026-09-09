import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCash,
  IconDotsVertical,
  IconExternalLink,
  IconLink,
  IconReceipt,
  IconRotateClockwise,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import {
  AssigneePicker,
  Button,
  DatePicker,
  EntityCombobox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  EditorPreviewCommunications,
  EditorPreviewHistory,
} from "@app/components/shared/editor-preview-tabs";
import { formatProgramDateTime } from "@app/components/programs/program-format";
import { ProgramIcon } from "@app/components/programs/program-presentation";
import {
  programsRepository,
  type ProgramRegistrationEditorRepository,
} from "@app/data/programs-repository";
import { ApiClientError } from "@app/lib/api-client";
import { useDirectoryAssignees, useDirectoryCustomers } from "@app/features/use-directory-data";
import {
  programRegistrationStatuses,
  programRegistrationStatusMeta,
  type ProgramRegistrationEditorRecord,
  type ProgramRegistrationAddOnSelection,
  type ProgramRegistrationPaymentMethod,
  type ProgramRegistrationQuote,
  type ProgramRegistrationStatus,
  type ProgramRun,
} from "@app/entities/programs";

const tabs = ["main", "participants", "payment", "communications", "history"] as const;
const tabItems = [
  { value: "main", label: "Основное" },
  { value: "participants", label: "Участники" },
  { value: "payment", label: "Оплата" },
  { value: "communications", label: "Коммуникации" },
  { value: "history", label: "История" },
];
const statusOptions = programRegistrationStatuses.map((value) => ({
  value,
  label: programRegistrationStatusMeta[value].label,
}));
const paymentMethodOptions = [
  { value: "card", label: "Карта" },
  { value: "cash", label: "Наличные" },
  { value: "transfer", label: "Перевод" },
];
const paymentMethodLabels: Record<ProgramRegistrationPaymentMethod, string> = {
  card: "Карта",
  cash: "Наличные",
  transfer: "Перевод",
};
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

export function ProgramRegistrationEditorPage({
  repository = programsRepository,
}: {
  repository?: ProgramRegistrationEditorRepository;
}) {
  const programAssignees = useDirectoryAssignees("program");
  const navigate = useNavigate();
  const { id = "new" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = oneOf(params.get("tab"), tabs, "main");
  const requestedRunId = params.get("run");
  const [draft, setDraft] = useState<ProgramRegistrationEditorRecord | null>(
    null,
  );
  const [runs, setRuns] = useState<ProgramRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");
  const [quote, setQuote] = useState<ProgramRegistrationQuote | null>(null);
  const [quotePending, setQuotePending] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [addOnSelections, setAddOnSelections] = useState<ProgramRegistrationAddOnSelection[]>([]);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (!quote) return;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [quote]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    repository
      .listRegistrationRuns()
      .then(async (nextRuns) => {
        const initialRun =
          nextRuns.find((run) => run.id === requestedRunId) ?? nextRuns[0];
        const registration = id === "new"
          ? await repository.createRegistrationDraft(initialRun)
          : await repository.getRegistration(id);
        if (!active) return;
        setRuns(nextRuns);
        if (!registration) {
          setError("Регистрация на программу не найдена");
          setLoading(false);
          return;
        }
        setDraft(registration);
        setQuote(null);
        setAddOnSelections(registration.availableAddOns.filter((item) => item.required).map((item) => ({ assignmentId: item.assignmentId, quantity: item.defaultQuantity })));
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить регистрацию",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, repository, requestedRunId]);

  const update = useCallback(
    <K extends keyof ProgramRegistrationEditorRecord>(
      key: K,
      value: ProgramRegistrationEditorRecord[K],
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
    (status: ProgramRegistrationStatus) => update("status", status),
    [update],
  );
  const setTotal = useCallback((total: number) => {
    setDraft((current) =>
      current
        ? { ...current, debt: Math.max(0, total - current.paid), total }
        : current,
    );
    setSaveState("dirty");
  }, []);
  const setRun = useCallback(
    (runId: string) => {
      const run = runs.find((item) => item.id === runId);
      if (!run) return;
      setDraft((current) =>
        current
          ? {
              ...current,
              categoryIcon: run.categoryIcon,
              categoryTone: run.categoryTone,
              currency: run.currency ?? current.currency,
              occurrenceVersion: run.version ?? null,
              programName: run.name,
              programStartsAt: run.startsAt,
              run: structuredClone(run),
              runId,
              availableAddOns: [],
            }
          : current,
      );
      setQuote(null);
      setAddOnSelections([]);
      setSaveState("dirty");
    },
    [runs],
  );
  const addPayment = useCallback(
    (
      amount: number,
      method: ProgramRegistrationPaymentMethod,
      date: string,
      comment: string,
    ) => {
      if (amount <= 0) return;
      setDraft((current) =>
        current
          ? {
              ...current,
              debt: Math.max(0, current.total - current.paid - amount),
              paid: current.paid + amount,
              payments: [
                {
                  amount,
                  comment: comment.trim(),
                  date,
                  id: `registration-payment-${Date.now()}`,
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
      if (!payment || payment.kind === "refund") return current;
      const paid = Math.max(0, current.paid - payment.amount);
      return {
        ...current,
        debt: Math.max(0, current.total - paid),
        paid,
        payments: [
          {
            ...payment,
            date: new Date().toISOString().slice(0, 10),
            id: `registration-refund-${Date.now()}`,
            kind: "refund",
            sourcePaymentId: payment.id,
          },
          ...current.payments,
        ],
      };
    });
    setSaveState("dirty");
  }, []);
  const save = async () => {
    if (!draft) return;
    setSaveState("saving");
    try {
      const wasNew = draft.id === "new";
      const saved = await repository.saveRegistration(draft);
      setDraft(saved);
      setAddOnSelections((current) => {
        const options = new Map(saved.availableAddOns.map((item) => [item.assignmentId, item]));
        const valid = current.filter((item) => options.has(item.assignmentId));
        for (const option of saved.availableAddOns.filter((item) => item.required)) {
          if (!valid.some((item) => item.assignmentId === option.assignmentId)) valid.push({ assignmentId: option.assignmentId, quantity: option.defaultQuantity });
        }
        return valid;
      });
      setSaveState("saved");
      setPricingError(null);
      if (wasNew && saved.id !== "new") navigate(`/programs/registrations/${saved.id}`, { replace: true });
    } catch (reason) {
      setPricingError(apiMessage(reason, "Не удалось сохранить черновик"));
      setSaveState("conflict");
    }
  };

  const requestQuote = async () => {
    if (!draft) return;
    setQuotePending(true);
    setPricingError(null);
    try {
      setQuote(await repository.quoteRegistration(draft, addOnSelections));
    } catch (reason) {
      setPricingError(apiMessage(reason, "Не удалось рассчитать стоимость"));
    } finally {
      setQuotePending(false);
    }
  };

  const quoteMatchesDraft = Boolean(draft && quote
    && quote.occurrenceId === draft.runId
    && quote.occurrenceVersion === draft.occurrenceVersion
    && quote.participants === Math.max(1, draft.participantCount ?? 1)
    && sameAddOns(quote.addOns, addOnSelections)
    && new Date(quote.validUntil).getTime() > clock);
  const quoteExpired = Boolean(quote && new Date(quote.validUntil).getTime() <= clock);

  const confirm = async () => {
    if (!draft || !quote || !quoteMatchesDraft || saveState !== "saved") return;
    setConfirmPending(true);
    setPricingError(null);
    try {
      const confirmed = await repository.confirmRegistration(draft, quote);
      setDraft(confirmed);
      setQuote(null);
      setSaveState("saved");
    } catch (reason) {
      setPricingError(apiMessage(reason, "Не удалось подтвердить регистрацию"));
    } finally {
      setConfirmPending(false);
    }
  };

  const draftStatus = draft?.status;
  const pricedConfirmationRequired = draft?.pricingMode === "quote_required" && !draft.acceptedQuote;
  const statusControl = useMemo(
    () =>
      draftStatus ? (
        <FilterSelect
          className="w-28 max-w-28 sm:w-36 sm:max-w-36"
          label="Статус регистрации"
          onValueChange={(value) => {
            if (value === "confirmed" && pricedConfirmationRequired) {
              setPricingError("Для priced registration используйте «Подтвердить по расчёту».");
              return;
            }
            setStatus(value as ProgramRegistrationStatus);
          }}
          options={statusOptions}
          value={draftStatus}
        />
      ) : undefined,
    [draftStatus, pricedConfirmationRequired, setStatus],
  );
  const title = draft?.clientName ?? "Регистрация";
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
      ariaLabel="Разделы редактора регистрации"
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
  const openRun = () => {
    if (draft?.runId) navigate(`/programs/runs/${draft.runId}`);
  };

  return (
    <EditorFrame
      actions={
        draft ? (
          <>
            {statusControl}
            <AssigneePicker
              label="Сменить ответственного регистрации"
              onPeopleChange={(people) => update("assignees", people)}
              onValueChange={setAssignee}
              options={programAssignees}
              people={draft.assignees}
            />
            <RegistrationOverflow
              cancelled={draft.status === "cancelled"}
              onCancel={() => setStatus("cancelled")}
              onOpenRun={openRun}
            />
          </>
        ) : null
      }
      footerActions={
        <>
          <Button className="hidden sm:inline-flex" onClick={() => navigate(-1)} size="sm" variant="outline">
            Закрыть
          </Button>
          <Button
            aria-label="Сохранить черновик"
            disabled={!draft || saveState === "saving"}
            onClick={() => void save()}
            size="sm"
          >
            <span className="sm:hidden">Сохранить</span><span className="hidden sm:inline">Сохранить черновик</span>
          </Button>
          {draft?.pricingMode === "quote_required" && !draft.acceptedQuote ? (
            <>
              <Button aria-label={quote ? "Пересчитать" : "Рассчитать"} disabled={quotePending || saveState !== "saved" || draft.id === "new"} onClick={() => void requestQuote()} size="sm" variant="outline">
                <span className="sm:hidden">{quotePending ? "Считаем…" : "Расчёт"}</span><span className="hidden sm:inline">{quotePending ? "Рассчитываем…" : quote ? "Пересчитать" : "Рассчитать"}</span>
              </Button>
              <Button aria-label="Подтвердить по расчёту" disabled={confirmPending || !quoteMatchesDraft || saveState !== "saved"} onClick={() => void confirm()} size="sm">
                <span className="sm:hidden">{confirmPending ? "Ждите…" : "Подтвердить"}</span><span className="hidden sm:inline">{confirmPending ? "Подтверждаем…" : "Подтвердить по расчёту"}</span>
              </Button>
            </>
          ) : null}
        </>
      }
      mobileActions={
        draft ? (
          <RegistrationMobileActions
            cancelled={draft.status === "cancelled"}
            onAssigneeChange={setAssignee}
            onCancel={() => setStatus("cancelled")}
            onOpenRun={openRun}
          />
        ) : null
      }
      navigation={navigation}
      saveState={saveState}
      sidebar={
        draft ? (
          <RegistrationSidebar
            draft={draft}
            onAssigneeChange={setAssignee}
            onOpenRun={openRun}
            update={update}
          />
        ) : (
          <Skeleton className="h-96 rounded-xl" />
        )
      }
    >
      {loading ? <RegistrationEditorLoading /> : null}
      {error ? (
        <div className="rounded-xl border bg-background">
          <PageState
            icon={IconAlertTriangle}
            title="Регистрация не открылась"
            tone="danger"
          >
            {error}
          </PageState>
        </div>
      ) : null}
      {draft && tab === "main" ? (
        <RegistrationMain
          draft={draft}
          onRunChange={setRun}
          runs={runs}
          update={update}
        />
      ) : null}
      {draft && tab === "participants" ? (
        <RegistrationParticipants draft={draft} update={update} />
      ) : null}
      {draft && tab === "payment" ? (
        <RegistrationPayments
          addOnSelections={addOnSelections}
          draft={draft}
          onAdd={addPayment}
          onRefund={refundPayment}
          onTotalChange={setTotal}
          onAddOnSelectionsChange={setAddOnSelections}
          pricingError={pricingError}
          quote={quote}
          quoteExpired={quoteExpired}
          quoteMatchesDraft={quoteMatchesDraft}
          update={update}
        />
      ) : null}
      {draft && tab === "communications" ? (
        <EditorPreviewCommunications phone={draft.phone} />
      ) : null}
      {draft && tab === "history" ? (
        <EditorPreviewHistory entityLabel="Регистрация" />
      ) : null}
    </EditorFrame>
  );
}

function sameAddOns(left: ProgramRegistrationAddOnSelection[], right: ProgramRegistrationAddOnSelection[]) {
  const canonical = (items: ProgramRegistrationAddOnSelection[]) => [...items].sort((a, b) => a.assignmentId.localeCompare(b.assignmentId));
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function apiMessage(reason: unknown, fallback: string) {
  if (!(reason instanceof Error)) return fallback;
  if (reason instanceof ApiClientError) {
    if (reason.status === 403) return "Нет прав на расчёт или подтверждение";
    if (reason.rawCode === "QUOTE_EXPIRED") return "Срок действия расчёта истёк. Пересчитайте стоимость.";
    if (reason.rawCode === "CAPACITY_EXCEEDED") return "На проведении нет мест для этой группы.";
    if (reason.status === 409 || reason.rawCode === "QUOTE_CONTEXT_MISMATCH") return "Данные или условия изменились. Обновите страницу и повторите расчёт.";
  }
  return reason.message || fallback;
}

function RegistrationOverflow({
  cancelled,
  onCancel,
  onOpenRun,
}: {
  cancelled: boolean;
  onCancel: () => void;
  onOpenRun: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия регистрации"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpenRun}>
          <IconExternalLink aria-hidden="true" />
          Открыть проведение
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={cancelled} onClick={onCancel}>
          <IconAlertTriangle aria-hidden="true" />
          {cancelled ? "Регистрация отменена" : "Отменить регистрацию"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function RegistrationMobileActions({
  cancelled,
  onAssigneeChange,
  onCancel,
  onOpenRun,
}: {
  cancelled: boolean;
  onAssigneeChange: (person: Assignee | null) => void;
  onCancel: () => void;
  onOpenRun: () => void;
}) {
  const programAssignees = useDirectoryAssignees("program");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия регистрации"
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
        <DropdownMenuItem onClick={onOpenRun}>
          <IconExternalLink aria-hidden="true" />
          Открыть проведение
        </DropdownMenuItem>
        <DropdownMenuItem disabled={cancelled} onClick={onCancel}>
          <IconAlertTriangle aria-hidden="true" />
          {cancelled ? "Регистрация отменена" : "Отменить регистрацию"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RegistrationMain({
  draft,
  onRunChange,
  runs,
  update,
}: {
  draft: ProgramRegistrationEditorRecord;
  onRunChange: (id: string) => void;
  runs: ProgramRun[];
  update: <K extends keyof ProgramRegistrationEditorRecord>(
    key: K,
    value: ProgramRegistrationEditorRecord[K],
  ) => void;
}) {
  const customers = useDirectoryCustomers();
  const selectedCustomer = customers.find(
    (customer) =>
      customer.id === draft.customerId ||
      customer.name === draft.clientName ||
      customer.phone === draft.phone,
  );
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
            <p className="truncate text-[13px] font-medium">
              {draft.programName}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {formatProgramDateTime(draft.programStartsAt)}
            </p>
          </div>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-6"
            htmlFor="registration-run"
            label="Проведение"
          >
            {draft.acceptedQuote ? (
              <Input aria-label="Проведение программы" disabled value={`${draft.programName} · ${formatProgramDateTime(draft.programStartsAt)}`} />
            ) : (
              <EntityCombobox
                label="Проведение программы"
                onValueChange={onRunChange}
                options={runs.map((run) => ({
                  label: run.name,
                  secondary: formatProgramDateTime(run.startsAt),
                  value: run.id,
                }))}
                value={draft.runId}
              />
            )}
          </FormField>
          <FormField
            className="sm:col-span-4"
            htmlFor="registration-client-name"
            label="Клиент"
          >
            <EntityCombobox
              label="Клиент регистрации"
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
                  update("customerId", customer.id);
                  update("clientName", customer.name);
                  update("phone", customer.phone);
                }
              }}
              options={customers.map((customer) => ({
                label: customer.name,
                secondary: customer.phone,
                value: customer.id,
              }))}
              placeholder={draft.clientName || "Выберите клиента"}
              value={selectedCustomer?.id ?? ""}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-phone"
            label="Телефон"
          >
            <Input
              id="registration-phone"
              inputMode="tel"
              onChange={(event) => update("phone", event.target.value)}
              value={draft.phone}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="registration-client-comment"
            label="Комментарий клиента"
          >
            <Textarea
              id="registration-client-comment"
              onChange={(event) => update("comment", event.target.value)}
              placeholder="Пожелания и важные детали"
              value={draft.comment}
            />
          </FormField>
        </div>
      </EditorSection>
    </div>
  );
}

function RegistrationParticipants({
  draft,
  update,
}: {
  draft: ProgramRegistrationEditorRecord;
  update: <K extends keyof ProgramRegistrationEditorRecord>(
    key: K,
    value: ProgramRegistrationEditorRecord[K],
  ) => void;
}) {
  return (
    <EditorSection
      subtitle="Персональные данные будут валидироваться и храниться по серверным правилам после backend-интеграции."
      title="Состав группы"
    >
      <div className="grid items-start gap-4 sm:grid-cols-6">
        <FormField
          className="sm:col-span-2"
          htmlFor="registration-participant-count"
          label="Количество участников"
        >
          <Input
            disabled={Boolean(draft.acceptedQuote)}
            id="registration-participant-count"
            min="1"
            onChange={(event) =>
              update("participantCount", inputNumber(event.target.value))
            }
            type="number"
            value={draft.participantCount ?? ""}
          />
        </FormField>
        <FormField
          className="sm:col-span-6"
          htmlFor="registration-participant-names"
          label="Имена участников"
        >
          <Textarea
            id="registration-participant-names"
            onChange={(event) => update("participantNames", event.target.value)}
            placeholder="По одному имени в строке или через запятую"
            value={draft.participantNames}
          />
        </FormField>
      </div>
    </EditorSection>
  );
}

function RegistrationPayments({
  addOnSelections,
  draft,
  onAdd,
  onAddOnSelectionsChange,
  onRefund,
  onTotalChange,
  pricingError,
  quote,
  quoteExpired,
  quoteMatchesDraft,
  update,
}: {
  addOnSelections: ProgramRegistrationAddOnSelection[];
  draft: ProgramRegistrationEditorRecord;
  onAdd: (
    amount: number,
    method: ProgramRegistrationPaymentMethod,
    date: string,
    comment: string,
  ) => void;
  onAddOnSelectionsChange: (value: ProgramRegistrationAddOnSelection[]) => void;
  onRefund: (id: string) => void;
  onTotalChange: (value: number) => void;
  pricingError: string | null;
  quote: ProgramRegistrationQuote | null;
  quoteExpired: boolean;
  quoteMatchesDraft: boolean;
  update: <K extends keyof ProgramRegistrationEditorRecord>(
    key: K,
    value: ProgramRegistrationEditorRecord[K],
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <EditorSection title="Стоимость регистрации">
        <div className="grid items-start gap-3">
          {draft.pricingMode === "legacy_unpriced" ? (
            <>
              <FormField htmlFor="registration-total" label="Стоимость">
                <Input id="registration-total" min="0" onChange={(event) => onTotalChange(inputNumber(event.target.value))} type="number" value={draft.total} />
              </FormField>
              <FormField htmlFor="registration-discount" label="Скидка, %">
                <Input id="registration-discount" max="100" min="0" onChange={(event) => update("discount", inputNumber(event.target.value))} type="number" value={draft.discount} />
              </FormField>
              <p className="text-[11px] text-muted-foreground">Устаревший режим: стоимость задаёт оператор.</p>
            </>
          ) : (
            <ServerPricing
              addOnSelections={addOnSelections}
              draft={draft}
              onAddOnSelectionsChange={onAddOnSelectionsChange}
              pricingError={pricingError}
              quote={quote}
              quoteExpired={quoteExpired}
              quoteMatchesDraft={quoteMatchesDraft}
            />
          )}
          <FormField htmlFor="registration-promo" label="Промокод">
            <Input
              id="registration-promo"
              onChange={(event) => update("promo", event.target.value)}
              placeholder="Без промокода"
              value={draft.promo}
            />
          </FormField>
        </div>
      </EditorSection>
      <RegistrationPaymentEditor
        draft={draft}
        onAdd={onAdd}
        onRefund={onRefund}
      />
    </div>
  );
}

function ServerPricing({
  addOnSelections,
  draft,
  onAddOnSelectionsChange,
  pricingError,
  quote,
  quoteExpired,
  quoteMatchesDraft,
}: {
  addOnSelections: ProgramRegistrationAddOnSelection[];
  draft: ProgramRegistrationEditorRecord;
  onAddOnSelectionsChange: (value: ProgramRegistrationAddOnSelection[]) => void;
  pricingError: string | null;
  quote: ProgramRegistrationQuote | null;
  quoteExpired: boolean;
  quoteMatchesDraft: boolean;
}) {
  const shown = draft.acceptedQuote ?? quote;
  const updateQuantity = (assignmentId: string, quantity: number, required: boolean) => {
    const rest = addOnSelections.filter((item) => item.assignmentId !== assignmentId);
    onAddOnSelectionsChange(quantity > 0 || required ? [...rest, { assignmentId, quantity: Math.max(1, quantity) }] : rest);
  };
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs font-medium">Цену фиксирует серверный расчёт</p>
        <p className="mt-1 text-[11px] text-muted-foreground">Сохраните черновик, рассчитайте точное проведение и состав группы, затем подтвердите.</p>
      </div>
      {!draft.acceptedQuote && draft.availableAddOns.length ? (
        <div className="space-y-3" aria-label="Дополнительные услуги">
          {draft.availableAddOns.map((option) => {
            const selected = addOnSelections.find((item) => item.assignmentId === option.assignmentId);
            return (
              <FormField key={option.assignmentId} htmlFor={`registration-addon-${option.assignmentId}`} label={`${option.label}${option.required ? " (обязательно)" : ""}`}>
                <Input
                  id={`registration-addon-${option.assignmentId}`}
                  min={option.required ? option.minQuantity : 0}
                  max={option.maxQuantity ?? undefined}
                  onChange={(event) => updateQuantity(option.assignmentId, inputNumber(event.target.value), option.required)}
                  type="number"
                  value={selected?.quantity ?? 0}
                />
              </FormField>
            );
          })}
        </div>
      ) : <p className="text-[11px] text-muted-foreground">Доступных дополнений нет.</p>}
      {pricingError ? <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger-foreground" role="alert">{pricingError}</p> : null}
      {shown ? (
        <div className="space-y-2 rounded-lg border p-3" aria-label={draft.acceptedQuote ? "Принятый расчёт" : "Текущий расчёт"}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium">{draft.acceptedQuote ? "Принятая стоимость" : "Рассчитанная стоимость"}</span>
            <span className="font-medium tabular-nums">{money.format(shown.total)}</span>
          </div>
          {shown.lines.map((line, index) => <div className="flex justify-between gap-3 text-[11px] text-muted-foreground" key={`${line.kind}-${line.label}-${index}`}><span>{line.label} × {line.quantity}</span><span className="tabular-nums">{money.format(line.amount)}</span></div>)}
          {draft.acceptedQuote ? <p className="border-t pt-2 text-[11px] text-muted-foreground">Снимок цены и дополнений зафиксирован {new Date(draft.acceptedQuote.acceptedAt).toLocaleString("ru-RU")}.</p> : quoteExpired ? <p className="border-t pt-2 text-[11px] text-warning-foreground">Срок действия расчёта истёк. Пересчитайте стоимость.</p> : !quoteMatchesDraft ? <p className="border-t pt-2 text-[11px] text-warning-foreground">Расчёт устарел: проведение, участники или дополнения изменились.</p> : <p className="border-t pt-2 text-[11px] text-muted-foreground">Действует до {new Date(quote!.validUntil).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}.</p>}
        </div>
      ) : null}
    </div>
  );
}

function RegistrationPaymentEditor({
  draft,
  onAdd,
  onRefund,
}: {
  draft: ProgramRegistrationEditorRecord;
  onAdd: (
    amount: number,
    method: ProgramRegistrationPaymentMethod,
    date: string,
    comment: string,
  ) => void;
  onRefund: (id: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] =
    useState<ProgramRegistrationPaymentMethod>("card");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState("");
  const submit = () => {
    const value = inputNumber(amount);
    if (value <= 0) return;
    onAdd(value, method, date, comment);
    setAmount("");
    setComment("");
  };
  return (
    <EditorSection title="Операции оплаты">
      <div className="space-y-4">
        <PaymentProgress
          className="w-full"
          paid={draft.paid}
          total={draft.total}
        />
        <div className="flex items-center justify-between border-t pt-3 text-xs">
          <span className="text-muted-foreground">Долг</span>
          <span className="tabular-nums">{money.format(draft.debt)}</span>
        </div>
        <div className="grid items-end gap-3 sm:grid-cols-6">
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-payment-amount"
            label="Сумма"
          >
            <Input
              id="registration-payment-amount"
              min="0"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0"
              type="number"
              value={amount}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-payment-method"
            label="Способ"
          >
            <FormSelect
              id="registration-payment-method"
              label="Способ оплаты регистрации"
              onValueChange={(value) =>
                setMethod(value as ProgramRegistrationPaymentMethod)
              }
              options={paymentMethodOptions}
              value={method}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="registration-payment-date"
            label="Дата"
          >
            <DatePicker
              className="w-full max-w-none"
              density="form"
              id="registration-payment-date"
              label="Дата оплаты"
              onValueChange={(value) =>
                value && setDate(value.toISOString().slice(0, 10))
              }
              value={new Date(`${date}T12:00:00`)}
            />
          </FormField>
          <FormField
            className="sm:col-span-4"
            htmlFor="registration-payment-comment"
            label="Комментарий"
          >
            <Input
              id="registration-payment-comment"
              onChange={(event) => setComment(event.target.value)}
              placeholder="Необязательно"
              value={comment}
            />
          </FormField>
          <Button
            className="sm:col-span-2"
            disabled={inputNumber(amount) <= 0}
            onClick={submit}
            size="sm"
          >
            <IconCash aria-hidden="true" />
            Добавить оплату
          </Button>
        </div>
        {draft.payments.length ? (
          <div className="divide-y border-t">
            {draft.payments.map((payment) => (
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
                <div className="min-w-0 flex-1">
                  <p className="tabular-nums">{money.format(payment.amount)}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {payment.date} · {paymentMethodLabels[payment.method]}
                    {payment.comment ? ` · ${payment.comment}` : ""}
                  </p>
                </div>
                {payment.kind === "payment" ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          aria-label={`Оформить возврат ${money.format(payment.amount)}`}
                          onClick={() => onRefund(payment.id)}
                          size="icon-xs"
                          variant="ghost"
                        />
                      }
                    >
                      <IconRotateClockwise aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>Оформить возврат</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t pt-3 text-center text-[11px] text-muted-foreground">
            Детализация предыдущих оплат недоступна
          </p>
        )}
      </div>
    </EditorSection>
  );
}

function RegistrationSidebar({
  draft,
  onAssigneeChange,
  onOpenRun,
  update,
}: {
  draft: ProgramRegistrationEditorRecord;
  onAssigneeChange: (person: Assignee | null) => void;
  onOpenRun: () => void;
  update: <K extends keyof ProgramRegistrationEditorRecord>(
    key: K,
    value: ProgramRegistrationEditorRecord[K],
  ) => void;
}) {
  const programAssignees = useDirectoryAssignees("program");
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
                label="Сменить ответственного регистрации в сводке"
                onPeopleChange={(people) => update("assignees", people)}
                onValueChange={onAssigneeChange}
                options={programAssignees}
                people={draft.assignees}
              />
            </div>
          </ListRow>
          <ListRow>
            <Button
              className="h-auto w-full justify-start rounded-none px-4 py-3 text-left text-xs"
              onClick={onOpenRun}
              variant="ghost"
            >
              <IconLink
                aria-hidden="true"
                className="size-3.5 text-muted-foreground"
              />
              <span className="min-w-0 flex-1 text-muted-foreground">
                Проведение
              </span>
              <span className="max-w-40 truncate">#{draft.runId || "—"}</span>
            </Button>
          </ListRow>
          <ListRow>
            <SummaryRow
              icon={IconCalendarEvent}
              label="Начало"
              value={formatProgramDateTime(draft.programStartsAt)}
            />
          </ListRow>
          <ListRow>
            <SummaryRow
              icon={IconUsers}
              label="Участники"
              value={
                draft.participantCount === null
                  ? "Не указаны"
                  : String(draft.participantCount)
              }
            />
          </ListRow>
          <ListRow>
            <div className="grid gap-1.5 px-4 py-3">
              <span className="text-xs font-medium">Источник</span>
              <FormSelect
                id="registration-source"
                label="Источник регистрации"
                onValueChange={(value) => update("source", value)}
                options={[
                  { value: "Сайт", label: "Сайт" },
                  { value: "Телефон", label: "Телефон" },
                  { value: "VK", label: "VK" },
                  { value: "Рекомендация", label: "Рекомендация" },
                  { value: "Вручную", label: "Вручную" },
                ]}
                value={draft.source || "Вручную"}
              />
            </div>
          </ListRow>
        </>}
        detailsCount={5}
        icon={IconReceipt}
        tone="program"
      />
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
function RegistrationEditorLoading() {
  return (
    <div
      aria-label="Загрузка редактора регистрации"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
