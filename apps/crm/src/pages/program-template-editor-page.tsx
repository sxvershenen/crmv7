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
  type ProgramOfferingResolution,
  type ProgramPriceBookDraftInput,
} from "@app/data/programs-repository";
import { ApiClientError } from "@app/lib/api-client";
import { useDirectoryAssignees } from "@app/features/use-directory-data";
import type {
  ProgramCategory,
  ProgramCategoryIcon,
  ProgramCategoryTone,
  ProgramTemplateEditorRecord,
  ProgramTemplateStage,
} from "@app/entities/programs";
import { programRunStatusMeta } from "@app/entities/programs";
import type { ProgramOfferingQuoteResult, RatePlan, RatePlanDraft } from "@crm/contracts";

const tabs = ["main", "content", "commercial", "runs", "settings", "history"] as const;
const tabItems = [
  { value: "main", label: "Основное" },
  { value: "content", label: "Сценарий" },
  { value: "commercial", label: "Продажи и цены" },
  { value: "runs", label: "Проведения" },
  { value: "settings", label: "Настройки" },
  { value: "history", label: "История" },
];
const publicationOptions = [
  { value: "draft", label: "Черновик" },
  { value: "published", label: "Опубликовано" },
];
const adminAppBaseUrl = (import.meta.env.VITE_ADMIN_APP_URL ?? (import.meta.env.DEV ? "http://localhost:5174" : "/cms")).replace(/\/$/, "");
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
  const [offering, setOffering] = useState<ProgramOfferingResolution | null>(null);
  const [offeringLoading, setOfferingLoading] = useState(id !== "new");
  const [commercialBusy, setCommercialBusy] = useState<string | null>(null);
  const [commercialError, setCommercialError] = useState<string | null>(null);
  const [quote, setQuote] = useState<ProgramOfferingQuoteResult | null>(null);

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
        if (id === "new") {
          setOffering({ resolution: "unprepared" });
          setOfferingLoading(false);
          return;
        }
        setOfferingLoading(true);
        void repository.resolveProgramOffering(template.id).then((next) => {
          if (active) setOffering(next);
        }).catch((reason: unknown) => {
          if (active) setCommercialError(errorMessage(reason, "Не удалось загрузить коммерческое предложение"));
        }).finally(() => {
          if (active) setOfferingLoading(false);
        });
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
      const saved = await repository.saveTemplate(draft);
      setDraft(saved);
      setSaveState("saved");
    } catch {
      setSaveState("conflict");
    }
  };

  const prepared = offering?.resolution === "linked";
  const published = draft?.published;
  const statusControl = useMemo(
    () =>
      published === undefined || prepared || draft?.capabilities?.canChangeStatus === false || draft?.capabilities?.canEdit === false ? undefined : (
        <FilterSelect
          className="w-28 max-w-28 sm:w-36 sm:max-w-36"
          label="Публикация программы"
          onValueChange={(value) => setPublished(value === "published")}
          options={publicationOptions}
          value={published ? "published" : "draft"}
        />
      ),
    [draft?.capabilities?.canChangeStatus, draft?.capabilities?.canEdit, prepared, published, setPublished],
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
  const refreshOffering = useCallback(async () => {
    if (!draft || draft.id === "new") return;
    setOffering(await repository.resolveProgramOffering(draft.id));
  }, [draft, repository]);
  const commercialAction = useCallback(async (name: string, action: () => Promise<void>) => {
    setCommercialBusy(name);
    setCommercialError(null);
    try {
      await action();
    } catch (reason) {
      setCommercialError(errorMessage(reason, "Коммерческая операция не выполнена"));
    } finally {
      setCommercialBusy(null);
    }
  }, []);

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
            disabled={!draft || saveState === "saving" || draft.capabilities?.canEdit === false}
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
          commercialPrepared={prepared}
          disabled={draft.capabilities?.canEdit === false}
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
      {draft && tab === "commercial" ? (
        <ProgramCommercial
          busy={commercialBusy}
          draft={draft}
          error={commercialError}
          offering={offering}
          offeringLoading={offeringLoading}
          onActivate={(offeringId, priceBookId, expectedPricingVersion) => commercialAction("activate", async () => {
            await repository.activateProgramPriceBook(offeringId, priceBookId, expectedPricingVersion);
            await refreshOffering();
            setQuote(null);
          })}
          onInvalidateQuote={() => setQuote(null)}
          onPrepare={() => commercialAction("prepare", async () => {
            await repository.prepareProgramOffering(draft.id, draft.version);
            await refreshOffering();
          })}
          onPreview={(input) => commercialAction("preview", async () => {
            setQuote(null);
            setQuote(await repository.previewProgramQuote(draft.id, input));
          })}
          onSavePrice={(offeringId, priceBookId, expectedPricingVersion, input) => commercialAction("price", async () => {
            if (priceBookId) await repository.replaceProgramPriceBook(offeringId, priceBookId, expectedPricingVersion, input);
            else await repository.createProgramPriceBook(offeringId, expectedPricingVersion, input);
            await refreshOffering();
            setQuote(null);
          })}
          quote={quote}
        />
      ) : null}
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
  commercialPrepared,
  disabled,
  draft,
  onCategoryChange,
  update,
}: {
  categories: ProgramCategory[];
  commercialPrepared: boolean;
  disabled: boolean;
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
          {!commercialPrepared ? (
            <FormField
              className="sm:col-span-2"
              htmlFor="program-price"
              label="Legacy стоимость"
            >
              <Input
                disabled={disabled}
                id="program-price"
                min="0"
                onChange={(event) =>
                  update("basePrice", inputNumber(event.target.value))
                }
                type="number"
                value={draft.basePrice}
              />
            </FormField>
          ) : (
            <div className="sm:col-span-4 rounded-lg border bg-muted/25 p-3 text-xs text-muted-foreground">
              Цена управляется на вкладке «Продажи и цены». Legacy стоимость сохранена только для совместимости и больше не редактируется.
            </div>
          )}
        </div>
      </EditorSection>
    </div>
  );
}

function ProgramCommercial({
  busy,
  draft,
  error,
  offering,
  offeringLoading,
  onActivate,
  onInvalidateQuote,
  onPrepare,
  onPreview,
  onSavePrice,
  quote,
}: {
  busy: string | null;
  draft: ProgramTemplateEditorRecord;
  error: string | null;
  offering: ProgramOfferingResolution | null;
  offeringLoading: boolean;
  onActivate: (offeringId: string, priceBookId: string, expectedPricingVersion: number) => Promise<void>;
  onInvalidateQuote: () => void;
  onPrepare: () => Promise<void>;
  onPreview: (input: { serviceDate: string; participants: number; ratePlanKey: string | null }) => Promise<void>;
  onSavePrice: (offeringId: string, priceBookId: string | null, expectedPricingVersion: number, input: ProgramPriceBookDraftInput) => Promise<void>;
  quote: ProgramOfferingQuoteResult | null;
}) {
  if (offeringLoading) return <ProgramEditorLoading />;
  if (offering?.resolution === "ambiguous") {
    return (
      <EditorSection title="Коммерческое предложение">
        <PageState icon={IconAlertTriangle} title="Нужна ручная сверка" tone="danger">
          Для шаблона найдено несколько предложений. Цены и CMS-страница заблокированы, пока связь не станет однозначной.
        </PageState>
      </EditorSection>
    );
  }
  if (!offering) {
    return (
      <EditorSection title="Коммерческое предложение">
        <PageState icon={IconAlertTriangle} title="Состояние предложения не подтверждено" tone="danger">
          {error ?? "Повторите загрузку страницы. Подготовка и цены недоступны, пока сервер не подтвердит текущее состояние."}
        </PageState>
      </EditorSection>
    );
  }
  if (offering.resolution === "unprepared") {
    return (
      <EditorSection
        subtitle="Будут созданы одно program offering, точная связь с шаблоном и канонический CMS-черновик. Legacy стоимость не активируется автоматически."
        title="Коммерческое предложение"
      >
        {error ? <CommercialError message={error} /> : null}
        <Button disabled={busy !== null || draft.id === "new" || draft.capabilities?.canCreate === false || draft.capabilities?.canEdit === false} onClick={() => void onPrepare()} size="sm">
          {busy === "prepare" ? "Подготавливаем…" : "Подготовить продажи и CMS-страницу"}
        </Button>
        {draft.id === "new" ? <p className="mt-2 text-xs text-muted-foreground">Сначала сохраните новый шаблон.</p> : null}
      </EditorSection>
    );
  }

  const { editor } = offering;
  return (
    <div className="space-y-3">
      {error ? <CommercialError message={error} /> : null}
      <ProgramOfferingReadiness cmsReady={offering.cmsReady} editor={editor} publicReady={offering.publicReady} />
      <ProgramPriceBookEditor busy={busy} draft={draft} editor={editor} onActivate={onActivate} onSave={onSavePrice} />
      <ProgramQuotePreview busy={busy} draft={draft} editor={editor} onInvalidateQuote={onInvalidateQuote} onPreview={onPreview} quote={quote} />
      <EditorSection
        subtitle="Подключённые дополнения видны как readiness-сигнал. Template preview v1 пока рассчитывается без дополнений."
        title="Дополнения"
      >
        {editor.addOnAssignments.length ? (
          <div className="divide-y rounded-lg border">
            {editor.addOnAssignments.map((assignment) => {
              const item = editor.addOnCatalog.find((candidate) => candidate.offering.id === assignment.addOnOfferingId);
              return (
                <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-2 text-xs" key={assignment.id}>
                  <span className="truncate">{assignment.labelOverride ?? item?.offering.operationalName ?? "Дополнение"}</span>
                  <StatusBadge tone={assignment.enabled && item?.availability.status === "available" ? "success" : "warning"}>
                    {assignment.enabled && item?.availability.status === "available" ? "Доступно" : "Не готово"}
                  </StatusBadge>
                </div>
              );
            })}
          </div>
        ) : <p className="text-xs text-muted-foreground">Дополнения не подключены.</p>}
      </EditorSection>
    </div>
  );
}

function CommercialError({ message }: { message: string }) {
  return <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">{message}</div>;
}

function ProgramOfferingReadiness({ cmsReady, editor, publicReady }: { cmsReady: boolean; editor: Extract<ProgramOfferingResolution, { resolution: "linked" }>["editor"]; publicReady: false }) {
  const editorial = editor.editorial;
  const cmsHref = editorial ? `${adminAppBaseUrl}/content/tree?selected=${encodeURIComponent(editorial.node.id)}` : null;
  return (
    <EditorSection title="Готовность">
      <div className="grid gap-3 sm:grid-cols-3">
        <ReadinessItem label="Продажи" ready={editor.offering.state === "active" && Boolean(editor.offering.activePriceBookId)} readyText="Активны" waitText="Нужен активный тариф" />
        <ReadinessItem label="CMS-черновик" ready={cmsReady && Boolean(editorial)} readyText="Готов" waitText="Нужна сверка" />
        <ReadinessItem label="Публичный сайт" ready={publicReady} readyText="Готов" waitText="Закрыт до public gate" />
      </div>
      {editorial ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="font-medium">{editorial.currentRevision?.title ?? "Страница программы"}</p>
            <p className="truncate text-muted-foreground">{editorial.currentRevision?.path ?? "Черновик без маршрута"}</p>
          </div>
          {cmsHref ? <Button nativeButton={false} render={<a href={cmsHref} rel="noreferrer" target="_blank" />} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Открыть в CMS</Button> : null}
        </div>
      ) : null}
    </EditorSection>
  );
}

function ReadinessItem({ label, ready, readyText, waitText }: { label: string; ready: boolean; readyText: string; waitText: string }) {
  return <div className="min-w-0 rounded-lg border bg-muted/20 p-3"><p className="text-[11px] text-muted-foreground">{label}</p><StatusBadge className="mt-2 max-w-full" tone={ready ? "success" : "warning"}>{ready ? readyText : waitText}</StatusBadge></div>;
}

function ProgramPriceBookEditor({ busy, draft, editor, onActivate, onSave }: {
  busy: string | null;
  draft: ProgramTemplateEditorRecord;
  editor: Extract<ProgramOfferingResolution, { resolution: "linked" }>["editor"];
  onActivate: (offeringId: string, priceBookId: string, expectedPricingVersion: number) => Promise<void>;
  onSave: (offeringId: string, priceBookId: string | null, expectedPricingVersion: number, input: ProgramPriceBookDraftInput) => Promise<void>;
}) {
  const priceBook = editor.priceBooks.find((item) => item.state === "draft") ?? null;
  const activeBook = editor.priceBooks.find((item) => item.id === editor.offering.activePriceBookId) ?? null;
  const sourceBook = priceBook ?? activeBook;
  const sourcePlan = sourceBook?.ratePlans.find((item) => item.isDefault) ?? sourceBook?.ratePlans[0] ?? null;
  const [basis, setBasis] = useState<"per_person" | "flat_package">(sourcePlan?.pricingBasis === "flat_package" ? "flat_package" : "per_person");
  const [amount, setAmount] = useState(String((sourcePlan?.baseAmount ?? Math.round(draft.basePrice * 100)) / 100));
  const [included, setIncluded] = useState(sourcePlan?.includedQuantity === null || sourcePlan?.includedQuantity === undefined ? "" : String(sourcePlan.includedQuantity));
  const [extra, setExtra] = useState(sourcePlan?.baseExtraUnitAmount === null || sourcePlan?.baseExtraUnitAmount === undefined ? "" : String(sourcePlan.baseExtraUnitAmount / 100));
  const [validFrom, setValidFrom] = useState(priceBook?.validFrom ?? activeBook?.validFrom ?? localDate(new Date()));
  const writable = editor.capabilities.pricing.canEditDraft;
  const activateAllowed = editor.capabilities.pricing.canActivate;
  const packagePairValid = basis === "per_person" || (included === "" && extra === "") || (Number(included) > 0 && Number(extra) >= 0);
  const amountMinor = Math.round(Number(amount) * 100);
  const canSave = writable && busy === null && Number.isFinite(amountMinor) && amountMinor >= 0 && Boolean(validFrom) && packagePairValid;

  useEffect(() => {
    setBasis(sourcePlan?.pricingBasis === "flat_package" ? "flat_package" : "per_person");
    setAmount(String((sourcePlan?.baseAmount ?? Math.round(draft.basePrice * 100)) / 100));
    setIncluded(sourcePlan?.includedQuantity === null || sourcePlan?.includedQuantity === undefined ? "" : String(sourcePlan.includedQuantity));
    setExtra(sourcePlan?.baseExtraUnitAmount === null || sourcePlan?.baseExtraUnitAmount === undefined ? "" : String(sourcePlan.baseExtraUnitAmount / 100));
    setValidFrom(priceBook?.validFrom ?? activeBook?.validFrom ?? localDate(new Date()));
  }, [activeBook, draft.basePrice, priceBook, sourcePlan]);

  const submit = () => {
    const packageTerms = basis === "flat_package" && included !== "" && extra !== "";
    const plan = {
      ...(priceBook?.ratePlans[0]?.id ? { id: priceBook.ratePlans[0].id } : {}),
      key: sourcePlan?.key ?? "standard",
      label: sourcePlan?.label ?? "Основной тариф",
      pricingBasis: basis,
      quantityMetric: "participants" as const,
      baseAmount: amountMinor,
      includedQuantity: packageTerms ? Number(included) : null,
      baseExtraUnitAmount: packageTerms ? Math.round(Number(extra) * 100) : null,
      minQuantity: draft.minimumParticipants && draft.minimumParticipants > 0 ? draft.minimumParticipants : null,
      maxQuantity: draft.participantLimit,
      minDurationMinutes: draft.durationMinutes,
      maxDurationMinutes: draft.durationMinutes,
      isDefault: true,
      displayOrder: 0,
      rules: sourcePlan?.rules.map((rule) => toProgramPriceRuleDraft(rule, Boolean(priceBook))) ?? [],
    };
    const ratePlans = sourceBook
      ? sourceBook.ratePlans.map((candidate) => candidate.id === sourcePlan?.id ? plan : toProgramRatePlanDraft(candidate, Boolean(priceBook)))
      : [plan];
    void onSave(editor.offering.id, priceBook?.id ?? null, editor.ownerVersions.pricing, {
      supersedesPriceBookId: priceBook?.supersedesPriceBookId ?? activeBook?.id ?? null,
      name: priceBook?.name ?? `${draft.name} — тариф`, validFrom, validToExclusive: priceBook?.validToExclusive ?? null,
      changeReason: priceBook?.changeReason || "Настройка тарифа программы", ratePlans,
    });
  };

  return (
    <EditorSection
      actions={priceBook ? <StatusBadge tone="warning">Черновик</StatusBadge> : activeBook ? <StatusBadge tone="success">Тариф активен</StatusBadge> : null}
      subtitle="Суммы показывает сервер. Для пакетной цены количество включённых участников и доплата задаются только вместе."
      title="Тариф"
    >
      <div className="grid items-start gap-4 sm:grid-cols-6">
        <FormField className="sm:col-span-2" htmlFor="program-pricing-basis" label="Способ расчёта"><FormSelect disabled={!writable} id="program-pricing-basis" label="Способ расчёта программы" onValueChange={(value) => setBasis(value as "per_person" | "flat_package")} options={[{ value: "per_person", label: "За участника" }, { value: "flat_package", label: "Пакет" }]} value={basis} /></FormField>
        <FormField className="sm:col-span-2" htmlFor="program-pricing-amount" label={basis === "per_person" ? "Цена за участника, ₽" : "Цена пакета, ₽"}><Input disabled={!writable} id="program-pricing-amount" min="0" onChange={(event) => setAmount(event.target.value)} step="0.01" type="number" value={amount} /></FormField>
        <FormField className="sm:col-span-2" htmlFor="program-pricing-valid" label="Действует с"><Input disabled={!writable} id="program-pricing-valid" onChange={(event) => setValidFrom(event.target.value)} type="date" value={validFrom} /></FormField>
        {basis === "flat_package" ? <><FormField className="sm:col-span-2" htmlFor="program-pricing-included" label="Участников включено"><Input disabled={!writable} id="program-pricing-included" min="1" onChange={(event) => setIncluded(event.target.value)} placeholder="Без доплаты сверх пакета" type="number" value={included} /></FormField><FormField className="sm:col-span-2" htmlFor="program-pricing-extra" label="Доплата за участника, ₽"><Input disabled={!writable} id="program-pricing-extra" min="0" onChange={(event) => setExtra(event.target.value)} placeholder="Не задана" step="0.01" type="number" value={extra} /></FormField></> : null}
      </div>
      {!packagePairValid ? <p className="mt-2 text-xs text-destructive" role="alert">Укажите вместе включённое количество и доплату.</p> : null}
      {!writable ? <p className="mt-3 text-xs text-muted-foreground">Тариф доступен только для чтения.</p> : (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button disabled={!canSave} onClick={submit} size="sm">{busy === "price" ? "Сохраняем…" : priceBook ? "Сохранить тариф" : "Создать черновик тарифа"}</Button>
          {priceBook ? <Button disabled={!activateAllowed || busy !== null} onClick={() => void onActivate(editor.offering.id, priceBook.id, editor.ownerVersions.pricing)} size="sm" variant="outline">{busy === "activate" ? "Активируем…" : "Активировать тариф"}</Button> : null}
        </div>
      )}
    </EditorSection>
  );
}

function ProgramQuotePreview({ busy, draft, editor, onInvalidateQuote, onPreview, quote }: {
  busy: string | null;
  draft: ProgramTemplateEditorRecord;
  editor: Extract<ProgramOfferingResolution, { resolution: "linked" }>["editor"];
  onInvalidateQuote: () => void;
  onPreview: (input: { serviceDate: string; participants: number; ratePlanKey: string | null }) => Promise<void>;
  quote: ProgramOfferingQuoteResult | null;
}) {
  const [serviceDate, setServiceDate] = useState(localDate(new Date()));
  const [participants, setParticipants] = useState(Math.max(1, draft.minimumParticipants ?? 1));
  const active = editor.priceBooks.find((item) => item.id === editor.offering.activePriceBookId);
  const canPreview = editor.capabilities.canPreviewQuote && Boolean(active) && busy === null;
  return (
    <EditorSection subtitle="Это неизменяемый серверный снимок для проверки тарифа, не цена регистрации и не резерв мест." title="Пробный расчёт">
      <div className="grid items-end gap-4 sm:grid-cols-6">
        <FormField className="sm:col-span-2" htmlFor="program-quote-date" label="Дата программы"><Input id="program-quote-date" onChange={(event) => { setServiceDate(event.target.value); onInvalidateQuote(); }} type="date" value={serviceDate} /></FormField>
        <FormField className="sm:col-span-2" htmlFor="program-quote-participants" label="Участники"><Input id="program-quote-participants" min="1" onChange={(event) => { setParticipants(Math.max(1, Number(event.target.value) || 1)); onInvalidateQuote(); }} type="number" value={participants} /></FormField>
        <Button className="sm:col-span-2" disabled={!canPreview} onClick={() => void onPreview({ serviceDate, participants, ratePlanKey: active?.ratePlans.find((plan) => plan.isDefault)?.key ?? null })} size="sm">{busy === "preview" ? "Рассчитываем…" : "Рассчитать"}</Button>
      </div>
      {!editor.capabilities.canPreviewQuote ? <p className="mt-2 text-xs text-muted-foreground">Расчёт станет доступен после активации тарифа.</p> : null}
      {quote ? <div className="mt-4 rounded-lg border bg-muted/20 p-3" aria-label="Результат пробного расчёта"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{money(quote.total.amountMinor, quote.currency)}</p><StatusBadge tone="warning">Не для подтверждения</StatusBadge></div><p className="mt-1 text-xs text-muted-foreground">{quote.inputs.participants} участн. · до {formatProgramDateTime(quote.validUntil)}</p><div className="mt-2 space-y-1">{quote.lines.map((line, index) => <div className="flex justify-between gap-3 text-xs" key={`${line.kind}-${index}`}><span>{line.label} × {line.quantity}</span><span className="tabular-nums">{money(line.amount.amountMinor, line.amount.currency)}</span></div>)}</div></div> : null}
    </EditorSection>
  );
}

function localDate(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amountMinor / 100);
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason instanceof ApiClientError) return reason.isConflict ? `${reason.message} Обновите данные и повторите действие.` : reason.message;
  return reason instanceof Error ? reason.message : fallback;
}

function toProgramPriceRuleDraft(rule: RatePlan["rules"][number], preserveId: boolean) {
  return {
    ...(preserveId ? { id: rule.id } : {}),
    dateSelector: rule.dateSelector,
    quantityRange: rule.quantityRange,
    bookingLeadDays: rule.bookingLeadDays,
    durationMinutes: rule.durationMinutes,
    amount: rule.amount,
    extraUnitAmount: rule.extraUnitAmount,
    priority: rule.priority,
    reason: rule.reason,
    enabled: rule.enabled,
  };
}

function toProgramRatePlanDraft(plan: RatePlan, preserveIds: boolean): RatePlanDraft {
  return {
    ...(preserveIds ? { id: plan.id } : {}),
    key: plan.key,
    label: plan.label,
    pricingBasis: plan.pricingBasis,
    quantityMetric: plan.quantityMetric,
    baseAmount: plan.baseAmount,
    includedQuantity: plan.includedQuantity,
    baseExtraUnitAmount: plan.baseExtraUnitAmount,
    minQuantity: plan.minQuantity,
    maxQuantity: plan.maxQuantity,
    minDurationMinutes: plan.minDurationMinutes,
    maxDurationMinutes: plan.maxDurationMinutes,
    isDefault: plan.isDefault,
    displayOrder: plan.displayOrder,
    rules: plan.rules.map((rule) => toProgramPriceRuleDraft(rule, preserveIds)),
  };
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
