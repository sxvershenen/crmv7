import { useEffect, useRef, useState } from "react"
import { IconCalendarTime, IconPlayerPlay, IconRefresh, IconTrash } from "@tabler/icons-react"

import type { InternalOfferingEditor, PriceRuleDraft, PriceWeekday, PricingBasis, RatePlanDraft } from "@crm/contracts"
import { Button, EditorSection, FormField, FormSelect, IconBox, Input, StatusBadge } from "@crm/ui"

import { offeringEditorErrorMessage, type OfferingEditorCommandMetaFactory, type OfferingEditorGateway } from "./gateway.js"
import {
  incrementDateOnly,
  majorMoneyToMinor,
  minorMoneyToMajor,
  serviceDateInTimezone,
  zonedLocalDateTimeToIso,
} from "./house-offering-helpers.js"
import {
  compactDate,
  compactDateTime,
  metricOptions,
  minorMoney,
  numberOrNull,
  pricingBasisOptions,
  pricingBasisShortLabel,
  priceBookLabel,
  priceBookTone,
  quantityMetricLabel,
  type AddOnPricingConstraint,
} from "./house-offering-workspace-model.js"

const pricingWeekdays: Array<{ label: string; value: PriceWeekday }> = [
  { label: "Пн", value: "mon" }, { label: "Вт", value: "tue" }, { label: "Ср", value: "wed" }, { label: "Чт", value: "thu" },
  { label: "Пт", value: "fri" }, { label: "Сб", value: "sat" }, { label: "Вс", value: "sun" },
]

export function ResourceBasePrice({ disabled, editor, kind, onChange, plan }: { disabled: boolean; editor: InternalOfferingEditor; kind: "house" | "campground"; onChange: (patch: Partial<RatePlanDraft>) => void; plan: RatePlanDraft }) {
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

export function ResourceSpecialPrices({ disabled, onChange, plan, timezone }: { disabled: boolean; onChange: (rules: PriceRuleDraft[]) => void; plan: RatePlanDraft; timezone: string }) {
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

export function RatePlanEditor({ constraint, currency, disabled, index, onChange, plan }: { constraint: AddOnPricingConstraint | null; currency: string; disabled: boolean; index: number; onChange: (patch: Partial<RatePlanDraft>) => void; plan: RatePlanDraft }) {
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

export function PriceBookLifecycle({ compact = false, createCommandMeta, draftDirty, editor, gateway, onReload }: { compact?: boolean; createCommandMeta: OfferingEditorCommandMetaFactory; draftDirty: boolean; editor: InternalOfferingEditor; gateway: OfferingEditorGateway; onReload: () => Promise<void> }) {
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
