import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { IconAlertTriangle, IconCalendarEvent, IconClock, IconExternalLink, IconFileText, IconPlus, IconReceipt2, IconRefresh } from "@tabler/icons-react"

import {
  EventServiceOfferingQuotePreviewBodySchema,
  EventServiceRatePlanDraftSchema,
  HousePriceBookDraftCreateBodySchema,
  HousePriceBookDraftReplaceBodySchema,
  type EventServiceOfferingDossier,
  type EventServiceOfferingQuotePreviewBody,
  type EventServiceOfferingQuoteResult,
  type EventServiceRatePlanDraft,
  type HousePriceBookActivateBody,
  type HousePriceBookDraftCreateBody,
  type HousePriceBookDraftReplaceBody,
  type HousePriceBookScheduleBody,
  type InternalOfferingEditor,
  type OfferingPricingMutationResult,
  type EventServiceTemplateMutationBody,
  type EventServiceTemplateIcon,
  type EventServiceTemplateTone,
} from "@crm/contracts"
import {
  Button,
  EditorFrame,
  EditorSection,
  FormField,
  FormSelect,
  Input,
  PageNav,
  PageState,
  StatusBadge,
  Textarea,
} from "@crm/ui"

import { offeringEditorErrorMessage, isOfferingEditorConflict } from "./gateway.js"
import { majorMoneyToMinor, minorMoneyToMajor, serviceDateInTimezone, zonedLocalDateTimeToIso } from "./house-offering-helpers.js"
import { createEmptyRatePlan, createDraftPriceBookForm, priceBookToDraftForm, type DraftPriceBookForm } from "./price-book-draft.js"

export type EventServiceEditorData = {
  dossier: EventServiceOfferingDossier
  editor: InternalOfferingEditor
}

export interface EventServiceOfferingGateway {
  updateTemplate(templateId: string, body: EventServiceTemplateMutationBody): Promise<{ template: EventServiceOfferingDossier["template"]; subjectVersion: number }>
  createDraftPriceBook(offeringId: string, body: HousePriceBookDraftCreateBody): Promise<OfferingPricingMutationResult>
  replaceDraftPriceBook(offeringId: string, priceBookId: string, body: HousePriceBookDraftReplaceBody): Promise<OfferingPricingMutationResult>
  activatePriceBook(offeringId: string, priceBookId: string, body: HousePriceBookActivateBody): Promise<OfferingPricingMutationResult>
  schedulePriceBook(offeringId: string, priceBookId: string, body: HousePriceBookScheduleBody): Promise<OfferingPricingMutationResult>
  previewQuote(offeringId: string, body: EventServiceOfferingQuotePreviewBody): Promise<EventServiceOfferingQuoteResult>
}

export type EventServiceOfferingWorkspaceTab = "terms" | "pricing" | "preview"
type SaveState = "dirty" | "saving" | "saved" | "conflict"
type TemplateDraft = Pick<EventServiceOfferingDossier["template"], "format" | "icon" | "tone" | "defaultDurationMinutes" | "minimumGuests" | "maximumGuests" | "preparationBeforeMinutes" | "preparationAfterMinutes"> & Pick<EventServiceOfferingDossier["offering"], "operationalName" | "internalComment">

export type EventServiceOfferingWorkspaceProps = {
  data: EventServiceEditorData
  gateway: EventServiceOfferingGateway
  createTemplateCommandMeta: () => Pick<EventServiceTemplateMutationBody, "operationId" | "idempotencyKey" | "expectedSubjectVersion">
  createPricingCommandMeta: () => Pick<HousePriceBookDraftCreateBody, "operationId" | "idempotencyKey" | "expectedPricingVersion">
  createPreviewCommandMeta: () => Pick<EventServiceOfferingQuotePreviewBody, "operationId" | "idempotencyKey">
  initialTab?: EventServiceOfferingWorkspaceTab
  onBack?: () => void
  onReload: () => Promise<void>
  onNavigationGuardChange?: (guard: (() => boolean) | null) => void
  onTabChange?: (tab: EventServiceOfferingWorkspaceTab) => void
  editorialHref?: (nodeId: string) => string | null
}

const formatLabel = { wedding: "Свадьба", corporate: "Корпоратив", birthday: "День рождения", other: "Другое" } as const
const iconOptions: Array<{ value: EventServiceTemplateIcon; label: string }> = [{ value: "heart", label: "Сердце" }, { value: "building", label: "Здание" }, { value: "cake", label: "Праздник" }, { value: "bus", label: "Выезд" }]
const toneOptions: Array<{ value: EventServiceTemplateTone; label: string }> = [{ value: "rose", label: "Розовый" }, { value: "violet", label: "Фиолетовый" }, { value: "amber", label: "Янтарный" }, { value: "sky", label: "Голубой" }]
const stateLabel = { active: "Активно", archived: "В архиве", draft: "Черновик", paused: "Приостановлено" } as const

export function EventServiceOfferingWorkspace({ data, gateway, createTemplateCommandMeta, createPricingCommandMeta, createPreviewCommandMeta, initialTab = "terms", onBack, onReload, onNavigationGuardChange, onTabChange, editorialHref }: EventServiceOfferingWorkspaceProps) {
  const [tab, setTab] = useState<EventServiceOfferingWorkspaceTab>(initialTab)
  const [templateState, setTemplateState] = useState<SaveState>("saved")
  const [templateDetail, setTemplateDetail] = useState("Изменения отсутствуют")
  const [templateAction, setTemplateAction] = useState<(() => void) | null>(null)
  const [pricingState, setPricingState] = useState<SaveState>("saved")
  const [pricingDetail, setPricingDetail] = useState("Изменения отсутствуют")
  const [pricingAction, setPricingAction] = useState<(() => void) | null>(null)
  const registerTemplateAction = useCallback((action: (() => void) | null) => setTemplateAction(() => action), [])
  const registerPricingAction = useCallback((action: (() => void) | null) => setPricingAction(() => action), [])

  useEffect(() => setTab(initialTab), [initialTab])
  const dirty = templateState === "dirty" || templateState === "saving" || templateState === "conflict" || pricingState === "dirty" || pricingState === "saving" || pricingState === "conflict"
  const guard = useCallback(() => !dirty || typeof window === "undefined" || window.confirm("Есть несохранённые изменения. Закрыть редактор?"), [dirty])
  useEffect(() => { onNavigationGuardChange?.(dirty ? guard : null); return () => onNavigationGuardChange?.(null) }, [dirty, guard, onNavigationGuardChange])
  useEffect(() => {
    if (!dirty || typeof window === "undefined") return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [dirty])

  const setActiveTab = (value: string) => { const next = value as EventServiceOfferingWorkspaceTab; setTab(next); onTabChange?.(next) }
  const activeState = tab === "terms" ? templateState : tab === "pricing" ? pricingState : "saved"
  const activeDetail = tab === "terms" ? templateDetail : tab === "pricing" ? pricingDetail : "Изменения отсутствуют"
  const activeAction = tab === "terms" ? templateAction : tab === "pricing" ? pricingAction : null
  const navigation = <PageNav ariaLabel="Разделы категории мероприятия" items={[{ icon: IconCalendarEvent, label: "Условия", value: "terms" }, { icon: IconReceipt2, label: "Пакеты и цены", value: "pricing" }, { icon: IconClock, label: "Проверка стоимости", value: "preview" }]} onValueChange={setActiveTab} value={tab} />
  const footer = <><Button onClick={() => { if (onBack && guard()) onBack() }} size="sm" variant="outline">Закрыть</Button>{activeAction ? <Button disabled={activeState !== "dirty" && activeState !== "conflict"} onClick={activeAction} size="sm">{activeState === "saving" ? "Сохранение…" : activeState === "conflict" ? "Повторить сохранение" : tab === "terms" ? "Сохранить формат" : "Сохранить цены"}</Button> : null}</>

  return <EditorFrame footerActions={footer} navigation={navigation} saveDetail={activeDetail} saveState={activeState} sidebar={<EventServiceSidebar data={data} {...(editorialHref ? { editorialHref } : {})} />}>{tab === "terms" ? <EventServiceTermsEditor data={data} createCommandMeta={createTemplateCommandMeta} gateway={gateway} onReload={onReload} onSaveActionChange={registerTemplateAction} onSaveState={(state, detail) => { setTemplateState(state); setTemplateDetail(detail) }} /> : null}{tab === "pricing" ? <EventServicePricingEditor data={data} createCommandMeta={createPricingCommandMeta} gateway={gateway} onReload={onReload} onSaveActionChange={registerPricingAction} onSaveState={(state, detail) => { setPricingState(state); setPricingDetail(detail) }} /> : null}{tab === "preview" ? <EventServiceQuotePreview data={data} createCommandMeta={createPreviewCommandMeta} gateway={gateway} /> : null}</EditorFrame>
}

function EventServiceSidebar({ data, editorialHref }: { data: EventServiceEditorData; editorialHref?: (nodeId: string) => string | null }) {
  const { dossier, editor } = data
  const locator = dossier.editorial
  const cmsHref = locator ? editorialHref?.(locator.node.id) ?? null : null
  return <div className="space-y-3"><EditorSection title="Категория мероприятия"><dl className="grid gap-3 text-xs"><Detail label="Название" value={dossier.offering.operationalName} /><Detail label="Коммерческий код" value={dossier.offering.code} /><Detail label="Формат" value={formatLabel[dossier.template.format]} /><Detail label="Иконка" value={iconOptions.find((option) => option.value === dossier.template.icon)?.label ?? dossier.template.icon} /><Detail label="Цвет" value={toneOptions.find((option) => option.value === dossier.template.tone)?.label ?? dossier.template.tone} /><Detail label="Состояние" value={stateLabel[dossier.offering.state]} /><Detail label="Часовой пояс" value={dossier.offering.timezone} /></dl></EditorSection><EditorSection title="CMS-черновик">{locator ? <div className="space-y-2 text-xs"><div className="flex items-center justify-between gap-2"><span>{locator.currentRevision?.title ?? "Черновик без редакции"}</span><StatusBadge tone={dossier.publicReady ? "success" : "warning"}>{dossier.publicReady ? "Готово" : "Public закрыт"}</StatusBadge></div>{cmsHref ? <Button className="w-full" nativeButton={false} render={<a href={cmsHref} />} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Открыть в CMS</Button> : null}<p className="text-muted-foreground">CMS редактирует только editorial-контент. Операционные поля и цены остаются в CRM.</p></div> : <PageState icon={IconFileText} title="CMS-черновик не подготовлен">Подготовка категории создаёт canonical editorial draft.</PageState>}</EditorSection><EditorSection title="Готовность"><div className="grid gap-2 text-xs"><Readiness label="Цена" ready={Boolean(editor.offering.activePriceBookId) && editor.capabilities.canPreviewQuote} /><Readiness label="CMS" ready={dossier.cmsReady} /><Readiness label="Публичный сайт" ready={false} text="Закрыт до public gate" /></div><p className="mt-3 text-[11px] text-muted-foreground">Успешный расчёт цены не означает доступность, бронь или подтверждение мероприятия.</p></EditorSection></div>
}

function EventServiceTermsEditor({ data, gateway, createCommandMeta, onReload, onSaveActionChange, onSaveState }: { data: EventServiceEditorData; gateway: Pick<EventServiceOfferingGateway, "updateTemplate">; createCommandMeta: EventServiceOfferingWorkspaceProps["createTemplateCommandMeta"]; onReload: () => Promise<void>; onSaveActionChange: (action: (() => void) | null) => void; onSaveState: (state: SaveState, detail: string) => void }) {
  const template = data.dossier.template
  const initial = useMemo<TemplateDraft>(() => ({ operationalName: data.dossier.offering.operationalName, internalComment: data.dossier.offering.internalComment, format: template.format, icon: template.icon, tone: template.tone, defaultDurationMinutes: template.defaultDurationMinutes, minimumGuests: template.minimumGuests, maximumGuests: template.maximumGuests, preparationBeforeMinutes: template.preparationBeforeMinutes, preparationAfterMinutes: template.preparationAfterMinutes }), [data.dossier.offering.internalComment, data.dossier.offering.operationalName, template])
  const [draft, setDraft] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const command = useRef<{ body: EventServiceTemplateMutationBody } | null>(null)
  const saveRef = useRef<() => Promise<void>>(async () => undefined)
  useEffect(() => { if (!dirty && !conflict) { setDraft(initial); setError(null); command.current = null } }, [dirty, conflict, initial])
  const update = <K extends keyof TemplateDraft>(key: K, value: TemplateDraft[K]) => { if (!data.editor.capabilities.subject.canEdit || conflict) return; command.current = null; setDraft((current) => ({ ...current, [key]: value })); setDirty(true); setError(null); onSaveState("dirty", "Условия формата изменены") }
  const save = async () => {
    if (!data.editor.capabilities.subject.canEdit) return
    setError(null); setConflict(false); onSaveState("saving", "Проверяем и сохраняем формат")
    try {
      const body = command.current?.body ?? { ...draft, ...createCommandMeta(), expectedSubjectVersion: template.version, expectedOfferingVersion: data.dossier.offering.version }
      command.current = { body }
      await gateway.updateTemplate(template.id, body)
      command.current = null; setDirty(false); onSaveState("saved", "Формат сохранён"); await onReload()
    } catch (reason) {
      const nextError = offeringEditorErrorMessage(reason, "Не удалось сохранить категорию мероприятия.")
      setError(nextError); const isConflict = isOfferingEditorConflict(reason); setConflict(isConflict); onSaveState(isConflict ? "conflict" : "dirty", nextError)
    }
  }
  const reload = async () => { await onReload(); setConflict(false); setError(null); onSaveState("dirty", "Версия сервера обновлена; локальный черновик сохранён") }
  saveRef.current = conflict ? reload : save
  useEffect(() => { const action = () => { void saveRef.current() }; onSaveActionChange(action); return () => onSaveActionChange(null) }, [onSaveActionChange])
  return <div className="space-y-3"><EditorSection subtitle="Название, внутренняя заметка и условия сохраняются одной командой. Заметка не публикуется в CMS." title="Основные условия"><div className="grid items-start gap-4 sm:grid-cols-6"><FormField className="sm:col-span-3" htmlFor="event-service-operational-name" label="Название"><Input disabled={!data.editor.capabilities.subject.canEdit || conflict} id="event-service-operational-name" onChange={(event) => update("operationalName", event.target.value)} value={draft.operationalName} /></FormField><FormSelect className="sm:col-span-3" disabled={!data.editor.capabilities.subject.canEdit || conflict} id="event-service-format" label="Формат" onValueChange={(value) => update("format", value as TemplateDraft["format"])} options={Object.entries(formatLabel).map(([value, label]) => ({ value, label }))} value={draft.format} /><FormField className="sm:col-span-6" htmlFor="event-service-internal-comment" label="Внутренняя заметка"><Textarea disabled={!data.editor.capabilities.subject.canEdit || conflict} id="event-service-internal-comment" onChange={(event) => update("internalComment", event.target.value)} placeholder="Только для команды; на сайт не публикуется" value={draft.internalComment} /></FormField><FormSelect className="sm:col-span-2" disabled={!data.editor.capabilities.subject.canEdit || conflict} id="event-service-icon" label="Иконка" onValueChange={(value) => update("icon", value as TemplateDraft["icon"])} options={iconOptions} value={draft.icon} /><FormSelect className="sm:col-span-2" disabled={!data.editor.capabilities.subject.canEdit || conflict} id="event-service-tone" label="Цвет" onValueChange={(value) => update("tone", value as TemplateDraft["tone"])} options={toneOptions} value={draft.tone} /><FormField className="sm:col-span-2" htmlFor="event-service-duration" label="Длительность, минут"><Input disabled={!data.editor.capabilities.subject.canEdit || conflict} id="event-service-duration" min="1" onChange={(event) => update("defaultDurationMinutes", numberInput(event.target.value))} type="number" value={draft.defaultDurationMinutes} /></FormField><FormField className="sm:col-span-2" htmlFor="event-service-min-guests" label="Минимум гостей"><Input disabled={!data.editor.capabilities.subject.canEdit || conflict} id="event-service-min-guests" min="0" onChange={(event) => update("minimumGuests", nullableNumber(event.target.value))} placeholder="Без минимума" type="number" value={draft.minimumGuests ?? ""} /></FormField><FormField className="sm:col-span-2" htmlFor="event-service-max-guests" label="Максимум гостей"><Input disabled={!data.editor.capabilities.subject.canEdit || conflict} id="event-service-max-guests" min="0" onChange={(event) => update("maximumGuests", nullableNumber(event.target.value))} placeholder="Без лимита" type="number" value={draft.maximumGuests ?? ""} /></FormField><FormField className="sm:col-span-2" htmlFor="event-service-preparation-before" label="Подготовка до, минут"><Input disabled={!data.editor.capabilities.subject.canEdit || conflict} id="event-service-preparation-before" min="0" onChange={(event) => update("preparationBeforeMinutes", numberInput(event.target.value))} type="number" value={draft.preparationBeforeMinutes} /></FormField><FormField className="sm:col-span-2" htmlFor="event-service-preparation-after" label="Подготовка после, минут"><Input disabled={!data.editor.capabilities.subject.canEdit || conflict} id="event-service-preparation-after" min="0" onChange={(event) => update("preparationAfterMinutes", numberInput(event.target.value))} type="number" value={draft.preparationAfterMinutes} /></FormField></div>{draft.minimumGuests !== null && draft.maximumGuests !== null && draft.minimumGuests > draft.maximumGuests ? <p className="mt-3 text-xs text-danger-foreground" role="alert">Максимум гостей не может быть меньше минимума.</p> : null}</EditorSection><EditorSection title="Коммерческие данные"><dl className="grid gap-4 text-sm sm:grid-cols-2"><Detail label="Коммерческий код" value={data.dossier.offering.code} /><Detail label="Цена и налоги" value={`${data.editor.offering.currency} · ${data.editor.offering.taxMode === "tax_included" ? "налог включён" : data.editor.offering.taxMode}`} /></dl></EditorSection>{error ? <ConflictOrError conflict={conflict} error={error} onReload={() => void reload()} onRetry={() => void save()} /> : null}{!data.editor.capabilities.subject.canEdit ? <p className="text-xs text-muted-foreground">У вас нет права изменять условия категории.</p> : null}</div>
}

function EventServicePricingEditor({ data, gateway, createCommandMeta, onReload, onSaveActionChange, onSaveState }: { data: EventServiceEditorData; gateway: Pick<EventServiceOfferingGateway, "createDraftPriceBook" | "replaceDraftPriceBook" | "activatePriceBook" | "schedulePriceBook">; createCommandMeta: EventServiceOfferingWorkspaceProps["createPricingCommandMeta"]; onReload: () => Promise<void>; onSaveActionChange: (action: (() => void) | null) => void; onSaveState: (state: SaveState, detail: string) => void }) {
  const draftBook = data.editor.priceBooks.find((book) => book.state === "draft") ?? null
  const activeBook = data.editor.priceBooks.find((book) => book.id === data.editor.offering.activePriceBookId) ?? data.editor.priceBooks.find((book) => book.state === "active") ?? null
  const source = draftBook ?? activeBook
  const initial = useMemo(() => createEventPriceBookForm(source, data.editor.offering.timezone), [data.editor.offering.timezone, source])
  const [form, setForm] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const command = useRef<{ body: HousePriceBookDraftCreateBody | HousePriceBookDraftReplaceBody; priceBookId: string | null } | null>(null)
  const saveRef = useRef<() => Promise<void>>(async () => undefined)
  useEffect(() => { if (!dirty && !conflict) { setForm(initial); setError(null); command.current = null } }, [dirty, conflict, initial])
  const update = (patch: Partial<DraftPriceBookForm>) => { if (!data.editor.capabilities.pricing.canEditDraft || conflict) return; command.current = null; setForm((current) => ({ ...current, ...patch })); setDirty(true); setError(null); onSaveState("dirty", "Пакеты и цены изменены") }
  const updatePlan = (index: number, patch: Partial<EventServiceRatePlanDraft>) => update({ ratePlans: form.ratePlans.map((plan, current) => current === index ? { ...plan, ...patch } : plan) })
  const save = async () => {
    if (!data.editor.capabilities.pricing.canEditDraft) return
    setError(null); setConflict(false); onSaveState("saving", "Проверяем и сохраняем пакеты")
    try {
      const meta = createCommandMeta()
      const body = command.current?.body ?? buildEventPriceBookBody(form, meta, draftBook?.id ?? null, source?.id ?? null)
      command.current = { body, priceBookId: draftBook?.id ?? null }
      if (draftBook) await gateway.replaceDraftPriceBook(data.editor.offering.id, draftBook.id, body as HousePriceBookDraftReplaceBody)
      else await gateway.createDraftPriceBook(data.editor.offering.id, body as HousePriceBookDraftCreateBody)
      command.current = null; setDirty(false); onSaveState("saved", "Пакеты сохранены"); await onReload()
    } catch (reason) {
      const nextError = offeringEditorErrorMessage(reason, "Не удалось сохранить пакеты."); const isConflict = isOfferingEditorConflict(reason); setError(nextError); setConflict(isConflict); onSaveState(isConflict ? "conflict" : "dirty", nextError)
    }
  }
  const reload = async () => { await onReload(); setConflict(false); setError(null); onSaveState("dirty", "Версия сервера обновлена; локальный черновик сохранён") }
  saveRef.current = conflict ? reload : save
  useEffect(() => { const action = () => { void saveRef.current() }; onSaveActionChange(action); return () => onSaveActionChange(null) }, [onSaveActionChange])
  const addPlan = () => update({ ratePlans: [...form.ratePlans, createEventServicePlan(form.ratePlans.length)] })
  const writable = data.editor.capabilities.pricing.canEditDraft
  return <div className="space-y-3"><EditorSection actions={writable ? <Button disabled={conflict} onClick={addPlan} size="sm" variant="outline"><IconPlus aria-hidden="true" />Пакет</Button> : null} subtitle="Только flat package: базовая сумма, включённые гости и доплата сверх лимита. Итог считает сервер." title="Пакеты"><div className="space-y-3">{form.ratePlans.map((plan, index) => <EventServicePlanRow disabled={!writable || conflict} index={index} key={plan.id ?? `new-${index}`} onChange={(patch) => updatePlan(index, patch)} plan={plan} />)}</div></EditorSection><EditorSection title="Период действия"><div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="event-price-name" label="Название прайс-листа"><Input disabled={!writable || conflict} id="event-price-name" onChange={(event) => update({ name: event.target.value })} value={form.name} /></FormField><FormField htmlFor="event-price-reason" label="Причина изменения"><Input disabled={!writable || conflict} id="event-price-reason" onChange={(event) => update({ changeReason: event.target.value })} value={form.changeReason} /></FormField><FormField htmlFor="event-price-from" label="Действует с"><Input disabled={!writable || conflict} id="event-price-from" onChange={(event) => update({ validFrom: event.target.value })} type="date" value={form.validFrom} /></FormField><FormField htmlFor="event-price-to" label="До даты (не включая)"><Input disabled={!writable || conflict} id="event-price-to" onChange={(event) => update({ validToExclusive: event.target.value })} type="date" value={form.validToExclusive} /></FormField></div></EditorSection>{error ? <ConflictOrError conflict={conflict} error={error} onReload={() => void reload()} onRetry={() => void save()} /> : null}{!writable ? <p className="text-xs text-muted-foreground">Пакеты доступны только для чтения.</p> : null}<PriceLifecycle active={activeBook} disabled={!writable || dirty || conflict} editor={data.editor} gateway={gateway} onReload={onReload} /> </div>
}

function EventServicePlanRow({ disabled, index, onChange, plan }: { disabled: boolean; index: number; onChange: (patch: Partial<EventServiceRatePlanDraft>) => void; plan: EventServiceRatePlanDraft }) {
  return <div className="rounded-lg border bg-muted/10 p-3"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">Пакет {index + 1}</p><StatusBadge tone="info">flat_package</StatusBadge></div><div className="grid items-end gap-3 sm:grid-cols-6"><FormField className="sm:col-span-2" htmlFor={`event-plan-label-${index}`} label="Название"><Input disabled={disabled} id={`event-plan-label-${index}`} onChange={(event) => onChange({ label: event.target.value })} value={plan.label} /></FormField><FormField className="sm:col-span-2" htmlFor={`event-plan-key-${index}`} label="Ключ пакета"><Input disabled={disabled} id={`event-plan-key-${index}`} onChange={(event) => onChange({ key: event.target.value })} value={plan.key} /></FormField><FormField className="sm:col-span-2" htmlFor={`event-plan-amount-${index}`} label="Цена пакета, ₽"><Input disabled={disabled} id={`event-plan-amount-${index}`} min="0" onChange={(event) => onChange({ baseAmount: majorMoneyToMinor(event.target.value) })} step="0.01" type="number" value={minorMoneyToMajor(plan.baseAmount)} /></FormField><FormField className="sm:col-span-2" htmlFor={`event-plan-included-${index}`} label="Гостей включено"><Input disabled={disabled} id={`event-plan-included-${index}`} min="1" onChange={(event) => onChange({ includedQuantity: numberInput(event.target.value) })} type="number" value={plan.includedQuantity ?? ""} /></FormField><FormField className="sm:col-span-2" htmlFor={`event-plan-extra-${index}`} label="Доплата за гостя, ₽"><Input disabled={disabled} id={`event-plan-extra-${index}`} min="0" onChange={(event) => onChange({ baseExtraUnitAmount: majorMoneyToMinor(event.target.value) })} step="0.01" type="number" value={plan.baseExtraUnitAmount === null ? "" : minorMoneyToMajor(plan.baseExtraUnitAmount)} /></FormField><FormField className="sm:col-span-2" htmlFor={`event-plan-min-${index}`} label="Минимум гостей"><Input disabled={disabled} id={`event-plan-min-${index}`} min="1" onChange={(event) => onChange({ minQuantity: nullablePositiveNumber(event.target.value) })} type="number" value={plan.minQuantity ?? ""} /></FormField><FormField className="sm:col-span-2" htmlFor={`event-plan-max-${index}`} label="Максимум гостей"><Input disabled={disabled} id={`event-plan-max-${index}`} min="1" onChange={(event) => onChange({ maxQuantity: nullablePositiveNumber(event.target.value) })} placeholder="Без лимита" type="number" value={plan.maxQuantity ?? ""} /></FormField><FormField className="sm:col-span-2" htmlFor={`event-plan-min-duration-${index}`} label="Мин. длительность, минут"><Input disabled={disabled} id={`event-plan-min-duration-${index}`} min="1" onChange={(event) => onChange({ minDurationMinutes: nullablePositiveNumber(event.target.value) })} type="number" value={plan.minDurationMinutes ?? ""} /></FormField><FormField className="sm:col-span-2" htmlFor={`event-plan-max-duration-${index}`} label="Макс. длительность, минут"><Input disabled={disabled} id={`event-plan-max-duration-${index}`} min="1" onChange={(event) => onChange({ maxDurationMinutes: nullablePositiveNumber(event.target.value) })} type="number" value={plan.maxDurationMinutes ?? ""} /></FormField></div></div>
}

function EventServiceQuotePreview({ data, gateway, createCommandMeta }: { data: EventServiceEditorData; gateway: Pick<EventServiceOfferingGateway, "previewQuote">; createCommandMeta: EventServiceOfferingWorkspaceProps["createPreviewCommandMeta"] }) {
  const active = data.editor.priceBooks.find((book) => book.id === data.editor.offering.activePriceBookId) ?? data.editor.priceBooks.find((book) => book.state === "active") ?? null
  const defaultPlan = active?.ratePlans.find((plan) => plan.isDefault) ?? active?.ratePlans[0] ?? null
  const [startsAt, setStartsAt] = useState(() => localDateTimeInTimezone(data.editor.offering.timezone))
  const [endsAt, setEndsAt] = useState(() => localDateTimeInTimezone(data.editor.offering.timezone, data.dossier.template.defaultDurationMinutes))
  const [guests, setGuests] = useState(String(Math.max(1, data.dossier.template.minimumGuests ?? defaultPlan?.includedQuantity ?? 1)))
  const [planKey, setPlanKey] = useState(defaultPlan?.key ?? "")
  const [quote, setQuote] = useState<EventServiceOfferingQuoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const request = useRef<{ key: string; body: EventServiceOfferingQuotePreviewBody } | null>(null)
  const generation = useRef(0)
  const inputKey = JSON.stringify({ startsAt, endsAt, guests, planKey, offeringId: data.editor.offering.id, timezone: data.editor.offering.timezone })
  useEffect(() => { generation.current += 1; request.current = null; setQuote(null); setError(null) }, [inputKey])
  useEffect(() => { setPlanKey(defaultPlan?.key ?? "") }, [defaultPlan?.key])
  const preview = async () => {
    if (!planKey || !startsAt || !endsAt || running) return
    const currentGeneration = generation.current
    const key = inputKey
    setRunning(true); setError(null)
    try {
      const body = request.current?.key === key ? request.current.body : EventServiceOfferingQuotePreviewBodySchema.parse({ quoteType: "event_service_preview", ratePlanKey: planKey, startsAt: zonedLocalDateTimeToOffsetIso(startsAt, data.editor.offering.timezone), endsAt: zonedLocalDateTimeToOffsetIso(endsAt, data.editor.offering.timezone), guests: numberInput(guests), currency: data.editor.offering.currency, addOns: [], ...createCommandMeta() })
      request.current = { key, body }
      const result = await gateway.previewQuote(data.editor.offering.id, body)
      if (generation.current === currentGeneration && key === inputKey) { setQuote(result); request.current = null }
    } catch (reason) { if (generation.current === currentGeneration && key === inputKey) setError(offeringEditorErrorMessage(reason, "Не удалось рассчитать стоимость.")) } finally { if (generation.current === currentGeneration && key === inputKey) setRunning(false) }
  }
  return <EditorSection subtitle="Серверный immutable snapshot для проверки пакета. Доступность, ресурсы, бронь и подтверждение не выполняются." title="Типизированный preview"><div className="grid items-end gap-4 sm:grid-cols-6"><FormField className="sm:col-span-2" htmlFor="event-preview-start" label={`Начало (${data.editor.offering.timezone})`}><Input id="event-preview-start" onChange={(event) => setStartsAt(event.target.value)} type="datetime-local" value={startsAt} /></FormField><FormField className="sm:col-span-2" htmlFor="event-preview-end" label={`Конец (${data.editor.offering.timezone})`}><Input id="event-preview-end" onChange={(event) => setEndsAt(event.target.value)} type="datetime-local" value={endsAt} /></FormField><FormField className="sm:col-span-1" htmlFor="event-preview-guests" label="Гости"><Input id="event-preview-guests" min="1" onChange={(event) => setGuests(event.target.value)} type="number" value={guests} /></FormField><FormField className="sm:col-span-1" htmlFor="event-preview-plan" label="Пакет"><FormSelect disabled={!active} id="event-preview-plan" label="Выберите пакет" onValueChange={setPlanKey} options={active?.ratePlans.map((plan) => ({ value: plan.key, label: plan.label })) ?? []} value={planKey} /></FormField><Button className="sm:col-span-2" disabled={!data.editor.capabilities.canPreviewQuote || !active || !planKey || running} onClick={() => void preview()}>{running ? "Рассчитываем…" : "Рассчитать цену"}</Button></div>{!data.editor.capabilities.canPreviewQuote || !active ? <p className="mt-3 text-xs text-muted-foreground">Расчёт станет доступен после активации пакета.</p> : null}{error ? <div className="mt-3" role="alert"><ConflictOrError conflict={false} error={error} /></div> : null}{quote ? <EventQuoteResult quote={quote} /> : <div className="mt-4 flex min-h-32 items-center justify-center rounded-lg border border-dashed bg-muted/15 p-5 text-center text-xs text-muted-foreground"><div><IconReceipt2 aria-hidden="true" className="mx-auto size-5" /><p className="mt-2">Здесь появится цена пакета</p><p className="mt-1">Цена рассчитана отдельно от доступности и брони.</p></div></div>}</EditorSection>
}

function EventQuoteResult({ quote }: { quote: EventServiceOfferingQuoteResult }) { return <div aria-label="Результат preview цены" className="mt-4 min-w-0 overflow-hidden rounded-xl border bg-background"><div className="flex flex-wrap items-start justify-between gap-3 border-b p-4"><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Итого</p><p className="mt-1 text-2xl font-semibold tabular-nums">{money(quote.total.amountMinor, quote.currency)}</p></div><StatusBadge tone="warning">Цена рассчитана</StatusBadge><p className="w-full text-xs text-muted-foreground">Доступность, бронь и подтверждение не проверялись. Снимок не acceptance-ready.</p></div><div className="divide-y px-4">{quote.lines.map((line, index) => <div className="flex flex-wrap justify-between gap-3 py-3 text-xs" key={`${line.kind}-${index}`}><span>{line.label} × {line.quantity}</span><span className="font-semibold tabular-nums">{money(line.amount.amountMinor, quote.currency)}</span></div>)}</div><div className="border-t bg-muted/20 px-4 py-3 text-[10px] text-muted-foreground"><p>Интервал: {quote.inputs.startsAt} — {quote.inputs.endsAt}</p><p className="mt-1">Действителен до: {quote.validUntil}</p><p className="mt-1">Версии источников зафиксированы сервером.</p></div></div> }

function PriceLifecycle({ active, disabled, editor, gateway, onReload }: { active: InternalOfferingEditor["priceBooks"][number] | null; disabled: boolean; editor: InternalOfferingEditor; gateway: Pick<EventServiceOfferingGateway, "activatePriceBook" | "schedulePriceBook">; onReload: () => Promise<void> }) {
  const target = editor.priceBooks.find((book) => book.state === "draft") ?? null
  const [reason, setReason] = useState("")
  const [scheduledAt, setScheduledAt] = useState("")
  const [busy, setBusy] = useState(false)
  const run = async (action: "activate" | "schedule") => {
    if (!target || !reason.trim() || disabled) return
    setBusy(true)
    try {
      const meta = { operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedPricingVersion: editor.ownerVersions.pricing }
      if (action === "activate") await gateway.activatePriceBook(editor.offering.id, target.id, { ...meta, reason: reason.trim() })
      else await gateway.schedulePriceBook(editor.offering.id, target.id, { ...meta, reason: reason.trim(), scheduledActivationAt: scheduledAt ? zonedLocalDateTimeToIso(scheduledAt, editor.offering.timezone) : "" })
      await onReload()
    } finally { setBusy(false) }
  }
  return <EditorSection title="Ввод цены в действие"><div className="flex flex-wrap items-center gap-3 text-xs"><span>{target ? `Черновик: ${target.name}` : active ? `Активен: ${active.name}` : "Прайс-лист не подготовлен"}</span>{target ? <StatusBadge tone="warning">Черновик</StatusBadge> : active ? <StatusBadge tone="success">Активен</StatusBadge> : null}</div>{target ? <div className="mt-3 grid items-end gap-3 sm:grid-cols-3"><FormField htmlFor="event-price-transition-reason" label="Причина"><Input disabled={disabled || busy} id="event-price-transition-reason" onChange={(event) => setReason(event.target.value)} value={reason} /></FormField><FormField htmlFor="event-price-transition-at" label="Запланировать с"><Input disabled={disabled || busy} id="event-price-transition-at" onChange={(event) => setScheduledAt(event.target.value)} type="datetime-local" value={scheduledAt} /></FormField><div className="flex flex-wrap gap-2"><Button disabled={disabled || busy || !reason.trim()} onClick={() => void run("activate")} size="sm">{busy ? "Применяем…" : "Активировать"}</Button><Button disabled={disabled || busy || !reason.trim() || !scheduledAt} onClick={() => void run("schedule")} size="sm" variant="outline">Запланировать</Button></div></div> : null}</EditorSection>
}

function ConflictOrError({ conflict, error, onReload, onRetry }: { conflict: boolean; error: string; onReload?: () => void; onRetry?: () => void }) { return <div className="flex flex-wrap items-start gap-2 rounded-lg border border-danger/25 bg-danger-subtle/20 p-3 text-xs text-danger-foreground"><IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold">{conflict ? "Данные изменились на сервере" : "Изменения не сохранены"}</p><p className="mt-1">{error}</p>{conflict ? <p className="mt-1 text-muted-foreground">Локальный черновик сохранён. Повтор отправит те же данные.</p> : null}</div>{onRetry ? <Button onClick={onRetry} size="sm" variant="outline">Повторить</Button> : null}{onReload ? <Button onClick={onReload} size="sm" variant="outline"><IconRefresh aria-hidden="true" />Обновить сервер</Button> : null}</div> }
function Readiness({ label, ready, text }: { label: string; ready: boolean; text?: string }) { return <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"><span>{label}</span><StatusBadge tone={ready ? "success" : "warning"}>{ready ? "Готово" : text ?? "Нужно настроить"}</StatusBadge></div> }
function Detail({ label, value }: { label: string; value: ReactNode }) { return <div><dt className="text-[10px] text-muted-foreground">{label}</dt><dd className="mt-0.5 break-words font-medium">{value}</dd></div> }
function numberInput(value: string) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0 }
function nullableNumber(value: string) { return value.trim() ? numberInput(value) : null }
function nullablePositiveNumber(value: string) { const parsed = nullableNumber(value); return parsed && parsed > 0 ? parsed : null }
function money(amountMinor: number, currency: string) { return new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 2 }).format(amountMinor / 100) }
function createEventServicePlan(index: number): EventServiceRatePlanDraft { return { ...createEmptyRatePlan(), key: `package_${index + 1}`, label: `Пакет ${index + 1}`, pricingBasis: "flat_package", quantityMetric: "guests", includedQuantity: 1, baseExtraUnitAmount: 0, minQuantity: 1, isDefault: index === 0 } }
function createEventPriceBookForm(source: InternalOfferingEditor["priceBooks"][number] | null, timezone: string): DraftPriceBookForm { const form = source ? (source.state === "draft" ? priceBookToDraftForm(source) : { ...createDraftPriceBookForm(source, serviceDateInTimezone(timezone)), name: `${source.name} — черновик` }) : { ...createDraftPriceBookForm(null, serviceDateInTimezone(timezone)), ratePlans: [createEventServicePlan(0)] }; return { ...form, ratePlans: form.ratePlans.map((plan, index) => ({ ...plan, pricingBasis: "flat_package" as const, quantityMetric: "guests" as const, includedQuantity: plan.includedQuantity ?? 1, baseExtraUnitAmount: plan.baseExtraUnitAmount ?? 0, isDefault: index === 0 ? true : plan.isDefault })) } }
function buildEventPriceBookBody(form: DraftPriceBookForm, meta: Pick<HousePriceBookDraftCreateBody, "operationId" | "idempotencyKey" | "expectedPricingVersion">, draftId: string | null, supersedesPriceBookId: string | null): HousePriceBookDraftCreateBody | HousePriceBookDraftReplaceBody { const plans = form.ratePlans.map((plan) => { const parsed = EventServiceRatePlanDraftSchema.safeParse({ ...plan, ...(draftId ? {} : { id: undefined }) }); if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => issue.message).join(" ")); const next = { ...parsed.data }; if (!draftId) delete next.id; return next }); const raw = { ...meta, name: form.name, validFrom: form.validFrom, validToExclusive: form.validToExclusive || null, changeReason: form.changeReason, ratePlans: plans, ...(draftId ? {} : { supersedesPriceBookId }) }; return (draftId ? HousePriceBookDraftReplaceBodySchema : HousePriceBookDraftCreateBodySchema).parse(raw) as HousePriceBookDraftCreateBody | HousePriceBookDraftReplaceBody }
function localDateTimeInTimezone(timezone: string, addMinutes = 0) { const date = new Date(Date.now() + addMinutes * 60_000); const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date); const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}` }
function zonedLocalDateTimeToOffsetIso(value: string, timezone: string) { const iso = zonedLocalDateTimeToIso(value, timezone); const offset = new Intl.DateTimeFormat("en", { timeZone: timezone, timeZoneName: "longOffset" }).formatToParts(new Date(iso)).find((part) => part.type === "timeZoneName")?.value ?? "GMT"; const normalized = offset === "GMT" ? "Z" : offset.replace(/^GMT/, ""); return `${value}:00${normalized}` }
