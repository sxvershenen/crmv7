import { useEffect, useMemo, useRef, useState } from "react"
import { IconAlertTriangle, IconLock, IconPlus } from "@tabler/icons-react"

import type { InternalOfferingEditor, RatePlanDraft } from "@crm/contracts"
import { Button, EditorSection, FormField, Input, PageState } from "@crm/ui"

import {
  isOfferingEditorConflict,
  offeringEditorErrorMessage,
  type OfferingEditorCommandMetaFactory,
  type OfferingEditorGateway,
} from "./gateway.js"
import {
  buildCreateDraftPriceBookBody,
  buildReplaceDraftPriceBookBody,
  createDraftPriceBookForm,
  createEmptyRatePlan,
  priceBookToDraftForm,
  type DraftPriceBookForm,
} from "./price-book-draft.js"
import { canEditPricingDraft, majorMoneyToMinor, minorMoneyToMajor, shouldPreserveLocalPricingDraft, serviceDateInTimezone } from "./house-offering-helpers.js"
import {
  type AddOnPricingConstraint,
  constrainAddOnPricingForm,
  constrainAddOnRatePlan,
  draftPriceBook,
  priceBookSource,
  type SaveState,
} from "./house-offering-workspace-model.js"
import { PriceBookLifecycle, RatePlanEditor, ResourceBasePrice, ResourceSpecialPrices } from "./offering-pricing-controls.js"
import { QuoteSimulator } from "./offering-quote-simulator.js"

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

export function PricingWorkspace(props: Parameters<typeof OfferingPricingWorkspace>[0]) { return <OfferingPricingWorkspace {...props} /> }
