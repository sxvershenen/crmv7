import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  IconAlertTriangle,
  IconArchive,
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconDotsVertical,
  IconExternalLink,
  IconLink,
  IconMessageCircle,
  IconUsers,
} from "@tabler/icons-react";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type FieldPath,
  type FieldPathValue,
} from "react-hook-form";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type Assignee,
  type EditorSaveState,
} from "@crm/ui";

import { useEditorLayoutChrome } from "@app/app/editor-layout-context";
import { EditorPreviewHistory } from "@app/components/shared/editor-preview-tabs";
import { applyTaskFormValues, formatTaskDue, taskFormSchema, toLocalDateTimeInput, toTaskFormValues, type TaskFormValues } from "@app/components/tasks/task-editor-form";
import {
  taskRepository,
  type TaskEditorRepository,
} from "@app/data/tasks-repository";
import { useDirectoryAssignees } from "@app/features/use-directory-data";
import type { TaskEditorRecord, TaskStatus } from "@app/entities/tasks";
import {
  taskPriorityMeta,
  taskPriorities,
  taskRelationLabels,
  taskRelationTypes,
  taskStatusMeta,
  taskStatuses,
} from "@app/entities/tasks";

const tabs = ["main", "relations", "history"] as const;

const tabItems = [
  { value: "main", label: "Основное" },
  { value: "relations", label: "Связи" },
  { value: "history", label: "История" },
];
const statusOptions = taskStatuses.map((value) => ({
  value,
  label: taskStatusMeta[value].label,
}));
const priorityOptions = taskPriorities.map((value) => ({
  value,
  label: taskPriorityMeta[value].label,
}));
const relationTypeOptions = taskRelationTypes.map((value) => ({
  value,
  label: taskRelationLabels[value],
}));
const emptyTask: TaskEditorRecord = {
  id: "new",
  title: "Новая задача",
  details: "",
  status: "todo",
  priority: "normal",
  dueAt: null,
  dueLabel: "Без срока",
  createdAt: new Date().toISOString(),
  relation: { type: "internal", label: "Без связи", href: "/tasks" },
  assignees: [],
  commentCount: 0,
  latestComment: null,
  blocked: false,
  archived: false,
  reminderMinutes: "",
};

function oneOf<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T {
  return value && options.includes(value as T) ? (value as T) : fallback;
}

export function TaskEditorPage({
  repository = taskRepository,
}: {
  repository?: TaskEditorRepository;
}) {
  const taskAssignees = useDirectoryAssignees("task");
  const navigate = useNavigate();
  const { id = "new" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = oneOf(params.get("tab"), tabs, "main");
  const [record, setRecord] = useState<TaskEditorRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");
  const { control, formState: { errors, isDirty }, handleSubmit, reset, setValue, watch } = useForm<TaskFormValues>({
    defaultValues: toTaskFormValues(emptyTask),
    resolver: zodResolver(taskFormSchema),
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    if (id === "new") {
      const task = structuredClone(emptyTask);
      setRecord(task);
      reset(toTaskFormValues(task));
      setSaveState("saved");
      setLoading(false);
      return () => {
        active = false;
      };
    }
    repository
      .get(id)
      .then((task) => {
        if (!active) return;
        if (!task) {
          setError("Задача не найдена");
          setLoading(false);
          return;
        }
        setRecord(task);
        reset(toTaskFormValues(task));
        setSaveState("saved");
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить задачу",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, repository, reset]);

  const update = useCallback(
    <K extends FieldPath<TaskFormValues>>(
      key: K,
      value: FieldPathValue<TaskFormValues, K>,
    ) => {
      setValue(key, value, { shouldDirty: true, shouldTouch: true });
      setSaveState((current) => current === "conflict" ? "saved" : current);
    },
    [setValue],
  );
  const markInteraction = useCallback(() => {
    setSaveState((current) => current === "conflict" ? "saved" : current);
  }, []);
  const setStatus = useCallback(
    (status: TaskStatus) => update("status", status),
    [update],
  );
  const setAssignee = useCallback(
    (person: Assignee | null) => update("assignees", person ? [person] : []),
    [update],
  );
  const values = watch();
  const task = record ? applyTaskFormValues(record, values) : null;
  const moveToTomorrow = useCallback(() => {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    if (values.dueAt) {
      const due = new Date(values.dueAt);
      next.setHours(due.getHours(), due.getMinutes(), 0, 0);
    } else next.setHours(10, 0, 0, 0);
    update("dueAt", toLocalDateTimeInput(next.toISOString()));
  }, [update, values.dueAt]);
  const save = handleSubmit(async (nextValues) => {
    if (!record) return;
    setSaveState("saving");
    try {
      const saved = await repository.save(applyTaskFormValues(record, nextValues));
      setRecord(saved);
      reset(toTaskFormValues(saved));
      setSaveState("saved");
    } catch {
      setSaveState("conflict");
    }
  });
  const visibleSaveState: EditorSaveState = saveState === "saving" || saveState === "conflict" ? saveState : isDirty ? "dirty" : "saved";

  const draftStatus = task?.status;
  const statusControl = useMemo(
    () =>
      draftStatus ? (
        <FilterSelect
          className="w-20 max-w-20 sm:w-36 sm:max-w-36"
          label="Статус задачи"
          onValueChange={(value) => setStatus(value as TaskStatus)}
          options={statusOptions}
          value={draftStatus}
        />
      ) : undefined,
    [draftStatus, setStatus],
  );
  const title = task?.title.trim() || "Задача";
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
      ariaLabel="Разделы редактора задачи"
      items={tabItems}
      onValueChange={(value) =>
        setParams(value === "main" ? {} : { tab: value })
      }
      value={tab}
    />
  );
  const desktopActions = task ? (
    <>
      {statusControl}
      <QuickIconAction
        disabled={task.status === "done"}
        icon={IconCheck}
        label="Завершить задачу"
        onClick={() => setStatus("done")}
      />
      <QuickIconAction
        icon={IconCalendarEvent}
        label="Перенести задачу на завтра"
        onClick={moveToTomorrow}
      />
      <AssigneePicker
        label="Сменить исполнителя задачи"
        onPeopleChange={(people) => update("assignees", people)}
        onValueChange={setAssignee}
        options={taskAssignees}
        people={task.assignees}
      />
      <TaskOverflowActions
        archived={task.archived}
        onArchive={() => update("archived", true)}
      />
    </>
  ) : null;
  const mobileActions = task ? (
    <TaskMobileActions
      archived={task.archived}
      done={task.status === "done"}
      onArchive={() => update("archived", true)}
      onAssigneeChange={setAssignee}
      onComplete={() => setStatus("done")}
      onTomorrow={moveToTomorrow}
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
            disabled={!task || visibleSaveState === "saving"}
            onClick={() => void save()}
            size="sm"
          >
            Сохранить
          </Button>
        </>
      }
      mobileActions={mobileActions}
      navigation={navigation}
      saveState={visibleSaveState}
      sidebar={
        task ? (
          <TaskSidebar
            task={task}
            onAssigneeChange={setAssignee}
            onAssigneesChange={(people) => update("assignees", people)}
          />
        ) : (
          <Skeleton className="h-72 rounded-xl" />
        )
      }
    >
      {loading ? <TaskEditorLoading /> : null}
      {error ? (
        <div className="rounded-xl border bg-background">
          <PageState
            icon={IconAlertTriangle}
            title="Задача не открылась"
            tone="danger"
          >
            {error}
          </PageState>
        </div>
      ) : null}
      {task && tab === "main" ? (
        <TaskMain
          control={control}
          errors={errors}
          onInteraction={markInteraction}
        />
      ) : null}
      {task && tab === "relations" ? (
        <TaskRelations control={control} onInteraction={markInteraction} />
      ) : null}
      {task && tab === "history" ? <TaskHistory /> : null}
    </EditorFrame>
  );
}

function QuickIconAction({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled?: boolean;
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
            disabled={disabled}
            onClick={onClick}
            size="icon-sm"
            variant="outline"
          />
        }
      >
        <Icon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function TaskOverflowActions({
  archived,
  onArchive,
}: {
  archived: boolean;
  onArchive: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия задачи"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {archived ? (
          <DropdownMenuItem disabled>
            <IconArchive aria-hidden="true" />
            Задача в архиве
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onArchive}>
            <IconArchive aria-hidden="true" />В архив
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskMobileActions({
  archived,
  done,
  onArchive,
  onAssigneeChange,
  onComplete,
  onTomorrow,
}: {
  archived: boolean;
  done: boolean;
  onArchive: () => void;
  onAssigneeChange: (person: Assignee | null) => void;
  onComplete: () => void;
  onTomorrow: () => void;
}) {
  const taskAssignees = useDirectoryAssignees("task");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия задачи"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={done} onClick={onComplete}>
          <IconCheck aria-hidden="true" />
          Завершить
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onTomorrow}>
          <IconCalendarEvent aria-hidden="true" />
          На завтра
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {taskAssignees.map((person) => (
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
          Без исполнителя
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={archived} onClick={onArchive}>
          <IconArchive aria-hidden="true" />
          {archived ? "Задача в архиве" : "В архив"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TaskMain({
  control,
  errors,
  onInteraction,
}: {
  control: Control<TaskFormValues>;
  errors: FieldErrors<TaskFormValues>;
  onInteraction: () => void;
}) {
  return (
    <div className="space-y-3">
      <EditorSection title="Основные данные">
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-6"
            error={errors.title?.message}
            htmlFor="task-title"
            label="Название задачи"
          >
            <Controller
              control={control}
              name="title"
              render={({ field }) => (
                <Input
                  {...field}
                  aria-invalid={Boolean(errors.title)}
                  id="task-title"
                  onChange={(event) => {
                    field.onChange(event);
                    onInteraction();
                  }}
                />
              )}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="task-details"
            label="Подробности"
          >
            <Controller
              control={control}
              name="details"
              render={({ field }) => (
                <Textarea
                  {...field}
                  id="task-details"
                  onChange={(event) => {
                    field.onChange(event);
                    onInteraction();
                  }}
                />
              )}
            />
          </FormField>
        </div>
      </EditorSection>
      <EditorSection title="Планирование">
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-3"
            error={errors.dueAt?.message}
            htmlFor="task-due"
            label="Дедлайн"
          >
            <Controller
              control={control}
              name="dueAt"
              render={({ field }) => (
                <DateTimePicker
                  id="task-due"
                  label="Дедлайн задачи"
                  onValueChange={(value) => {
                    field.onChange(value);
                    onInteraction();
                  }}
                  value={field.value}
                />
              )}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="task-priority"
            label="Приоритет"
          >
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <FormSelect
                  id="task-priority"
                  label="Приоритет задачи"
                  onValueChange={(value) => {
                    field.onChange(value);
                    onInteraction();
                  }}
                  options={priorityOptions}
                  value={field.value}
                />
              )}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            error={errors.reminderMinutes?.message}
            htmlFor="task-reminder"
            label="Напомнить за, мин"
          >
            <Controller
              control={control}
              name="reminderMinutes"
              render={({ field }) => (
                <Input
                  {...field}
                  aria-invalid={Boolean(errors.reminderMinutes)}
                  id="task-reminder"
                  min="0"
                  onChange={(event) => {
                    field.onChange(event);
                    onInteraction();
                  }}
                  placeholder="Не задано"
                  type="number"
                />
              )}
            />
          </FormField>
        </div>
      </EditorSection>
    </div>
  );
}

function TaskSidebar({
  task,
  onAssigneeChange,
  onAssigneesChange,
}: {
  task: TaskEditorRecord;
  onAssigneeChange: (person: Assignee | null) => void;
  onAssigneesChange: (people: Assignee[]) => void;
}) {
  const navigate = useNavigate();
  const taskAssignees = useDirectoryAssignees("task");
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <ListSection
        count={4}
        icon={IconClock}
        title="Операционная сводка"
        tone="task"
      >
        <ListRow>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-xs text-muted-foreground">Исполнитель</span>
            <AssigneePicker
              label="Сменить исполнителя задачи в сводке"
              onPeopleChange={onAssigneesChange}
              onValueChange={onAssigneeChange}
              options={taskAssignees}
              people={task.assignees}
            />
          </div>
        </ListRow>
        <ListRow>
          <div className="flex items-center gap-2 px-4 py-3 text-xs">
            <IconLink
              aria-hidden="true"
              className="size-3.5 shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate" title={task.relation.label}>
              {task.relation.label}
            </span>
            <Button
              aria-label="Открыть связанную запись"
              disabled={!task.relation.href}
              onClick={() => navigate(task.relation.href)}
              size="icon-sm"
              variant="ghost"
            >
              <IconExternalLink aria-hidden="true" />
            </Button>
          </div>
        </ListRow>
        <ListRow>
          <SummaryRow
            icon={IconMessageCircle}
            label="Комментарии"
            value={String(task.commentCount)}
          />
        </ListRow>
        <ListRow>
          <SummaryRow
            icon={IconClock}
            label="Создана"
            value={formatTaskDue(task.createdAt)}
          />
        </ListRow>
      </ListSection>
    </div>
  );
}

function TaskRelations({
  control,
  onInteraction,
}: {
  control: Control<TaskFormValues>;
  onInteraction: () => void;
}) {
  const navigate = useNavigate();
  const relationHref = useWatch({ control, name: "relationHref" });

  return (
    <EditorSection title="Связанная запись">
      <div className="grid items-start gap-4 sm:grid-cols-6">
        <FormField
          className="sm:col-span-2"
          htmlFor="task-relation-type"
          label="Тип связи"
        >
          <Controller
            control={control}
            name="relationType"
            render={({ field }) => (
              <FormSelect
                id="task-relation-type"
                label="Тип связи"
                onValueChange={(value) => {
                  field.onChange(value);
                  onInteraction();
                }}
                options={relationTypeOptions}
                value={field.value}
              />
            )}
          />
        </FormField>
        <FormField
          className="sm:col-span-4"
          htmlFor="task-relation-label"
          label="Название или номер"
        >
          <Controller
            control={control}
            name="relationLabel"
            render={({ field }) => (
              <Input
                {...field}
                aria-label="Название связанной записи"
                id="task-relation-label"
                onChange={(event) => {
                  field.onChange(event);
                  onInteraction();
                }}
                placeholder="Например, бронь #2051"
              />
            )}
          />
        </FormField>
        <FormField
          className="sm:col-span-6"
          htmlFor="task-relation-href"
          label="Адрес в CRM"
        >
          <div className="flex gap-2">
            <Controller
              control={control}
              name="relationHref"
              render={({ field }) => (
                <Input
                  {...field}
                  id="task-relation-href"
                  onChange={(event) => {
                    field.onChange(event);
                    onInteraction();
                  }}
                  placeholder="/bookings/2051"
                />
              )}
            />
            <Button
              aria-label="Открыть связанную запись"
              disabled={!relationHref}
              onClick={() => navigate(relationHref)}
              size="icon"
              variant="outline"
            >
              <IconExternalLink aria-hidden="true" />
            </Button>
          </div>
        </FormField>
      </div>
    </EditorSection>
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
      <span className="max-w-44 truncate text-right" title={value}>
        {value}
      </span>
    </div>
  );
}

function TaskHistory() {
  return <EditorPreviewHistory entityLabel="Задача" />;
}
function TaskEditorLoading() {
  return (
    <div
      aria-label="Загрузка редактора задачи"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-44 rounded-xl" />
    </div>
  );
}
