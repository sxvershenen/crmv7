import { useCallback, useEffect, useMemo, useState } from "react"
import { IconAlertTriangle, IconCalendarEvent, IconClock, IconDotsVertical, IconExternalLink, IconLock, IconLockOpen, IconPlus, IconSettings, IconTrash, IconUser, IconWorld } from "@tabler/icons-react"
import { Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"

import {
  Button,
  Checkbox,
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
  Progress,
  Skeleton,
  StatusBadge,
  Switch,
  Textarea,
  type EditorSaveState,
  type IconBoxVariant,
} from "@crm/ui"

import { useEditorLayoutChrome } from "@app/app/editor-layout-context"
import { EditorPreviewHistory } from "@app/components/shared/editor-preview-tabs"
import { formatResourceDate } from "@app/components/resources/resource-date"
import { ResourceIdentityIcon } from "@app/components/resources/resource-presentation"
import { resourceColorOptions, resourceIconOptions } from "@app/components/resources/resource-presentation-data"
import { createEmptyResource, resourceRepository, type ResourceEditorRepository } from "@app/data/resources-repository"
import type { ResourceActivityStatus, ResourceEditorBlock, ResourceEditorRecord, ResourceEditorRules, ResourceKind, ResourceSpaceType, ResourceWeekDay } from "@app/entities/resources"
import { isResourceKind, resourceActivityStatusLabels, resourceKindLabels, resourceKinds, resourceSpaceTypeLabels, resourceSpaceTypes, resourceWeekDayLabels, resourceWeekDays } from "@app/entities/resources"

const tabs = ["main", "schedule", "blocks", "rules", "history"] as const
const tabItems = [
  { value: "main", label: "Основное" },
  { value: "schedule", label: "Расписание" },
  { value: "blocks", label: "Блокировки" },
  { value: "rules", label: "Правила" },
  { value: "history", label: "История" },
]
const statusOptions = (["active", "inactive"] as const).map((value) => ({ value, label: resourceActivityStatusLabels[value] }))
const kindOptions = resourceKinds.map((value) => ({ value, label: resourceKindLabels[value] }))
const capacityModeOptions = [{ value: "fixed", label: "Фиксированная" }, { value: "shared", label: "Общая" }]
const spaceTypeOptions = resourceSpaceTypes.map((value) => ({ value, label: resourceSpaceTypeLabels[value] }))
const resourceTones: Record<ResourceKind, IconBoxVariant> = { bath: "resourceBath", camping: "resourceCamping", houses: "resourceHouses", venues: "resourceVenues" }

function oneOf<T extends string>(value: string | null, options: readonly T[], fallback: T): T { return value && options.includes(value as T) ? value as T : fallback }
function inputNumber(value: string) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, parsed) : 0 }

export function ResourceEditorPage({ repository = resourceRepository }: { repository?: ResourceEditorRepository }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { kind, resourceId = "new" } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = oneOf(params.get("tab"), tabs, "main")
  const [draft, setDraft] = useState<ResourceEditorRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<EditorSaveState>("saved")

  const validKind = isResourceKind(kind) ? kind : null
  useEffect(() => {
    if (!validKind) return
    let active = true
    setLoading(true)
    setError(null)
    if (resourceId === "new") { setDraft(createEmptyResource(validKind)); setLoading(false); return () => { active = false } }
    repository.get(resourceId).then((resource) => {
      if (!active) return
      if (!resource || resource.kind !== validKind) { setError("Ресурс не найден"); setLoading(false); return }
      setDraft(resource)
      setLoading(false)
    }).catch((reason: unknown) => { if (active) { setError(reason instanceof Error ? reason.message : "Не удалось загрузить ресурс"); setLoading(false) } })
    return () => { active = false }
  }, [repository, resourceId, validKind])

  const update = useCallback(<K extends keyof ResourceEditorRecord,>(key: K, value: ResourceEditorRecord[K]) => { setDraft((current) => current ? { ...current, [key]: value } : current); setSaveState("dirty") }, [])
  const updateRules = useCallback(<K extends keyof ResourceEditorRules,>(key: K, value: ResourceEditorRules[K]) => { setDraft((current) => current ? { ...current, rules: { ...current.rules, [key]: value } } : current); setSaveState("dirty") }, [])
  const setStatus = useCallback((status: ResourceActivityStatus) => update("active", status === "active"), [update])
  const setKind = useCallback((nextKind: ResourceKind) => { setDraft((current) => current ? { ...current, kind: nextKind, spaceType: nextKind === "venues" ? current.spaceType ?? "outdoor" : null } : current); setSaveState("dirty") }, [])
  const setCapacityMode = useCallback((mode: string) => { setDraft((current) => { if (!current) return current; const total = current.capacity.total; return { ...current, capacity: mode === "shared" ? { mode: "shared", occupied: 0, total } : { mode: "fixed", total } } }); setSaveState("dirty") }, [])
  const setCapacityTotal = useCallback((total: number) => { setDraft((current) => current ? { ...current, capacity: current.capacity.mode === "shared" ? { ...current.capacity, total } : { mode: "fixed", total } } : current); setSaveState("dirty") }, [])
  const setOccupied = useCallback((occupied: number) => { setDraft((current) => current?.capacity.mode === "shared" ? { ...current, capacity: { ...current.capacity, occupied } } : current); setSaveState("dirty") }, [])
  const addBlock = useCallback((from: string, to: string, reason: string) => { const text = reason.trim(); if (!draft?.permissions.canManageBlocks || !from || !to || !text) return; const block: ResourceEditorBlock = { from, id: `block-${Date.now()}`, reason: text, status: "active", to }; setDraft((current) => current ? { ...current, blocks: [block, ...current.blocks], hasActiveBlock: true } : current); setSaveState("dirty") }, [draft?.permissions.canManageBlocks])
  const cancelBlock = useCallback((id: string) => { if (!draft?.permissions.canManageBlocks) return; setDraft((current) => { if (!current) return current; const blocks = current.blocks.map((block) => block.id === id ? { ...block, status: "cancelled" as const } : block); return { ...current, blocks, hasActiveBlock: blocks.some((block) => block.status === "active") } }); setSaveState("dirty") }, [draft?.permissions.canManageBlocks])
  const save = async () => { if (!draft?.permissions.canEdit) return; setSaveState("saving"); try { await repository.save(draft); setSaveState("saved") } catch { setSaveState("conflict") } }

  const draftActive = draft?.active
  const statusControl = useMemo(() => draftActive === undefined ? undefined : <FilterSelect className="w-28 max-w-28 sm:w-36 sm:max-w-36" label="Статус активности ресурса" onValueChange={(value) => setStatus(value as ResourceActivityStatus)} options={statusOptions} value={draftActive ? "active" : "inactive"} />, [draftActive, setStatus])
  const title = draft?.name ?? "Ресурс"
  const editorChrome = useMemo(() => ({ idLabel: `#${resourceId}`, mobileStatus: statusControl, onBack: () => navigate(-1), title }), [navigate, resourceId, statusControl, title])
  useEditorLayoutChrome(editorChrome)

  if (!validKind) return <Navigate replace to={`/resources/houses${location.search}`} />
  const navigation = <PageNav ariaLabel="Разделы редактора ресурса" items={tabItems} onValueChange={(value) => setParams((current) => { const next = new URLSearchParams(current); if (value === "main") next.delete("tab"); else next.set("tab", value); return next })} value={tab} />
  const openSchedule = () => navigate(`/bookings?view=scheduler&resource=${draft?.id ?? resourceId}`)
  const overflow = draft ? <ResourceOverflow onOpenSchedule={openSchedule} /> : null

  return <EditorFrame actions={draft ? <>{statusControl}{overflow}</> : null} footerActions={<><Button onClick={() => navigate(-1)} size="sm" variant="outline">Закрыть</Button><Button aria-describedby={draft?.permissions.canEdit ? undefined : "resource-save-permission"} disabled={!draft || !draft.permissions.canEdit || saveState === "saving"} onClick={() => void save()} size="sm" title={draft && !draft.permissions.canEdit ? "Нет прав на изменение ресурса" : undefined}>Сохранить</Button></>} mobileActions={overflow} navigation={navigation} saveState={saveState} sidebar={draft ? <ResourceSidebar draft={draft} /> : <Skeleton className="h-80 rounded-xl" />}>
    {loading ? <ResourceEditorLoading /> : null}
    {error ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Ресурс не открылся" tone="danger">{error}</PageState></div> : null}
    {draft && !draft.permissions.canEdit ? <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-subtle p-3 text-xs text-warning-foreground" id="resource-save-permission" role="status"><IconLock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>У вас нет прав на изменение этого ресурса. Сохранение недоступно.</span></div> : null}
    {draft && tab === "blocks" && !draft.permissions.canManageBlocks ? <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-subtle p-3 text-xs text-warning-foreground" role="status"><IconLock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>У вас нет прав на управление блокировками. Добавление и отмена недоступны.</span></div> : null}
    {draft && tab === "main" ? <ResourceMain draft={draft} onCapacityModeChange={setCapacityMode} onCapacityTotalChange={setCapacityTotal} onKindChange={setKind} onOccupiedChange={setOccupied} update={update} /> : null}
    {draft && tab === "schedule" ? <ResourceSchedule draft={draft} onOpenSchedule={openSchedule} /> : null}
    {draft && tab === "blocks" ? <ResourceBlocks canManageBlocks={draft.permissions.canManageBlocks} draft={draft} onAdd={addBlock} onCancel={cancelBlock} /> : null}
    {draft && tab === "rules" ? <ResourceRules rules={draft.rules} update={updateRules} /> : null}
    {draft && tab === "history" ? <EditorPreviewHistory entityLabel="Ресурс" /> : null}
  </EditorFrame>
}

function ResourceOverflow({ onOpenSchedule }: { onOpenSchedule: () => void }) { return <DropdownMenu><DropdownMenuTrigger render={<Button aria-label="Дополнительные действия ресурса" size="icon-sm" variant="ghost" />}><IconDotsVertical aria-hidden="true" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={onOpenSchedule}><IconExternalLink aria-hidden="true" />Открыть расписание</DropdownMenuItem></DropdownMenuContent></DropdownMenu> }

function ResourceMain({ draft, onCapacityModeChange, onCapacityTotalChange, onKindChange, onOccupiedChange, update }: { draft: ResourceEditorRecord; onCapacityModeChange: (value: string) => void; onCapacityTotalChange: (value: number) => void; onKindChange: (value: ResourceKind) => void; onOccupiedChange: (value: number) => void; update: <K extends keyof ResourceEditorRecord>(key: K, value: ResourceEditorRecord[K]) => void }) {
  const uploadIcon = (file: File | undefined) => { if (!file) return; const reader = new FileReader(); reader.onload = () => { if (typeof reader.result === "string") { update("customIconDataUrl", reader.result); update("customIconName", file.name) } }; reader.readAsDataURL(file) }
  return <div className="space-y-3"><EditorSection title="Основные данные"><div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/25 p-3"><ResourceIdentityIcon color={draft.colorKey} customIconDataUrl={draft.customIconDataUrl} iconKey={draft.iconKey} kind={draft.kind} /><div className="min-w-0"><p className="truncate text-[13px] font-medium">{draft.name}</p><p className="truncate text-[11px] text-muted-foreground">{draft.customIconName || draft.secondaryType || resourceKindLabels[draft.kind]}</p></div>{draft.customIconDataUrl ? <Button className="ml-auto" onClick={() => { update("customIconDataUrl", ""); update("customIconName", "") }} size="sm" variant="ghost">Удалить свою иконку</Button> : null}</div><div className="grid items-start gap-4 sm:grid-cols-6"><FormField className="sm:col-span-2" htmlFor="resource-icon" label="Иконка из набора"><FormSelect id="resource-icon" label="Иконка ресурса" onValueChange={(value) => update("iconKey", value)} options={resourceIconOptions} value={draft.iconKey} /></FormField><FormField className="sm:col-span-2" htmlFor="resource-color" label="Цвет"><FormSelect id="resource-color" label="Цвет ресурса" onValueChange={(value) => update("colorKey", value as ResourceEditorRecord["colorKey"])} options={resourceColorOptions} value={draft.colorKey} /></FormField><FormField className="sm:col-span-2" htmlFor="resource-icon-upload" label="Своя иконка"><Input accept="image/svg+xml,image/png,image/webp" id="resource-icon-upload" onChange={(event) => uploadIcon(event.target.files?.[0])} type="file" /></FormField><FormField className="sm:col-span-2" htmlFor="resource-kind" label="Направление"><FormSelect id="resource-kind" label="Направление ресурса" onValueChange={(value) => onKindChange(value as ResourceKind)} options={kindOptions} value={draft.kind} /></FormField><FormField className="sm:col-span-4" htmlFor="resource-name" label="Название"><Input id="resource-name" onChange={(event) => update("name", event.target.value)} value={draft.name} /></FormField><FormField className="sm:col-span-2" htmlFor="resource-type" label="Тип ресурса"><Input id="resource-type" onChange={(event) => update("secondaryType", event.target.value)} value={draft.secondaryType} /></FormField>{draft.kind === "venues" ? <FormField className="sm:col-span-3" htmlFor="resource-space-type" label="Тип пространства"><FormSelect id="resource-space-type" label="Тип пространства" onValueChange={(value) => update("spaceType", value as ResourceSpaceType)} options={spaceTypeOptions} value={draft.spaceType ?? "outdoor"} /></FormField> : null}<FormField className="sm:col-span-6" htmlFor="resource-description" label="Описание"><Textarea id="resource-description" onChange={(event) => update("description", event.target.value)} placeholder="Описание ресурса для команды и сайта" value={draft.description} /></FormField></div></EditorSection><EditorSection title="Вместимость"><div className="grid items-start gap-4 sm:grid-cols-6"><FormField className="sm:col-span-2" htmlFor="capacity-mode" label="Режим"><FormSelect id="capacity-mode" label="Режим вместимости" onValueChange={onCapacityModeChange} options={capacityModeOptions} value={draft.capacity.mode} /></FormField><FormField className="sm:col-span-2" htmlFor="capacity-total" label="Всего мест"><Input id="capacity-total" min="0" onChange={(event) => onCapacityTotalChange(inputNumber(event.target.value))} type="number" value={draft.capacity.total} /></FormField>{draft.capacity.mode === "shared" ? <FormField className="sm:col-span-2" htmlFor="capacity-occupied" label="Занято сейчас"><Input id="capacity-occupied" min="0" onChange={(event) => onOccupiedChange(inputNumber(event.target.value))} type="number" value={draft.capacity.occupied} /></FormField> : null}</div></EditorSection><EditorSection title="Публикация и интеграция"><div className="divide-y rounded-lg border"><ToggleField checked={draft.active} label="Активен для бронирования" onChange={(checked) => update("active", checked)} /><ToggleField checked={draft.showOnSite} label="Показывать на сайте" onChange={(checked) => update("showOnSite", checked)} /></div><div className="mt-4 grid sm:grid-cols-2"><FormField htmlFor="resource-cms-id" label="CMS ID"><Input id="resource-cms-id" onChange={(event) => update("cmsId", event.target.value)} placeholder="Не связан" value={draft.cmsId} /></FormField></div></EditorSection></div>
}

function ToggleField({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) { return <label className="flex min-h-12 items-center justify-between gap-3 px-3 text-xs font-medium"><span>{label}</span><Switch checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} /></label> }

function ResourceSchedule({ draft, onOpenSchedule }: { draft: ResourceEditorRecord; onOpenSchedule: () => void }) {
  const operations = [{ label: "Ближайшая бронь", value: formatResourceDate(draft.nextBookingAt), icon: IconCalendarEvent }, { label: "Свободен после", value: formatResourceDate(draft.nextAvailableFrom), icon: IconLockOpen }]
  return <div className="space-y-3"><EditorSection actions={<Button onClick={onOpenSchedule} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Открыть scheduler</Button>} title="Загрузка месяца">{draft.monthlyLoadPercent === null ? <PageState icon={IconCalendarEvent} title="Расчёт загрузки пока недоступен">Загрузка появится после подключения полного календаря доступности.</PageState> : <div><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">Занято</span><span>{draft.monthlyLoadPercent}%</span></div><Progress aria-label={`Загрузка месяца ${draft.monthlyLoadPercent}%`} value={draft.monthlyLoadPercent} /></div>}</EditorSection><div className="overflow-hidden rounded-xl border bg-background"><ListSection count={operations.length} icon={IconClock} title="Ближайшие операции" tone={resourceTones[draft.kind]}>{operations.map(({ icon: Icon, label, value }) => <ListRow key={label}><SummaryRow icon={Icon} label={label} value={value} /></ListRow>)}</ListSection></div>{draft.warning ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Требует внимания" tone="warning">{draft.warning.message}</PageState></div> : null}</div>
}

function ResourceBlocks({ canManageBlocks, draft, onAdd, onCancel }: { canManageBlocks: boolean; draft: ResourceEditorRecord; onAdd: (from: string, to: string, reason: string) => void; onCancel: (id: string) => void }) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [reason, setReason] = useState("")
  const submit = () => { if (!from || !to || !reason.trim()) return; onAdd(from, to, reason); setFrom(""); setTo(""); setReason("") }
  return <div className="space-y-3"><EditorSection title="Новая блокировка"><div className="grid items-end gap-4 sm:grid-cols-6"><FormField className="sm:col-span-2" htmlFor="block-from" label="С даты"><Input disabled={!canManageBlocks} id="block-from" onChange={(event) => setFrom(event.target.value)} type="datetime-local" value={from} /></FormField><FormField className="sm:col-span-2" htmlFor="block-to" label="По дату"><Input disabled={!canManageBlocks} id="block-to" onChange={(event) => setTo(event.target.value)} type="datetime-local" value={to} /></FormField><FormField className="sm:col-span-2" htmlFor="block-reason" label="Причина"><Input disabled={!canManageBlocks} id="block-reason" onChange={(event) => setReason(event.target.value)} value={reason} /></FormField><Button className="sm:col-span-2" disabled={!canManageBlocks || !from || !to || !reason.trim()} onClick={submit} size="sm"><IconPlus aria-hidden="true" />Добавить блокировку</Button></div></EditorSection><EditorSection title="Блокировки">{draft.blocks.length ? <div className="divide-y rounded-lg border">{draft.blocks.map((block) => <div className="flex items-start gap-3 p-3" key={block.id}><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-medium">{block.reason}</p><StatusBadge tone={block.status === "active" ? "warning" : "neutral"}>{block.status === "active" ? "Активна" : "Отменена"}</StatusBadge></div><p className="mt-1 text-[10px] text-muted-foreground">{block.from.replace("T", " ")} — {block.to.replace("T", " ")}</p></div><Button aria-label={`Отменить блокировку: ${block.reason}`} disabled={!canManageBlocks || block.status === "cancelled"} onClick={() => onCancel(block.id)} size="icon-sm" variant="ghost"><IconTrash aria-hidden="true" /></Button></div>)}</div> : draft.hasActiveBlock ? <PageState icon={IconLock} title="Активная блокировка отмечена">Интервалы существующей блокировки отсутствуют в текущем наборе данных. Новые блокировки можно создавать здесь.</PageState> : <PageState icon={IconLockOpen} title="Блокировок нет">Добавьте интервал и причину новой блокировки.</PageState>}</EditorSection></div>
}

function ResourceRules({ rules, update }: { rules: ResourceEditorRules; update: <K extends keyof ResourceEditorRules>(key: K, value: ResourceEditorRules[K]) => void }) {
  const toggleDay = (day: ResourceWeekDay, checked: boolean) => update("availableDays", checked ? [...rules.availableDays, day] : rules.availableDays.filter((item) => item !== day))
  return <div className="space-y-3"><EditorSection subtitle="Пустое поле означает, что правило ещё не настроено." title="Длительность и шаг"><div className="grid items-start gap-4 sm:grid-cols-6"><RuleNumber className="sm:col-span-2" id="rule-min" label="Мин. длительность, мин" onChange={(value) => update("minDurationMinutes", value)} value={rules.minDurationMinutes} /><RuleNumber className="sm:col-span-2" id="rule-max" label="Макс. длительность, мин" onChange={(value) => update("maxDurationMinutes", value)} value={rules.maxDurationMinutes} /><RuleNumber className="sm:col-span-2" id="rule-step" label="Шаг бронирования, мин" onChange={(value) => update("bookingStepMinutes", value)} value={rules.bookingStepMinutes} /><RuleNumber className="sm:col-span-2" id="rule-prep-before" label="Подготовка до, мин" onChange={(value) => update("preparationBeforeMinutes", value)} value={rules.preparationBeforeMinutes} /><RuleNumber className="sm:col-span-2" id="rule-prep-after" label="Подготовка после, мин" onChange={(value) => update("preparationAfterMinutes", value)} value={rules.preparationAfterMinutes} /></div></EditorSection><EditorSection title="Время и доступные дни"><div className="grid items-start gap-4 sm:grid-cols-6"><FormField className="sm:col-span-2" htmlFor="rule-check-in" label="Дефолт заезд"><Input id="rule-check-in" onChange={(event) => update("defaultCheckIn", event.target.value)} type="time" value={rules.defaultCheckIn} /></FormField><FormField className="sm:col-span-2" htmlFor="rule-check-out" label="Дефолт выезд"><Input id="rule-check-out" onChange={(event) => update("defaultCheckOut", event.target.value)} type="time" value={rules.defaultCheckOut} /></FormField><div className="sm:col-span-6"><p className="mb-2 text-xs font-medium">Доступные дни</p><div className="flex flex-wrap gap-2">{resourceWeekDays.map((day) => <label className="flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs" key={day}><Checkbox checked={rules.availableDays.includes(day)} onCheckedChange={(checked) => toggleDay(day, Boolean(checked))} />{resourceWeekDayLabels[day]}</label>)}</div></div></div></EditorSection></div>
}

function RuleNumber({ className, id, label, onChange, value }: { className?: string; id: string; label: string; onChange: (value: string) => void; value: string }) { return <FormField {...(className ? { className } : {})} htmlFor={id} label={label}><Input id={id} min="0" onChange={(event) => onChange(event.target.value)} placeholder="Не задано" type="number" value={value} /></FormField> }

function ResourceSidebar({ draft }: { draft: ResourceEditorRecord }) {
  const capacity = draft.capacity.mode === "shared" ? `${draft.capacity.occupied} / ${draft.capacity.total}` : String(draft.capacity.total)
  return <div className="space-y-3"><div className="overflow-hidden rounded-xl border bg-background"><ListSection count={5} icon={IconSettings} title="Операционная сводка" tone={resourceTones[draft.kind]}><ListRow><SummaryRow icon={IconWorld} label="Направление" value={resourceKindLabels[draft.kind]} /></ListRow><ListRow><SummaryRow icon={IconUser} label="Вместимость" value={capacity} /></ListRow><ListRow><SummaryRow icon={IconCalendarEvent} label="Будущие брони" value={String(draft.futureBookingCount)} /></ListRow><ListRow><SummaryRow icon={IconClock} label="Ближайшая бронь" value={formatResourceDate(draft.nextBookingAt)} /></ListRow><ListRow><SummaryRow icon={draft.hasActiveBlock ? IconLock : IconLockOpen} label="Блокировка" value={draft.hasActiveBlock ? "Есть" : "Нет"} /></ListRow></ListSection></div>{draft.capacity.mode === "shared" ? <EditorSection title="Занятость"><div className="mb-2 flex items-center justify-between text-xs"><span className="text-muted-foreground">Мест занято</span><span>{capacity}</span></div><Progress aria-label={`Занято ${draft.capacity.occupied} из ${draft.capacity.total}`} value={draft.capacity.total > 0 ? draft.capacity.occupied / draft.capacity.total * 100 : 0} /></EditorSection> : null}</div>
}

function SummaryRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) { return <div className="flex items-center gap-2 px-4 py-3 text-xs"><Icon aria-hidden="true" className="size-3.5 text-muted-foreground" /><span className="min-w-0 flex-1 text-muted-foreground">{label}</span><span className="max-w-40 truncate text-right tabular-nums" title={value}>{value}</span></div> }
function ResourceEditorLoading() { return <div aria-label="Загрузка редактора ресурса" className="space-y-3" role="status"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div> }
