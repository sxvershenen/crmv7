import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react"
import {
  IconAlertTriangle,
  IconBuildingCottage,
  IconCalendar,
  IconCalendarCheck,
  IconCalendarTime,
  IconCircleCheck,
  IconClock,
  IconCurrencyRuble,
  IconExternalLink,
  IconFileText,
  IconHome,
  IconLink,
  IconLock,
  IconPlus,
  IconPlayerPlay,
  IconReceipt2,
  IconRefresh,
  IconSettings,
  IconTag,
  IconTent,
  IconTrash,
  IconUsers,
} from "@tabler/icons-react"

import {
  type InternalOfferingEditor,
  type InternalOfferingQuoteResult,
  type InternalStayOfferingQuoteBody,
  type PriceBook,
  type PriceRuleDraft,
  type PriceWeekday,
  type PricingBasis,
  type RatePlanDraft,
} from "@crm/contracts"
import {
  Button,
  EditorFrame,
  EditorSection,
  FormField,
  FormSelect,
  IconBox,
  Input,
  LoadingRows,
  PageNav,
  PageState,
  Separator,
  StatusBadge,
  SummaryMetric,
  SummaryMetricStrip,
} from "@crm/ui"

import {
  isOfferingEditorConflict,
  offeringEditorErrorMessage,
  type OfferingEditorCommandMetaFactory,
  type OfferingEditorGateway,
} from "./gateway.js"
import {
  HouseBindingEditor,
  CampgroundBindingEditor,
  type OfferingEditorSubjectCommandMetaFactory,
} from "./house-binding-editor.js"
import {
  HouseAddOnEditor,
  type OfferingEditorAddOnsCommandMetaFactory,
} from "./house-addon-editor.js"
import {
  buildCreateDraftPriceBookBody,
  buildReplaceDraftPriceBookBody,
  createDraftPriceBookForm,
  createEmptyRatePlan,
  priceBookToDraftForm,
  type DraftPriceBookForm,
} from "./price-book-draft.js"
import { allowOfferingEditorClose, buildCampgroundQuoteBody, buildHouseQuoteBody, canEditPricingDraft, HouseQuoteRequestCache, incrementDateOnly, majorMoneyToMinor, minorMoneyToMajor, serviceDateInTimezone, shouldPreserveLocalPricingDraft, zonedLocalDateTimeToIso } from "./house-offering-helpers.js"

export type HouseOfferingWorkspaceTab = "overview" | "composition" | "pricing"
export type CampgroundOfferingWorkspaceTab = HouseOfferingWorkspaceTab

export type HouseOfferingWorkspaceProps = {
  createCommandMeta: OfferingEditorCommandMetaFactory
  createSubjectCommandMeta: OfferingEditorSubjectCommandMetaFactory
  createAddOnsCommandMeta: OfferingEditorAddOnsCommandMetaFactory
  gateway: OfferingEditorGateway
  initialTab?: HouseOfferingWorkspaceTab
  editorialHref?: (nodeId: string) => string | null
  offeringId: string
  onBack?: () => void
  onEditorChange?: (editor: InternalOfferingEditor) => void
  onOpenEditorial?: (nodeId: string) => void
  onNavigationGuardChange?: (guard: (() => boolean) | null) => void
  onTabChange?: (tab: HouseOfferingWorkspaceTab) => void
  layout?: "standalone" | "embedded"
}

export type CampgroundOfferingWorkspaceProps = Omit<HouseOfferingWorkspaceProps, "gateway"> & {
  gateway: OfferingEditorGateway
}

type SaveState = "dirty" | "saving" | "saved" | "conflict"
type AddOnPricingConstraint = { basis: "per_unit" | "per_person"; metric: "units" | "participants" }

const pricingBasisOptions = [
  { label: "За ночь", value: "per_night" },
  { label: "За день", value: "per_day" },
  { label: "За слот", value: "per_slot" },
  { label: "За час", value: "per_hour" },
  { label: "За человека", value: "per_person" },
  { label: "За единицу", value: "per_unit" },
  { label: "Фиксированный пакет", value: "flat_package" },
]

const metricOptions = [
  { label: "Не применяется", value: "none" },
  { label: "Гости", value: "guests" },
  { label: "Участники", value: "participants" },
  { label: "Единицы", value: "units" },
]

const priceBookTone = { active: "success", draft: "warning", retired: "neutral", scheduled: "info" } as const
const priceBookLabel = { active: "Активен", draft: "Черновик", retired: "Снят", scheduled: "Запланирован" } as const
const salesModeLabel = { request_only: "По заявке", quoted: "По расчёту", selectable: "Можно выбрать" } as const
const priceDisplayLabel = { exact: "Точная цена", from: "Цена от", request: "По запросу" } as const
const taxModeLabel = { tax_included: "Налог включён", tax_excluded: "Налог сверху", not_taxable: "Без налога" } as const
const bindingTargetLabel = { resource: "Ресурс", resource_group: "Группа ресурсов", program_template: "Шаблон программы", event_service_template: "Шаблон мероприятия" } as const
const pricingBasisShortLabel: Record<PricingBasis, string> = {
  flat_package: "пакет",
  per_day: "день",
  per_hour: "час",
  per_night: "ночь",
  per_person: "человека",
  per_slot: "слот",
  per_unit: "единицу",
}
const quantityMetricLabel = { guests: "гостя", participants: "участника", units: "единицу" } as const

function numberOrNull(value: string) { return value.trim() === "" ? null : Number(value) }
function numberOrZero(value: string) { const result = Number(value); return Number.isFinite(result) ? result : 0 }
function minorMoney(value: number, currency: string) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(value / 100) }
function compactDate(value: string) { return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00.000Z`)) }
function compactDateTime(value: string, timeZone: string) { return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value)) }
function priceBookSource(editor: InternalOfferingEditor) { return editor.priceBooks.find((item) => item.state === "active") ?? editor.priceBooks[0] ?? null }
function draftPriceBook(editor: InternalOfferingEditor) { return editor.priceBooks.find((item) => item.state === "draft") ?? null }

/**
 * Route-neutral offering workspace. Its host may bind the tab to URL state and
 * use `onEditorChange` to invalidate a transport-specific cache.
 */
export function HouseOfferingWorkspace({
  createCommandMeta,
  createSubjectCommandMeta,
  createAddOnsCommandMeta,
  gateway,
  initialTab = "overview",
  editorialHref,
  offeringId,
  onBack,
  onEditorChange,
  onOpenEditorial,
  onNavigationGuardChange,
  onTabChange,
  layout = "standalone",
}: HouseOfferingWorkspaceProps) {
  return <StayOfferingWorkspace createAddOnsCommandMeta={createAddOnsCommandMeta} createCommandMeta={createCommandMeta} createSubjectCommandMeta={createSubjectCommandMeta} {...(editorialHref ? { editorialHref } : {})} gateway={gateway} initialTab={initialTab} kind="house" layout={layout} offeringId={offeringId} {...(onBack ? { onBack } : {})} {...(onEditorChange ? { onEditorChange } : {})} {...(onOpenEditorial ? { onOpenEditorial } : {})} {...(onNavigationGuardChange ? { onNavigationGuardChange } : {})} {...(onTabChange ? { onTabChange } : {})} />
}

export function CampgroundOfferingWorkspace(props: CampgroundOfferingWorkspaceProps) {
  return <StayOfferingWorkspace {...props} kind="campground" />
}

function StayOfferingWorkspace({
  createCommandMeta,
  createSubjectCommandMeta,
  createAddOnsCommandMeta,
  gateway,
  initialTab = "overview",
  kind,
  editorialHref,
  offeringId,
  onBack,
  onEditorChange,
  onOpenEditorial,
  onNavigationGuardChange,
  onTabChange,
  layout = "standalone",
}: HouseOfferingWorkspaceProps & { kind: "house" | "campground" }) {
  const [editor, setEditor] = useState<InternalOfferingEditor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = kind === "campground" ? await gateway.getCampgroundEditor(offeringId) : await gateway.getHouseEditor(offeringId)
      setEditor(next)
      if (next) onEditorChange?.(next)
    } catch (loadError) {
      setError(offeringEditorErrorMessage(loadError, kind === "campground" ? "Не удалось открыть кемпинг." : "Не удалось открыть домик."))
    } finally {
      setLoading(false)
    }
  }, [gateway, kind, offeringId, onEditorChange])

  useEffect(() => { void load() }, [load])

  // Keep the mounted editor during a refresh so a local draft can survive a
  // conflict recovery reload and remain visible for comparison.
  if (loading && !editor) return <WorkspaceLoading />
  if (error) return <WorkspaceState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title={kind === "campground" ? "Кемпинг не открылся" : "Домик не открылся"} tone="danger">{error}</WorkspaceState>
  if (!editor) return <WorkspaceState icon={kind === "campground" ? IconTent : IconHome} title={kind === "campground" ? "Кемпинг не найден" : "Домик не найден"}>Возможно, он был удалён или у вас нет доступа.</WorkspaceState>

  return <HouseOfferingEditor {...(editorialHref ? { editorialHref } : {})} {...(onBack ? { onBack } : {})} {...(onNavigationGuardChange ? { onNavigationGuardChange } : {})} {...(onOpenEditorial ? { onOpenEditorial } : {})} {...(onTabChange ? { onTabChange } : {})} createAddOnsCommandMeta={createAddOnsCommandMeta} createCommandMeta={createCommandMeta} createSubjectCommandMeta={createSubjectCommandMeta} editor={editor} gateway={gateway} initialTab={initialTab} kind={kind} layout={layout} onReload={load} />
}

export type HouseOfferingEditorProps = {
  createCommandMeta: OfferingEditorCommandMetaFactory
  createSubjectCommandMeta: OfferingEditorSubjectCommandMetaFactory
  createAddOnsCommandMeta: OfferingEditorAddOnsCommandMetaFactory
  editor: InternalOfferingEditor
  editorialHref?: (nodeId: string) => string | null
  gateway: OfferingEditorGateway
  initialTab?: HouseOfferingWorkspaceTab
  kind?: "house" | "campground"
  onBack?: () => void
  onNavigationGuardChange?: (guard: (() => boolean) | null) => void
  onOpenEditorial?: (nodeId: string) => void
  onReload: () => Promise<void>
  onTabChange?: (tab: HouseOfferingWorkspaceTab) => void
  layout?: "standalone" | "embedded"
}

/** Data-presentational editor for hosts that already own server-state loading. */
export function HouseOfferingEditor({ createAddOnsCommandMeta, createCommandMeta, createSubjectCommandMeta, editor, editorialHref, gateway, initialTab = "overview", kind = "house", layout = "standalone", onBack, onNavigationGuardChange, onOpenEditorial, onReload, onTabChange }: HouseOfferingEditorProps) {
  const [tab, setTab] = useState<HouseOfferingWorkspaceTab>(initialTab)
  const [pricingSaveState, setPricingSaveState] = useState<SaveState>("saved")
  const [pricingSaveDetail, setPricingSaveDetail] = useState("Изменения отсутствуют")
  const [pricingSaveAction, setPricingSaveAction] = useState<(() => void) | null>(null)
  const [subjectSaveState, setSubjectSaveState] = useState<SaveState>("saved")
  const [subjectSaveDetail, setSubjectSaveDetail] = useState("Изменения отсутствуют")
  const [subjectSaveAction, setSubjectSaveAction] = useState<(() => void) | null>(null)
  const [addOnsSaveState, setAddOnsSaveState] = useState<SaveState>("saved")
  const [addOnsSaveDetail, setAddOnsSaveDetail] = useState("Изменения отсутствуют")
  const [addOnsSaveAction, setAddOnsSaveAction] = useState<(() => void) | null>(null)
  const handlePricingSaveActionChange = useCallback((action: (() => void) | null) => setPricingSaveAction(() => action), [])
  const handleSubjectSaveActionChange = useCallback((action: (() => void) | null) => setSubjectSaveAction(() => action), [])
  const handleAddOnsSaveActionChange = useCallback((action: (() => void) | null) => setAddOnsSaveAction(() => action), [])
  const handleSubjectSaveState = useCallback((state: SaveState, detail: string) => { setSubjectSaveState(state); setSubjectSaveDetail(detail) }, [])
  const handleAddOnsSaveState = useCallback((state: SaveState, detail: string) => { setAddOnsSaveState(state); setAddOnsSaveDetail(detail) }, [])

  useEffect(() => setTab(initialTab), [initialTab])
  const setActiveTab = (value: string) => {
    const next = value as HouseOfferingWorkspaceTab
    setTab(next)
    onTabChange?.(next)
  }
  const navigation = <PageNav ariaLabel="Разделы предложения" items={[
    { icon: IconHome, label: "Обзор", value: "overview" },
    { icon: IconLink, label: kind === "campground" ? "Места и зона" : "Состав", value: "composition" },
    { icon: IconSettings, label: "Цены", value: "pricing" },
  ]} onValueChange={setActiveTab} value={tab} />
  const pricingWritable = editor.capabilities.pricing.canEditDraft
  const subjectWritable = editor.capabilities.subject.canManageBindings
  const compositionSave = addOnsSaveState !== "saved" ? { action: addOnsSaveAction, detail: addOnsSaveDetail, state: addOnsSaveState } : { action: subjectSaveAction, detail: subjectSaveDetail, state: subjectSaveState }
  const activeSaveState = tab === "pricing" ? pricingSaveState : tab === "composition" ? compositionSave.state : "saved"
  const activeSaveDetail = tab === "pricing" ? pricingSaveDetail : tab === "composition" ? compositionSave.detail : "Изменения отсутствуют"
  const activeSaveAction = tab === "pricing" ? pricingSaveAction : tab === "composition" ? compositionSave.action : null
  const isDirty = [pricingSaveState, subjectSaveState, addOnsSaveState].some((state) => state === "dirty" || state === "conflict" || state === "saving")
  const navigationGuard = useCallback(() => {
    return allowOfferingEditorClose(isDirty, () => typeof window === "undefined" || window.confirm("Есть несохранённые изменения. Закрыть редактор?"))
  }, [isDirty])

  useEffect(() => {
    onNavigationGuardChange?.(isDirty ? navigationGuard : null)
    return () => onNavigationGuardChange?.(null)
  }, [isDirty, navigationGuard, onNavigationGuardChange])

  useEffect(() => {
    if (!isDirty || typeof window === "undefined") return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  const close = () => { if (onBack && navigationGuard()) onBack() }
  const canRunPrimaryAction = activeSaveState === "dirty" || activeSaveState === "conflict"
  const footerActions = <>
    {onBack ? <Button onClick={close} size="sm" variant="outline">Закрыть</Button> : null}
    {tab === "pricing" && pricingWritable ? <Button disabled={!activeSaveAction || !canRunPrimaryAction} onClick={() => activeSaveAction?.()} size="sm">{activeSaveState === "conflict" ? "Обновить версию" : activeSaveState === "saving" ? "Сохранение…" : "Сохранить условия"}</Button> : null}
    {tab === "composition" && subjectWritable ? <Button disabled={!subjectSaveAction || !(subjectSaveState === "dirty" || subjectSaveState === "conflict")} onClick={() => subjectSaveAction?.()} size="sm" variant="outline">{subjectSaveState === "conflict" ? "Обновить версию" : subjectSaveState === "saving" ? "Сохранение…" : "Сохранить состав"}</Button> : null}
    {tab === "composition" && editor.capabilities.addOns.canAssign ? <Button disabled={!addOnsSaveAction || !(addOnsSaveState === "dirty" || addOnsSaveState === "conflict")} onClick={() => addOnsSaveAction?.()} size="sm">{addOnsSaveState === "conflict" ? "Обновить услуги" : addOnsSaveState === "saving" ? "Сохранение…" : "Сохранить услуги"}</Button> : null}
  </>

  const embeddedSave = addOnsSaveState !== "saved" ? { detail: addOnsSaveDetail, state: addOnsSaveState } : { detail: pricingSaveDetail, state: pricingSaveState }
  const embeddedFooterActions = <>
    {pricingWritable ? <Button disabled={!pricingSaveAction || !(pricingSaveState === "dirty" || pricingSaveState === "conflict")} onClick={() => pricingSaveAction?.()} size="sm" variant={addOnsSaveState === "saved" ? "default" : "outline"}>{pricingSaveState === "conflict" ? "Обновить цены" : pricingSaveState === "saving" ? "Сохранение…" : "Сохранить цены"}</Button> : null}
    {editor.capabilities.addOns.canAssign ? <Button disabled={!addOnsSaveAction || !(addOnsSaveState === "dirty" || addOnsSaveState === "conflict")} onClick={() => addOnsSaveAction?.()} size="sm">{addOnsSaveState === "conflict" ? "Обновить услуги" : addOnsSaveState === "saving" ? "Сохранение…" : "Сохранить услуги"}</Button> : null}
  </>

  const content = <>
    <div hidden={tab !== "overview"}><OfferingOverview editor={editor} kind={kind} {...(editorialHref ? { editorialHref } : {})} {...(onOpenEditorial ? { onOpenEditorial } : {})} /></div>
    <div className="space-y-3" hidden={tab !== "composition"}>{kind === "campground" ? <CampgroundBindingEditor createCommandMeta={createSubjectCommandMeta} editor={editor} gateway={gateway} onReload={onReload} onSaveActionChange={handleSubjectSaveActionChange} onSaveState={handleSubjectSaveState} /> : <HouseBindingEditor createCommandMeta={createSubjectCommandMeta} editor={editor} gateway={gateway} onReload={onReload} onSaveActionChange={handleSubjectSaveActionChange} onSaveState={handleSubjectSaveState} />}<HouseAddOnEditor createCommandMeta={createAddOnsCommandMeta} editor={editor} gateway={gateway} onReload={onReload} onSaveActionChange={handleAddOnsSaveActionChange} onSaveState={handleAddOnsSaveState} /></div>
    <div hidden={tab !== "pricing"}><PricingWorkspace createCommandMeta={createCommandMeta} editor={editor} gateway={gateway} kind={kind} onReload={onReload} onSaveActionChange={handlePricingSaveActionChange} onSaveState={(state, detail) => { setPricingSaveState(state); setPricingSaveDetail(detail) }} /></div>
  </>

  if (layout === "embedded") {
    return <div className="space-y-3" data-slot="embedded-offering-editor">
      <ResourceSaleHeader editor={editor} />
      <PricingWorkspace createCommandMeta={createCommandMeta} editor={editor} gateway={gateway} kind={kind} onReload={onReload} onSaveActionChange={handlePricingSaveActionChange} onSaveState={(state, detail) => { setPricingSaveState(state); setPricingSaveDetail(detail) }} resourceView />
      <ResourceSiteCard editor={editor} {...(editorialHref ? { editorialHref } : {})} {...(onOpenEditorial ? { onOpenEditorial } : {})} />
      <HouseAddOnEditor compact createCommandMeta={createAddOnsCommandMeta} editor={editor} gateway={gateway} onReload={onReload} onSaveActionChange={handleAddOnsSaveActionChange} onSaveState={handleAddOnsSaveState} />
      <div className="flex flex-col gap-2 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-slot="embedded-offering-actions"><div className="min-w-0"><p className="text-xs font-medium">{embeddedSave.state === "dirty" ? "Есть изменения" : embeddedSave.state === "saving" ? "Сохранение…" : embeddedSave.state === "conflict" ? "Данные изменились" : "Сохранено"}</p><p className="truncate text-[11px] text-muted-foreground">{embeddedSave.detail}</p></div><div className="flex shrink-0 items-center gap-2">{embeddedFooterActions}</div></div>
    </div>
  }

  return <EditorFrame footerActions={footerActions} navigation={navigation} saveDetail={activeSaveDetail} saveState={activeSaveState} sidebar={<OfferingSidebar editor={editor} />}>
    {content}
  </EditorFrame>
}

function WorkspaceLoading() {
  return <div aria-label="Загрузка редактора домика" className="space-y-3" role="status"><div className="overflow-hidden rounded-xl border bg-background"><LoadingRows count={4} /></div><div className="h-48 animate-pulse rounded-xl border bg-muted/30" /></div>
}

function WorkspaceState({ actionLabel, children, icon, onAction, title, tone = "neutral" }: { actionLabel?: string; children?: ReactNode; icon: ElementType; onAction?: () => void; title: string; tone?: "neutral" | "danger" }) {
  return <div className="rounded-xl border bg-background"><PageState {...(actionLabel ? { actionLabel } : {})} icon={icon} {...(onAction ? { onAction } : {})} title={title} tone={tone}>{children}</PageState></div>
}

function ResourceSaleHeader({ editor }: { editor: InternalOfferingEditor }) {
  const active = editor.priceBooks.find((book) => book.state === "active") ?? null
  const draft = editor.priceBooks.find((book) => book.state === "draft") ?? null
  const scheduled = editor.priceBooks.find((book) => book.state === "scheduled") ?? null
  const plan = (draft ?? active)?.ratePlans.find((item) => item.isDefault) ?? (draft ?? active)?.ratePlans[0] ?? null
  const quantity = plan?.includedQuantity ?? null
  const summary = plan
    ? `${minorMoney(plan.baseAmount, editor.offering.currency)} / ночь${quantity !== null ? ` · до ${quantity} гостей` : ""}${plan.baseExtraUnitAmount !== null ? ` · +${minorMoney(plan.baseExtraUnitAmount, editor.offering.currency)} за следующего` : ""}`
    : "Стоимость ещё не задана"
  const state = draft ? "Есть новые цены" : scheduled?.scheduledActivationAt ? `Изменятся ${compactDateTime(scheduled.scheduledActivationAt, scheduled.timezone)}` : active ? "Цены действуют" : "Не настроено"
  return <div className="flex flex-col gap-3 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center">
    <IconBox icon={IconCurrencyRuble} size="sm" variant={active ? "success" : "warning"} />
    <div className="min-w-0 flex-1"><p className="text-[13px] font-semibold">{summary}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Для каждой ночи применяется самая точная подходящая цена.</p></div>
    <StatusBadge tone={draft || scheduled ? "warning" : active ? "success" : "neutral"}>{state}</StatusBadge>
  </div>
}

function ResourceSiteCard({ editor, editorialHref, onOpenEditorial }: { editor: InternalOfferingEditor; editorialHref?: (nodeId: string) => string | null; onOpenEditorial?: (nodeId: string) => void }) {
  const locator = editor.editorial
  const href = locator ? editorialHref?.(locator.node.id) ?? null : null
  const revision = locator?.currentRevision ?? null
  const blockerCount = locator?.publication.blockers.length ?? 0
  const status = locator?.latestPublished ? "Опубликовано" : locator?.publication.eligible ? "Готово к публикации" : locator ? "Нужно дозаполнить" : "Не подготовлена"
  const tone = locator?.latestPublished ? "success" : locator?.publication.eligible ? "info" : "warning"
  return <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center" data-slot="resource-site-card">
    <IconBox icon={IconFileText} size="sm" variant={locator?.node.status === "archived" ? "neutral" : "info"} />
    <div className="min-w-0 flex-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2"><h2 className="text-xs font-semibold">Страница на сайте</h2><StatusBadge tone={tone}>{status}</StatusBadge></div>
      <p className="mt-1 truncate text-xs font-medium">{revision?.title ?? "Страница появится автоматически"}</p>
      <p className="mt-0.5 break-words text-[10px] text-muted-foreground sm:truncate">{revision?.path ?? "Тексты, фотографии и публикация настраиваются в CMS."}{blockerCount ? ` · Осталось задач: ${blockerCount}` : ""}</p>
    </div>
    {locator && onOpenEditorial ? <Button className="shrink-0" onClick={() => onOpenEditorial(locator.node.id)} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Редактировать страницу</Button> : locator && href ? <Button className="shrink-0" nativeButton={false} render={<a href={href} />} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Редактировать страницу</Button> : null}
  </section>
}

function OfferingOverview({ editor, editorialHref, kind, onOpenEditorial }: { editor: InternalOfferingEditor; editorialHref?: (nodeId: string) => string | null; kind: "house" | "campground"; onOpenEditorial?: (nodeId: string) => void }) {
  const { offering } = editor
  const campground = kind === "campground" && offering.fulfillment.kind === "campground" ? offering.fulfillment : null
  const subtypeLabel = campground?.salesUnit === "owned_tent" ? "Наша палатка · отдельный объект" : campground ? "Гостевая палатка · общая зона" : null
  const capacityLabel = campground?.salesUnit === "own_tent_pitch" ? "Палаточных мест" : "Гостей"
  const OfferingIcon = kind === "campground" ? IconTent : IconBuildingCottage
  const primary = editor.bindings.find((binding) => binding.role === "primary")
  const primaryTarget = primary?.target.type === "resource" ? editor.bindingTargets.find((target) => target.id === primary.target.id) ?? null : null
  const activeBook = editor.priceBooks.find((book) => book.state === "active") ?? null
  const pricingReady = Boolean(primary && activeBook && editor.capabilities.canPreviewQuote)
  return <div className="space-y-3">
    <SummaryMetricStrip ariaLabel="Сводка предложения">
      <SummaryMetric icon={OfferingIcon} label="Состояние" tone={offering.state === "active" ? "success" : offering.state === "archived" ? "neutral" : "warning"} value={priceBookLabelForOffering(offering.state)}><span className="font-mono">{offering.code}</span></SummaryMetric>
      <SummaryMetric icon={IconTag} label="Продажа" tone="stay" value={salesModeLabel[offering.salesMode]}>{priceDisplayLabel[offering.priceDisplayMode]}</SummaryMetric>
      <SummaryMetric icon={IconCurrencyRuble} label="Готовность цены" tone={pricingReady ? "success" : "warning"} value={pricingReady ? "Готово" : "Настроить"}>{activeBook ? `${activeBook.name} · ред. ${activeBook.revision}` : "Нет активного прайс-листа"}</SummaryMetric>
      <SummaryMetric icon={IconLink} label="Исполнение" tone={primary ? "info" : "warning"} value={primary ? bindingTargetLabel[primary.target.type] : "Не связано"}>{primary ? `${capacityLabel} ${primaryTarget?.capacity.total ?? "—"} · связанных ресурсов ${editor.bindings.length}` : "Добавьте основной ресурс"}</SummaryMetric>
    </SummaryMetricStrip>
    <EditorSection title="Предложение">
      <div className="flex flex-wrap items-center gap-3 border-b pb-4">
        <IconBox icon={kind === "campground" ? IconTent : IconHome} size="lg" variant={kind === "campground" ? "info" : "resourceHouses"} />
        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">{offering.operationalName}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{offering.code}</p></div>
        {subtypeLabel ? <StatusBadge tone="info">{subtypeLabel}</StatusBadge> : null}<StatusBadge tone={offering.state === "active" ? "success" : offering.state === "archived" ? "neutral" : "warning"}>{priceBookLabelForOffering(offering.state)}</StatusBadge>
      </div>
      <dl className="grid gap-x-6 gap-y-4 pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
        <Detail label="Валюта" value={offering.currency} />
        <Detail label="Часовой пояс" value={offering.timezone} />
        <Detail label="Налоги" value={taxModeLabel[offering.taxMode]} />
        <Detail label="Расчёт проживания" value={offering.fulfillment.kind === "house" || offering.fulfillment.kind === "campground" ? "По каждой ночи" : "По условиям предложения"} />
      </dl>
    </EditorSection>
    <EditorSection subtitle="Ресурс и доступность принадлежат operational-контуру CRM." title="Исполнение">
      {primary ? <div className="flex flex-col gap-3 border-y py-3 sm:flex-row sm:items-center">
        <IconBox icon={IconLink} size="sm" variant="info" />
        <div className="min-w-0 flex-1"><p className="text-xs font-medium">{primaryTarget?.name ?? "Сводка ресурса недоступна"}</p><p className="truncate font-mono text-[10px] text-muted-foreground">{primaryTarget ? `${primaryTarget.code} · ${capacityLabel}: ${primaryTarget.capacity.total} · ${primaryTarget.capacity.mode === "shared" ? "общая" : "фиксированная"}` : "Обновите состав, чтобы получить безопасную сводку ресурса."}</p>{primaryTarget?.archived ? <StatusBadge tone="warning">Ресурс в архиве</StatusBadge> : null}</div>
        <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground"><span className="rounded-md bg-muted px-2 py-1">Количество: {primary.defaultQuantity}</span><span className="rounded-md bg-muted px-2 py-1">Влияние: {primary.defaultCapacityImpact}</span><span className="rounded-md bg-muted px-2 py-1">Подготовка: {primary.preparationBeforeMinutes + primary.preparationAfterMinutes} мин</span><span className="rounded-md bg-muted px-2 py-1">{primary.availabilityRequired ? "Проверка доступности" : "Без проверки доступности"}</span></div>
      </div> : <PageState icon={IconAlertTriangle} title="Основная привязка не задана" tone="warning">{kind === "campground" ? "Кемпинг нельзя безопасно рассчитывать без основного ресурса." : "Домик нельзя безопасно рассчитывать без основного ресурса."}</PageState>}
    </EditorSection>
    <OfferingEditorialSummary editor={editor} {...(editorialHref ? { editorialHref } : {})} {...(onOpenEditorial ? { onOpenEditorial } : {})} />
    <EditorSection title="Прайс-листы">
      {editor.priceBooks.length ? <div className="divide-y rounded-lg border">{editor.priceBooks.map((book) => <PriceBookSummary book={book} key={book.id} />)}</div> : <PageState icon={IconCalendar} title="Прайс-листов ещё нет">Создайте черновик на вкладке «Цены».</PageState>}
    </EditorSection>
  </div>
}

const editorialRevisionLabel = { approved: "Одобрено", draft: "Черновик", published: "Опубликовано", review: "На проверке", scheduled: "Запланировано" } as const
const editorialBlockerLabel = {
  cms_node_archived: "Страница в архиве",
  cms_node_kind_incompatible: "Тип страницы не подходит этому ресурсу",
  offering_not_active: "Ресурс не активен для продажи",
  public_profile_mismatch: "Настройки сайта связаны с другой записью",
  public_profile_missing: "Показ на сайте не настроен",
  revision_relation_mismatch: "Страница связана с другой версией данных",
  revision_relation_missing: "Страница ещё не связана с рабочей версией",
  safe_public_projection_missing: "Данные для сайта ещё не подготовлены",
} as const

/** Locator summary only. Marketing fields remain in the canonical CMS editor. */
function OfferingEditorialSummary({ editor, editorialHref, onOpenEditorial }: { editor: InternalOfferingEditor; editorialHref?: (nodeId: string) => string | null; onOpenEditorial?: (nodeId: string) => void }) {
  const locator = editor.editorial
  if (!locator) return <EditorSection subtitle="Здесь будут тексты, фото, SEO и статус публикации." title="Страница на сайте">
    <PageState icon={IconFileText} title="Страница ещё не подготовлена">Сохраните ресурс или повторите подготовку выше. Система свяжет страницу автоматически.</PageState>
  </EditorSection>

  const revision = locator.currentRevision
  const href = editorialHref?.(locator.node.id) ?? null
  const archived = locator.node.status === "archived"
  return <EditorSection
    actions={<StatusBadge tone={locator.publication.eligible ? "success" : "warning"}>{locator.publication.eligible ? "Готово к публикации" : "Нужно дозаполнить"}</StatusBadge>}
    subtitle="Тексты, фото, SEO и публикация редактируются в одной связанной странице."
    title="Страница на сайте"
  >
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center">
      <IconBox icon={IconFileText} size="sm" variant={archived ? "neutral" : "info"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{revision?.title ?? "CMS-черновик без рабочей редакции"}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{revision?.path ?? "Маршрут ещё не подготовлен"}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
          {revision ? <StatusBadge tone={revision.state === "published" ? "success" : revision.state === "draft" ? "warning" : "info"}>{editorialRevisionLabel[revision.state]}</StatusBadge> : <StatusBadge tone="warning">Нет редакции</StatusBadge>}
          <span className="rounded-md bg-muted px-2 py-1">CMS v{locator.node.version}</span>
          {locator.latestPublished ? <span className="rounded-md bg-muted px-2 py-1">На сайте: ред. {locator.latestPublished.revision}</span> : <span className="rounded-md bg-muted px-2 py-1">Ещё не публиковалось</span>}
        </div>
      </div>
      {onOpenEditorial ? <Button onClick={() => onOpenEditorial(locator.node.id)} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Редактировать страницу</Button> : href ? <Button nativeButton={false} render={<a href={href} />} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Редактировать страницу</Button> : null}
    </div>
    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Блокировки публикации">{locator.publication.blockers.map((blocker) => <span className="rounded-md bg-warning-subtle px-2 py-1 text-[10px] text-warning-foreground" key={blocker}>{editorialBlockerLabel[blocker]}</span>)}</div>
  </EditorSection>
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] text-muted-foreground">{label}</dt><dd className="mt-1 text-xs font-medium">{value}</dd></div> }
function priceBookLabelForOffering(state: InternalOfferingEditor["offering"]["state"]) { return { active: "Активно", archived: "В архиве", draft: "Черновик", paused: "Приостановлено" }[state] }
function PriceBookSummary({ book }: { book: PriceBook }) { return <div className={book.state === "active" ? "flex items-center gap-3 border-l-2 border-l-success px-3 py-2.5" : "flex items-center gap-3 px-3 py-2.5"}><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{book.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{compactDate(book.validFrom)} — {book.validToExclusive ? compactDate(book.validToExclusive) : "без срока"} · {book.ratePlans.length} тарифов · редакция {book.revision}</p></div><StatusBadge tone={priceBookTone[book.state]}>{priceBookLabel[book.state]}</StatusBadge></div> }

function OfferingSidebar({ editor }: { editor: InternalOfferingEditor }) {
  const { capabilities, ownerVersions, offering } = editor
  return <div className="space-y-3">
    <EditorSection title="Доступ"><div className="space-y-2 text-xs"><p>{capabilities.pricing.canEditDraft ? "Можно редактировать черновик цен." : "Прайс-лист доступен только для просмотра."}</p><p>{capabilities.canPreviewQuote ? "Проверка стоимости доступна." : "Расчёт появится после настройки предложения."}</p>{offering.state === "archived" ? <p className="flex items-center gap-1 text-muted-foreground"><IconLock aria-hidden="true" className="size-3" />Архивная запись</p> : null}</div></EditorSection>
    <EditorSection title="Технические данные"><dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><Detail label="Каталог" value={String(ownerVersions.catalog)} /><Detail label="Источник" value={String(ownerVersions.subject.aggregateVersion)} /><Detail label="Цены" value={String(ownerVersions.pricing)} /><Detail label="Допы" value={String(ownerVersions.addOnAssignments)} /></dl></EditorSection>
  </div>
}

export function OfferingPricingWorkspace({ createCommandMeta, editor, gateway, kind, onReload, onSaveActionChange, onSaveState, resourceView = false }: { createCommandMeta: OfferingEditorCommandMetaFactory; editor: InternalOfferingEditor; gateway: OfferingEditorGateway; kind: "house" | "campground" | "addon"; onReload: () => Promise<void>; onSaveActionChange?: (action: (() => void) | null) => void; onSaveState: (state: SaveState, detail: string) => void; resourceView?: boolean }) {
  const draft = draftPriceBook(editor)
  const source = useMemo(() => draft ?? priceBookSource(editor), [draft, editor])
  const addOnConstraint = useMemo<AddOnPricingConstraint | null>(() => {
    if (kind !== "addon" || !editor.addOnTerms) return null
    return editor.addOnTerms.serviceType === "quantity_service"
      ? { basis: "per_unit", metric: "units" }
      : editor.addOnTerms.serviceType === "person_service"
        ? { basis: "per_person", metric: "participants" }
        : null
  }, [editor.addOnTerms, kind])
  const initialForm = useMemo(() => constrainAddOnPricingForm(
    draft ? priceBookToDraftForm(draft) : createDraftPriceBookForm(priceBookSource(editor), serviceDateInTimezone(editor.offering.timezone)),
    addOnConstraint,
  ), [addOnConstraint, draft, editor])
  const [form, setForm] = useState<DraftPriceBookForm>(initialForm)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveConflict, setSaveConflict] = useState(false)
  const commandMeta = useRef<ReturnType<OfferingEditorCommandMetaFactory> | null>(null)
  const localDraftDirty = useRef(false)
  const saveRef = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    if (shouldPreserveLocalPricingDraft(localDraftDirty.current, saveConflict)) return
    setForm(initialForm)
    setSaveError(null)
    commandMeta.current = null
  }, [initialForm, saveConflict])

  const writable = editor.capabilities.pricing.canEditDraft
  const update = (patch: Partial<DraftPriceBookForm>) => {
    if (!canEditPricingDraft(writable, saveConflict)) return
    localDraftDirty.current = true
    commandMeta.current = null
    setForm((current) => ({ ...current, ...patch }))
    setSaveError(null)
    onSaveState("dirty", "Черновик цен изменён")
  }
  const updateRatePlan = (index: number, patch: Partial<RatePlanDraft>) => {
    if (!canEditPricingDraft(writable, saveConflict)) return
    localDraftDirty.current = true
    commandMeta.current = null
    setForm((current) => ({ ...current, ratePlans: current.ratePlans.map((plan, currentIndex) => currentIndex === index ? { ...plan, ...patch } : plan) }))
    setSaveError(null)
    onSaveState("dirty", "Черновик цен изменён")
  }
  const save = async () => {
    if (!canEditPricingDraft(writable, saveConflict)) return
    setSaveError(null)
    setSaveConflict(false)
    onSaveState("saving", "Проверяем и сохраняем правила")
    try {
      const meta = commandMeta.current ?? createCommandMeta()
      commandMeta.current = meta
      const saved = draft
        ? await gateway.replaceDraftPriceBook(editor.offering.id, draft.id, buildReplaceDraftPriceBookBody(form, meta))
        : await gateway.createDraftPriceBook(editor.offering.id, buildCreateDraftPriceBookBody(form, meta, source?.id ?? null))
      if (kind === "addon" && editor.capabilities.pricing.canActivate) {
        const activationMeta = createCommandMeta()
        await gateway.activatePriceBook(editor.offering.id, saved.priceBook.id, {
          ...activationMeta,
          expectedPricingVersion: saved.pricingVersion,
          reason: "Цена изменена в CRM",
        })
      }
      localDraftDirty.current = false
      commandMeta.current = null
      onSaveState("saved", kind === "addon" && editor.capabilities.pricing.canActivate ? "Цена сохранена и уже действует" : "Черновик сохранён")
      await onReload()
    } catch (mutationError) {
      const message = offeringEditorErrorMessage(mutationError, "Не удалось сохранить черновик цен.")
      const conflict = isOfferingEditorConflict(mutationError)
      setSaveError(message)
      setSaveConflict(conflict)
      onSaveState(conflict ? "conflict" : "dirty", message)
    }
  }
  useEffect(() => {
    if (!onSaveActionChange) return
    const action = () => { void saveRef.current() }
    onSaveActionChange(action)
    return () => onSaveActionChange(null)
  }, [onSaveActionChange])

  const reloadServer = async () => {
    try {
      await onReload()
      commandMeta.current = null
      setSaveError(null)
      setSaveConflict(false)
      onSaveState("dirty", "Версия сервера обновлена; локальный черновик сохранён для сравнения")
    } catch (reloadError) {
      setSaveError(offeringEditorErrorMessage(reloadError, "Не удалось обновить версию сервера."))
    }
  }
  saveRef.current = saveConflict ? reloadServer : save
  const serverDraft = draft ?? null

  if (resourceView && kind !== "addon") {
    const plan = form.ratePlans[0] ?? null
    const legacyMultiplePlans = form.ratePlans.length > 1
    const setPlan = (patch: Partial<RatePlanDraft>) => {
      if (plan) updateRatePlan(0, patch)
      else update({ ratePlans: [{ ...createEmptyRatePlan(), ...patch }] })
    }
    return <div className="space-y-3" data-slot="resource-pricing-layout">
      {!writable ? <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-subtle p-3 text-xs text-warning-foreground"><IconLock aria-hidden="true" className="mt-0.5 size-4" /><div><p className="font-semibold">Только просмотр</p><p className="mt-0.5">У вас нет права изменять цены.</p></div></div> : null}
      {saveError && !saveConflict ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Цены не сохранены" tone="danger">{saveError}</PageState></div> : null}
      {saveConflict ? <div className="rounded-xl border border-danger/25 bg-danger-subtle/20 p-4 text-xs" data-slot="pricing-conflict-comparison"><p className="font-semibold">Цены уже изменил другой пользователь</p><p className="mt-1 text-muted-foreground">Обновите данные; введённые значения останутся в форме для сравнения.</p></div> : null}
      {legacyMultiplePlans ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Нужно объединить старые цены" tone="danger">У ресурса найдено несколько устаревших тарифов. Обычное редактирование заблокировано, чтобы не потерять данные.</PageState></div> : <>
        <ResourceBasePrice editor={editor} disabled={!writable || saveConflict} kind={kind} onChange={setPlan} plan={plan ?? createEmptyRatePlan()} />
        <ResourceSpecialPrices disabled={!writable || saveConflict} onChange={(rules) => setPlan({ rules })} plan={plan ?? createEmptyRatePlan()} timezone={editor.offering.timezone} />
        <div className="grid items-start gap-3 xl:grid-cols-2" data-slot="resource-pricing-operations">
          <PriceBookLifecycle compact createCommandMeta={createCommandMeta} draftDirty={localDraftDirty.current} editor={editor} gateway={gateway} onReload={onReload} />
          <QuoteSimulator compact createCommandMeta={createCommandMeta} editor={editor} gateway={gateway} kind={kind} />
        </div>
      </>}
    </div>
  }

  if (kind === "addon") {
    const plan = form.ratePlans[0] ?? constrainAddOnRatePlan(createEmptyRatePlan(), addOnConstraint)
    const legacyMultiplePlans = form.ratePlans.length > 1
    const setPlan = (patch: Partial<RatePlanDraft>) => {
      if (form.ratePlans[0]) updateRatePlan(0, patch)
      else update({ ratePlans: [{ ...plan, ...patch, isDefault: true }] })
    }
    const unit = addOnConstraint?.metric === "participants" ? "участника" : "единицу"
    return <div className="space-y-3" data-slot="addon-simple-pricing">
      {!writable ? <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-subtle p-3 text-xs text-warning-foreground"><IconLock aria-hidden="true" className="mt-0.5 size-4" /><div><p className="font-semibold">Только просмотр</p><p className="mt-0.5">У вас нет права изменять цену.</p></div></div> : null}
      {saveError && !saveConflict ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Цена не сохранена" tone="danger">{saveError}</PageState></div> : null}
      {saveConflict ? <div className="rounded-xl border border-danger/25 bg-danger-subtle/20 p-4 text-xs" data-slot="pricing-conflict-comparison"><p className="font-semibold">Цену уже изменил другой пользователь</p><p className="mt-1 text-muted-foreground">Обновите данные; введённая цена останется в форме для сравнения.</p></div> : null}
      {legacyMultiplePlans ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Нужно объединить старые тарифы" tone="danger">У услуги найдено несколько старых тарифов. Автоматически выбирать один из них небезопасно.</PageState></div> : <EditorSection subtitle={`Стоимость за ${unit}. После сохранения новая цена сразу начинает действовать.`} title="Цена"><div className="grid max-w-xl items-end gap-3 rounded-lg bg-muted/25 p-3 sm:grid-cols-[minmax(180px,240px)_1fr]"><FormField htmlFor="addon-base-price" label={`Цена за ${unit}, ₽`}><Input disabled={!writable || saveConflict} id="addon-base-price" min="0" onChange={(event) => setPlan({ baseAmount: majorMoneyToMinor(event.target.value), isDefault: true })} step="0.01" type="number" value={minorMoneyToMajor(plan.baseAmount)} /></FormField><p className="pb-2 text-xs text-muted-foreground">Без прайс-листов, ручной активации и нескольких тарифов.</p></div></EditorSection>}
    </div>
  }

  return <div className="space-y-3">
    {!writable ? <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-subtle p-3 text-xs text-warning-foreground"><IconLock aria-hidden="true" className="mt-0.5 size-4" /><div><p className="font-semibold">Только просмотр</p><p className="mt-0.5">У вас нет права изменять черновик цен. Проверка стоимости остаётся доступной, если предложение готово к расчёту.</p></div></div> : null}
    {saveError && !saveConflict ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Черновик не сохранён" tone="danger">{saveError}</PageState></div> : null}
    {saveConflict ? <div className="rounded-xl border border-danger/25 bg-danger-subtle/20 p-4 text-xs" data-slot="pricing-conflict-comparison"><div className="flex items-start gap-2"><IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-foreground" /><div><p className="font-semibold">Версия прайс-листа изменилась</p><p className="mt-1 text-muted-foreground">Редактирование приостановлено. Локальный черновик сохранён в форме; обновите серверную версию из нижней панели, чтобы продолжить.</p></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border bg-background p-3"><p className="font-medium">Локальный черновик</p><p className="mt-1">{form.name} · причина: {form.changeReason || "не указана"}</p></div><div className="rounded-lg border bg-background p-3"><p className="font-medium">Версия сервера</p><p className="mt-1">{serverDraft ? `${serverDraft.name} · причина: ${serverDraft.changeReason || "не указана"}` : "Черновика на сервере нет"}</p></div></div></div> : null}
    <EditorSection title={draft ? "Черновик прайс-листа" : "Новый черновик прайс-листа"}>
      <div className="grid items-end gap-4 sm:grid-cols-12"><FormField className="sm:col-span-6" htmlFor="price-book-name" label="Название"><Input disabled={!writable || saveConflict} id="price-book-name" onChange={(event) => update({ name: event.target.value })} value={form.name} /></FormField><FormField className="sm:col-span-3" htmlFor="price-book-from" label="С даты"><Input disabled={!writable || saveConflict} id="price-book-from" onChange={(event) => update({ validFrom: event.target.value })} type="date" value={form.validFrom} /></FormField><FormField className="sm:col-span-3" htmlFor="price-book-to" label="До даты (не включая)"><Input disabled={!writable || saveConflict} id="price-book-to" onChange={(event) => update({ validToExclusive: event.target.value })} type="date" value={form.validToExclusive} /></FormField><FormField className="sm:col-span-8" htmlFor="price-book-reason" label="Причина изменения"><Input disabled={!writable || saveConflict} id="price-book-reason" onChange={(event) => update({ changeReason: event.target.value })} value={form.changeReason} /></FormField></div>
    </EditorSection>
    <EditorSection actions={writable ? <Button disabled={saveConflict} onClick={() => update({ ratePlans: [...form.ratePlans, constrainAddOnRatePlan({ ...createEmptyRatePlan(), displayOrder: form.ratePlans.length, isDefault: false, key: `tariff_${form.ratePlans.length + 1}`, label: `Тариф ${form.ratePlans.length + 1}` }, addOnConstraint)] })} size="sm" variant="outline"><IconPlus aria-hidden="true" />Тариф</Button> : null} subtitle={addOnConstraint ? "Основа и единица тарифа зафиксированы operational terms; календарные правила передаются без потерь." : "Правила календарных дат не редактируются здесь и передаются обратно без потерь."} title="Тарифы">
      <div className="space-y-3">{form.ratePlans.map((plan, index) => <RatePlanEditor constraint={addOnConstraint} currency={editor.offering.currency} disabled={!writable || saveConflict} index={index} key={plan.id ?? `new-${index}`} onChange={(patch) => updateRatePlan(index, patch)} plan={plan} />)}</div>
    </EditorSection>
    <PriceBookLifecycle createCommandMeta={createCommandMeta} draftDirty={localDraftDirty.current} editor={editor} gateway={gateway} onReload={onReload} />
    <QuoteSimulator createCommandMeta={createCommandMeta} editor={editor} gateway={gateway} kind={kind} />
  </div>
}

function PricingWorkspace(props: Parameters<typeof OfferingPricingWorkspace>[0]) { return <OfferingPricingWorkspace {...props} /> }

function constrainAddOnPricingForm(form: DraftPriceBookForm, constraint: AddOnPricingConstraint | null): DraftPriceBookForm {
  if (!constraint) return form
  return { ...form, ratePlans: form.ratePlans.map((plan) => constrainAddOnRatePlan(plan, constraint)) }
}

function constrainAddOnRatePlan(plan: RatePlanDraft, constraint: AddOnPricingConstraint | null): RatePlanDraft {
  if (!constraint) return plan
  return { ...plan, pricingBasis: constraint.basis, quantityMetric: constraint.metric, includedQuantity: null, baseExtraUnitAmount: null, minQuantity: null, maxQuantity: null }
}

const pricingWeekdays: Array<{ label: string; value: PriceWeekday }> = [
  { label: "Пн", value: "mon" }, { label: "Вт", value: "tue" }, { label: "Ср", value: "wed" }, { label: "Чт", value: "thu" },
  { label: "Пт", value: "fri" }, { label: "Сб", value: "sat" }, { label: "Вс", value: "sun" },
]

function ResourceBasePrice({ disabled, editor, kind, onChange, plan }: { disabled: boolean; editor: InternalOfferingEditor; kind: "house" | "campground"; onChange: (patch: Partial<RatePlanDraft>) => void; plan: RatePlanDraft }) {
  const pitch = kind === "campground" && editor.offering.fulfillment.kind === "campground" && editor.offering.fulfillment.salesUnit === "own_tent_pitch"
  const updateIncluded = (value: string) => {
    const includedQuantity = numberOrNull(value)
    onChange({ includedQuantity, quantityMetric: includedQuantity === null && plan.baseExtraUnitAmount === null ? null : "guests" })
  }
  const updateExtra = (value: string) => {
    const baseExtraUnitAmount = value.trim() === "" ? null : majorMoneyToMinor(value)
    onChange({ baseExtraUnitAmount, quantityMetric: baseExtraUnitAmount === null && plan.includedQuantity === null ? null : "guests" })
  }
  return <EditorSection subtitle={pitch ? "Стоимость одного палаточного места за одну ночь." : "Одна понятная формула вместо набора тарифов."} title="Основная цена">
    <div className={pitch ? "grid max-w-[220px] items-end" : "grid items-end gap-3 rounded-lg bg-muted/25 p-3 md:grid-cols-[minmax(180px,220px)_minmax(100px,130px)_minmax(180px,220px)]"} data-slot="resource-base-price-formula">
      <FormField className="min-w-0" htmlFor="resource-base-price" label={pitch ? "Цена за место и ночь, ₽" : "Цена за ночь, ₽"}><Input disabled={disabled} id="resource-base-price" min="0" onChange={(event) => onChange({ baseAmount: majorMoneyToMinor(event.target.value), isDefault: true, pricingBasis: "per_night", ...(pitch ? { quantityMetric: "units", includedQuantity: null, baseExtraUnitAmount: null } : {}) })} step="0.01" type="number" value={minorMoneyToMajor(plan.baseAmount)} /></FormField>
      {!pitch ? <><FormField className="min-w-0" htmlFor="resource-included-guests" label="Гостей включено"><Input disabled={disabled} id="resource-included-guests" min="0" onChange={(event) => updateIncluded(event.target.value)} placeholder="—" type="number" value={plan.includedQuantity ?? ""} /></FormField><FormField className="min-w-0" htmlFor="resource-extra-guest-price" label="За следующего гостя, ₽"><Input disabled={disabled} id="resource-extra-guest-price" min="0" onChange={(event) => updateExtra(event.target.value)} placeholder="Без доплаты" step="0.01" type="number" value={plan.baseExtraUnitAmount === null ? "" : minorMoneyToMajor(plan.baseExtraUnitAmount)} /></FormField></> : null}
    </div>
  </EditorSection>
}

function newSpecialPrice(type: "weekdays" | "holiday" | "period", amount: number, timezone: string): PriceRuleDraft {
  const today = serviceDateInTimezone(timezone)
  const common = { amount, bookingLeadDays: null, durationMinutes: null, enabled: true, extraUnitAmount: null, priority: 0, quantityRange: null, reason: "" }
  if (type === "weekdays") return { ...common, dateSelector: { type: "recurring_weekdays", days: ["fri", "sat", "sun"] } }
  if (type === "holiday") return { ...common, dateSelector: { type: "calendar_holiday" } }
  return { ...common, dateSelector: { type: "custom_date_override", from: today, toExclusive: incrementDateOnly(today), label: "Особый период" } }
}

function ResourceSpecialPrices({ disabled, onChange, plan, timezone }: { disabled: boolean; onChange: (rules: PriceRuleDraft[]) => void; plan: RatePlanDraft; timezone: string }) {
  const updateRule = (index: number, patch: Partial<PriceRuleDraft>) => onChange(plan.rules.map((rule, current) => current === index ? { ...rule, ...patch } : rule))
  const hasHoliday = plan.rules.some((rule) => rule.dateSelector.type === "calendar_holiday")
  const hasWeekdays = plan.rules.some((rule) => rule.dateSelector.type === "recurring_weekdays" || rule.dateSelector.type === "day_class")
  return <EditorSection
    actions={<div className="flex flex-wrap gap-1.5"><Button disabled={disabled || hasWeekdays} onClick={() => onChange([...plan.rules, newSpecialPrice("weekdays", plan.baseAmount, timezone)])} size="sm" variant="outline">Дни недели</Button><Button disabled={disabled || hasHoliday} onClick={() => onChange([...plan.rules, newSpecialPrice("holiday", plan.baseAmount, timezone)])} size="sm" variant="outline">Праздники</Button><Button disabled={disabled} onClick={() => onChange([...plan.rules, newSpecialPrice("period", plan.baseAmount, timezone)])} size="sm" variant="outline">Особый период</Button></div>}
    subtitle="Добавляйте только исключения из основной цены. Новый год можно задать отдельным периодом."
    title="Особые цены"
  >
    {plan.rules.length ? <div className="space-y-2" data-slot="resource-special-price-list">{plan.rules.map((rule, index) => <ResourceSpecialPriceRow controlId={rule.id ?? `new-${index}`} disabled={disabled} key={rule.id ?? `${rule.dateSelector.type}-${index}`} onChange={(patch) => updateRule(index, patch)} onDelete={() => onChange(plan.rules.filter((_, current) => current !== index))} rule={rule} />)}</div> : <div className="rounded-lg border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">Во все дни действует основная цена.</div>}
    <p className="mt-3 text-[10px] text-muted-foreground">Приоритет: особый период → праздник → день недели → основная цена.</p>
  </EditorSection>
}

function ResourceSpecialPriceRow({ controlId, disabled, onChange, onDelete, rule }: { controlId: string; disabled: boolean; onChange: (patch: Partial<PriceRuleDraft>) => void; onDelete: () => void; rule: PriceRuleDraft }) {
  const selector = rule.dateSelector
  const selectedDays: PriceWeekday[] = selector.type === "recurring_weekdays" ? [...selector.days] : selector.type === "day_class" ? selector.dayClass === "weekend" ? ["sat", "sun"] : ["mon", "tue", "wed", "thu", "fri"] : []
  const toggleDay = (day: PriceWeekday) => {
    const days = selectedDays.includes(day) ? selectedDays.filter((item) => item !== day) : pricingWeekdays.map((item) => item.value).filter((item) => [...selectedDays, day].includes(item))
    if (days.length) onChange({ dateSelector: { type: "recurring_weekdays", days } })
  }
  const typeLabel = selector.type === "custom_date_override" ? "Особый период" : selector.type === "calendar_holiday" ? "Праздники" : selector.type === "recurring_weekdays" || selector.type === "day_class" ? "Дни недели" : "Другое правило"
  return <div className="grid min-w-0 items-end gap-3 rounded-lg border bg-background p-3 lg:grid-cols-[minmax(110px,0.55fr)_minmax(300px,1.8fr)_minmax(160px,200px)_auto]" data-slot="resource-special-price-row">
    <div className="min-w-0 self-start"><p className="truncate text-xs font-semibold">{typeLabel}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{selector.type === "custom_date_override" ? "Выше праздников" : selector.type === "calendar_holiday" ? "По календарю" : "Повторяется еженедельно"}</p></div>
    <div className="min-w-0">
      {selector.type === "recurring_weekdays" || selector.type === "day_class" ? <fieldset><legend className="sr-only">Выберите дни недели</legend><div className="flex flex-wrap gap-1">{pricingWeekdays.map((day) => <Button aria-pressed={selectedDays.includes(day.value)} disabled={disabled} key={day.value} onClick={() => toggleDay(day.value)} size="sm" variant={selectedDays.includes(day.value) ? "secondary" : "outline"}>{day.label}</Button>)}</div></fieldset> : selector.type === "calendar_holiday" ? <p className="break-words text-[11px] leading-4 text-muted-foreground">Все даты, отмеченные праздничными в производственном календаре.</p> : selector.type === "custom_date_override" ? <div className="grid min-w-0 gap-2 min-[420px]:grid-cols-[minmax(120px,1fr)_minmax(125px,0.8fr)_minmax(125px,0.8fr)]"><FormField className="min-w-0" htmlFor={`rule-label-${controlId}`} label="Название"><Input className="min-w-0" disabled={disabled} id={`rule-label-${controlId}`} onChange={(event) => onChange({ dateSelector: { ...selector, label: event.target.value } })} value={selector.label} /></FormField><FormField className="min-w-0" htmlFor={`rule-from-${controlId}`} label="С"><Input disabled={disabled} id={`rule-from-${controlId}`} onChange={(event) => onChange({ dateSelector: { ...selector, from: event.target.value } })} type="date" value={selector.from} /></FormField><FormField className="min-w-0" htmlFor={`rule-to-${controlId}`} label="По"><Input disabled={disabled} id={`rule-to-${controlId}`} onChange={(event) => onChange({ dateSelector: { ...selector, toExclusive: event.target.value ? incrementDateOnly(event.target.value) : "" } })} type="date" value={selector.toExclusive ? incrementDateOnly(selector.toExclusive, -1) : ""} /></FormField></div> : <p className="break-words text-[11px] text-muted-foreground">Системное условие сохранится без потерь.</p>}
    </div>
    <FormField className="min-w-0" htmlFor={`rule-amount-${controlId}`} label="Цена за ночь, ₽"><Input disabled={disabled} id={`rule-amount-${controlId}`} min="0" onChange={(event) => onChange({ amount: majorMoneyToMinor(event.target.value) })} step="0.01" type="number" value={rule.amount === null ? "" : minorMoneyToMajor(rule.amount)} /></FormField>
    <Button aria-label={`Удалить особую цену «${typeLabel}»`} className="justify-self-end lg:self-end" disabled={disabled} onClick={onDelete} size="icon-sm" variant="ghost"><IconTrash aria-hidden="true" /></Button>
  </div>
}

function RatePlanEditor({ constraint, currency, disabled, index, onChange, plan }: { constraint: AddOnPricingConstraint | null; currency: string; disabled: boolean; index: number; onChange: (patch: Partial<RatePlanDraft>) => void; plan: RatePlanDraft }) {
  const controlId = plan.id ?? `new-${index}`
  const quantityLabel = plan.quantityMetric ? quantityMetricLabel[plan.quantityMetric] : "единицу"
  const updateQuantity = (key: "includedQuantity" | "baseExtraUnitAmount", value: string) => {
    const next = numberOrNull(value)
    const other = key === "includedQuantity" ? plan.baseExtraUnitAmount : plan.includedQuantity
    onChange({ [key]: next, quantityMetric: next === null && other === null ? null : plan.quantityMetric ?? "guests" })
  }
  return <article className="overflow-hidden rounded-xl border bg-background">
    <header className="flex flex-wrap items-center gap-2 border-b px-3 py-2.5">
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">Тариф {index + 1} · {plan.label}</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{plan.key}</p></div>
      {plan.isDefault ? <StatusBadge tone="success">По умолчанию</StatusBadge> : null}
      <StatusBadge tone="neutral">Правил дат: {plan.rules.length}</StatusBadge>
    </header>
    <div className="border-b bg-muted/30 px-3 py-2.5 text-xs"><span className="font-semibold">{minorMoney(plan.baseAmount, currency)}</span> / {pricingBasisShortLabel[plan.pricingBasis]}{plan.includedQuantity !== null ? ` · включено ${plan.includedQuantity} ${quantityLabel}` : ""}{plan.baseExtraUnitAmount !== null ? ` · далее +${minorMoney(plan.baseExtraUnitAmount, currency)} / ${quantityLabel}` : ""}</div>
    <div className="grid items-end gap-3 p-3 sm:grid-cols-6 lg:grid-cols-12">
      <FormField className="sm:col-span-3 lg:col-span-4" htmlFor={`rate-label-${controlId}`} label="Название"><Input disabled={disabled} id={`rate-label-${controlId}`} onChange={(event) => onChange({ label: event.target.value })} value={plan.label} /></FormField>
      <FormField className="sm:col-span-3 lg:col-span-3" htmlFor={`rate-basis-${controlId}`} label="Основа"><FormSelect disabled={disabled || Boolean(constraint)} id={`rate-basis-${controlId}`} label="Основа тарифа" onValueChange={(value) => onChange({ pricingBasis: value as PricingBasis })} options={constraint ? pricingBasisOptions.filter((option) => option.value === constraint.basis) : pricingBasisOptions} value={plan.pricingBasis} /></FormField>
      <FormField className="sm:col-span-3 lg:col-span-3" htmlFor={`rate-base-${controlId}`} label={`Базовая цена, ${currency}`}><Input disabled={disabled} id={`rate-base-${controlId}`} min="0" onChange={(event) => onChange({ baseAmount: majorMoneyToMinor(event.target.value) })} step="0.01" type="number" value={minorMoneyToMajor(plan.baseAmount)} /></FormField>
      <FormField className="sm:col-span-3 lg:col-span-2" htmlFor={`rate-key-${controlId}`} label="Системный ключ"><Input className="font-mono text-xs" disabled={disabled} id={`rate-key-${controlId}`} onChange={(event) => onChange({ key: event.target.value })} value={plan.key} /></FormField>
      <FormField className="sm:col-span-3 lg:col-span-3" htmlFor={`rate-metric-${controlId}`} label={constraint ? "Единица тарифа" : "Единица включения"}><FormSelect disabled={disabled || Boolean(constraint)} id={`rate-metric-${controlId}`} label="Единица тарифа" onValueChange={(value) => onChange({ quantityMetric: value === "none" ? null : value as RatePlanDraft["quantityMetric"] })} options={constraint ? metricOptions.filter((option) => option.value === constraint.metric) : metricOptions} value={plan.quantityMetric ?? "none"} /></FormField>
      {!constraint ? <><FormField className="sm:col-span-3 lg:col-span-2" htmlFor={`rate-included-${controlId}`} label="Включено"><Input disabled={disabled} id={`rate-included-${controlId}`} min="0" onChange={(event) => updateQuantity("includedQuantity", event.target.value)} placeholder="Не задано" type="number" value={plan.includedQuantity ?? ""} /></FormField><FormField className="sm:col-span-3 lg:col-span-3" htmlFor={`rate-extra-${controlId}`} label={`Доп. единица, ${currency}`}><Input disabled={disabled} id={`rate-extra-${controlId}`} min="0" onChange={(event) => onChange({ baseExtraUnitAmount: event.target.value.trim() === "" ? null : majorMoneyToMinor(event.target.value) })} placeholder="Не задано" step="0.01" type="number" value={plan.baseExtraUnitAmount === null ? "" : minorMoneyToMajor(plan.baseExtraUnitAmount)} /></FormField></> : null}
    </div>
  </article>
}

function PriceBookLifecycle({ compact = false, createCommandMeta, draftDirty, editor, gateway, onReload }: { compact?: boolean; createCommandMeta: OfferingEditorCommandMetaFactory; draftDirty: boolean; editor: InternalOfferingEditor; gateway: OfferingEditorGateway; onReload: () => Promise<void> }) {
  const draft = editor.priceBooks.find((book) => book.state === "draft") ?? null
  const scheduled = editor.priceBooks.find((book) => book.state === "scheduled") ?? null
  const target = draft ?? scheduled
  const active = editor.priceBooks.find((book) => book.state === "active") ?? null
  const [reason, setReason] = useState("")
  const [scheduledLocal, setScheduledLocal] = useState("")
  const [pending, setPending] = useState<"activate" | "schedule" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const command = useRef<{ key: string; meta: ReturnType<OfferingEditorCommandMetaFactory> } | null>(null)
  const canTransition = editor.capabilities.pricing.canActivate && Boolean(target) && !draftDirty && !pending

  useEffect(() => { command.current = null; setError(null) }, [reason, scheduledLocal, target?.id])

  const run = async (action: "activate" | "schedule") => {
    if (!target || !canTransition) return
    const normalizedReason = reason.trim()
    if (!normalizedReason) { setError("Укажите причину ввода цен в действие."); return }
    let scheduledActivationAt: string | null = null
    if (action === "schedule") {
      try { scheduledActivationAt = zonedLocalDateTimeToIso(scheduledLocal, editor.offering.timezone) }
      catch (dateError) { setError(dateError instanceof Error ? dateError.message : "Укажите дату и время активации."); return }
    }
    const key = JSON.stringify({ action, priceBookId: target.id, reason: normalizedReason, scheduledActivationAt })
    const meta = command.current?.key === key ? command.current.meta : createCommandMeta()
    command.current = { key, meta }
    setPending(action)
    setError(null)
    try {
      if (action === "activate") await gateway.activatePriceBook(editor.offering.id, target.id, { ...meta, reason: normalizedReason })
      else await gateway.schedulePriceBook(editor.offering.id, target.id, { ...meta, reason: normalizedReason, scheduledActivationAt: scheduledActivationAt! })
      command.current = null
      setReason("")
      setScheduledLocal("")
      await onReload()
    } catch (transitionError) {
      setError(offeringEditorErrorMessage(transitionError, action === "activate" ? compact ? "Не удалось применить цены." : "Не удалось активировать прайс-лист." : "Не удалось запланировать активацию."))
    } finally { setPending(null) }
  }

  return <EditorSection subtitle={compact ? "Сохраните изменения, а затем выберите, когда они начнут работать." : "Переход выполняет backend: он проверяет период, календарь, тарифы и версии, затем обновляет публичную проекцию."} title={compact ? "Когда применить изменения" : "Ввод цен в действие"}>
    <div className="flex flex-wrap items-center gap-3 border-b pb-3">
      <IconBox icon={scheduled ? IconCalendarTime : IconPlayerPlay} size="sm" variant={scheduled ? "info" : target ? "warning" : "success"} />
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{compact ? target ? "Подготовлены новые цены" : active ? "Текущие цены действуют" : "Цены ещё не настроены" : target?.name ?? active?.name ?? "Прайс-лист не подготовлен"}</p><p className="mt-0.5 break-words text-[10px] text-muted-foreground">{scheduled?.scheduledActivationAt ? `Начнут действовать ${compactDateTime(scheduled.scheduledActivationAt, scheduled.timezone)}` : draft ? compact ? `Сохранены, ещё не применены · с ${compactDate(draft.validFrom)}` : `Черновик · период с ${compactDate(draft.validFrom)}` : active ? compact ? `Действуют с ${compactDate(active.validFrom)}` : `Активен с ${compactDate(active.validFrom)}` : "Сначала сохраните основную цену"}</p></div>
      {target ? <StatusBadge tone={priceBookTone[target.state]}>{compact ? scheduled ? "Запланированы" : "Не применены" : priceBookLabel[target.state]}</StatusBadge> : active ? <StatusBadge tone="success">{compact ? "Действуют" : "Активен"}</StatusBadge> : null}
    </div>
    {target && editor.capabilities.pricing.canActivate ? <div className={compact ? "grid items-end gap-3 pt-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2" : "grid items-end gap-3 pt-3 sm:grid-cols-6 lg:grid-cols-12"} data-slot={compact ? "resource-price-activation" : undefined}>
      <FormField className={compact ? "min-w-0 sm:col-span-2 xl:col-span-1 2xl:col-span-2" : "sm:col-span-6 lg:col-span-6"} htmlFor="price-book-transition-reason" label="Причина"><Input disabled={Boolean(pending)} id="price-book-transition-reason" onChange={(event) => setReason(event.target.value)} placeholder="Например, согласованы цены сезона" value={reason} /></FormField>
      {target.state === "draft" ? <FormField className={compact ? "min-w-0" : "sm:col-span-3 lg:col-span-3"} htmlFor="price-book-scheduled-at" label={compact ? "Применить с даты" : "Отложенная активация"}><div><Input disabled={Boolean(pending)} id="price-book-scheduled-at" onChange={(event) => setScheduledLocal(event.target.value)} type="datetime-local" value={scheduledLocal} />{compact ? null : <p className="mt-1 text-[9px] text-muted-foreground">Часовой пояс: {editor.offering.timezone}</p>}</div></FormField> : null}
      <div className={compact ? "flex min-w-0 flex-col gap-2" : target.state === "draft" ? "flex flex-col gap-2 sm:col-span-3 lg:col-span-3" : "flex gap-2 sm:col-span-6 lg:col-span-6"}>
        <Button disabled={!canTransition || !reason.trim()} onClick={() => void run("activate")} size="sm"><IconPlayerPlay aria-hidden="true" />{pending === "activate" ? "Применяем…" : compact ? "Применить сейчас" : "Активировать сейчас"}</Button>
        {target.state === "draft" ? <Button disabled={!canTransition || !reason.trim() || !scheduledLocal} onClick={() => void run("schedule")} size="sm" variant="outline"><IconCalendarTime aria-hidden="true" />{pending === "schedule" ? "Планируем…" : compact ? "Применить с даты" : "Запланировать"}</Button> : null}
      </div>
    </div> : target ? <p className="pt-3 text-xs text-muted-foreground">{compact ? "У вас нет права применять эти изменения." : "У вас нет права активировать или планировать прайс-лист."}</p> : null}
    {draftDirty ? <p className="pt-3 text-xs text-warning-foreground">Сначала сохраните изменения черновика, затем вводите цены в действие.</p> : null}
    {error ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-danger/20 p-3 text-xs text-danger-foreground" role="alert"><span className="min-w-0 flex-1">{error}</span><Button onClick={() => void onReload()} size="sm" variant="outline"><IconRefresh aria-hidden="true" />Обновить данные</Button></div> : null}
  </EditorSection>
}

function QuoteSimulator({ compact = false, createCommandMeta, editor, gateway, kind }: { compact?: boolean; createCommandMeta: OfferingEditorCommandMetaFactory; editor: InternalOfferingEditor; gateway: OfferingEditorGateway; kind: "house" | "campground" }) {
  const defaultPlan = priceBookSource(editor)?.ratePlans.find((plan) => plan.isDefault)?.key ?? null
  const campground = kind === "campground" && editor.offering.fulfillment.kind === "campground" ? editor.offering.fulfillment : null
  const quantityLabel = campground?.salesUnit === "own_tent_pitch" ? "Палаточных мест" : "Гости"
  const [arrivalDate, setArrivalDate] = useState(() => serviceDateInTimezone(editor.offering.timezone))
  const [departureDate, setDepartureDate] = useState(() => incrementDateOnly(serviceDateInTimezone(editor.offering.timezone)))
  const [quantity, setQuantity] = useState(campground?.salesUnit === "own_tent_pitch" ? "1" : "2")
  const [quote, setQuote] = useState<InternalOfferingQuoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const requestRef = useRef(new HouseQuoteRequestCache<InternalStayOfferingQuoteBody>())
  const inputKey = JSON.stringify({ arrivalDate, defaultPlan, departureDate, quantity, salesUnit: campground?.salesUnit ?? "house", timezone: editor.offering.timezone, currency: editor.offering.currency })

  useEffect(() => {
    requestRef.current.reset()
    setQuote(null)
    setError(null)
  }, [inputKey])

  const preview = async () => {
    setError(null)
    setRunning(true)
    try {
      const request = requestRef.current.getOrCreate(inputKey, () => campground
        ? buildCampgroundQuoteBody({ arrivalDate, currency: editor.offering.currency, departureDate, meta: createCommandMeta(), quantity: numberOrZero(quantity), ratePlanKey: defaultPlan, salesUnit: campground.salesUnit })
        : buildHouseQuoteBody({ arrivalDate, currency: editor.offering.currency, departureDate, guests: numberOrZero(quantity), meta: createCommandMeta(), ratePlanKey: defaultPlan }))
      const result = campground
        ? await gateway.previewCampgroundQuote(editor.offering.id, request as ReturnType<typeof buildCampgroundQuoteBody>)
        : await gateway.previewHouseQuote(editor.offering.id, request as ReturnType<typeof buildHouseQuoteBody>)
      setQuote(result)
      requestRef.current.markSuccess(inputKey)
    } catch (quoteError) {
      setError(offeringEditorErrorMessage(quoteError, "Не удалось рассчитать стоимость."))
    } finally { setRunning(false) }
  }
  if (compact) return <EditorSection subtitle="Проверьте итог для конкретных дат и гостей." title="Проверить стоимость">
    <div className="grid items-end gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(135px,1fr)_minmax(135px,1fr)_minmax(90px,110px)_auto]" data-slot="resource-quote-form">
      <FormField className="min-w-0" htmlFor="quote-arrival" label="Заезд"><Input id="quote-arrival" onChange={(event) => setArrivalDate(event.target.value)} type="date" value={arrivalDate} /></FormField>
      <FormField className="min-w-0" htmlFor="quote-departure" label="Выезд"><Input id="quote-departure" onChange={(event) => setDepartureDate(event.target.value)} type="date" value={departureDate} /></FormField>
      <FormField className="min-w-0" htmlFor="quote-quantity" label={quantityLabel}><Input id="quote-quantity" min="1" onChange={(event) => setQuantity(event.target.value)} type="number" value={quantity} /></FormField>
      <Button className="w-full sm:self-end" disabled={!editor.capabilities.canPreviewQuote || running} onClick={() => void preview()}><IconReceipt2 aria-hidden="true" />{running ? "Считаем…" : "Рассчитать"}</Button>
    </div>
    {!editor.capabilities.canPreviewQuote ? <p className="mt-3 text-xs text-muted-foreground">Расчёт станет доступен, когда цены начнут действовать.</p> : null}
    {error ? <div className="mt-3 rounded-lg border border-danger/20 p-3 text-xs text-danger-foreground" role="alert">{error}</div> : null}
    <div className="mt-3">{quote ? <QuoteResult compact quote={quote} timezone={editor.offering.timezone} /> : <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed bg-muted/15 p-4 text-center"><div><IconReceipt2 aria-hidden="true" className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-xs font-medium">Расчёт появится здесь</p></div></div>}</div>
  </EditorSection>

  return <EditorSection subtitle="Расчёт не создаёт бронь и сохраняется как неизменяемый снимок условий." title="Проверить стоимость">
    <div className="grid gap-5 lg:grid-cols-[minmax(280px,340px)_1px_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="grid gap-3 min-[480px]:grid-cols-2 lg:grid-cols-2">
          <FormField htmlFor="quote-arrival" label="Заезд"><Input id="quote-arrival" onChange={(event) => setArrivalDate(event.target.value)} type="date" value={arrivalDate} /></FormField>
          <FormField htmlFor="quote-departure" label="Выезд"><Input id="quote-departure" onChange={(event) => setDepartureDate(event.target.value)} type="date" value={departureDate} /></FormField>
        </div>
        <FormField className="max-w-36" htmlFor="quote-quantity" label={quantityLabel}><Input id="quote-quantity" min="1" onChange={(event) => setQuantity(event.target.value)} type="number" value={quantity} /></FormField>
        <Button className="w-full" disabled={!editor.capabilities.canPreviewQuote || running} onClick={() => void preview()}><IconReceipt2 aria-hidden="true" />{running ? "Считаем…" : "Рассчитать"}</Button>
        {!editor.capabilities.canPreviewQuote ? <p className="text-xs text-muted-foreground">Расчёт станет доступен после привязки ресурса и активного прайс-листа.</p> : null}
        {error ? <div className="rounded-lg border border-danger/20 p-3 text-xs text-danger-foreground" role="alert">{error}</div> : null}
      </div>
      <Separator className="hidden lg:block" orientation="vertical" />
      {quote ? <QuoteResult quote={quote} timezone={editor.offering.timezone} /> : <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed bg-muted/15 p-6 text-center"><div><IconReceipt2 aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 text-xs font-medium">Здесь появится расчёт</p><p className="mt-1 text-[11px] text-muted-foreground">Укажите даты и {quantityLabel.toLocaleLowerCase("ru-RU")}.</p></div></div>}
    </div>
  </EditorSection>
}

function QuoteResult({ compact = false, quote, timezone }: { compact?: boolean; quote: InternalOfferingQuoteResult; timezone: string }) {
  return <div className="min-w-0 overflow-hidden rounded-xl border bg-background">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
      <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Итого</p><p className="mt-1 text-2xl font-semibold tabular-nums">{minorMoney(quote.total.amountMinor, quote.currency)}</p></div>
      <StatusBadge tone="success"><IconCircleCheck aria-hidden="true" />{compact ? "Рассчитано" : "Снимок зафиксирован"}</StatusBadge>
      <div className="flex w-full flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><IconCalendarCheck aria-hidden="true" className="size-3" />Действителен до {compactDateTime(quote.validUntil, timezone)}</span><span className="flex items-center gap-1"><IconClock aria-hidden="true" className="size-3" />Рассчитан {compactDateTime(quote.calculatedAt, timezone)}</span></div>
    </div>
    <div className="divide-y px-4">{quote.lines.map((line, index) => <div className="py-3 text-xs" key={`${line.kind}-${index}`}><div className="flex flex-col justify-between gap-1 min-[420px]:flex-row min-[420px]:gap-3"><div className="min-w-0"><p className="font-medium">{line.serviceDate ? compactDate(line.serviceDate) : line.label}</p>{!compact && line.serviceDate ? <p className="mt-0.5 text-[10px] text-muted-foreground">{compactDate(line.serviceDate)}</p> : null}</div><span className="shrink-0 font-semibold tabular-nums">{minorMoney(line.amount.amountMinor, quote.currency)}</span></div>{!compact ? <><p className="mt-1 text-[10px] text-muted-foreground">{line.explanation}</p>{line.matchedRuleId ? <p className="mt-1 truncate font-mono text-[9px] text-muted-foreground/75">Правило: {line.matchedRuleId}</p> : null}</> : null}</div>)}</div>
    {!compact ? <div className="border-t bg-muted/20 px-4 py-2.5 text-[9px] leading-4 text-muted-foreground"><p className="flex items-center gap-1 font-medium"><IconUsers aria-hidden="true" className="size-3" />Версии источников расчёта</p><p className="mt-1 break-all font-mono">Прайс-лист {quote.provenance.priceBookId} · v{quote.provenance.priceBookVersion}; календарь {quote.provenance.businessCalendarId} · v{quote.provenance.businessCalendarVersion}</p></div> : null}
  </div>
}
