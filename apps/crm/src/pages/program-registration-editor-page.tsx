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
  createEmptyProgramRegistration,
  programsRepository,
  type ProgramRegistrationEditorRepository,
} from "@app/data/programs-repository";
import { useDirectoryAssignees, useDirectoryCustomers } from "@app/features/use-directory-data";
import {
  programRegistrationStatuses,
  programRegistrationStatusMeta,
  type ProgramRegistrationEditorRecord,
  type ProgramRegistrationPaymentMethod,
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    repository
      .listRegistrationRuns()
      .then(async (nextRuns) => {
        const initialRun =
          nextRuns.find((run) => run.id === requestedRunId) ?? nextRuns[0];
        const registration =
          id === "new"
            ? createEmptyProgramRegistration(initialRun)
            : await repository.getRegistration(id);
        if (!active) return;
        setRuns(nextRuns);
        if (!registration) {
          setError("Регистрация на программу не найдена");
          setLoading(false);
          return;
        }
        setDraft(registration);
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
              programName: run.name,
              programStartsAt: run.startsAt,
              run: structuredClone(run),
              runId,
            }
          : current,
      );
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
      await repository.saveRegistration(draft);
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
          label="Статус регистрации"
          onValueChange={(value) =>
            setStatus(value as ProgramRegistrationStatus)
          }
          options={statusOptions}
          value={draftStatus}
        />
      ) : undefined,
    [draftStatus, setStatus],
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
          draft={draft}
          onAdd={addPayment}
          onRefund={refundPayment}
          onTotalChange={setTotal}
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
  draft,
  onAdd,
  onRefund,
  onTotalChange,
  update,
}: {
  draft: ProgramRegistrationEditorRecord;
  onAdd: (
    amount: number,
    method: ProgramRegistrationPaymentMethod,
    date: string,
    comment: string,
  ) => void;
  onRefund: (id: string) => void;
  onTotalChange: (value: number) => void;
  update: <K extends keyof ProgramRegistrationEditorRecord>(
    key: K,
    value: ProgramRegistrationEditorRecord[K],
  ) => void;
}) {
  return (
    <div className="space-y-3">
      <EditorSection title="Стоимость регистрации">
        <div className="grid items-start gap-3">
          <FormField htmlFor="registration-total" label="Стоимость">
            <Input
              id="registration-total"
              min="0"
              onChange={(event) =>
                onTotalChange(inputNumber(event.target.value))
              }
              type="number"
              value={draft.total}
            />
          </FormField>
          <FormField htmlFor="registration-discount" label="Скидка, %">
            <Input
              id="registration-discount"
              max="100"
              min="0"
              onChange={(event) =>
                update("discount", inputNumber(event.target.value))
              }
              type="number"
              value={draft.discount}
            />
          </FormField>
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
