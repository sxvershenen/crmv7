import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconExternalLink, IconPlus, IconTrash } from "@tabler/icons-react"
import type { InternalOfferingEditor, RatePlanDraft } from "@crm/contracts"
import { Button, EditorSection, FormField, Input, PageState, StatusBadge } from "@crm/ui"
import { buildCreateDraftPriceBookBody, buildReplaceDraftPriceBookBody, createDraftPriceBookForm, isOfferingEditorConflict, offeringEditorErrorMessage, serviceDateInTimezone, type DraftPriceBookForm, type OfferingEditorGateway } from "@crm/offering-editor"

type PricingGateway = Pick<OfferingEditorGateway, "getAddOnEditor" | "createDraftPriceBook" | "replaceDraftPriceBook" | "activatePriceBook">

function tariff(key: string, label: string, basis: "per_hour" | "per_slot", rubles: number, min: number | null, max: number | null, displayOrder: number): RatePlanDraft {
  return { key, label, pricingBasis: basis, quantityMetric: min === null ? null : "guests", baseAmount: rubles * 100,
    includedQuantity: null, baseExtraUnitAmount: null, minQuantity: min, maxQuantity: max,
    minDurationMinutes: null, maxDurationMinutes: null, isDefault: displayOrder === 0, displayOrder, rules: [] }
}

function preset(kind: "sauna" | "chan"): RatePlanDraft[] {
  if (kind === "chan") return [tariff("pine_chan", "Чан с хвойным наполнением", "per_slot", 5600, null, null, 0)]
  return [
    tariff("standard_6", "Стандарт", "per_hour", 3000, 1, 6, 0),
    tariff("standard_10", "Стандарт", "per_hour", 3500, 7, 10, 1),
    tariff("standard_15", "Стандарт", "per_hour", 4000, 11, 15, 2),
    tariff("all_inclusive_6", "Всё включено", "per_hour", 6000, 1, 6, 3),
    tariff("all_inclusive_10", "Всё включено", "per_hour", 7000, 7, 10, 4),
    tariff("all_inclusive_15", "Всё включено", "per_hour", 8000, 11, 15, 5),
  ]
}

function formFromEditor(editor: InternalOfferingEditor): DraftPriceBookForm {
  const draft = editor.priceBooks.find((book) => book.state === "draft")
  const active = editor.priceBooks.find((book) => book.state === "active")
  const source = draft ?? active ?? null
  const today = serviceDateInTimezone(editor.offering.timezone)
  const form = createDraftPriceBookForm(source, today)
  return { ...form, name: source?.name ?? "Тарифы бани и чана", validFrom: draft?.validFrom ?? today,
    validToExclusive: draft?.validToExclusive ?? "", ratePlans: source ? form.ratePlans : [], changeReason: draft?.changeReason ?? "" }
}

export function ScheduledResourcePricing({ gateway, offeringId, resourceName, readOnly = false, onNavigationGuardChange }: {
  gateway: PricingGateway
  offeringId: string
  resourceName: string
  readOnly?: boolean
  onNavigationGuardChange: (guard: (() => boolean) | null) => void
}) {
  const [editor, setEditor] = useState<InternalOfferingEditor | null>(null)
  const [form, setForm] = useState<DraftPriceBookForm | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await gateway.getAddOnEditor(offeringId)
      if (!next || next.addOnTerms?.serviceType !== "scheduled_resource") throw new Error("Условия продажи этого ресурса не найдены")
      setEditor(next)
      setForm(formFromEditor(next))
      setDirty(false)
    } catch (reason) { setError(offeringEditorErrorMessage(reason, "Не удалось загрузить тарифы")) }
    finally { setLoading(false) }
  }, [gateway, offeringId])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    onNavigationGuardChange(dirty ? () => window.confirm("Тарифы не сохранены. Уйти со страницы?") : null)
    return () => onNavigationGuardChange(null)
  }, [dirty, onNavigationGuardChange])

  const update = (patch: Partial<DraftPriceBookForm>) => { setForm((current) => current ? { ...current, ...patch } : current); setDirty(true) }
  const updatePlan = (index: number, patch: Partial<RatePlanDraft>) => {
    if (!form) return
    update({ ratePlans: form.ratePlans.map((plan, position) => position === index ? { ...plan, ...patch } : plan) })
  }
  const save = async () => {
    if (!form || !editor || busy || readOnly || !editor.capabilities.pricing.canEditDraft) return
    if (!form.ratePlans.length || form.ratePlans.some((plan) => plan.baseAmount <= 0 || !plan.label.trim() || (plan.quantityMetric === "guests" && (!plan.minQuantity || !plan.maxQuantity)))) {
      setError("Добавьте тарифы с названием, ценой больше нуля и полным диапазоном гостей.")
      return
    }
    if (!form.changeReason.trim()) { setError("Укажите причину изменения цены."); return }
    setBusy(true); setError(null)
    try {
      const draft = editor.priceBooks.find((book) => book.state === "draft")
      const active = editor.priceBooks.find((book) => book.state === "active")
      const meta = { operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedPricingVersion: editor.ownerVersions.pricing }
      if (draft) await gateway.replaceDraftPriceBook(offeringId, draft.id, buildReplaceDraftPriceBookBody(form, meta))
      else await gateway.createDraftPriceBook(offeringId, buildCreateDraftPriceBookBody(form, meta, active?.id ?? null))
      await load()
    } catch (reason) { setError(isOfferingEditorConflict(reason) ? "Цена уже изменилась у другого сотрудника. Скопируйте свои значения и обновите редактор." : offeringEditorErrorMessage(reason, "Не удалось сохранить тарифы")) }
    finally { setBusy(false) }
  }
  const activate = async () => {
    if (!editor || !form || dirty || busy || readOnly || !editor.capabilities.pricing.canActivate) return
    const draft = editor.priceBooks.find((book) => book.state === "draft")
    if (!draft) return
    setBusy(true); setError(null)
    try {
      await gateway.activatePriceBook(offeringId, draft.id, { operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedPricingVersion: editor.ownerVersions.pricing, reason: draft.changeReason || "Обновление тарифов бани и чана" })
      await load()
    } catch (reason) { setError(offeringEditorErrorMessage(reason, "Не удалось применить цену")) }
    finally { setBusy(false) }
  }

  if (loading && !editor) return <PageState icon={IconAlertTriangle} title="Загружаем тарифы">Проверяем цену и страницу ресурса.</PageState>
  if (!editor || !form) return <PageState icon={IconAlertTriangle} title="Тарифы не загрузились" tone="danger" actionLabel="Повторить" onAction={() => void load()}>{error}</PageState>
  const draft = editor.priceBooks.find((book) => book.state === "draft")
  const active = editor.priceBooks.find((book) => book.state === "active")
  const canEdit = !readOnly && editor.capabilities.pricing.canEditDraft
  const canActivate = !readOnly && editor.capabilities.pricing.canActivate
  const basis = form.ratePlans[0]?.pricingBasis === "per_slot" ? "per_slot" : "per_hour"
  const cmsHref = editor.editorial?.node.id ? `${(import.meta.env.VITE_ADMIN_APP_URL ?? (import.meta.env.DEV ? "http://localhost:5174" : "/cms")).replace(/\/$/, "")}/content/tree?selected=${encodeURIComponent(editor.editorial.node.id)}` : null
  return <div className="space-y-3">
    <EditorSection title="Цена и страница" subtitle="Цена принадлежит CRM. Описание и публикация страницы — в CMS.">
      <div className="flex flex-wrap items-center gap-2 text-xs"><span>{resourceName}</span><StatusBadge tone={active ? "success" : "warning"}>{active ? "Действующая цена в CRM" : "Цена ещё не применена"}</StatusBadge>{draft && <StatusBadge tone="warning">Есть черновик цены</StatusBadge>}{cmsHref && <Button size="sm" variant="outline" onClick={() => window.open(cmsHref, "_blank", "noopener,noreferrer")}><IconExternalLink aria-hidden="true" />Открыть страницу в CMS</Button>}</div>
    </EditorSection>
    <EditorSection title="Тарифы" subtitle="Для бани укажите цену за час по числу гостей. Чан продаётся за сеанс: длительность уточняет менеджер.">
      <div className="mb-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || !canEdit} onClick={() => update({ ratePlans: preset("sauna") })}>Заполнить тарифы бани</Button><Button size="sm" variant="outline" disabled={busy || !canEdit} onClick={() => update({ ratePlans: preset("chan") })}>Заполнить чан</Button></div>
      {form.ratePlans.length > 0 && <FormField htmlFor="scheduled-basis" label="Как считается цена"><select id="scheduled-basis" className="h-9 rounded-md border bg-background px-3 text-sm" value={basis} disabled={busy || !canEdit} onChange={(event) => update({ ratePlans: form.ratePlans.map((plan) => ({ ...plan, pricingBasis: event.target.value as "per_hour" | "per_slot" })) })}><option value="per_hour">За час</option><option value="per_slot">За сеанс</option></select></FormField>}
      <div className="mt-3 space-y-2">{form.ratePlans.map((plan, index) => <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(5rem,1fr)_minmax(5rem,1fr)_minmax(6rem,1fr)_auto]" key={plan.key}>
        <FormField htmlFor={`tariff-${plan.key}-label`} label="Название"><Input id={`tariff-${plan.key}-label`} disabled={busy || !canEdit} value={plan.label} onChange={(event) => updatePlan(index, { label: event.target.value })} /></FormField>
        <FormField htmlFor={`tariff-${plan.key}-min`} label="Гостей от"><Input id={`tariff-${plan.key}-min`} type="number" min="1" disabled={busy || !canEdit} value={plan.minQuantity ?? ""} onChange={(event) => { const value = event.target.value ? Number(event.target.value) : null; updatePlan(index, { minQuantity: value, quantityMetric: value === null && plan.maxQuantity === null ? null : "guests" }) }} /></FormField>
        <FormField htmlFor={`tariff-${plan.key}-max`} label="Гостей до"><Input id={`tariff-${plan.key}-max`} type="number" min="1" disabled={busy || !canEdit} value={plan.maxQuantity ?? ""} onChange={(event) => { const value = event.target.value ? Number(event.target.value) : null; updatePlan(index, { maxQuantity: value, quantityMetric: value === null && plan.minQuantity === null ? null : "guests" }) }} /></FormField>
        <FormField htmlFor={`tariff-${plan.key}-price`} label="Цена, ₽"><Input id={`tariff-${plan.key}-price`} type="number" min="0" step="1" disabled={busy || !canEdit} value={plan.baseAmount / 100} onChange={(event) => updatePlan(index, { baseAmount: Math.round(Number(event.target.value) * 100) })} /></FormField>
        <Button aria-label={`Удалить тариф ${plan.label}`} size="icon-sm" variant="ghost" disabled={busy || !canEdit} onClick={() => update({ ratePlans: form.ratePlans.filter((_, position) => position !== index).map((item, position) => ({ ...item, isDefault: position === 0, displayOrder: position })) })}><IconTrash aria-hidden="true" /></Button>
      </div>)}</div>
      <Button className="mt-3" size="sm" variant="outline" disabled={busy || !canEdit || form.ratePlans.length >= 40} onClick={() => update({ ratePlans: [...form.ratePlans, tariff(`tariff_${crypto.randomUUID().slice(0, 8)}`, "Новый тариф", basis, 0, null, null, form.ratePlans.length)] })}><IconPlus aria-hidden="true" />Добавить тариф</Button>
    </EditorSection>
    <EditorSection title="Применение цены" subtitle="После применения опубликованная страница сразу покажет новую цену."><div className="grid gap-3 sm:grid-cols-2"><FormField htmlFor="scheduled-valid-from" label="Действует с"><Input id="scheduled-valid-from" type="date" value={form.validFrom} disabled={busy || !canEdit} onChange={(event) => update({ validFrom: event.target.value })} /></FormField><FormField htmlFor="scheduled-reason" label="Причина изменения"><Input id="scheduled-reason" value={form.changeReason} disabled={busy || !canEdit} placeholder="Например, новый сезон" onChange={(event) => update({ changeReason: event.target.value })} /></FormField></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={busy || !canEdit || !dirty} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить черновик цены"}</Button>{draft && <Button size="sm" variant="outline" disabled={busy || !canActivate || dirty} onClick={() => void activate()}>Применить цену</Button>}</div>{!canEdit && <p className="mt-2 text-xs text-muted-foreground">Редактирование тарифов недоступно для этой записи или вашей роли.</p>}{error && <p className="mt-3 flex items-start gap-2 text-xs text-danger" role="alert"><IconAlertTriangle aria-hidden="true" className="size-4 shrink-0" />{error}</p>}</EditorSection>
  </div>
}
