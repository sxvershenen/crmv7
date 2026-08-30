import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconAlertTriangle,
  IconCalendarEvent,
  IconCategory,
  IconClock,
  IconDotsVertical,
  IconExternalLink,
  IconListCheck,
  IconPlus,
  IconSettings,
  IconUser,
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
  ListSection,
  PageNav,
  PageState,
  Skeleton,
  StatusBadge,
  Textarea,
  type Assignee,
  type EditorSaveState,
} from "@crm/ui";

import { useEditorLayoutChrome } from "@app/app/editor-layout-context";
import { EditorPreviewHistory } from "@app/components/shared/editor-preview-tabs";
import {
  formatDuration,
  formatProgramDateTime,
} from "@app/components/programs/program-format";
import { ProgramIcon } from "@app/components/programs/program-presentation";
import {
  programIconOptions,
  programToneOptions,
} from "@app/components/programs/program-presentation-data";
import { ProgramStageList } from "@app/components/programs/program-stage-list";
import {
  createEmptyProgramTemplate,
  programsRepository,
  type ProgramTemplateEditorRepository,
} from "@app/data/programs-repository";
import { useDirectoryAssignees } from "@app/features/use-directory-data";
import type {
  ProgramCategory,
  ProgramCategoryIcon,
  ProgramCategoryTone,
  ProgramTemplateEditorRecord,
  ProgramTemplateStage,
} from "@app/entities/programs";
import { programRunStatusMeta } from "@app/entities/programs";

const tabs = ["main", "content", "runs", "settings", "history"] as const;
const tabItems = [
  { value: "main", label: "Основное" },
  { value: "content", label: "Сценарий" },
  { value: "runs", label: "Проведения" },
  { value: "settings", label: "Настройки" },
  { value: "history", label: "История" },
];
const publicationOptions = [
  { value: "draft", label: "Черновик" },
  { value: "published", label: "Опубликовано" },
];
function oneOf<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T {
  return value && options.includes(value as T) ? (value as T) : fallback;
}
function numberOrNull(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}
function inputNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function ProgramTemplateEditorPage({
  repository = programsRepository,
}: {
  repository?: ProgramTemplateEditorRepository;
}) {
  const programAssignees = useDirectoryAssignees("program");
  const navigate = useNavigate();
  const { id = "new" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = oneOf(params.get("tab"), tabs, "main");
  const [draft, setDraft] = useState<ProgramTemplateEditorRecord | null>(null);
  const [categories, setCategories] = useState<ProgramCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<EditorSaveState>("saved");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      id === "new"
        ? Promise.resolve(createEmptyProgramTemplate())
        : repository.getTemplate(id),
      repository.listCategories(),
    ])
      .then(([template, nextCategories]) => {
        if (!active) return;
        setCategories(nextCategories);
        if (!template) {
          setError("Шаблон программы не найден");
          setLoading(false);
          return;
        }
        setDraft(template);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить шаблон программы",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [id, repository]);

  const update = useCallback(
    <K extends keyof ProgramTemplateEditorRecord>(
      key: K,
      value: ProgramTemplateEditorRecord[K],
    ) => {
      setDraft((current) => (current ? { ...current, [key]: value } : current));
      setSaveState("dirty");
    },
    [],
  );
  const setPublished = useCallback(
    (published: boolean) => update("published", published),
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
  const updateStage = useCallback(
    <K extends keyof ProgramTemplateStage>(
      stageId: string,
      key: K,
      value: ProgramTemplateStage[K],
    ) => {
      setDraft((current) =>
        current
          ? {
              ...current,
              stages: current.stages.map((stage) =>
                stage.id === stageId ? { ...stage, [key]: value } : stage,
              ),
            }
          : current,
      );
      setSaveState("dirty");
    },
    [],
  );
  const addStage = useCallback(
    (name: string, durationMinutes: number, comment: string) => {
      const text = name.trim();
      if (!text) return;
      const stage: ProgramTemplateStage = {
        comment: comment.trim(),
        durationMinutes,
        id: `stage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: text,
      };
      setDraft((current) =>
        current ? { ...current, stages: [...current.stages, stage] } : current,
      );
      setSaveState("dirty");
    },
    [],
  );
  const duplicateStage = useCallback((stage: ProgramTemplateStage) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            stages: [
              ...current.stages,
              {
                ...stage,
                id: `stage-${Date.now()}-copy`,
                name: `${stage.name} — копия`,
              },
            ],
          }
        : current,
    );
    setSaveState("dirty");
  }, []);
  const deleteStage = useCallback((stageId: string) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            stages: current.stages.filter((stage) => stage.id !== stageId),
          }
        : current,
    );
    setSaveState("dirty");
  }, []);
  const moveStage = useCallback((from: number, to: number) => {
    setDraft((current) => {
      if (
        !current ||
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= current.stages.length ||
        to >= current.stages.length
      )
        return current;
      const stages = [...current.stages];
      const [stage] = stages.splice(from, 1);
      if (!stage) return current;
      stages.splice(to, 0, stage);
      return { ...current, stages };
    });
    setSaveState("dirty");
  }, []);
  const save = async () => {
    if (!draft) return;
    setSaveState("saving");
    try {
      await repository.saveTemplate(draft);
      setSaveState("saved");
    } catch {
      setSaveState("conflict");
    }
  };

  const published = draft?.published;
  const statusControl = useMemo(
    () =>
      published === undefined ? undefined : (
        <FilterSelect
          className="w-28 max-w-28 sm:w-36 sm:max-w-36"
          label="Публикация программы"
          onValueChange={(value) => setPublished(value === "published")}
          options={publicationOptions}
          value={published ? "published" : "draft"}
        />
      ),
    [published, setPublished],
  );
  const title = draft?.name ?? "Программа";
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
      ariaLabel="Разделы редактора программы"
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
  const openCategories = () => navigate("/programs/categories");
  const overflow = draft ? (
    <ProgramOverflow onOpenCategories={openCategories} />
  ) : null;

  return (
    <EditorFrame
      actions={
        draft ? (
          <>
            {statusControl}
            <AssigneePicker
              label="Сменить ответственного программы"
              onPeopleChange={(people) => update("assignees", people)}
              onValueChange={setAssignee}
              options={programAssignees}
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
          <ProgramMobileActions
            onAssigneeChange={setAssignee}
            onOpenCategories={openCategories}
          />
        ) : null
      }
      navigation={navigation}
      saveState={saveState}
      sidebar={
        draft ? (
          <ProgramSidebar
            draft={draft}
            onAssigneeChange={setAssignee}
            onAssigneesChange={(people) => update("assignees", people)}
          />
        ) : (
          <Skeleton className="h-80 rounded-xl" />
        )
      }
    >
      {loading ? <ProgramEditorLoading /> : null}
      {error ? (
        <div className="rounded-xl border bg-background">
          <PageState
            icon={IconAlertTriangle}
            title="Программа не открылась"
            tone="danger"
          >
            {error}
          </PageState>
        </div>
      ) : null}
      {draft && tab === "main" ? (
        <ProgramMain
          categories={categories}
          draft={draft}
          onCategoryChange={setCategory}
          update={update}
        />
      ) : null}
      {draft && tab === "content" ? (
        <ProgramContent
          draft={draft}
          onAdd={addStage}
          onDelete={deleteStage}
          onDuplicate={duplicateStage}
          onMove={moveStage}
          updateStage={updateStage}
        />
      ) : null}
      {draft && tab === "runs" ? <ProgramRuns draft={draft} /> : null}
      {draft && tab === "settings" ? (
        <ProgramSettings draft={draft} onOpenCategories={openCategories} />
      ) : null}
      {draft && tab === "history" ? (
        <EditorPreviewHistory entityLabel="Шаблон программы" />
      ) : null}
    </EditorFrame>
  );
}

function ProgramOverflow({
  onOpenCategories,
}: {
  onOpenCategories: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия программы"
            size="icon-sm"
            variant="ghost"
          />
        }
      >
        <IconDotsVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpenCategories}>
          <IconCategory aria-hidden="true" />
          Категории программ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function ProgramMobileActions({
  onAssigneeChange,
  onOpenCategories,
}: {
  onAssigneeChange: (person: Assignee | null) => void;
  onOpenCategories: () => void;
}) {
  const programAssignees = useDirectoryAssignees("program");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Дополнительные действия программы"
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
        <DropdownMenuItem onClick={onOpenCategories}>
          <IconCategory aria-hidden="true" />
          Категории программ
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProgramMain({
  categories,
  draft,
  onCategoryChange,
  update,
}: {
  categories: ProgramCategory[];
  draft: ProgramTemplateEditorRecord;
  onCategoryChange: (id: string) => void;
  update: <K extends keyof ProgramTemplateEditorRecord>(
    key: K,
    value: ProgramTemplateEditorRecord[K],
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
              {draft.categoryName}
            </p>
          </div>
        </div>
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-2"
            htmlFor="program-icon"
            label="Иконка"
          >
            <FormSelect
              id="program-icon"
              label="Иконка программы"
              onValueChange={(value) =>
                update("categoryIcon", value as ProgramCategoryIcon)
              }
              options={programIconOptions}
              value={draft.categoryIcon}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="program-tone"
            label="Цвет"
          >
            <FormSelect
              id="program-tone"
              label="Цвет программы"
              onValueChange={(value) =>
                update("categoryTone", value as ProgramCategoryTone)
              }
              options={programToneOptions}
              value={draft.categoryTone}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="program-category"
            label="Категория"
          >
            <FormSelect
              id="program-category"
              label="Категория программы"
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
            htmlFor="program-name"
            label="Название"
          >
            <Input
              id="program-name"
              onChange={(event) => update("name", event.target.value)}
              value={draft.name}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="program-description"
            label="Описание"
          >
            <Textarea
              id="program-description"
              onChange={(event) => update("description", event.target.value)}
              placeholder="Что входит в программу и для кого она предназначена"
              value={draft.description}
            />
          </FormField>
        </div>
      </EditorSection>
      <EditorSection title="Параметры участия">
        <div className="grid items-start gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-2"
            htmlFor="program-duration"
            label="Продолжительность, мин"
          >
            <Input
              id="program-duration"
              min="0"
              onChange={(event) =>
                update("durationMinutes", inputNumber(event.target.value))
              }
              type="number"
              value={draft.durationMinutes}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="program-min"
            label="Минимум участников"
          >
            <Input
              id="program-min"
              min="0"
              onChange={(event) =>
                update("minimumParticipants", numberOrNull(event.target.value))
              }
              placeholder="Не задано"
              type="number"
              value={draft.minimumParticipants ?? ""}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="program-max"
            label="Максимум участников"
          >
            <Input
              id="program-max"
              min="0"
              onChange={(event) =>
                update("participantLimit", inputNumber(event.target.value))
              }
              type="number"
              value={draft.participantLimit}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="program-close"
            label="Закрыть регистрацию за, ч"
          >
            <Input
              id="program-close"
              min="0"
              onChange={(event) =>
                update(
                  "registrationCloseHours",
                  numberOrNull(event.target.value),
                )
              }
              placeholder="Не задано"
              type="number"
              value={draft.registrationCloseHours ?? ""}
            />
          </FormField>
          <FormField
            className="sm:col-span-2"
            htmlFor="program-price"
            label="Базовая стоимость"
          >
            <Input
              id="program-price"
              min="0"
              onChange={(event) =>
                update("basePrice", inputNumber(event.target.value))
              }
              type="number"
              value={draft.basePrice}
            />
          </FormField>
        </div>
      </EditorSection>
    </div>
  );
}

function ProgramContent({
  draft,
  onAdd,
  onDelete,
  onDuplicate,
  onMove,
  updateStage,
}: {
  draft: ProgramTemplateEditorRecord;
  onAdd: (name: string, duration: number, comment: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (stage: ProgramTemplateStage) => void;
  onMove: (from: number, to: number) => void;
  updateStage: <K extends keyof ProgramTemplateStage>(
    id: string,
    key: K,
    value: ProgramTemplateStage[K],
  ) => void;
}) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [comment, setComment] = useState("");
  const submit = () => {
    if (!name.trim()) return;
    onAdd(name, inputNumber(duration), comment);
    setName("");
    setDuration("");
    setComment("");
  };
  return (
    <div className="space-y-3">
      <EditorSection title="Быстрое добавление этапа">
        <div className="grid items-end gap-4 sm:grid-cols-6">
          <FormField
            className="sm:col-span-5"
            htmlFor="new-stage-name"
            label="Название этапа"
          >
            <Input
              id="new-stage-name"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </FormField>
          <FormField
            className="sm:col-span-1"
            htmlFor="new-stage-duration"
            label="Длительность, минут"
          >
            <Input
              id="new-stage-duration"
              min="0"
              onChange={(event) => setDuration(event.target.value)}
              type="number"
              value={duration}
            />
          </FormField>
          <FormField
            className="sm:col-span-6"
            htmlFor="new-stage-comment"
            label="Комментарий"
          >
            <Textarea
              id="new-stage-comment"
              onChange={(event) => setComment(event.target.value)}
              placeholder="Необязательно"
              rows={3}
              value={comment}
            />
          </FormField>
          <Button
            className="sm:col-span-2"
            disabled={!name.trim()}
            onClick={submit}
            size="sm"
          >
            <IconPlus aria-hidden="true" />
            Добавить этап
          </Button>
        </div>
      </EditorSection>
      <EditorSection
        subtitle="Перетаскивайте этапы за ручку или используйте кнопки вверх и вниз."
        title="Сценарий программы"
      >
        {draft.stages.length ? (
          <ProgramStageList
            onChange={updateStage}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onMove={onMove}
            stages={draft.stages}
          />
        ) : (
          <PageState
            actionLabel="Перейти к добавлению"
            icon={IconListCheck}
            onAction={() => document.getElementById("new-stage-name")?.focus()}
            title="Этапов пока нет"
          >
            Добавьте название, длительность и при необходимости комментарий.
          </PageState>
        )}
      </EditorSection>
    </div>
  );
}

function ProgramRuns({ draft }: { draft: ProgramTemplateEditorRecord }) {
  const navigate = useNavigate();
  return (
    <EditorSection
      actions={
        <Button
          onClick={() => navigate(`/programs/runs/new?template=${draft.id}`)}
          size="sm"
        >
          <IconPlus aria-hidden="true" />
          Новое проведение
        </Button>
      }
      title="Проведения по шаблону"
    >
      {draft.relatedRuns.length ? (
        <div className="divide-y rounded-lg border">
          {draft.relatedRuns.map((run) => (
            <Button
              className="h-auto w-full justify-start rounded-none px-3 py-3 text-left"
              key={run.id}
              onClick={() => navigate(`/programs/runs/${run.id}`)}
              variant="ghost"
            >
              <ProgramIcon icon={run.categoryIcon} tone={run.categoryTone} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{run.name}</p>
                <p className="mt-0.5 text-[10px] font-normal text-muted-foreground">
                  {formatProgramDateTime(run.startsAt)} ·{" "}
                  <IconUser aria-hidden="true" className="inline size-3" />{" "}
                  {run.participantCount}/{run.participantLimit}
                </p>
              </div>
              <StatusBadge tone={programRunStatusMeta[run.status].tone}>
                {programRunStatusMeta[run.status].label}
              </StatusBadge>
            </Button>
          ))}
        </div>
      ) : (
        <PageState
          actionLabel="Создать проведение"
          icon={IconCalendarEvent}
          onAction={() => navigate(`/programs/runs/new?template=${draft.id}`)}
          title="Проведений пока нет"
        >
          Создайте первое проведение на основе этого шаблона.
        </PageState>
      )}
    </EditorSection>
  );
}

function ProgramSettings({
  draft,
  onOpenCategories,
}: {
  draft: ProgramTemplateEditorRecord;
  onOpenCategories: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border bg-background">
        <ListSection
          count={3}
          icon={IconSettings}
          title="Служебные параметры"
          tone="program"
        >
          <ListRow>
            <SummaryRow
              icon={IconSettings}
              label="Версия"
              value={String(draft.version)}
            />
          </ListRow>
          <ListRow>
            <SummaryRow
              icon={IconClock}
              label="Изменено"
              value={formatProgramDateTime(draft.updatedAt)}
            />
          </ListRow>
          <ListRow>
            <SummaryRow
              icon={IconCategory}
              label="Категория"
              value={draft.categoryName}
            />
          </ListRow>
        </ListSection>
      </div>
      <EditorSection
        actions={
          <Button onClick={onOpenCategories} size="sm" variant="outline">
            <IconExternalLink aria-hidden="true" />
            Открыть категории
          </Button>
        }
        title="Категории"
      >
        Иконка и цвет шаблона могут отличаться от текущей категории. Изменение
        справочника выполняется на отдельной странице.
      </EditorSection>
    </div>
  );
}

function ProgramSidebar({
  draft,
  onAssigneeChange,
  onAssigneesChange,
}: {
  draft: ProgramTemplateEditorRecord;
  onAssigneeChange: (person: Assignee | null) => void;
  onAssigneesChange: (people: Assignee[]) => void;
}) {
  const programAssignees = useDirectoryAssignees("program");
  const stagesDuration = draft.stages.reduce(
    (sum, stage) => sum + stage.durationMinutes,
    0,
  );
  return (
    <div className="overflow-hidden rounded-xl border bg-background">
      <ListSection
        count={6}
        icon={IconListCheck}
        title="Операционная сводка"
        tone="program"
      >
        <ListRow>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-xs text-muted-foreground">Ответственный</span>
            <AssigneePicker
              label="Сменить ответственного программы в сводке"
              onPeopleChange={onAssigneesChange}
              onValueChange={onAssigneeChange}
              options={programAssignees}
              people={draft.assignees}
            />
          </div>
        </ListRow>
        <ListRow>
          <SummaryRow
            icon={IconCategory}
            label="Категория"
            value={draft.categoryName}
          />
        </ListRow>
        <ListRow>
          <SummaryRow
            icon={IconClock}
            label="Длительность"
            value={formatDuration(draft.durationMinutes)}
          />
        </ListRow>
        <ListRow>
          <SummaryRow
            icon={IconUser}
            label="Максимум"
            value={String(draft.participantLimit)}
          />
        </ListRow>
        <ListRow>
          <SummaryRow
            icon={IconListCheck}
            label="Этапы"
            value={
              draft.stages.length
                ? `${draft.stages.length} · ${stagesDuration} мин`
                : "Нет"
            }
          />
        </ListRow>
        <ListRow>
          <SummaryRow
            icon={IconCalendarEvent}
            label="Следующее проведение"
            value={
              draft.nextRun
                ? formatProgramDateTime(draft.nextRun.startsAt)
                : "Не назначено"
            }
          />
        </ListRow>
      </ListSection>
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
function ProgramEditorLoading() {
  return (
    <div
      aria-label="Загрузка редактора программы"
      className="space-y-3"
      role="status"
    >
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
