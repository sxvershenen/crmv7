import { useCallback, useEffect, useMemo, useRef, useState, type ElementType, type ReactNode } from "react"
import {
  IconAlertTriangle,
  IconCurrencyRuble,
  IconExternalLink,
  IconLock,
  IconPuzzle,
  IconUsers,
} from "@tabler/icons-react"

import type {
  AddOnApplicableOfferingKind,
  AddOnServiceTerms,
  AddOnTermsMutationBody,
  AddOnUsageSummary,
  InternalOfferingEditor,
} from "@crm/contracts"
import {
  Button,
  EditorFrame,
  EditorSection,
  FormField,
  Input,
  LoadingRows,
  PageNav,
  PageState,
  StatusBadge,
  Switch,
} from "@crm/ui"

import {
  isOfferingEditorConflict,
  offeringEditorErrorMessage,
  type OfferingEditorCommandMetaFactory,
  type OfferingEditorGateway,
} from "./gateway.js"
import { OfferingPricingWorkspace } from "./house-offering-workspace.js"
import type { OfferingEditorSubjectCommandMetaFactory } from "./house-binding-editor.js"

export type AddOnOfferingWorkspaceTab = "overview" | "terms" | "pricing" | "usage"
type SaveState = "dirty" | "saving" | "saved" | "conflict"
type SupportedTerms = Extract<AddOnServiceTerms, { serviceType: "quantity_service" | "person_service" }>
type TermsDraft = {
  applicableOfferingKinds: AddOnApplicableOfferingKind[]
  categoryKey: string
  defaultQuantity: string
  maxQuantity: string
  minQuantity: string
  standalone: boolean
  step: string
}

export type AddOnOfferingWorkspaceProps = {
  createCommandMeta: OfferingEditorCommandMetaFactory
  createSubjectCommandMeta: OfferingEditorSubjectCommandMetaFactory
  editorialHref?: (nodeId: string) => string | null
  gateway: OfferingEditorGateway
  initialTab?: AddOnOfferingWorkspaceTab
  offeringId: string
  onBack?: () => void
  onEditorChange?: (editor: InternalOfferingEditor) => void
  onNavigationGuardChange?: (guard: (() => boolean) | null) => void
  onTabChange?: (tab: AddOnOfferingWorkspaceTab) => void
  usageHref?: (usage: AddOnUsageSummary) => string | null
}

const serviceTypeLabel = { person_service: "Услуга на участника", quantity_service: "Количественная услуга" } as const
const stateLabel = { active: "Активно", archived: "В архиве", draft: "Черновик", paused: "Приостановлено" } as const
const parentKindLabel = { campground: "Кемпинг", event_service: "Мероприятие под заказ", house: "Домик", program: "Программа", venue: "Площадка" } as const
const applicableKindOptions = Object.entries(parentKindLabel) as Array<[AddOnApplicableOfferingKind, string]>

export function AddOnOfferingWorkspace({
  createCommandMeta,
  createSubjectCommandMeta,
  editorialHref,
  gateway,
  initialTab = "overview",
  offeringId,
  onBack,
  onEditorChange,
  onNavigationGuardChange,
  onTabChange,
  usageHref,
}: AddOnOfferingWorkspaceProps) {
  const [editor, setEditor] = useState<InternalOfferingEditor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await gateway.getAddOnEditor(offeringId)
      setEditor(next)
      if (next) onEditorChange?.(next)
    } catch (loadError) {
      setError(offeringEditorErrorMessage(loadError, "Не удалось открыть дополнение."))
    } finally {
      setLoading(false)
    }
  }, [gateway, offeringId, onEditorChange])

  useEffect(() => { void load() }, [load])

  if (loading && !editor) return <WorkspaceLoading />
  if (error) return <WorkspaceState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title="Дополнение не открылось" tone="danger">{error}</WorkspaceState>
  if (!editor) return <WorkspaceState icon={IconPuzzle} title="Дополнение не найдено">Возможно, оно было удалено или у вас нет доступа.</WorkspaceState>
  if (editor.offering.kind !== "addon" || editor.offering.fulfillment.kind !== "addon" || !editor.addOnTerms) return <WorkspaceState icon={IconAlertTriangle} title="Получен другой тип предложения" tone="danger">Откройте запись из реестра «Допы и услуги».</WorkspaceState>
  if (!isSupportedTerms(editor.addOnTerms)) return <WorkspaceState icon={IconAlertTriangle} title="Тип услуги пока не поддерживается">Первый operational slice редактирует только количественные услуги и услуги на участника.</WorkspaceState>
  const supportedEditor = editor as InternalOfferingEditor & { addOnTerms: SupportedTerms }

  return <AddOnOfferingEditor
    createCommandMeta={createCommandMeta}
    createSubjectCommandMeta={createSubjectCommandMeta}
    editor={supportedEditor}
    {...(editorialHref ? { editorialHref } : {})}
    gateway={gateway}
    initialTab={initialTab}
    onReload={load}
    {...(onBack ? { onBack } : {})}
    {...(onNavigationGuardChange ? { onNavigationGuardChange } : {})}
    {...(onTabChange ? { onTabChange } : {})}
    {...(usageHref ? { usageHref } : {})}
  />
}

function AddOnOfferingEditor({
  createCommandMeta,
  createSubjectCommandMeta,
  editor,
  editorialHref,
  gateway,
  initialTab,
  onBack,
  onNavigationGuardChange,
  onReload,
  onTabChange,
  usageHref,
}: {
  createCommandMeta: OfferingEditorCommandMetaFactory
  createSubjectCommandMeta: OfferingEditorSubjectCommandMetaFactory
  editor: InternalOfferingEditor & { addOnTerms: SupportedTerms }
  editorialHref?: (nodeId: string) => string | null
  gateway: OfferingEditorGateway
  initialTab: AddOnOfferingWorkspaceTab
  onBack?: () => void
  onNavigationGuardChange?: (guard: (() => boolean) | null) => void
  onReload: () => Promise<void>
  onTabChange?: (tab: AddOnOfferingWorkspaceTab) => void
  usageHref?: (usage: AddOnUsageSummary) => string | null
}) {
  const normalizedInitialTab = initialTab === "overview" ? "terms" : initialTab
  const [tab, setTab] = useState<AddOnOfferingWorkspaceTab>(normalizedInitialTab)
  const [termsSaveState, setTermsSaveState] = useState<SaveState>("saved")
  const [termsSaveDetail, setTermsSaveDetail] = useState("Изменения отсутствуют")
  const [termsSaveAction, setTermsSaveAction] = useState<(() => void) | null>(null)
  const [pricingSaveState, setPricingSaveState] = useState<SaveState>("saved")
  const [pricingSaveDetail, setPricingSaveDetail] = useState("Изменения отсутствуют")
  const [pricingSaveAction, setPricingSaveAction] = useState<(() => void) | null>(null)
  const handleTermsSaveActionChange = useCallback((action: (() => void) | null) => setTermsSaveAction(() => action), [])
  const handlePricingSaveActionChange = useCallback((action: (() => void) | null) => setPricingSaveAction(() => action), [])
  const handleTermsSaveState = useCallback((state: SaveState, detail: string) => { setTermsSaveState(state); setTermsSaveDetail(detail) }, [])
  const handlePricingSaveState = useCallback((state: SaveState, detail: string) => { setPricingSaveState(state); setPricingSaveDetail(detail) }, [])
  const dirty = [termsSaveState, pricingSaveState].some((state) => state === "dirty" || state === "saving" || state === "conflict")

  useEffect(() => setTab(initialTab === "overview" ? "terms" : initialTab), [initialTab])
  const navigationGuard = useCallback(() => !dirty || typeof window === "undefined" || window.confirm("Есть несохранённые изменения. Закрыть редактор?"), [dirty])
  useEffect(() => {
    onNavigationGuardChange?.(dirty ? navigationGuard : null)
    return () => onNavigationGuardChange?.(null)
  }, [dirty, navigationGuard, onNavigationGuardChange])
  useEffect(() => {
    if (!dirty || typeof window === "undefined") return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [dirty])

  const activeSaveState = tab === "terms" ? termsSaveState : tab === "pricing" ? pricingSaveState : "saved"
  const activeSaveDetail = tab === "terms" ? termsSaveDetail : tab === "pricing" ? pricingSaveDetail : "Изменения отсутствуют"
  const activeAction = tab === "terms" ? termsSaveAction : tab === "pricing" ? pricingSaveAction : null
  const writable = tab === "terms" ? editor.capabilities.subject.canEdit : tab === "pricing" ? editor.capabilities.pricing.canEditDraft : false
  const navigation = <PageNav ariaLabel="Разделы дополнения" items={[
    { icon: IconPuzzle, label: "Основное", value: "terms" },
    { icon: IconCurrencyRuble, label: "Цена", value: "pricing" },
    { icon: IconUsers, label: "Где используется", value: "usage" },
  ]} onValueChange={(value) => { const next = value as AddOnOfferingWorkspaceTab; setTab(next); onTabChange?.(next) }} value={tab} />
  const footerActions = <><Button onClick={() => { if (onBack && navigationGuard()) onBack() }} size="sm" variant="outline">Закрыть</Button>{writable ? <Button disabled={!activeAction || activeSaveState === "saved" || activeSaveState === "saving"} onClick={() => activeAction?.()} size="sm">{activeSaveState === "conflict" ? "Повторить сохранение" : activeSaveState === "saving" ? "Сохранение…" : tab === "terms" ? "Сохранить" : "Сохранить цену"}</Button> : null}</>

  return <EditorFrame footerActions={footerActions} navigation={navigation} saveDetail={activeSaveDetail} saveState={activeSaveState} sidebar={<AddOnSidebar editor={editor} {...(editorialHref ? { editorialHref } : {})} />}>
    <div hidden={tab !== "terms"}><AddOnTermsEditor createCommandMeta={createSubjectCommandMeta} editor={editor} gateway={gateway} onReload={onReload} onSaveActionChange={handleTermsSaveActionChange} onSaveState={handleTermsSaveState} /></div>
    <div hidden={tab !== "pricing"}><OfferingPricingWorkspace createCommandMeta={createCommandMeta} editor={editor} gateway={gateway} kind="addon" onReload={onReload} onSaveActionChange={handlePricingSaveActionChange} onSaveState={handlePricingSaveState} /></div>
    <div hidden={tab !== "usage"}><AddOnUsageList editor={editor} {...(usageHref ? { usageHref } : {})} /></div>
  </EditorFrame>
}

function AddOnSidebar({ editor, editorialHref }: { editor: InternalOfferingEditor; editorialHref?: (nodeId: string) => string | null }) {
  const href = editor.editorial ? editorialHref?.(editor.editorial.node.id) ?? null : null
  return <div className="space-y-3"><EditorSection title="Услуга"><dl className="grid gap-3 text-xs"><Detail label="Тип" value={editor.addOnTerms ? serviceTypeLabel[editor.addOnTerms.serviceType as keyof typeof serviceTypeLabel] ?? "Дополнительная услуга" : "Дополнительная услуга"} /><Detail label="Статус" value={stateLabel[editor.offering.state]} /><Detail label="Используется" value={`${editor.addOnUsages.length} раз`} /></dl></EditorSection><EditorSection title="Страница на сайте">{href ? <Button className="w-full" nativeButton={false} render={<a href={href} />} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Открыть в CMS</Button> : <p className="text-xs text-muted-foreground">Черновик страницы ещё не подготовлен.</p>}</EditorSection></div>
}

function AddOnTermsEditor({ createCommandMeta, editor, gateway, onReload, onSaveActionChange, onSaveState }: {
  createCommandMeta: OfferingEditorSubjectCommandMetaFactory
  editor: InternalOfferingEditor & { addOnTerms: SupportedTerms }
  gateway: Pick<OfferingEditorGateway, "replaceAddOnTerms">
  onReload: () => Promise<void>
  onSaveActionChange: (action: (() => void) | null) => void
  onSaveState: (state: SaveState, detail: string) => void
}) {
  const initialDraft = useMemo(() => termsDraft(editor), [editor])
  const [draft, setDraft] = useState(initialDraft)
  const [dirty, setDirty] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const command = useRef<{ key: string; body: AddOnTermsMutationBody } | null>(null)
  const saveRef = useRef<() => Promise<void>>(async () => undefined)
  const writable = editor.capabilities.subject.canEdit

  useEffect(() => { if (!dirty && !conflict) { setDraft(initialDraft); setError(null); command.current = null } }, [conflict, dirty, initialDraft])
  const update = (patch: Partial<TermsDraft>) => {
    if (!writable || conflict) return
    command.current = null
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
    setError(null)
    onSaveState("dirty", "Основные настройки изменены")
  }
  const draftKey = JSON.stringify(draft)
  const buildBody = (): AddOnTermsMutationBody => {
    if (!draft.categoryKey.match(/^[a-z][a-z0-9_]*$/)) throw new Error("Категория должна начинаться с латинской буквы и содержать только a–z, 0–9 и _. ")
    if (!draft.applicableOfferingKinds.length) throw new Error("Выберите хотя бы один тип предложения.")
    const min = integerInRange(draft.minQuantity, 1, 1_000_000, "Минимум")
    const max = draft.maxQuantity.trim() ? integerInRange(draft.maxQuantity, 1, 1_000_000, "Максимум") : null
    const defaultValue = integerInRange(draft.defaultQuantity, 1, 1_000_000, "По умолчанию")
    const step = editor.addOnTerms.serviceType === "person_service" ? 1 : integerInRange(draft.step, 1, 1_000_000, "Шаг")
    if (max !== null && min > max) throw new Error("Минимум не может быть больше максимума.")
    if (defaultValue < min || (max !== null && defaultValue > max)) throw new Error("Значение по умолчанию должно попадать в диапазон.")
    const quantity = { min, max, default: defaultValue, step, metric: editor.addOnTerms.serviceType === "quantity_service" ? "units" as const : "participants" as const }
    return { ...createCommandMeta(), standalone: draft.standalone, terms: { categoryKey: draft.categoryKey, applicableOfferingKinds: draft.applicableOfferingKinds, serviceType: editor.addOnTerms.serviceType, quantity } as SupportedTerms }
  }
  const save = async () => {
    if (!writable) return
    let body: AddOnTermsMutationBody
    try { body = command.current?.key === draftKey ? command.current.body : buildBody(); command.current = { key: draftKey, body } }
    catch (validationError) { const message = offeringEditorErrorMessage(validationError, "Проверьте настройки услуги."); setError(message); onSaveState("dirty", message); return }
    setError(null)
    onSaveState("saving", "Сохраняем настройки услуги")
    try {
      await gateway.replaceAddOnTerms(editor.offering.id, body)
      command.current = null
      setDirty(false)
      setConflict(false)
      onSaveState("saved", "Настройки сохранены")
      await onReload()
    } catch (mutationError) {
      const message = offeringEditorErrorMessage(mutationError, "Не удалось сохранить условия.")
      const nextConflict = isOfferingEditorConflict(mutationError)
      setError(message); setConflict(nextConflict); setDirty(true); onSaveState(nextConflict ? "conflict" : "dirty", message)
      if (nextConflict) { try { await onReload() } catch { /* keep the local CAS command available */ } }
    }
  }
  saveRef.current = save
  useEffect(() => { const action = () => { void saveRef.current() }; onSaveActionChange(action); return () => onSaveActionChange(null) }, [onSaveActionChange])

  const toggleApplicable = (kind: AddOnApplicableOfferingKind, checked: boolean) => update({ applicableOfferingKinds: checked ? [...draft.applicableOfferingKinds, kind] : draft.applicableOfferingKinds.filter((item) => item !== kind) })
  return <div className="space-y-3">
    {!writable ? <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-subtle p-3 text-xs text-warning-foreground"><IconLock aria-hidden="true" className="mt-0.5 size-4" /><div><p className="font-semibold">Только просмотр</p><p className="mt-1">У вас нет права изменять эту услугу.</p></div></div> : null}
    {conflict ? <div className="rounded-xl border border-danger/25 bg-danger-subtle/20 p-4 text-xs" data-slot="addon-terms-conflict"><p className="font-semibold">Услугу уже изменил другой пользователь</p><p className="mt-1 text-muted-foreground">Обновите данные и сравните их с введёнными значениями.</p>{error ? <p className="mt-2 text-danger-foreground">{error}</p> : null}</div> : null}
    {error && !conflict ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Настройки не сохранены" tone="danger">{error}</PageState></div> : null}
    <EditorSection actions={<StatusBadge tone="info">{serviceTypeLabel[editor.addOnTerms.serviceType]}</StatusBadge>} subtitle="Как услуга будет предлагаться клиенту и учитываться в заказе." title="Основные настройки"><div className="grid items-end gap-3 sm:grid-cols-6"><FormField className="sm:col-span-3" htmlFor="addon-category-key" label="Группа в каталоге"><Input disabled={!writable || conflict} id="addon-category-key" onChange={(event) => update({ categoryKey: event.target.value })} placeholder="Например, комфорт" value={draft.categoryKey} /></FormField><label className="flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium sm:col-span-3"><Switch aria-label="Можно продавать отдельно" checked={draft.standalone} disabled={!writable || conflict} onCheckedChange={(checked) => update({ standalone: checked })} size="sm" />Можно продавать отдельно</label></div></EditorSection>
    <EditorSection subtitle="Короткие числовые поля собраны в одну строку." title="Количество"><div className="grid max-w-3xl gap-3 grid-cols-2 sm:grid-cols-4"><FormField htmlFor="addon-min" label="Минимум"><Input disabled={!writable || conflict} id="addon-min" min="1" onChange={(event) => update({ minQuantity: event.target.value })} type="number" value={draft.minQuantity} /></FormField><FormField htmlFor="addon-max" label="Максимум"><Input disabled={!writable || conflict} id="addon-max" min="1" onChange={(event) => update({ maxQuantity: event.target.value })} placeholder="Без лимита" type="number" value={draft.maxQuantity} /></FormField><FormField htmlFor="addon-default" label="По умолчанию"><Input disabled={!writable || conflict} id="addon-default" min="1" onChange={(event) => update({ defaultQuantity: event.target.value })} type="number" value={draft.defaultQuantity} /></FormField><FormField htmlFor="addon-step" label="Шаг"><Input disabled={!writable || conflict || editor.addOnTerms.serviceType === "person_service"} id="addon-step" min="1" onChange={(event) => update({ step: event.target.value })} type="number" value={draft.step} /></FormField></div></EditorSection>
    <EditorSection subtitle="Выберите, в заказы каких направлений можно добавлять услугу." title="К каким заказам подходит"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{applicableKindOptions.map(([kind, label]) => <label className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs" key={kind}><input checked={draft.applicableOfferingKinds.includes(kind)} disabled={!writable || conflict} onChange={(event) => toggleApplicable(kind, event.target.checked)} type="checkbox" />{label}</label>)}</div></EditorSection>
  </div>
}

function AddOnUsageList({ editor, usageHref }: { editor: InternalOfferingEditor; usageHref?: (usage: AddOnUsageSummary) => string | null }) {
  return <EditorSection subtitle="Read-only projection назначений. Изменять состав нужно в родительском предложении." title="Где используется">{editor.addOnUsages.length ? <div className="divide-y rounded-xl border">{editor.addOnUsages.map((usage) => { const href = usageHref?.(usage) ?? null; return <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center" key={usage.assignmentId}><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{usage.parentOffering.operationalName}</p><p className="mt-1 text-[10px] text-muted-foreground">{parentKindLabel[usage.parentOffering.kind]} · {stateLabel[usage.parentOffering.state]}</p></div><div className="flex flex-wrap items-center gap-1.5">{usage.enabled ? <StatusBadge tone="success">Включено</StatusBadge> : <StatusBadge tone="neutral">Выключено</StatusBadge>}{usage.required ? <StatusBadge tone="warning">Обязательно</StatusBadge> : null}{usage.recommended ? <StatusBadge tone="info">Рекомендуется</StatusBadge> : null}{href ? <Button nativeButton={false} render={<a href={href} />} size="sm" variant="outline">Открыть предложение</Button> : null}</div></div> })}</div> : <PageState icon={IconUsers} title="Доп пока не используется">Назначения появятся здесь после добавления услуги в предложение.</PageState>}</EditorSection>
}

function termsDraft(editor: InternalOfferingEditor & { addOnTerms: SupportedTerms }): TermsDraft {
  const terms = editor.addOnTerms
  return { applicableOfferingKinds: [...terms.applicableOfferingKinds], categoryKey: terms.categoryKey, defaultQuantity: String(terms.quantity.default), maxQuantity: terms.quantity.max === null ? "" : String(terms.quantity.max), minQuantity: String(terms.quantity.min), standalone: editor.offering.fulfillment.kind === "addon" ? editor.offering.fulfillment.standalone : false, step: String(terms.quantity.step) }
}
function isSupportedTerms(terms: AddOnServiceTerms): terms is SupportedTerms { return terms.serviceType === "quantity_service" || terms.serviceType === "person_service" }
function integerInRange(value: string, min: number, max: number, label: string) { const parsed = Number(value); if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label}: укажите целое число от ${min} до ${max}.`); return parsed }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] text-muted-foreground">{label}</dt><dd className="mt-1 text-xs font-medium">{value}</dd></div> }
function WorkspaceLoading() { return <div aria-label="Загрузка редактора дополнения" className="space-y-3" role="status"><div className="overflow-hidden rounded-xl border bg-background"><LoadingRows count={4} /></div><div className="h-48 animate-pulse rounded-xl border bg-muted/30" /></div> }
function WorkspaceState({ actionLabel, children, icon, onAction, title, tone = "neutral" }: { actionLabel?: string; children?: ReactNode; icon: ElementType; onAction?: () => void; title: string; tone?: "neutral" | "danger" }) { return <div className="rounded-xl border bg-background"><PageState {...(actionLabel ? { actionLabel } : {})} icon={icon} {...(onAction ? { onAction } : {})} title={title} tone={tone}>{children}</PageState></div> }
