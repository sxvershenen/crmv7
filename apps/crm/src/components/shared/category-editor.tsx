import { useEffect, useMemo, useState, type ReactNode } from "react"
import { IconAlertTriangle, IconCategory, IconDotsVertical, IconExternalLink, IconLink } from "@tabler/icons-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, type Control, type FieldErrors } from "react-hook-form"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EditorFrame, EditorSection, FormField, FormSelect, Input, ListRow, ListSection, PageNav, PageState, Skeleton, Textarea, type EditorSaveState } from "@crm/ui"
import { useEditorLayoutChrome } from "@app/app/editor-layout-context"
import { applyCategoryFormValues, createCategoryFormSchema, toCategoryFormValues, type CategoryFormValues } from "@app/components/shared/category-editor-form"

type BaseCategory = { id: string; name: string; description: string; icon: string; tone: string }
type Option = { value: string; label: string }
type RelatedItem = { href: string; id: string; label: string; secondary: string }

export type CategoryEditorRepository<T extends BaseCategory> = {
  getCategory(id: string): Promise<T | null>
  saveCategory(category: T): Promise<T>
}

export function CategoryEditor<T extends BaseCategory>({ createEmpty, entityLabel, iconOptions, listPath, relatedItems, relatedLabel, renderIcon, repository, tone, toneOptions, usageCount, usageLabel }: {
  createEmpty: () => T
  entityLabel: string
  iconOptions: Option[]
  listPath: string
  relatedItems: (category: T) => RelatedItem[]
  relatedLabel: string
  renderIcon: (category: T, size?: "sm" | "md") => ReactNode
  repository: CategoryEditorRepository<T>
  tone: "program" | "event"
  toneOptions: Option[]
  usageCount: (category: T) => number
  usageLabel: string
}) {
  const navigate = useNavigate(); const { id = "new" } = useParams(); const [params, setParams] = useSearchParams()
  const tab = params.get("tab") === "related" ? "related" : "main"
  const [draft, setDraft] = useState<T | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [saveState, setSaveState] = useState<EditorSaveState>("saved")
  const schema = useMemo(() => createCategoryFormSchema(iconOptions.map((option) => option.value), toneOptions.map((option) => option.value)), [iconOptions, toneOptions])
  const { control, formState: { errors, isDirty }, handleSubmit, reset, watch } = useForm<CategoryFormValues>({
    defaultValues: { description: "", icon: iconOptions[0]?.value ?? "", name: "", tone: toneOptions[0]?.value ?? "" },
    resolver: zodResolver(schema),
  })

  useEffect(() => { let active = true; setLoading(true); setError(null); const request = id === "new" ? Promise.resolve(createEmpty()) : repository.getCategory(id); request.then((category) => { if (!active) return; if (!category) { setError(`${entityLabel} не найдена`); setLoading(false); return }; setDraft(category); reset(toCategoryFormValues(category)); setSaveState("saved"); setLoading(false) }).catch((reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : `Не удалось загрузить ${entityLabel.toLocaleLowerCase("ru-RU")}`); setLoading(false) } }); return () => { active = false } }, [createEmpty, entityLabel, id, repository, reset])
  const values = watch()
  const category = draft ? applyCategoryFormValues(draft, values) : null
  const markInteraction = () => { if (saveState === "conflict") setSaveState("saved") }
  const save = handleSubmit(async (nextValues) => { if (!draft) return; setSaveState("saving"); try { const saved = await repository.saveCategory(applyCategoryFormValues(draft, nextValues)); setDraft(saved); reset(toCategoryFormValues(saved)); setSaveState("saved") } catch { setSaveState("conflict") } })
  const visibleSaveState: EditorSaveState = saveState === "saving" || saveState === "conflict" ? saveState : isDirty ? "dirty" : "saved"
  useEditorLayoutChrome(useMemo(() => ({ idLabel: `#${id}`, onBack: () => navigate(-1), title: category?.name ?? entityLabel }), [category?.name, entityLabel, id, navigate]))

  const navigation = <PageNav ariaLabel={`Разделы редактора: ${entityLabel}`} items={[{ value: "main", label: "Основное" }, { value: "related", label: relatedLabel }]} onValueChange={(value) => setParams((current) => { const next = new URLSearchParams(current); if (value === "main") next.delete("tab"); else next.set("tab", value); return next })} value={tab} />
  const overflow = <DropdownMenu><DropdownMenuTrigger render={<Button aria-label={`Дополнительные действия: ${entityLabel}`} size="icon-sm" variant="ghost" />}><IconDotsVertical aria-hidden="true" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => navigate(listPath)}><IconCategory aria-hidden="true" />Все категории</DropdownMenuItem></DropdownMenuContent></DropdownMenu>

  return <EditorFrame actions={category ? overflow : null} footerActions={<><Button onClick={() => navigate(-1)} size="sm" variant="outline">Закрыть</Button><Button disabled={!category || visibleSaveState === "saving"} onClick={() => void save()} size="sm">Сохранить</Button></>} mobileActions={category ? overflow : null} navigation={navigation} saveState={visibleSaveState} sidebar={category ? <CategorySidebar category={category} renderIcon={renderIcon} tone={tone} toneOptions={toneOptions} usageCount={usageCount} usageLabel={usageLabel} /> : <Skeleton className="h-64 rounded-xl" />}>
    {loading ? <div aria-label={`Загрузка: ${entityLabel}`} className="space-y-3" role="status"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div> : null}
    {error ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title={`${entityLabel} не открылась`} tone="danger">{error}</PageState></div> : null}
    {category && tab === "main" ? <CategoryMain category={category} control={control} entityLabel={entityLabel} errors={errors} iconOptions={iconOptions} onInteraction={markInteraction} renderIcon={renderIcon} toneOptions={toneOptions} /> : null}
    {category && tab === "related" ? <RelatedCategories category={category} items={relatedItems(category)} relatedLabel={relatedLabel} /> : null}
  </EditorFrame>
}

function CategoryMain<T extends BaseCategory>({ category, control, entityLabel, errors, iconOptions, onInteraction, renderIcon, toneOptions }: { category: T; control: Control<CategoryFormValues>; entityLabel: string; errors: FieldErrors<CategoryFormValues>; iconOptions: Option[]; onInteraction: () => void; renderIcon: (category: T, size?: "sm" | "md") => ReactNode; toneOptions: Option[] }) { return <EditorSection title="Основные данные"><div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/25 p-3">{renderIcon(category, "md")}<div className="min-w-0"><p className="truncate text-[13px] font-medium">{category.name}</p><p className="truncate text-[11px] text-muted-foreground">{entityLabel} · #{category.id}</p></div></div><div className="grid items-start gap-4 sm:grid-cols-6"><Controller control={control} name="icon" render={({ field }) => <FormField className="sm:col-span-3" error={errors.icon?.message} htmlFor="category-icon" label="Иконка"><FormSelect id="category-icon" label={`Иконка: ${entityLabel}`} onValueChange={(value) => { field.onChange(value); onInteraction() }} options={iconOptions} value={field.value} /></FormField>} /><Controller control={control} name="tone" render={({ field }) => <FormField className="sm:col-span-3" error={errors.tone?.message} htmlFor="category-tone" label="Цвет"><FormSelect id="category-tone" label={`Цвет: ${entityLabel}`} onValueChange={(value) => { field.onChange(value); onInteraction() }} options={toneOptions} value={field.value} /></FormField>} /><Controller control={control} name="name" render={({ field }) => <FormField className="sm:col-span-6" error={errors.name?.message} htmlFor="category-name" label="Название"><Input {...field} aria-invalid={Boolean(errors.name)} id="category-name" onChange={(event) => { field.onChange(event); onInteraction() }} /></FormField>} /><Controller control={control} name="description" render={({ field }) => <FormField className="sm:col-span-6" error={errors.description?.message} htmlFor="category-description" label="Описание"><Textarea {...field} aria-invalid={Boolean(errors.description)} id="category-description" onChange={(event) => { field.onChange(event); onInteraction() }} placeholder="Коротко объясните, какие сущности относятся к категории" /></FormField>} /></div></EditorSection> }

function RelatedCategories<T extends BaseCategory>({ category, items, relatedLabel }: { category: T; items: RelatedItem[]; relatedLabel: string }) { const navigate = useNavigate(); return <EditorSection subtitle={`Текущие связи категории «${category.name}».`} title={relatedLabel}>{items.length ? <div className="divide-y rounded-lg border">{items.map((item) => <Button className="h-auto w-full justify-start rounded-none px-3 py-3 text-left" key={item.id} onClick={() => navigate(item.href)} variant="ghost"><IconLink aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{item.label}</span><span className="mt-0.5 block truncate text-[10px] font-normal text-muted-foreground">{item.secondary}</span></span><IconExternalLink aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /></Button>)}</div> : <PageState icon={IconLink} title="Связей пока нет">После сохранения категорию можно назначить новым сущностям.</PageState>}</EditorSection> }

function CategorySidebar<T extends BaseCategory>({ category, renderIcon, tone, toneOptions, usageCount, usageLabel }: { category: T; renderIcon: (category: T, size?: "sm" | "md") => ReactNode; tone: "program" | "event"; toneOptions: Option[]; usageCount: (category: T) => number; usageLabel: string }) { const toneLabel = toneOptions.find((item) => item.value === category.tone)?.label ?? category.tone; return <div className="overflow-hidden rounded-xl border bg-background"><ListSection count={3} icon={IconCategory} title="Сводка категории" tone={tone}><ListRow><div className="flex items-center justify-between gap-3 px-4 py-3 text-xs"><span className="text-muted-foreground">Иконка</span>{renderIcon(category, "sm")}</div></ListRow><ListRow><SummaryRow label="Цвет" value={toneLabel} /></ListRow><ListRow><SummaryRow label={usageLabel} value={String(usageCount(category))} /></ListRow></ListSection></div> }
function SummaryRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs"><span className="text-muted-foreground">{label}</span><span className="max-w-44 truncate text-right tabular-nums" title={value}>{value}</span></div> }
