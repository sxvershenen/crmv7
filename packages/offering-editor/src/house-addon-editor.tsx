import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { IconAlertTriangle, IconLock, IconPlus, IconRefresh, IconSearch, IconTrash } from "@tabler/icons-react"

import type { AddOnCatalogItem, AddOnLibraryItem, AddOnServiceType, InternalOfferingEditor, OfferingAddOnAssignmentDraft, OfferingAddOnAssignmentsReplaceBody, OfferingCustomAddOnCreateBody } from "@crm/contracts"
import { Button, EditorSection, FormField, FormSelect, Input, LoadingRows, PageState, StatusBadge, Switch } from "@crm/ui"

import { isOfferingEditorConflict, offeringEditorErrorMessage, type OfferingEditorGateway } from "./gateway.js"

export type OfferingEditorAddOnsCommandMeta = Pick<OfferingAddOnAssignmentsReplaceBody, "operationId" | "idempotencyKey" | "expectedAddOnsVersion">
export type OfferingEditorAddOnsCommandMetaFactory = () => OfferingEditorAddOnsCommandMeta
type SaveState = "dirty" | "saving" | "saved" | "conflict"

type AssignmentDraft = OfferingAddOnAssignmentDraft

export function HouseAddOnEditor({
  compact = false,
  createCommandMeta,
  editor,
  gateway,
  onReload,
  onSaveActionChange,
  onSaveState,
}: {
  compact?: boolean
  createCommandMeta: OfferingEditorAddOnsCommandMetaFactory
  editor: InternalOfferingEditor
  gateway: Pick<OfferingEditorGateway, "createCustomAddOn" | "listAddOnLibrary" | "replaceAddOnAssignments">
  onReload: () => Promise<void>
  onSaveActionChange?: (action: (() => void) | null) => void
  onSaveState: (state: SaveState, detail: string) => void
}) {
  const initialDraft = useMemo(() => editor.addOnAssignments.map(toDraft), [editor.addOnAssignments])
  const [draft, setDraft] = useState<AssignmentDraft[]>(initialDraft)
  const [dirty, setDirty] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [localCatalog, setLocalCatalog] = useState<Map<string, AddOnCatalogItem>>(() => new Map())
  const command = useRef<{ body: OfferingAddOnAssignmentsReplaceBody; key: string } | null>(null)
  const saveRef = useRef<() => Promise<void>>(async () => undefined)
  const writable = editor.capabilities.addOns.canAssign

  useEffect(() => {
    if (dirty || conflict) return
    setDraft(initialDraft)
    setSaveError(null)
    command.current = null
  }, [conflict, dirty, initialDraft])

  const update = useCallback((id: string, patch: Partial<AssignmentDraft>) => {
    if (!writable || conflict) return
    command.current = null
    setDraft((current) => current.map((assignment) => assignment.addOnOfferingId === id ? normalizeDraft({ ...assignment, ...patch }) : assignment))
    setDirty(true)
    setSaveError(null)
    onSaveState("dirty", "Дополнительные услуги изменены")
  }, [conflict, onSaveState, writable])

  const add = useCallback((item: AddOnLibraryItem) => {
    if (!writable || conflict || !canAssignLibraryItem(item, editor.offering.id, draft)) return
    command.current = null
    setDraft((current) => [...current, emptyDraft(item.offering.id, current.length)])
    setLocalCatalog((current) => new Map(current).set(item.offering.id, libraryItemToCatalog(item)))
    setDirty(true)
    setSaveError(null)
    onSaveState("dirty", "Дополнительная услуга добавлена")
  }, [conflict, draft, editor.offering.id, onSaveState, writable])

  const remove = useCallback((id: string) => {
    if (!writable || conflict) return
    command.current = null
    setDraft((current) => current.filter((assignment) => assignment.addOnOfferingId !== id).map((assignment, index) => ({ ...assignment, displayOrder: index })))
    setDirty(true)
    setSaveError(null)
    onSaveState("dirty", "Дополнительная услуга удалена")
  }, [conflict, onSaveState, writable])

  const draftKey = JSON.stringify(draft)
  const buildBody = useCallback(() => ({
    ...createCommandMeta(),
    assignments: draft.map((assignment, index) => ({ ...normalizeDraft(assignment), displayOrder: index })),
  } satisfies OfferingAddOnAssignmentsReplaceBody), [createCommandMeta, draft])
  const save = useCallback(async () => {
    if (!writable) return
    setSaveError(null)
    let body: OfferingAddOnAssignmentsReplaceBody
    try {
      const cached = command.current
      body = cached?.key === draftKey ? cached.body : buildBody()
      command.current = { body, key: draftKey }
    } catch (bodyError) {
      const message = offeringEditorErrorMessage(bodyError, "Проверьте параметры дополнительных услуг.")
      setSaveError(message)
      onSaveState("dirty", message)
      return
    }
    onSaveState("saving", "Сохраняем дополнительные услуги и проверяем их версию")
    try {
      await gateway.replaceAddOnAssignments(editor.offering.id, body)
      command.current = null
      setDirty(false)
      setConflict(false)
      onSaveState("saved", "Дополнительные услуги сохранены")
      await onReload()
      setLocalCatalog(new Map())
    } catch (mutationError) {
      const message = offeringEditorErrorMessage(mutationError, "Не удалось сохранить дополнительные услуги.")
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
  }, [buildBody, draftKey, editor.offering.id, gateway, onReload, onSaveState, writable])

  const reloadServer = useCallback(async () => {
    try {
      await onReload()
      setConflict(false)
      setSaveError(null)
      onSaveState("dirty", "Серверная версия обновлена; локальный набор услуг сохранён для сравнения")
    } catch (reloadError) {
      setSaveError(offeringEditorErrorMessage(reloadError, "Не удалось обновить серверную версию."))
    }
  }, [onReload, onSaveState])
  saveRef.current = conflict ? reloadServer : save

  useEffect(() => {
    if (!onSaveActionChange) return
    const action = () => { void saveRef.current() }
    onSaveActionChange(action)
    return () => onSaveActionChange(null)
  }, [onSaveActionChange])

  const catalogById = useMemo(() => new Map([...editor.addOnCatalog.map((item) => [item.offering.id, item] as const), ...localCatalog]), [editor.addOnCatalog, localCatalog])
  if (compact) return <div className="space-y-3" data-slot="house-addon-editor">
    {!writable ? <ReadOnlyNotice canSearch={editor.capabilities.addOns.canSearch} /> : null}
    {conflict ? <ConflictNotice draft={draft} error={saveError} onReload={() => void reloadServer()} onRetry={() => void save()} server={initialDraft} catalog={catalogById} /> : null}
    {saveError && !conflict ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Дополнительные услуги не сохранены" tone="danger">{saveError}</PageState></div> : null}
    <EditorSection subtitle="Выберите услуги, которые можно предложить вместе с этим ресурсом." title="Дополнительные услуги">
      {draft.length ? <div className="divide-y overflow-hidden rounded-lg border bg-background">{draft.map((assignment) => <CompactAssignedAddOnRow catalog={catalogById.get(assignment.addOnOfferingId) ?? null} disabled={!writable || conflict} key={assignment.addOnOfferingId} onRemove={() => remove(assignment.addOnOfferingId)} onUpdate={(patch) => update(assignment.addOnOfferingId, patch)} value={assignment} />)}</div> : <div className="rounded-lg border border-dashed bg-muted/15 px-3 py-4 text-center text-xs text-muted-foreground">Услуги пока не добавлены.</div>}
      <AddOnLookup canAssign={writable && !conflict} canSearch={editor.capabilities.addOns.canSearch} compact gateway={gateway} offeringId={editor.offering.id} onAdd={add} selected={draft} />
    </EditorSection>
  </div>
  return <div className="space-y-3" data-slot="house-addon-editor">
    {!writable ? <ReadOnlyNotice canSearch={editor.capabilities.addOns.canSearch} /> : null}
    {conflict ? <ConflictNotice draft={draft} error={saveError} onReload={() => void reloadServer()} onRetry={() => void save()} server={initialDraft} catalog={catalogById} /> : null}
    {saveError && !conflict ? <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Дополнительные услуги не сохранены" tone="danger">{saveError}</PageState></div> : null}
    <EditorSection subtitle="Состав услуг сохраняется отдельной версией. Цены и доступность приходят из самих допов." title="Дополнительные услуги">
      {draft.length ? <div className="space-y-2">{draft.map((assignment) => <AssignedAddOnCard catalog={catalogById.get(assignment.addOnOfferingId) ?? null} disabled={!writable || conflict} key={assignment.addOnOfferingId} onRemove={() => remove(assignment.addOnOfferingId)} onUpdate={(patch) => update(assignment.addOnOfferingId, patch)} value={assignment} />)}</div> : <PageState icon={IconPlus} title="Дополнительные услуги не подключены">Добавьте готовую активную услугу из библиотеки ниже.</PageState>}
      <AddOnLookup canAssign={writable && !conflict} canSearch={editor.capabilities.addOns.canSearch} gateway={gateway} offeringId={editor.offering.id} onAdd={add} selected={draft} />
      <CustomAddOnCreator canCreate={writable && editor.capabilities.addOns.canCreate && !dirty && !conflict} createCommandMeta={createCommandMeta} displayOrder={draft.length} editor={editor} gateway={gateway} onReload={onReload} />
    </EditorSection>
  </div>
}

type CustomAddOnDraft = {
  categoryKey: string
  operationalName: string
  serviceType: AddOnServiceType
}

const customAddOnDefaults: CustomAddOnDraft = {
  categoryKey: "custom",
  operationalName: "",
  serviceType: "quantity_service",
}

/**
 * A new add-on is an atomic server command, not an unsaved assignment row.
 * It intentionally starts disabled because its own active PriceBook is a
 * separate commercial decision after creation.
 */
function CustomAddOnCreator({ canCreate, createCommandMeta, displayOrder, editor, gateway, onReload }: {
  canCreate: boolean
  createCommandMeta: OfferingEditorAddOnsCommandMetaFactory
  displayOrder: number
  editor: InternalOfferingEditor
  gateway: Pick<OfferingEditorGateway, "createCustomAddOn">
  onReload: () => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CustomAddOnDraft>(customAddOnDefaults)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const command = useRef<{ body: OfferingCustomAddOnCreateBody; key: string } | null>(null)

  const update = useCallback((patch: Partial<CustomAddOnDraft>) => {
    command.current = null
    setDraft((current) => ({ ...current, ...patch }))
    setError(null)
    setConflict(false)
  }, [])
  const reset = useCallback(() => {
    command.current = null
    setDraft(customAddOnDefaults)
    setError(null)
    setConflict(false)
    setOpen(false)
  }, [])
  const buildBody = useCallback(() => {
    const operationalName = draft.operationalName.trim()
    const categoryKey = draft.categoryKey.trim()
    if (!operationalName) throw new Error("Укажите название дополнительной услуги.")
    if (!/^[a-z][a-z0-9_]*$/.test(categoryKey)) throw new Error("Категория — короткий ключ латиницей: например, custom или comfort.")
    return {
      ...createCommandMeta(),
      addOn: {
        operationalName,
        internalComment: "",
        serviceType: draft.serviceType,
        categoryKey,
        standalone: false,
        salesMode: "request_only",
        priceDisplayMode: "request",
      },
      assignment: {
        enabled: false,
        required: false,
        recommended: false,
        groupKey: null,
        ratePlanKeyOverride: null,
        labelOverride: null,
        descriptionOverride: null,
        minQuantityOverride: null,
        maxQuantityOverride: null,
        defaultQuantityOverride: null,
        displayOrder,
      },
    } satisfies OfferingCustomAddOnCreateBody
  }, [createCommandMeta, displayOrder, draft])
  const draftKey = JSON.stringify(draft)
  const create = useCallback(async () => {
    if (!canCreate || creating) return
    setError(null)
    let body: OfferingCustomAddOnCreateBody
    try {
      const cached = command.current
      body = cached?.key === draftKey ? cached.body : buildBody()
      command.current = { body, key: draftKey }
    } catch (bodyError) {
      setError(offeringEditorErrorMessage(bodyError, "Проверьте параметры новой услуги."))
      return
    }
    setCreating(true)
    try {
      await gateway.createCustomAddOn(editor.offering.id, body)
      // The new identity, assignment and readiness always come back through
      // the authoritative editor projection rather than a locally fabricated row.
      await onReload()
      reset()
    } catch (createError) {
      setError(offeringEditorErrorMessage(createError, "Не удалось создать дополнительную услугу."))
      setConflict(isOfferingEditorConflict(createError))
      if (isOfferingEditorConflict(createError)) {
        try {
          await onReload()
        } catch (reloadError) {
          setError(offeringEditorErrorMessage(reloadError, "Конфликт сохранён локально; серверную версию не удалось обновить."))
        }
      }
    } finally {
      setCreating(false)
    }
  }, [buildBody, canCreate, creating, draftKey, editor.offering.id, gateway, onReload, reset])

  if (!canCreate && !open) return null
  return <div className="mt-3 border-t pt-3" data-slot="custom-addon-creator">
    {!open ? <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2.5"><div className="min-w-0"><p className="text-xs font-semibold">Нужной услуги нет в библиотеке?</p><p className="mt-0.5 text-[11px] text-muted-foreground">Создайте связанную услугу-черновик для этого домика.</p></div><Button onClick={() => setOpen(true)} size="sm" variant="outline"><IconPlus aria-hidden="true" />Создать свой доп</Button></div> : <div className="rounded-xl border bg-muted/15 p-3" data-slot="custom-addon-form">
      <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold">Свой дополнительный сервис</p><p className="mt-0.5 text-[11px] text-muted-foreground">Создастся черновиком и будет добавлен к этому домику выключенным.</p></div><StatusBadge tone="warning">Нужна отдельная цена</StatusBadge></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px_180px]">
        <FormField htmlFor="custom-addon-name" label="Название допа"><Input autoFocus disabled={creating || !canCreate} id="custom-addon-name" onChange={(event) => update({ operationalName: event.target.value })} placeholder="Например, Романтический набор" value={draft.operationalName} /></FormField>
        <FormField htmlFor="custom-addon-category" label="Категория"><Input disabled={creating || !canCreate} id="custom-addon-category" onChange={(event) => update({ categoryKey: event.target.value })} placeholder="custom" value={draft.categoryKey} /></FormField>
        <FormSelect disabled={creating || !canCreate} id="custom-addon-service-type" label="Формат" onValueChange={(serviceType) => update({ serviceType: serviceType as AddOnServiceType })} options={customServiceTypeOptions} value={draft.serviceType} />
      </div>
      <div className="mt-3 rounded-lg border border-warning/20 bg-background px-3 py-2 text-[11px] text-muted-foreground">После создания назначение останется выключенным: сначала настройте и активируйте отдельный PriceBook допа, затем включите его в карточке выше.</div>
      {error ? <div className="mt-3 rounded-lg border border-danger/25 bg-danger-subtle/20 px-3 py-2 text-xs text-danger-foreground" role="alert"><p>{conflict ? "Версия услуг изменилась. Повторный запрос отправит те же данные." : error}</p>{conflict && error ? <p className="mt-1 text-muted-foreground">{error}</p> : null}</div> : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2"><Button disabled={creating} onClick={reset} size="sm" variant="ghost">Отмена</Button><Button disabled={creating || !canCreate || !draft.operationalName.trim()} onClick={() => void create()} size="sm">{creating ? "Создаём…" : conflict ? "Повторить запрос" : "Создать черновик"}</Button></div>
    </div>}
    {!canCreate && open ? <p className="mt-2 text-[11px] text-muted-foreground">Сначала сохраните изменения назначенных услуг, затем можно создать свой доп.</p> : null}
  </div>
}

function AssignedAddOnCard({ catalog, disabled, onRemove, onUpdate, value }: { catalog: AddOnCatalogItem | null; disabled: boolean; onRemove: () => void; onUpdate: (patch: Partial<AssignmentDraft>) => void; value: AssignmentDraft }) {
  const [showOverrides, setShowOverrides] = useState(hasOverrides(value))
  const name = catalog?.offering.operationalName ?? "Сводка услуги недоступна"
  const availability = catalog?.availability
  return <div className="rounded-xl border bg-background p-3" data-slot="assigned-addon-card">
    <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
      <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{name}</p><p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{catalog ? `${catalog.offering.code} · ${catalog.categoryKey}` : "Обновите редактор, чтобы получить безопасную сводку."}</p></div>
      <div className="flex flex-wrap items-center gap-1 text-[10px]"><StatusBadge tone="info">{serviceTypeLabel[catalog?.serviceType ?? "content_only"]}</StatusBadge><span className="rounded-md bg-muted px-2 py-1">{scopeLabel[catalog?.scope ?? "reusable"]}</span>{availability?.status === "blocked" ? <StatusBadge tone="warning">{blockerLabel[availability.blocker ?? "not_active"]}</StatusBadge> : <StatusBadge tone="success">Доступен</StatusBadge>}</div>
      <Button aria-label={`Удалить ${name}`} disabled={disabled} onClick={onRemove} size="icon-sm" variant="ghost"><IconTrash aria-hidden="true" /></Button>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs">
      <Toggle checked={value.enabled} disabled={disabled} label="Включён" onChange={(enabled) => onUpdate({ enabled })} />
      <Toggle checked={value.required} disabled={disabled || !value.enabled} label="Обязателен" onChange={(required) => onUpdate({ required, ...(required ? { enabled: true, recommended: false } : {}) })} />
      <Toggle checked={value.recommended} disabled={disabled} label="Рекомендуем" onChange={(recommended) => onUpdate({ recommended, ...(recommended ? { required: false } : {}) })} />
      <button className="text-xs text-primary underline-offset-2 hover:underline disabled:text-muted-foreground" disabled={disabled} onClick={() => setShowOverrides((current) => !current)} type="button">{showOverrides ? "Скрыть параметры" : "Параметры"}</button>
    </div>
    {showOverrides ? <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2 xl:grid-cols-5">
      <FormField htmlFor={`addon-min-${value.addOnOfferingId}`} label="Мин."><Input disabled={disabled} id={`addon-min-${value.addOnOfferingId}`} min="0" onChange={(event) => onUpdate({ minQuantityOverride: nullableInteger(event.target.value) })} placeholder="—" type="number" value={value.minQuantityOverride ?? ""} /></FormField>
      <FormField htmlFor={`addon-max-${value.addOnOfferingId}`} label="Макс."><Input disabled={disabled} id={`addon-max-${value.addOnOfferingId}`} min="1" onChange={(event) => onUpdate({ maxQuantityOverride: nullableInteger(event.target.value) })} placeholder="—" type="number" value={value.maxQuantityOverride ?? ""} /></FormField>
      <FormField htmlFor={`addon-default-${value.addOnOfferingId}`} label="По умолчанию"><Input disabled={disabled} id={`addon-default-${value.addOnOfferingId}`} min="0" onChange={(event) => onUpdate({ defaultQuantityOverride: nullableInteger(event.target.value) })} placeholder="—" type="number" value={value.defaultQuantityOverride ?? ""} /></FormField>
      <FormField htmlFor={`addon-group-${value.addOnOfferingId}`} label="Группа"><Input disabled={disabled} id={`addon-group-${value.addOnOfferingId}`} onChange={(event) => onUpdate({ groupKey: nullableText(event.target.value) })} placeholder="—" value={value.groupKey ?? ""} /></FormField>
      <FormField htmlFor={`addon-rate-${value.addOnOfferingId}`} label="Тариф"><Input disabled={disabled} id={`addon-rate-${value.addOnOfferingId}`} onChange={(event) => onUpdate({ ratePlanKeyOverride: nullableText(event.target.value) })} placeholder="—" value={value.ratePlanKeyOverride ?? ""} /></FormField>
      <FormField htmlFor={`addon-label-${value.addOnOfferingId}`} label="Подпись"><Input disabled={disabled} id={`addon-label-${value.addOnOfferingId}`} onChange={(event) => onUpdate({ labelOverride: nullableText(event.target.value) })} placeholder="Без переименования" value={value.labelOverride ?? ""} /></FormField>
    </div> : null}
  </div>
}

function CompactAssignedAddOnRow({ catalog, disabled, onRemove, onUpdate, value }: { catalog: AddOnCatalogItem | null; disabled: boolean; onRemove: () => void; onUpdate: (patch: Partial<AssignmentDraft>) => void; value: AssignmentDraft }) {
  const name = value.labelOverride ?? catalog?.offering.operationalName ?? "Услуга"
  const availability = catalog?.availability
  return <div className="flex min-w-0 flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{name}</p><p className="mt-0.5 truncate text-[10px] text-muted-foreground">{serviceTypeLabel[catalog?.serviceType ?? "content_only"]}</p></div>
    {availability?.status === "blocked" ? <StatusBadge tone="warning">{blockerLabel[availability.blocker ?? "not_active"]}</StatusBadge> : <StatusBadge tone="success">Готова</StatusBadge>}
    <label className="flex items-center gap-2 whitespace-nowrap text-xs"><Switch checked={value.enabled} disabled={disabled} onCheckedChange={(enabled) => onUpdate({ enabled: Boolean(enabled) })} size="sm" />Предлагать</label>
    <Button aria-label={`Убрать ${name}`} disabled={disabled} onClick={onRemove} size="icon-sm" variant="ghost"><IconTrash aria-hidden="true" /></Button>
  </div>
}

function AddOnLookup({ canAssign, canSearch, compact = false, gateway, offeringId, onAdd, selected }: { canAssign: boolean; canSearch: boolean; compact?: boolean; gateway: Pick<OfferingEditorGateway, "listAddOnLibrary">; offeringId: string; onAdd: (item: AddOnLibraryItem) => void; selected: AssignmentDraft[] }) {
  const [query, setQuery] = useState("")
  const [items, setItems] = useState<AddOnLibraryItem[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const load = useCallback(async (nextCursor?: string, append = false) => {
    if (!canSearch) return
    setLoading(true)
    setError(null)
    try {
      const response = await gateway.listAddOnLibrary({ limit: 12, scope: "reusable", ...(query.trim() ? { q: query.trim() } : {}), ...(nextCursor ? { cursor: nextCursor } : {}) })
      setItems((current) => append ? [...(current ?? []), ...response.items] : response.items)
      setCursor(response.nextCursor)
    } catch (lookupError) {
      setError(offeringEditorErrorMessage(lookupError, "Не удалось загрузить библиотеку услуг."))
      if (!append) setItems([])
    } finally { setLoading(false) }
  }, [canSearch, gateway, query])
  useEffect(() => { if (canSearch) void load() }, [canSearch, load])
  if (!canSearch) return <div className="mt-3 border-t pt-3 text-xs text-muted-foreground">Поиск в библиотеке недоступен для этой роли.</div>
  return <div className="mt-3 border-t pt-3" data-slot="addon-library-lookup">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
      <FormField htmlFor="addon-library-search" label="Добавить из библиотеки"><div className="relative"><IconSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" id="addon-library-search" onChange={(event) => setQuery(event.target.value)} placeholder="Название, код или категория" value={query} /></div></FormField>
      <Button aria-label="Обновить библиотеку услуг" disabled={loading} onClick={() => void load()} size="icon" variant="outline"><IconRefresh aria-hidden="true" /></Button>
    </div>
    <div className="mt-2 overflow-hidden rounded-lg border bg-background">
      {loading && items === null ? <LoadingRows count={3} /> : null}
      {error ? <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title="Библиотека не загрузилась" tone="danger">{error}</PageState> : null}
      {!loading && !error && !items?.length ? <PageState icon={IconSearch} title={query.trim() ? "Услуги не найдены" : "Библиотека пуста"}>{query.trim() ? "Попробуйте другой запрос." : "Создайте первую услугу в разделе «Допы и услуги»."}</PageState> : null}
      {items?.map((item) => {
        const available = canAssignLibraryItem(item, offeringId, selected)
        const reason = libraryBlocker(item, offeringId, selected)
        return <button aria-label={`Добавить ${item.offering.operationalName}`} className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 enabled:hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60" disabled={!canAssign || !available} key={item.offering.id} onClick={() => onAdd(item)} type="button"><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{item.offering.operationalName}</span><span className={`block truncate text-[10px] text-muted-foreground${compact ? "" : " font-mono"}`}>{compact ? serviceTypeLabel[item.serviceType] : `${item.offering.code} · ${item.categoryKey} · ${serviceTypeLabel[item.serviceType]}`}</span></span>{compact ? null : <span className="shrink-0 text-[10px] text-muted-foreground">{scopeLabel[item.scope]}</span>}{reason ? <StatusBadge tone="warning">{reason}</StatusBadge> : <IconPlus aria-hidden="true" className="size-4 text-primary" />}</button>
      })}
      {loading && items?.length ? <div className="px-3 py-2 text-xs text-muted-foreground" role="status">Загрузка услуг…</div> : null}
    </div>
    {cursor ? <Button className="mt-2" disabled={loading} onClick={() => void load(cursor, true)} size="sm" variant="outline"><IconRefresh aria-hidden="true" />Показать ещё</Button> : null}
  </div>
}

function Toggle({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: (checked: boolean) => void }) { return <label className="flex items-center gap-2"><Switch checked={checked} disabled={disabled} onCheckedChange={onChange} size="sm" />{label}</label> }
function ReadOnlyNotice({ canSearch }: { canSearch: boolean }) { return <div className="flex items-start gap-2 rounded-xl border border-warning/25 bg-warning-subtle p-3 text-xs text-warning-foreground"><IconLock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">Только просмотр дополнительных услуг</p><p className="mt-0.5">{canSearch ? "Поиск в библиотеке доступен, но добавлять и менять состав может только пользователь с правом назначения." : "Состав доступен только для просмотра."}</p></div></div> }
function ConflictNotice({ catalog, draft, error, onReload, onRetry, server }: { catalog: Map<string, AddOnCatalogItem>; draft: AssignmentDraft[]; error: string | null; onReload: () => void; onRetry: () => void; server: AssignmentDraft[] }) { return <div className="rounded-xl border border-danger/25 bg-danger-subtle/20 p-4 text-xs" data-slot="addon-conflict-comparison"><div className="flex items-start gap-2"><IconAlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-danger-foreground" /><div><p className="font-semibold">Дополнительные услуги изменились на сервере</p><p className="mt-1 text-muted-foreground">Локальный черновик сохранён и заблокирован. Повторный запрос отправит ровно те же данные.</p>{error ? <p className="mt-1 text-danger-foreground">{error}</p> : null}</div></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-lg border bg-background p-3"><p className="font-medium">Локальный вариант</p><p className="mt-1">{draft.length ? draft.map((item) => catalog.get(item.addOnOfferingId)?.offering.operationalName ?? "Недоступная сводка").join(", ") : "Нет услуг"}</p></div><div className="rounded-lg border bg-background p-3"><p className="font-medium">Версия сервера</p><p className="mt-1">{server.length ? `${server.length} услуг(и)` : "Нет услуг"}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Button onClick={onRetry} size="sm" variant="outline">Повторить запрос</Button><Button onClick={onReload} size="sm" variant="outline">Обновить серверную версию</Button></div></div> }

const serviceTypeLabel = { content_only: "Контент", package_service: "Пакет", person_service: "За человека", quantity_service: "По количеству", scheduled_resource: "По слоту" } as const
const customServiceTypeOptions = [
  { label: "По количеству", value: "quantity_service" },
  { label: "За человека", value: "person_service" },
  { label: "Пакет", value: "package_service" },
  { label: "По слоту", value: "scheduled_resource" },
  { label: "Контент / по запросу", value: "content_only" },
]
const scopeLabel = { offering_specific: "Связанный", reusable: "Библиотека" } as const
const blockerLabel = { active_price_book_missing: "Нет цены", archived: "В архиве", not_active: "Не активен" } as const
function toDraft(value: InternalOfferingEditor["addOnAssignments"][number]): AssignmentDraft { return { addOnOfferingId: value.addOnOfferingId, enabled: value.enabled, required: value.required, recommended: value.recommended, groupKey: value.groupKey, ratePlanKeyOverride: value.ratePlanKeyOverride, labelOverride: value.labelOverride, descriptionOverride: value.descriptionOverride, minQuantityOverride: value.minQuantityOverride, maxQuantityOverride: value.maxQuantityOverride, defaultQuantityOverride: value.defaultQuantityOverride, displayOrder: value.displayOrder } }
function emptyDraft(addOnOfferingId: string, displayOrder: number): AssignmentDraft { return { addOnOfferingId, enabled: true, required: false, recommended: false, groupKey: null, ratePlanKeyOverride: null, labelOverride: null, descriptionOverride: null, minQuantityOverride: null, maxQuantityOverride: null, defaultQuantityOverride: null, displayOrder } }
function normalizeDraft(value: AssignmentDraft): AssignmentDraft { return { ...value, required: value.enabled ? value.required : false, recommended: value.required ? false : value.recommended } }
function nullableText(value: string) { const trimmed = value.trim(); return trimmed || null }
function nullableInteger(value: string) { if (value.trim() === "") return null; const number = Number(value); return Number.isInteger(number) && number >= 0 ? number : null }
function hasOverrides(value: AssignmentDraft) { return value.groupKey !== null || value.ratePlanKeyOverride !== null || value.labelOverride !== null || value.minQuantityOverride !== null || value.maxQuantityOverride !== null || value.defaultQuantityOverride !== null }
function canAssignLibraryItem(item: AddOnLibraryItem, offeringId: string, selected: AssignmentDraft[]) { return libraryBlocker(item, offeringId, selected) === null }
function libraryBlocker(item: AddOnLibraryItem, offeringId: string, selected: AssignmentDraft[]): string | null { if (item.offering.id === offeringId) return "Это домик"; if (selected.some((assignment) => assignment.addOnOfferingId === item.offering.id)) return "Уже добавлен"; if (item.offering.state !== "active" || item.offering.archivedAt) return "Не готов в CRM"; if (item.offering.salesMode !== "request_only" && !item.offering.activePriceBookId) return "Нет цены"; return null }
function libraryItemToCatalog(item: AddOnLibraryItem): AddOnCatalogItem { return { offering: { id: item.offering.id, version: item.offering.version, code: item.offering.code, operationalName: item.offering.operationalName, state: item.offering.state, archived: item.offering.archivedAt !== null }, serviceType: item.serviceType, scope: item.scope, ownerOfferingId: item.ownerOfferingId, categoryKey: item.categoryKey, standalone: item.standalone, availability: { status: "available", blocker: null } } }
