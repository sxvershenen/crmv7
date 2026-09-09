import { useState, type ElementType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  IconCalendarEvent,
  IconCash,
  IconCheck,
  IconClock,
  IconCreditCard,
  IconExternalLink,
  IconHistory,
  IconLink,
  IconMail,
  IconMessageCircle,
  IconPhone,
  IconPlus,
  IconReceipt,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";

import {
  AssigneePicker,
  Button,
  DateTimePicker,
  EditorSection,
  FormField,
  FormSelect,
  Input,
  MessageComposer,
  PaymentProgress,
  StatusBadge,
  type Assignee,
} from "@crm/ui";

import { useFixtureData } from "@app/lib/data-mode";

import type { MarketingAttributionDraft } from "./editor-preview-data";

const showPreviewFixtures =
  useFixtureData || import.meta.env.MODE === "test";

const marina: Assignee = {
  id: "preview-marina",
  initials: "МК",
  name: "Марина Кириллова",
  colorClass: "bg-sky-100 text-sky-700",
};
const alexey: Assignee = {
  id: "preview-alexey",
  initials: "АВ",
  name: "Алексей Воронов",
  colorClass: "bg-violet-100 text-violet-700",
};
const money = new Intl.NumberFormat("ru-RU", {
  currency: "RUB",
  maximumFractionDigits: 0,
  style: "currency",
});

function PreviewNote() {
  return (
    <p className="text-[11px] leading-4 text-muted-foreground">
      Демонстрационные fixture-данные для оценки плотности, переполнения и
      состояний интерфейса.
    </p>
  );
}

function PreviewUnavailable({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <EditorSection title={title}>
      <div className="rounded-lg border border-dashed px-4 py-8 text-center">
        <p className="text-xs font-medium">Данных пока нет</p>
        <p className="mx-auto mt-1 max-w-lg text-[11px] leading-4 text-muted-foreground">
          {description}
        </p>
      </div>
    </EditorSection>
  );
}

function TimelineRow({
  children,
  href,
  icon: Icon,
  meta,
  title,
  tone = "neutral",
}: {
  children?: ReactNode;
  href?: string;
  icon: ElementType;
  meta: string;
  title: string;
  tone?: "blue" | "green" | "neutral" | "violet";
}) {
  const tones = {
    blue: "bg-sky-50 text-sky-700",
    green: "bg-emerald-50 text-emerald-700",
    neutral: "bg-muted text-muted-foreground",
    violet: "bg-violet-50 text-violet-700",
  };
  const content = (
    <>
      <span
        className={`inline-flex size-7 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-[13px] leading-4">{title}</p>
          <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
            {meta}
            {href ? (
              <IconExternalLink aria-hidden="true" className="size-3" />
            ) : null}
          </span>
        </div>
        {children ? (
          <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {children}
          </div>
        ) : null}
      </div>
    </>
  );
  return href ? (
    <Link
      className="flex min-w-0 gap-3 rounded-md py-3 outline-none first:pt-0 last:pb-0 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
      to={href}
    >
      {content}
    </Link>
  ) : (
    <article className="flex min-w-0 gap-3 py-3 first:pt-0 last:pb-0">
      {content}
    </article>
  );
}

export function EditorPreviewHistory({ entityLabel }: { entityLabel: string }) {
  if (!showPreviewFixtures) {
    return (
      <PreviewUnavailable
        description={`История «${entityLabel}» появится здесь после подключения журнала изменений к редактору.`}
        title="История изменений"
      />
    );
  }
  return (
    <EditorSection
      subtitle="Хронология показана от новых событий к старым."
      title="История изменений"
    >
      <div className="divide-y">
        <TimelineRow
          icon={IconCheck}
          meta="Сегодня, 14:32 · Марина Кириллова"
          title="Изменён статус"
          tone="green"
        >
          <span>«Новый» → «В работе»</span>
        </TimelineRow>
        <TimelineRow
          icon={IconUser}
          meta="Сегодня, 12:18 · Система"
          title="Назначен ответственный"
          tone="violet"
        >
          <span>Марина Кириллова добавлена как ответственная.</span>
        </TimelineRow>
        <TimelineRow
          icon={IconHistory}
          meta="23 авг, 18:05 · Алексей Воронов"
          title="Обновлены основные данные"
        >
          <span>
            Изменены дата, количество участников и внутренний комментарий.
          </span>
        </TimelineRow>
        <TimelineRow
          icon={IconPlus}
          meta="21 авг, 10:40 · Марина Кириллова"
          title={`${entityLabel} создана`}
          tone="blue"
        >
          <span>Запись создана вручную в CRM.</span>
        </TimelineRow>
      </div>
    </EditorSection>
  );
}

export function EditorPreviewTasks({
  relationLabel,
}: {
  relationLabel: string;
}) {
  const [tasks, setTasks] = useState(() => [
    {
      id: "T-418",
      title: "Подтвердить детали и время приезда",
      due: "2026-08-25T18:00",
      priority: "high",
      status: "work",
      assignees: [marina],
    },
    {
      id: "T-421",
      title: "Отправить памятку и схему проезда",
      due: "2026-08-26T10:00",
      priority: "normal",
      status: "todo",
      assignees: [alexey],
    },
    {
      id: "T-397",
      title: "Проверить поступление предоплаты",
      due: "2026-08-27T12:00",
      priority: "normal",
      status: "done",
      assignees: [marina, alexey],
    },
  ]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    due: "2026-08-26T12:00",
    priority: "normal",
    status: "todo",
    assignees: [] as Assignee[],
  });
  if (!showPreviewFixtures) {
    return (
      <PreviewUnavailable
        description={`Связанные с «${relationLabel}» задачи доступны в разделе «Задачи». Встроенное редактирование появится после подключения relation API.`}
        title="Связанные задачи"
      />
    );
  }
  const addTask = () => {
    if (!newTask.title.trim()) return;
    const sequence = tasks.length + 422;
    setTasks((current) => [
      { id: `T-${sequence}`, ...newTask, title: newTask.title.trim() },
      ...current,
    ]);
    setNewTask({
      title: "",
      due: "2026-08-26T12:00",
      priority: "normal",
      status: "todo",
      assignees: [],
    });
    setCreating(false);
  };
  const updateTask = (id: string, patch: Partial<(typeof tasks)[number]>) =>
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    );
  const editorFields = (
    task: typeof newTask,
    update: (patch: Partial<typeof newTask>) => void,
    prefix: string,
  ) => (
    <div className="grid gap-3 sm:grid-cols-6">
      <FormField
        className="sm:col-span-6"
        htmlFor={`${prefix}-title`}
        label="Название"
      >
        <Input
          id={`${prefix}-title`}
          onChange={(event) => update({ title: event.target.value })}
          value={task.title}
        />
      </FormField>
      <FormField
        className="sm:col-span-3"
        htmlFor={`${prefix}-due`}
        label="Срок"
      >
        <DateTimePicker
          id={`${prefix}-due`}
          label="Срок задачи"
          onValueChange={(due) => update({ due })}
          value={task.due}
        />
      </FormField>
      <FormField
        className="sm:col-span-2"
        htmlFor={`${prefix}-priority`}
        label="Приоритет"
      >
        <FormSelect
          id={`${prefix}-priority`}
          label="Приоритет"
          onValueChange={(priority) => update({ priority })}
          options={[
            { value: "normal", label: "Обычный" },
            { value: "high", label: "Высокий" },
            { value: "urgent", label: "Срочный" },
          ]}
          value={task.priority}
        />
      </FormField>
      <FormField
        className="sm:col-span-1"
        htmlFor={`${prefix}-assignee`}
        label="Исполнитель"
      >
        <AssigneePicker
          className="w-full"
          label="Выбрать исполнителей"
          onPeopleChange={(assignees) => update({ assignees })}
          onValueChange={(person) =>
            update({ assignees: person ? [person] : [] })
          }
          options={[marina, alexey]}
          people={task.assignees}
        />
      </FormField>
    </div>
  );
  return (
    <div className="space-y-3">
      <EditorSection
        actions={
          <Button
            onClick={() => setCreating((current) => !current)}
            size="sm"
            variant={creating ? "outline" : "default"}
          >
            <IconPlus aria-hidden="true" />
            {creating ? "Свернуть" : "Добавить задачу"}
          </Button>
        }
        subtitle={`Все задачи связаны с «${relationLabel}».`}
        title="Связанные задачи"
      >
        {creating ? (
          <div className="mb-3 rounded-lg border bg-muted/20 p-3">
            {editorFields(
              newTask,
              (patch) => setNewTask((current) => ({ ...current, ...patch })),
              "preview-new-task",
            )}
            <div className="mt-3 flex justify-end">
              <Button
                disabled={!newTask.title.trim()}
                onClick={addTask}
                size="sm"
              >
                Создать задачу
              </Button>
            </div>
          </div>
        ) : null}
        <div className="divide-y rounded-lg border">
          {tasks.map((task) => (
            <article className="p-3" key={task.id}>
              {editingId === task.id ? (
                <>
                  {editorFields(
                    task,
                    (patch) => updateTask(task.id, patch),
                    `preview-task-${task.id}`,
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button onClick={() => setEditingId(null)} size="sm">
                      Готово
                    </Button>
                  </div>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-[auto_132px_minmax(0,1fr)_auto] sm:items-center">
                  <AssigneePicker
                    label="Изменить исполнителей"
                    onPeopleChange={(assignees) =>
                      updateTask(task.id, { assignees })
                    }
                    onValueChange={(person) =>
                      updateTask(task.id, { assignees: person ? [person] : [] })
                    }
                    options={[marina, alexey]}
                    people={task.assignees}
                  />
                  <FormSelect
                    id={`preview-task-status-${task.id}`}
                    label={`Статус задачи ${task.title}`}
                    onValueChange={(status) => updateTask(task.id, { status })}
                    options={[
                      { value: "todo", label: "К выполнению" },
                      { value: "work", label: "В работе" },
                      { value: "done", label: "Выполнено" },
                    ]}
                    value={task.status}
                  />
                  <button
                    className="min-w-0 text-left outline-none"
                    onClick={() => setEditingId(task.id)}
                    type="button"
                  >
                    <p className="truncate text-[13px]">{task.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <IconClock aria-hidden="true" className="size-3" />
                      {task.due.replace("T", " · ")} ·{" "}
                      {task.priority === "high"
                        ? "Высокий"
                        : task.priority === "urgent"
                          ? "Срочный"
                          : "Обычный"}
                    </p>
                  </button>
                  <Button
                    aria-label={`Открыть задачу ${task.title}`}
                    render={<Link to={`/tasks/${task.id.replace("T-", "")}`} />}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <IconExternalLink aria-hidden="true" />
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      </EditorSection>
      <PreviewNote />
    </div>
  );
}

export function EditorPreviewCommunications({
  phone = "+7 921 450-12-40",
}: {
  phone?: string;
}) {
  const [draft, setDraft] = useState("");
  const [type, setType] = useState("comment");
  const [localMessages, setLocalMessages] = useState<
    Array<{ text: string; type: string }>
  >([]);
  const add = () => {
    const message = draft.trim();
    if (!message) return;
    setLocalMessages((current) => [{ text: message, type }, ...current]);
    setDraft("");
  };
  const typeOptions = [
    { value: "call", label: "Звонок" },
    { value: "message", label: "Сообщение" },
    { value: "comment", label: "Внутренний комментарий" },
  ];
  const typeLabels: Record<string, string> = {
    call: "Звонок",
    message: "Сообщение",
    comment: "Внутренний комментарий",
  };
  if (!showPreviewFixtures) {
    return (
      <PreviewUnavailable
        description="Лента звонков и сообщений появится после подключения каналов коммуникации. Локальные сообщения не выдаются за сохранённые."
        title="Коммуникации"
      />
    );
  }
  return (
    <div className="space-y-3">
      <EditorSection
        subtitle="Тип и отправка находятся в единой панели сообщения."
        title="Добавить коммуникацию"
      >
        <MessageComposer
          ariaLabel="Содержание коммуникации"
          onSend={add}
          onTypeChange={setType}
          onValueChange={setDraft}
          placeholder="Результат звонка, сообщение или заметка"
          type={type}
          typeOptions={typeOptions}
          value={draft}
        />
      </EditorSection>
      <EditorSection
        subtitle="Звонки, сообщения и внутренние комментарии собраны в одной ленте."
        title="Хронология"
      >
        {localMessages.map((message, index) => (
          <TimelineRow
            icon={IconMessageCircle}
            key={`${message.text}-${index}`}
            meta="Только что · Марина Кириллова"
            title={typeLabels[message.type] ?? "Коммуникация"}
            tone="violet"
          >
            {message.text}
          </TimelineRow>
        ))}
        <div className="divide-y">
          <TimelineRow
            icon={IconPhone}
            meta="Сегодня, 14:18 · 03:42"
            title={`Исходящий звонок · ${phone}`}
            tone="green"
          >
            Клиент подтвердил количество гостей. Просил продублировать детали
            сообщением.
          </TimelineRow>
          <TimelineRow
            icon={IconMessageCircle}
            meta="Сегодня, 14:24 · VK"
            title="Отправлено сообщение"
            tone="blue"
          >
            Отправлены схема проезда, время заезда и контакты администратора.
          </TimelineRow>
          <TimelineRow
            icon={IconMail}
            meta="23 авг, 18:05 · CRM"
            title="Входящее сообщение"
          >
            «Спасибо! Подскажите, можно ли приехать на 30 минут раньше?»
          </TimelineRow>
        </div>
      </EditorSection>
    </div>
  );
}

export function EditorPreviewVisits({ clientName }: { clientName: string }) {
  if (!showPreviewFixtures) {
    return (
      <PreviewUnavailable
        description={`История посещений клиента «${clientName}» появится после подключения агрегированной выборки по бронированиям и программам.`}
        title="История посещений"
      />
    );
  }
  return (
    <div className="space-y-3">
      <EditorSection
        subtitle={`Предыдущие визиты клиента «${clientName}».`}
        title="История посещений"
      >
        <div className="divide-y rounded-lg border">
          <TimelineRow
            href="/bookings/2034"
            icon={IconCalendarEvent}
            meta="18 авг, 12:00–16:00"
            title="Дом «Берёза» · бронь #2034"
            tone="green"
          >
            <span className="inline-flex items-center gap-3">
              <span>
                <IconUsers aria-hidden="true" className="mr-1 inline size-3" />4
                человека
              </span>
              <StatusBadge tone="success">Посещено</StatusBadge>
            </span>
          </TimelineRow>
          <TimelineRow
            href="/programs/registrations/5012"
            icon={IconCalendarEvent}
            meta="06 июл, 14:00–18:30"
            title="Семейная программа · #PR-118"
            tone="violet"
          >
            <span className="inline-flex items-center gap-3">
              <span>
                <IconUsers aria-hidden="true" className="mr-1 inline size-3" />6
                человек
              </span>
              <StatusBadge tone="success">Посещено</StatusBadge>
            </span>
          </TimelineRow>
          <TimelineRow
            href="/bookings/1874"
            icon={IconCalendarEvent}
            meta="12 июн, 10:00–13:00"
            title="Баня и чан · бронь #1874"
            tone="blue"
          >
            <span className="inline-flex items-center gap-3">
              <span>
                <IconUsers aria-hidden="true" className="mr-1 inline size-3" />3
                человека
              </span>
              <StatusBadge tone="neutral">Отменено</StatusBadge>
            </span>
          </TimelineRow>
        </div>
      </EditorSection>
      <PreviewNote />
    </div>
  );
}

export function EditorPreviewPayments({
  paid = 28_000,
  total = 42_000,
}: {
  paid?: number;
  total?: number;
}) {
  const safeTotal = Math.max(total, paid, 1);
  if (!showPreviewFixtures) {
    return (
      <PreviewUnavailable
        description="Платёжные операции для этой сущности пока не подключены. Сводка не подменяется демонстрационными начислениями."
        title="Платежи"
      />
    );
  }
  return (
    <div className="space-y-3">
      <EditorSection title="Финансовая сводка">
        <PaymentProgress className="w-full" paid={paid} total={safeTotal} />
        <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3 text-xs">
          <div>
            <p className="text-[10px] text-muted-foreground">Начислено</p>
            <p className="mt-1 tabular-nums">{money.format(safeTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Оплачено</p>
            <p className="mt-1 tabular-nums">{money.format(paid)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Долг</p>
            <p className="mt-1 tabular-nums">
              {money.format(Math.max(0, safeTotal - paid))}
            </p>
          </div>
        </div>
      </EditorSection>
      <EditorSection title="Платёжные операции">
        <div className="divide-y">
          <TimelineRow
            href="/bookings/2048"
            icon={IconCreditCard}
            meta="Сегодня, 13:42 · Марина Кириллова"
            title={`Оплата ${money.format(Math.min(paid, 14_000))}`}
            tone="green"
          >
            Банковская карта · предоплата по ссылке
          </TimelineRow>
          <TimelineRow
            href="/bookings/2034"
            icon={IconCash}
            meta="20 авг, 16:10 · Алексей Воронов"
            title={`Оплата ${money.format(Math.max(1_000, paid - 14_000))}`}
            tone="green"
          >
            Наличные · касса на площадке
          </TimelineRow>
          <TimelineRow
            href="/bookings/2048"
            icon={IconReceipt}
            meta="18 авг, 11:25 · Система"
            title={`Начисление ${money.format(safeTotal)}`}
          >
            Создано на основании состава заказа.
          </TimelineRow>
        </div>
      </EditorSection>
    </div>
  );
}

export function EditorPreviewOrders({ clientName }: { clientName: string }) {
  if (!showPreviewFixtures) {
    return (
      <PreviewUnavailable
        description={`Связанные заявки и бронирования клиента «${clientName}» появятся после подключения агрегированной выборки.`}
        title="Заявки и бронирования"
      />
    );
  }
  return (
    <EditorSection
      subtitle={`Активные и завершённые процессы клиента «${clientName}».`}
      title="Заявки и бронирования"
    >
      <div className="divide-y rounded-lg border">
        <TimelineRow
          href="/bookings/2048"
          icon={IconCalendarEvent}
          meta="24 авг, 11:00"
          title="Бронь #2048 · Дом «Сосна»"
          tone="blue"
        >
          <span className="inline-flex items-center gap-2">
            <StatusBadge tone="info">Подтверждено</StatusBadge>
            <span>4 человека · {money.format(28_000)}</span>
          </span>
        </TimelineRow>
        <TimelineRow
          href="/leads/1284"
          icon={IconLink}
          meta="След. контакт сегодня, 18:00"
          title="Заявка #1284 · Домик и баня"
          tone="violet"
        >
          <StatusBadge tone="warning">В работе</StatusBadge>
        </TimelineRow>
        <TimelineRow
          href="/bookings/2034"
          icon={IconCalendarEvent}
          meta="18 авг, 12:00"
          title="Бронь #2034 · Дом «Берёза»"
          tone="green"
        >
          <StatusBadge tone="success">Завершено</StatusBadge>
        </TimelineRow>
      </div>
    </EditorSection>
  );
}

export function EditorMarketingAttribution({
  available = showPreviewFixtures,
  idPrefix,
  onChange,
  showIntegrationStatus = showPreviewFixtures,
  value,
}: {
  available?: boolean;
  idPrefix: string;
  onChange: <K extends keyof MarketingAttributionDraft>(
    key: K,
    value: MarketingAttributionDraft[K],
  ) => void;
  showIntegrationStatus?: boolean;
  value: MarketingAttributionDraft;
}) {
  if (!available) {
    return (
      <PreviewUnavailable
        description="Атрибуция для этой сущности пока не подключена к API. Поля не показываются как сохраняемые до появления серверного контракта."
        title="Маркетинг"
      />
    );
  }
  const field = <K extends keyof MarketingAttributionDraft>(
    key: K,
    label: string,
    span = "sm:col-span-2",
  ) => (
    <FormField className={span} htmlFor={`${idPrefix}-${key}`} label={label}>
      <Input
        id={`${idPrefix}-${key}`}
        onChange={(event) => onChange(key, event.target.value)}
        value={value[key]}
      />
    </FormField>
  );
  return (
    <div className="space-y-3">
      <EditorSection
        subtitle="Полный набор атрибуции хранится отдельно от операционного статуса записи."
        title="Источник и канал"
      >
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-3"
            htmlFor={`${idPrefix}-source`}
            label="Источник"
          >
            <FormSelect
              id={`${idPrefix}-source`}
              label="Источник"
              onValueChange={(next) => onChange("source", next)}
              options={[
                { value: "Сайт", label: "Сайт" },
                { value: "Телефон", label: "Телефон" },
                { value: "VK", label: "VK" },
                { value: "MAX", label: "MAX" },
                { value: "Повторное обращение", label: "Повторное обращение" },
                { value: "Рекомендация", label: "Рекомендация" },
                { value: "Офлайн", label: "Офлайн" },
                { value: "Вручную", label: "Вручную" },
                { value: "Другое", label: "Другое" },
              ]}
              value={value.source}
            />
          </FormField>
          <FormField
            className="sm:col-span-3"
            htmlFor={`${idPrefix}-channel`}
            label="Канал"
          >
            <FormSelect
              id={`${idPrefix}-channel`}
              label="Канал создания"
              onValueChange={(next) => onChange("channel", next)}
              options={[
                { value: "site", label: "Сайт" },
                { value: "crm", label: "CRM" },
                { value: "api", label: "API / интеграция" },
              ]}
              value={value.channel}
            />
          </FormField>
        </div>
      </EditorSection>
      <EditorSection title="UTM-метки">
        <div className="grid items-start gap-4 sm:grid-cols-6">
          {field("utmSource", "utm_source")}
          {field("utmMedium", "utm_medium")}
          {field("utmCampaign", "utm_campaign")}
          {field("utmContent", "utm_content", "sm:col-span-3")}
          {field("utmTerm", "utm_term", "sm:col-span-3")}
        </div>
      </EditorSection>
      <EditorSection title="Идентификаторы и интеграции">
        <div className="grid items-start gap-4 sm:grid-cols-6">
          {field("clientId", "client_id", "sm:col-span-3")}
          {field("metricaClientId", "Яндекс Метрика ClientID", "sm:col-span-3")}
          {field("vkLeadId", "VK lead ID", "sm:col-span-3")}
          {field("maxDialogId", "MAX dialog ID", "sm:col-span-3")}
        </div>
        {showIntegrationStatus ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
            <StatusBadge tone="success">Метрика подключена</StatusBadge>
            <StatusBadge tone="info">VK связан</StatusBadge>
            <StatusBadge tone="neutral">MAX не связан</StatusBadge>
          </div>
        ) : null}
      </EditorSection>
    </div>
  );
}
