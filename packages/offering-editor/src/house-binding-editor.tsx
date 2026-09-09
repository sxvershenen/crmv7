import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IconAlertTriangle, IconBuildingCottage, IconLock, IconRefresh, IconSearch, IconTent, IconUsers } from "@tabler/icons-react"

import type {
  CampgroundOfferingBindingsReplaceBody,
  HouseOfferingBindingsReplaceBody,
  InternalOfferingEditor,
  OfferingBindingTargetLookupItem,
  OfferingBindingTargetSummary,
} from "@crm/contracts"
import { Button, EditorSection, FormField, IconBox, Input, LoadingRows, PageState, StatusBadge, Switch } from "@crm/ui"

import {
  isOfferingEditorConflict,
  offeringEditorErrorMessage,
  type OfferingEditorGateway,
} from "./gateway.js"

export type OfferingEditorSubjectCommandMeta = Pick<
  HouseOfferingBindingsReplaceBody,
  "operationId" | "idempotencyKey" | "expectedSubjectVersion"
>

export type OfferingEditorSubjectCommandMetaFactory = () => OfferingEditorSubjectCommandMeta
type SaveState = "dirty" | "saving" | "saved" | "conflict"
type StayOfferingBindingsReplaceBody = HouseOfferingBindingsReplaceBody | CampgroundOfferingBindingsReplaceBody

type BindingDraft = {
  availabilityRequired: boolean
  defaultCapacityImpact: string
  defaultQuantity: string
  preparationAfterMinutes: string
  preparationBeforeMinutes: string
  target: OfferingBindingTargetSummary | null
}

export function HouseBindingEditor({
  createCommandMeta,
  editor,
  gateway,
  onReload,
  onSaveActionChange,
  onSaveState,
}: {
  createCommandMeta: OfferingEditorSubjectCommandMetaFactory
  editor: InternalOfferingEditor
  gateway: Pick<OfferingEditorGateway, "listBindingTargets" | "replaceHouseBindings">
  onReload: () => Promise<void>
  onSaveActionChange?: (action: (() => void) | null) => void
  onSaveState: (state: SaveState, detail: string) => void
}) {
  return <StayBindingEditor createCommandMeta={createCommandMeta} editor={editor} gateway={gateway} kind="house" onReload={onReload} {...(onSaveActionChange ? { onSaveActionChange } : {})} onSaveState={onSaveState} replaceBindings={(offeringId, body) => gateway.replaceHouseBindings(offeringId, body as HouseOfferingBindingsReplaceBody)} />
}

export function CampgroundBindingEditor({
  createCommandMeta,
  editor,
  gateway,
  onReload,
  onSaveActionChange,
  onSaveState,
}: {
  createCommandMeta: OfferingEditorSubjectCommandMetaFactory
  editor: InternalOfferingEditor
  gateway: Pick<OfferingEditorGateway, "listBindingTargets" | "replaceCampgroundBindings">
  onReload: () => Promise<void>
  onSaveActionChange?: (action: (() => void) | null) => void
  onSaveState: (state: SaveState, detail: string) => void
}) {
  return <StayBindingEditor createCommandMeta={createCommandMeta} editor={editor} gateway={gateway} kind="campground" onReload={onReload} {...(onSaveActionChange ? { onSaveActionChange } : {})} onSaveState={onSaveState} replaceBindings={(offeringId, body) => gateway.replaceCampgroundBindings(offeringId, body as CampgroundOfferingBindingsReplaceBody)} />
}

function StayBindingEditor({
  createCommandMeta,
  editor,
  gateway,
  kind,
  onReload,
  onSaveActionChange,
  onSaveState,
  replaceBindings,
}: {
  createCommandMeta: OfferingEditorSubjectCommandMetaFactory
  editor: InternalOfferingEditor
  gateway: Pick<OfferingEditorGateway, "listBindingTargets">
  kind: "house" | "campground"
  onReload: () => Promise<void>
  onSaveActionChange?: (action: (() => void) | null) => void
  onSaveState: (state: SaveState, detail: string) => void
  replaceBindings: (offeringId: string, body: StayOfferingBindingsReplaceBody) => Promise<unknown>
}) {
  const campground = kind === "campground" && editor.offering.fulfillment.kind === "campground" ? editor.offering.fulfillment : null
  const expectedCapacityMode = campground?.salesUnit === "owned_tent" ? "fixed" : campground?.salesUnit === "own_tent_pitch" ? "shared" : null
  const subtypeLabel = campground?.salesUnit === "owned_tent" ? "Наша палатка · отдельный объект" : campground ? "Гостевая палатка · общая зона" : null
  const capacityLabel = campground?.salesUnit === "own_tent_pitch" ? "Палаточных мест" : "Гостей"
  const initialDraft = useMemo(() => bindingDraftFromEditor(editor), [editor])
  const [draft, setDraft] = useState<BindingDraft>(initialDraft)
  const [dirty, setDirty] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const command = useRef<{ body: StayOfferingBindingsReplaceBody; key: string } | null>(null)
  const saveRef = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    if (dirty || conflict) return
    setDraft(initialDraft)
    setSaveError(null)
    command.current = null
  }, [conflict, dirty, initialDraft])

  const writable = editor.capabilities.subject.canManageBindings
  const update = (patch: Partial<BindingDraft>) => {
    if (!writable || conflict) return
    command.current = null
    setDraft((current) => ({ ...current, ...patch }))
    setDirty(true)
    setSaveError(null)
    onSaveState("dirty", kind === "campground" ? "Места и зона изменены" : "Состав домика изменён")
  }

  const draftKey = JSON.stringify({
    ...draft,
    target: draft.target?.id ?? null,
  })
  const buildBody = () => {
    if (!draft.target) throw new Error(kind === "campground" ? "Выберите основной ресурс кемпинга." : "Выберите основной ресурс домика.")
    const quantity = integerInRange(draft.defaultQuantity, 1, 1_000_000, "Количество")
    const capacityImpact = integerInRange(draft.defaultCapacityImpact, 0, 1_000_000, "Влияние на вместимость")
    const before = integerInRange(draft.preparationBeforeMinutes, 0, 10_080, "Подготовка до")
    const after = integerInRange(draft.preparationAfterMinutes, 0, 10_080, "Подготовка после")
    const meta = createCommandMeta()
    return {
      ...meta,
      bindings: [{
        availabilityRequired: draft.availabilityRequired,
        defaultCapacityImpact: capacityImpact,
        defaultQuantity: quantity,
        preparationAfterMinutes: after,
        preparationBeforeMinutes: before,
        role: "primary" as const,
        target: { id: draft.target.id, type: "resource" as const },
      }],
    } satisfies StayOfferingBindingsReplaceBody
  }

  const save = async () => {
    if (!writable) return
    setSaveError(null)
    let body: StayOfferingBindingsReplaceBody
    try {
      const cached = command.current
      body = cached?.key === draftKey ? cached.body : buildBody()
      command.current = { body, key: draftKey }
    } catch (bodyError) {
      const message = offeringEditorErrorMessage(bodyError, "Проверьте параметры основной привязки.")
      setSaveError(message)
      onSaveState("dirty", message)
      return
    }

    onSaveState("saving", "Сохраняем состав и проверяем версию ресурса")
    try {
      await replaceBindings(editor.offering.id, body)
      command.current = null
      setDirty(false)
      setConflict(false)
      onSaveState("saved", "Состав сохранён")
      await onReload()
    } catch (mutationError) {
      const message = offeringEditorErrorMessage(mutationError, kind === "campground" ? "Не удалось сохранить места и зону." : "Не удалось сохранить состав домика.")
      const isConflict = isOfferingEditorConflict(mutationError)
      setSaveError(message)
      setConflict(isConflict)
      setDirty(true)
      onSaveState(isConflict ? "conflict" : "dirty", message)
      if (isConflict) {
        try {
          await onReload()
        } catch (reloadError) {
          setSaveError(offeringEditorErrorMessage(reloadError, "Конфликт сохранён локально; серверную версию не удалось обновить."))
        }
      }
    }
  }

  const reloadServer = async () => {
    try {
      await onReload()
      command.current = null
      setConflict(false)
      setSaveError(null)
      onSaveState("dirty", "Серверная версия обновлена; локальный состав сохранён для сравнения")
    } catch (reloadError) {
      setSaveError(offeringEditorErrorMessage(reloadError, "Не удалось обновить серверную версию."))
    }
  }
  saveRef.current = conflict ? reloadServer : save

  useEffect(() => {
    if (!onSaveActionChange) return
    const action = () => { void saveRef.current() }
    onSaveActionChange(action)
    return () => onSaveActionChange(null)
  }, [onSaveActionChange])

  return <div className="space-y-3">
    {!writable ? <ReadOnlyNotice /> : null}
    {conflict ? <ConflictNotice draft={draft} error={saveError} onReload={() => void reloadServer()} onRetry={() => void save()} server={bindingDraftFromEditor(editor)} /> : null}
    {saveError && !conflict ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Состав не сохранён" tone="danger">{saveError}</PageState></div> : null}
    <EditorSection actions={subtypeLabel ? <StatusBadge tone="info">{subtypeLabel}</StatusBadge> : null} subtitle={kind === "campground" ? "Кемпинг использует один основной Resource. Группа ресурсов не является продаваемой единицей." : "Домик v1 использует ровно один основной Resource. Доступность, capacity и архивный статус приходят из CRM."} title="Основной ресурс">
      <PrimaryResourceCard capacityLabel={capacityLabel} kind={kind} target={draft.target} />
      {draft.target && expectedCapacityMode && draft.target.capacity.mode !== expectedCapacityMode ? <CapacityModeWarning expected={expectedCapacityMode} salesUnit={campground!.salesUnit} /> : null}
      {draft.target?.archived ? <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2.5 text-xs text-warning-foreground"><IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p><strong>Архивный ресурс.</strong> Он сохранён для восстановления контекста, но не возвращается в поиск и не может быть выбран заново.</p></div> : null}
      <ResourceLookup capacityLabel={capacityLabel} expectedCapacityMode={expectedCapacityMode} gateway={gateway} kind={kind} onSelect={(target) => update({ target })} selectedId={draft.target?.id ?? null} selectionDisabled={!writable || conflict} />
    </EditorSection>
    <EditorSection subtitle="Роль фиксирована как primary; параметры применяются к проверке доступности и подготовке." title="Условия привязки">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FormField htmlFor="binding-quantity" label="Количество"><Input disabled={!writable || conflict} id="binding-quantity" min="1" onChange={(event) => update({ defaultQuantity: event.target.value })} type="number" value={draft.defaultQuantity} /></FormField>
        <FormField htmlFor="binding-capacity" label="Влияние на вместимость"><Input disabled={!writable || conflict} id="binding-capacity" min="0" onChange={(event) => update({ defaultCapacityImpact: event.target.value })} type="number" value={draft.defaultCapacityImpact} /></FormField>
        <FormField htmlFor="binding-before" label="Подготовка до, мин"><Input disabled={!writable || conflict} id="binding-before" min="0" onChange={(event) => update({ preparationBeforeMinutes: event.target.value })} type="number" value={draft.preparationBeforeMinutes} /></FormField>
        <FormField htmlFor="binding-after" label="Подготовка после, мин"><Input disabled={!writable || conflict} id="binding-after" min="0" onChange={(event) => update({ preparationAfterMinutes: event.target.value })} type="number" value={draft.preparationAfterMinutes} /></FormField>
        <div className="flex min-h-9 items-end"><label className="flex cursor-pointer items-center gap-2 pb-2 text-xs font-medium"><Switch aria-label="Проверять доступность" checked={draft.availabilityRequired} disabled={!writable || conflict} onCheckedChange={(checked) => update({ availabilityRequired: checked })} size="sm" />Проверять доступность</label></div>
      </div>
    </EditorSection>
  </div>
}

function bindingDraftFromEditor(editor: InternalOfferingEditor): BindingDraft {
  const primary = editor.bindings.find((binding) => binding.role === "primary")
  const target = primary?.target.type === "resource" ? editor.bindingTargets.find((candidate) => candidate.id === primary.target.id) ?? null : null
  return {
    availabilityRequired: primary?.availabilityRequired ?? true,
    defaultCapacityImpact: String(primary?.defaultCapacityImpact ?? 1),
    defaultQuantity: String(primary?.defaultQuantity ?? 1),
    preparationAfterMinutes: String(primary?.preparationAfterMinutes ?? 0),
    preparationBeforeMinutes: String(primary?.preparationBeforeMinutes ?? 0),
    target,
  }
}

function PrimaryResourceCard({ capacityLabel, kind, target }: { capacityLabel: string; kind: "house" | "campground"; target: OfferingBindingTargetSummary | null }) {
  const ResourceIcon = kind === "campground" ? IconTent : IconBuildingCottage
  if (!target) return <PageState icon={IconAlertTriangle} title="Основной ресурс не задан" tone="warning">Выберите операционный ресурс перед сохранением состава.</PageState>
  return <div className="grid gap-3 rounded-xl border bg-background p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
    <IconBox icon={ResourceIcon} size="lg" variant={kind === "campground" ? "info" : "resourceHouses"} />
    <div className="min-w-0"><p className="truncate text-[13px] font-semibold">{target.name}</p><p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{target.code} · {target.kind}</p></div>
    <div className="flex flex-wrap items-center gap-1.5 text-[10px]"><span className="rounded-md bg-muted px-2 py-1"><IconUsers aria-hidden="true" className="mr-1 inline size-3" />{capacityLabel}: {target.capacity.total}</span><StatusBadge tone="neutral">{target.capacity.mode === "shared" ? "Общая" : "Фиксированная"}</StatusBadge>{target.archived ? <StatusBadge tone="warning">В архиве</StatusBadge> : <StatusBadge tone="success">Активен</StatusBadge>}</div>
  </div>
}

function ResourceLookup({ capacityLabel, expectedCapacityMode, gateway, kind, onSelect, selectedId, selectionDisabled }: { capacityLabel: string; expectedCapacityMode: "fixed" | "shared" | null; gateway: Pick<OfferingEditorGateway, "listBindingTargets">; kind: "house" | "campground"; onSelect: (target: OfferingBindingTargetLookupItem) => void; selectedId: string | null; selectionDisabled: boolean }) {
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<OfferingBindingTargetLookupItem[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (nextCursor?: string, append = false) => {
    setLoading(true)
    setError(null)
    try {
      const response = await gateway.listBindingTargets({
        targetType: "resource",
        kind,
        limit: 12,
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(nextCursor ? { cursor: nextCursor } : {}),
      })
      setItems((current) => append ? [...(current ?? []), ...response.items] : response.items)
      setCursor(response.nextCursor)
    } catch (lookupError) {
      setError(offeringEditorErrorMessage(lookupError, "Не удалось загрузить ресурсы."))
      if (!append) setItems([])
    } finally {
      setLoading(false)
    }
  }, [gateway, kind, query])

  useEffect(() => { void load() }, [load])

  const ResourceIcon = kind === "campground" ? IconTent : IconBuildingCottage
  return <div className="mt-3 border-t pt-3" data-slot={`${kind}-resource-lookup`}>
    <FormField htmlFor="binding-resource-search" label="Найти ресурс по названию или коду"><div className="relative"><IconSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="binding-resource-search" onChange={(event) => setQuery(event.target.value)} placeholder="Например, Лесной или house_lesnoy" value={query} className="pl-9" /></div></FormField>
    <div className="mt-2 overflow-hidden rounded-lg border bg-background">
      {loading && items === null ? <LoadingRows count={3} /> : null}
      {error ? <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title="Ресурсы не загрузились" tone="danger">{error}</PageState> : null}
      {!loading && !error && !items?.length ? <PageState icon={IconSearch} title={query.trim() ? "Ресурсы не найдены" : "Нет доступных ресурсов"}>{query.trim() ? "Попробуйте название или код без дополнительных фильтров." : "Архивные ресурсы намеренно не показываются в выборе."}</PageState> : null}
      {items?.map((item) => { const mismatch = expectedCapacityMode !== null && item.capacity.mode !== expectedCapacityMode; return <button aria-pressed={item.id === selectedId} className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 enabled:hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60" disabled={selectionDisabled} key={item.id} onClick={() => onSelect(item)} type="button"><IconBox icon={ResourceIcon} size="sm" variant={kind === "campground" ? "info" : "resourceHouses"} /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{item.name}</span><span className="block truncate font-mono text-[10px] text-muted-foreground">{item.code} · {item.kind}</span></span><span className="shrink-0 text-[10px] text-muted-foreground">{capacityLabel}: {item.capacity.total}</span>{mismatch ? <StatusBadge tone="warning">Режим не совпадает</StatusBadge> : null}{item.id === selectedId ? <StatusBadge tone="info">Выбран</StatusBadge> : null}</button> })}
      {loading && items?.length ? <div className="px-3 py-2 text-xs text-muted-foreground" role="status">Загрузка ресурсов…</div> : null}
    </div>
    {cursor ? <Button className="mt-2" disabled={loading} onClick={() => void load(cursor, true)} size="sm" variant="outline"><IconRefresh aria-hidden="true" />Показать ещё</Button> : null}
  </div>
}

function CapacityModeWarning({ expected, salesUnit }: { expected: "fixed" | "shared"; salesUnit: "owned_tent" | "own_tent_pitch" }) {
  return <div className="mt-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-subtle px-3 py-2.5 text-xs text-warning-foreground" role="alert"><IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p><strong>Режим вместимости не совпадает.</strong> Для {salesUnit === "owned_tent" ? "отдельной нашей палатки" : "общей зоны гостевых палаток"} нужен {expected === "fixed" ? "фиксированный" : "общий"} Resource. Список фильтруется только по kind=campground; окончательную проверку выполнит backend при сохранении.</p></div>
}

function ReadOnlyNotice() {
  return <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-subtle p-3 text-xs text-warning-foreground"><IconLock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">Только просмотр состава</p><p className="mt-0.5">Поиск и сведения о ресурсах доступны, но менять привязку может только пользователь с правом управления составом.</p></div></div>
}

function ConflictNotice({ draft, error, onReload, onRetry, server }: { draft: BindingDraft; error: string | null; onReload: () => void; onRetry: () => void; server: BindingDraft }) {
  return <div className="rounded-xl border border-danger/25 bg-danger-subtle/20 p-4 text-xs" data-slot="binding-conflict-comparison"><div className="flex items-start gap-2"><IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-foreground" /><div><p className="font-semibold">Состав изменился на сервере</p><p className="mt-1 text-muted-foreground">Локальный черновик сохранён и заблокирован. Повторный запрос отправит ровно те же данные; после обновления версии сможете сравнить и изменить состав заново.</p>{error ? <p className="mt-1 text-danger-foreground">{error}</p> : null}</div></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border bg-background p-3"><p className="font-medium">Локальный вариант</p><p className="mt-1">{draft.target?.name ?? "Ресурс не выбран"} · {draft.defaultQuantity} ед.</p></div><div className="rounded-lg border bg-background p-3"><p className="font-medium">Версия сервера</p><p className="mt-1">{server.target?.name ?? "Ресурс не задан"} · {server.defaultQuantity} ед.</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Button onClick={onRetry} size="sm" variant="outline">Повторить запрос</Button><Button onClick={onReload} size="sm" variant="outline">Обновить серверную версию</Button></div></div>
}

function integerInRange(value: string, min: number, max: number, label: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error(`${label}: укажите целое число от ${min} до ${max}.`)
  return parsed
}
