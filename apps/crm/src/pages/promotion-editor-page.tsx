import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IconAlertTriangle, IconX } from "@tabler/icons-react"
import { useNavigate, useParams } from "react-router-dom"
import { PromotionTermsSchema, type Promotion, type PromotionMutation, type PromotionTerms, type PromotionUpdate } from "@crm/contracts"
import { Button, DateTimePicker, EditorFrame, EditorSection, EntityCombobox, FormField, FormSelect, Input, PageState, Skeleton, Switch, type EditorSaveState } from "@crm/ui"
import { useEditorLayoutChrome } from "@app/app/editor-layout-context"
import { houseOfferingGateway } from "@app/data/house-offerings-repository"
import { marketingRepository, type MarketingRepository } from "@app/data/marketing-repository"
import { useDirectoryData } from "@app/features/use-directory-data"
import { ApiClientError } from "@app/lib/api-client"
import { businessDateTimeToIso, toBusinessDateTimeInput } from "@app/lib/business-datetime"

type NamedOption = { value: string; label: string }
type TargetOption = NamedOption & { id: string; kind: "resource" | "offering" }
const emptyTerms: PromotionTerms = { code: "", name: "", active: false, discountType: "percent", value: 10, minimumAmountMinor: 0, startsAt: null, endsAt: null, scope: "all", resourceIds: [], offeringIds: [] }
const localDate = (value: string | null) => {
  return toBusinessDateTimeInput(value)
}
const isoDate = (value: string) => value ? businessDateTimeToIso(value) : null

async function loadOfferingOptions(): Promise<NamedOption[]> {
  async function collect(load: (cursor?: string) => Promise<{ items: NamedOption[]; nextCursor: string | null }>) {
    const options: NamedOption[] = []
    const seen = new Set<string>()
    let cursor: string | undefined
    do {
      const page = await load(cursor)
      options.push(...page.items)
      if (!page.nextCursor) break
      if (seen.has(page.nextCursor)) throw new Error("Каталог вернул повторную страницу. Повторите загрузку.")
      seen.add(page.nextCursor); cursor = page.nextCursor
    } while (cursor)
    return options
  }
  const groups = await Promise.all([
    collect(async cursor => { const page = await houseOfferingGateway.listHouses({ kind: "house", limit: 100, ...(cursor ? { cursor } : {}) }); return { ...page, items: page.items.map(item => ({ value: item.id, label: `Домики · ${item.operationalName}` })) } }),
    collect(async cursor => { const page = await houseOfferingGateway.listCampgrounds({ kind: "campground", limit: 100, ...(cursor ? { cursor } : {}) }); return { ...page, items: page.items.map(item => ({ value: item.id, label: `Кемпинг · ${item.operationalName}` })) } }),
    collect(async cursor => { const page = await houseOfferingGateway.listAddOns({ kind: "addon", limit: 100, ...(cursor ? { cursor } : {}) }); return { ...page, items: page.items.map(item => ({ value: item.offering.id, label: `Допуслуги · ${item.offering.operationalName}` })) } }),
  ])
  return groups.flat()
}

export function PromotionEditorPage({ repository = marketingRepository, offeringOptionsLoader = loadOfferingOptions }: { repository?: MarketingRepository; offeringOptionsLoader?: () => Promise<NamedOption[]> }) {
  const { id = "new" } = useParams()
  const navigate = useNavigate()
  const { data: directory, error: directoryError } = useDirectoryData()
  const [promotion, setPromotion] = useState<Promotion | null>(null)
  const [terms, setTerms] = useState<PromotionTerms>(emptyTerms)
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<EditorSaveState>("saved")
  const [retry, setRetry] = useState(0)
  const [conflict, setConflict] = useState(false)
  const [offeringOptions, setOfferingOptions] = useState<NamedOption[] | null>(null)
  const [offeringError, setOfferingError] = useState<string | null>(null)
  const [offeringRetry, setOfferingRetry] = useState(0)
  const pending = useRef(false)
  const command = useRef<{ fingerprint: string; input: PromotionMutation | PromotionUpdate } | null>(null)
  const chrome = useMemo(() => ({ idLabel: id === "new" ? "Новый промокод" : terms.code, onBack: () => navigate("/marketing?tab=promotions"), title: terms.name || "Промокод" }), [id, navigate, terms.code, terms.name])
  useEditorLayoutChrome(chrome)

  useEffect(() => {
    let active = true
    setLoading(true); setLoadError(null)
    Promise.all([repository.list(), id === "new" ? Promise.resolve(null) : repository.get(id)]).then(([list, item]) => {
      if (!active) return
      setCanManage(list.canManage); setPromotion(item); setTerms(item?.terms ?? emptyTerms); setState("saved"); setError(null); setConflict(false); command.current = null
    }).catch((reason: unknown) => { if (active) setLoadError(reason instanceof Error ? reason.message : "Не удалось загрузить промокод") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, repository, retry])

  useEffect(() => {
    if (terms.scope !== "selected") return
    let active = true
    setOfferingError(null); setOfferingOptions(null)
    offeringOptionsLoader().then(options => { if (active) setOfferingOptions(options) }).catch((reason: unknown) => { if (active) setOfferingError(reason instanceof Error ? reason.message : "Не удалось загрузить услуги") })
    return () => { active = false }
  }, [offeringOptionsLoader, offeringRetry, terms.scope])

  const update = useCallback(<K extends keyof PromotionTerms>(key: K, value: PromotionTerms[K]) => {
    setTerms(current => ({ ...current, [key]: value })); setState("dirty"); setError(null)
  }, [])
  const save = async () => {
    if (pending.current || !canManage || conflict) return
    const parsed = PromotionTermsSchema.safeParse(terms)
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Проверьте условия промокода"); return }
    const fingerprint = JSON.stringify([id, promotion?.version, parsed.data])
    if (command.current?.fingerprint !== fingerprint) {
      const operationId = crypto.randomUUID()
      command.current = { fingerprint, input: { terms: parsed.data, operationId, idempotencyKey: operationId, ...(promotion ? { expectedVersion: promotion.version } : {}) } }
    }
    pending.current = true; setState("saving"); setError(null)
    try {
      const saved = promotion ? await repository.update(promotion.id, command.current.input as PromotionUpdate) : await repository.create(command.current.input)
      setPromotion(saved); setTerms(saved.terms); setState("saved"); command.current = null
      if (id === "new") navigate(`/marketing/promotions/${saved.id}`, { replace: true })
    } catch (reason: unknown) {
      const hasConflict = Boolean(promotion && reason instanceof ApiClientError && reason.isConflict)
      setConflict(hasConflict); setState(hasConflict ? "conflict" : "dirty")
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить промокод. Повторите попытку.")
    } finally { pending.current = false }
  }
  const disabled = loading || !canManage || state === "saving"
  const targetOptions: TargetOption[] = [
    ...(directory?.resources ?? []).map(resource => ({ id: resource.id, kind: "resource" as const, value: `resource:${resource.id}`, label: `Ресурс · ${resource.name}` })),
    ...(offeringOptions ?? []).map(offering => ({ id: offering.value, kind: "offering" as const, value: `offering:${offering.value}`, label: offering.label })),
  ]
  return <EditorFrame className="[&_[data-slot=editor-sidebar]]:hidden [&_[data-slot=editor-workspace]]:xl:grid-cols-1" navigation={<span className="text-xs font-medium">Условия промокода</span>} footerActions={<><Button onClick={() => navigate("/marketing?tab=promotions")} variant="outline">Закрыть</Button><Button disabled={disabled || Boolean(loadError) || conflict} onClick={() => void save()}>{state === "saving" ? "Сохраняем…" : "Сохранить"}</Button></>} saveState={state} sidebar={null}>
    {loading ? <Skeleton aria-label="Загрузка промокода" className="h-80" /> : loadError ? <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => setRetry(value => value + 1)} title="Промокод не загрузился">{loadError}</PageState> : <div className="space-y-3">
      {!canManage ? <p role="status" className="text-xs text-muted-foreground">Только просмотр: нет прав на управление промокодами.</p> : null}
      {error ? <div className="rounded-lg border p-3 text-xs" role="alert"><p className="text-danger-foreground">{error}</p>{conflict ? <><p className="mt-1">Ваши изменения сохранены в форме. Загрузка актуальной версии заменит их; автоматического перезаписывания нет.</p><Button className="mt-2" onClick={() => setRetry(value => value + 1)} size="sm" variant="outline">Загрузить актуальную версию</Button></> : null}</div> : null}
      <EditorSection title="Промокод"><fieldset className="grid min-w-0 gap-3 sm:grid-cols-6" disabled={disabled}>
        <FormField className="min-w-0 sm:col-span-4" htmlFor="promotion-name" label="Название"><Input id="promotion-name" maxLength={160} onChange={event => update("name", event.target.value)} value={terms.name} /></FormField>
        <FormField className="min-w-0 sm:col-span-2" htmlFor="promotion-code" label="Код"><Input autoCapitalize="characters" id="promotion-code" maxLength={40} onChange={event => update("code", event.target.value.toUpperCase())} value={terms.code} /></FormField>
        <FormField className="sm:col-span-2" htmlFor="promotion-type" label="Тип скидки"><FormSelect disabled={disabled} id="promotion-type" label="Тип скидки" onValueChange={value => { update("discountType", value as PromotionTerms["discountType"]); update("value", value === "percent" ? 10 : 10000) }} options={[{ value: "percent", label: "Процент" }, { value: "fixed", label: "Сумма в рублях" }]} value={terms.discountType} /></FormField>
        <FormField className="sm:col-span-2" htmlFor="promotion-value" label={terms.discountType === "percent" ? "Скидка, %" : "Скидка, ₽"}><Input id="promotion-value" min={terms.discountType === "percent" ? 1 : 0.01} max={terms.discountType === "percent" ? 100 : 1000000} onChange={event => update("value", terms.discountType === "percent" ? Number(event.target.value) : Math.round(Number(event.target.value) * 100))} step={terms.discountType === "percent" ? 1 : 0.01} type="number" value={terms.discountType === "percent" ? terms.value : terms.value / 100} /></FormField>
        <FormField className="sm:col-span-2" htmlFor="promotion-minimum" label="Минимальная сумма, ₽"><Input id="promotion-minimum" min={0} onChange={event => update("minimumAmountMinor", Math.round(Number(event.target.value) * 100))} step="0.01" type="number" value={terms.minimumAmountMinor / 100} /></FormField>
        <FormField className="min-w-0 sm:col-span-3" htmlFor="promotion-start" label="Действует с"><DateTimePicker id="promotion-start" label="Начало действия" onValueChange={value => update("startsAt", isoDate(value))} placeholder="Без ограничения" value={localDate(terms.startsAt)} /></FormField>
        <FormField className="min-w-0 sm:col-span-3" htmlFor="promotion-end" label="До (не включая)"><DateTimePicker id="promotion-end" label="Окончание действия" onValueChange={value => update("endsAt", isoDate(value))} placeholder="Без ограничения" value={localDate(terms.endsAt)} /></FormField>
        <p className="text-[11px] text-muted-foreground sm:col-span-6">Московское время. Пустые даты — без ограничения. Период определяет момент применения, не даты проживания.</p>
        <label className="flex min-w-0 items-center justify-between gap-4 rounded-lg border bg-muted/20 px-3 py-2.5 sm:col-span-6"><span className="min-w-0"><span className="block text-xs font-medium">Промокод включён</span><span className="mt-0.5 block break-words text-[11px] leading-4 text-muted-foreground">Выключенный промокод останется в списке, но его нельзя будет применить к новой брони.</span></span><Switch checked={terms.active} disabled={disabled} onCheckedChange={checked => update("active", Boolean(checked))} /></label>
      </fieldset></EditorSection>
      <EditorSection title="Где действует"><fieldset className="min-w-0 space-y-3" disabled={disabled}>
        <FormSelect disabled={disabled} id="promotion-scope" label="Область применения" onValueChange={value => { update("scope", value as PromotionTerms["scope"]); if (value === "all") { update("resourceIds", []); update("offeringIds", []) } }} options={[{ value: "all", label: "Все услуги" }, { value: "selected", label: "Выбранные ресурсы и услуги" }]} value={terms.scope} />
        {terms.scope === "selected" ? <><p className="text-xs text-muted-foreground">Выберите в одном поле ресурсы, основные услуги и допуслуги, на которые действует скидка.</p>
          {directoryError ? <p role="alert" className="text-xs text-danger-foreground">Не удалось загрузить ресурсы: {directoryError}</p> : !directory ? <p className="text-xs">Загружаем ресурсы…</p> : null}
          {offeringError ? <div role="alert" className="flex flex-wrap items-center gap-2 text-xs"><p className="min-w-0 flex-1 break-words text-danger-foreground">Не удалось загрузить услуги: {offeringError}</p><Button onClick={() => setOfferingRetry(value => value + 1)} size="sm" variant="outline">Повторить</Button></div> : !offeringOptions ? <p className="text-xs">Загружаем услуги…</p> : null}
          <PromotionTargetSelection disabled={disabled} onOfferingChange={value => update("offeringIds", value)} onResourceChange={value => update("resourceIds", value)} options={targetOptions} offeringIds={terms.offeringIds} resourceIds={terms.resourceIds} />
        </> : null}
      </fieldset></EditorSection>
    </div>}
  </EditorFrame>
}

function PromotionTargetSelection({ disabled, offeringIds, onOfferingChange, onResourceChange, options, resourceIds }: { disabled: boolean; offeringIds: string[]; onOfferingChange: (ids: string[]) => void; onResourceChange: (ids: string[]) => void; options: TargetOption[]; resourceIds: string[] }) {
  const selected = [...resourceIds.map(id => `resource:${id}`), ...offeringIds.map(id => `offering:${id}`)]
  const remove = (value: string) => {
    const option = options.find(item => item.value === value)
    if (option?.kind === "resource" || value.startsWith("resource:")) onResourceChange(resourceIds.filter(id => id !== (option?.id ?? value.slice("resource:".length))))
    else onOfferingChange(offeringIds.filter(id => id !== (option?.id ?? value.slice("offering:".length))))
  }
  const add = (value: string) => {
    const option = options.find(item => item.value === value)
    if (!option) return
    if (option.kind === "resource") onResourceChange([...resourceIds, option.id])
    else onOfferingChange([...offeringIds, option.id])
  }
  return <div className="min-w-0 space-y-2"><p className="text-xs font-medium">Ресурсы и услуги</p>{!disabled && (resourceIds.length < 100 || offeringIds.length < 100) ? <EntityCombobox label="Добавить ресурс или услугу" onValueChange={add} options={options.filter(option => !selected.includes(option.value) && (option.kind === "resource" ? resourceIds.length < 100 : offeringIds.length < 100))} placeholder="Выберите ресурс или услугу" searchPlaceholder="Поиск по ресурсам и услугам…" value="" /> : null}<div className="flex min-w-0 flex-wrap gap-2">{selected.map((value, index) => { const option = options.find(item => item.value === value); const label = option?.label ?? `Недоступная позиция ${index + 1}`; return <span className="inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs" key={value}><span className="min-w-0 break-words">{label}</span>{!disabled ? <Button aria-label={`Убрать ${label}`} className="shrink-0" onClick={() => remove(value)} size="icon-sm" variant="ghost"><IconX aria-hidden="true" /></Button> : null}</span> })}</div>{selected.length === 0 ? <p className="text-[11px] text-muted-foreground">Ничего не выбрано</p> : null}</div>
}
