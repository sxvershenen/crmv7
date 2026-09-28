import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconBuildingCommunity, IconExternalLink, IconFileText } from "@tabler/icons-react"

import type { InternalOfferingEditor } from "@crm/contracts"
import { Button, EditorSection, PageState } from "@crm/ui"

import { isOfferingEditorConflict, offeringEditorErrorMessage, type OfferingEditorGateway } from "./gateway.js"
import { OfferingPricingWorkspace } from "./offering-pricing-workspace.js"
import type { SaveState } from "./house-offering-workspace-model.js"

export type VenueOfferingWorkspaceProps = {
  gateway: OfferingEditorGateway
  offeringId: string
  onEditorChange?: (editor: InternalOfferingEditor) => void
  onNavigationGuardChange?: (guard: (() => boolean) | null) => void
  editorialHref?: (nodeId: string) => string | null
}

/** Minimal venue dossier: Resource remains operational authority; PriceBook remains the only pricing runtime. */
export function VenueOfferingWorkspace({ gateway, offeringId, onEditorChange, onNavigationGuardChange, editorialHref }: VenueOfferingWorkspaceProps) {
  const [editor, setEditor] = useState<InternalOfferingEditor | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [pricingSaveState, setPricingSaveState] = useState<SaveState>("saved")
  const [pricingSaveDetail, setPricingSaveDetail] = useState("")
  const [pricingSaveAction, setPricingSaveAction] = useState<(() => void) | null>(null)
  const load = useCallback(async () => {
    setLoading(true); setError(null); setConflict(false)
    try {
      const next = await gateway.getVenueEditor(offeringId)
      setEditor(next)
      if (next) onEditorChange?.(next)
    } catch (reason) {
      setError(offeringEditorErrorMessage(reason, "Не удалось открыть досье площадки."))
      setConflict(isOfferingEditorConflict(reason))
    } finally { setLoading(false) }
  }, [gateway, offeringId, onEditorChange])
  useEffect(() => { void load() }, [load])
  useEffect(() => {
    onNavigationGuardChange?.(pricingSaveState === "saved" ? null : () => typeof window === "undefined" || window.confirm("Есть несохранённые изменения цены. Покинуть страницу?"))
    return () => onNavigationGuardChange?.(null)
  }, [onNavigationGuardChange, pricingSaveState])
  useEffect(() => {
    if (pricingSaveState === "saved") return
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    window.addEventListener("beforeunload", preventUnload)
    return () => window.removeEventListener("beforeunload", preventUnload)
  }, [pricingSaveState])
  const onSaveActionChange = useCallback((action: (() => void) | null) => setPricingSaveAction(() => action), [])
  const onSaveState = useCallback((state: SaveState, detail: string) => { setPricingSaveState(state); setPricingSaveDetail(detail) }, [])
  const createCommandMeta = useCallback(() => ({ operationId: crypto.randomUUID(), idempotencyKey: crypto.randomUUID(), expectedPricingVersion: editor?.ownerVersions.pricing ?? 1 }), [editor?.ownerVersions.pricing])

  if (loading && !editor) return <div aria-label="Загрузка досье площадки" className="space-y-3" role="status"><div className="h-28 animate-pulse rounded-xl bg-muted" /><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>
  if (error) return <div className="rounded-xl border bg-background"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title={conflict ? "Версия досье изменилась" : "Площадка не открылась"} tone="danger">{error}</PageState></div>
  if (!editor) return <div className="rounded-xl border bg-background"><PageState icon={IconBuildingCommunity} title="Площадка не найдена">Связь с Catalog Offering отсутствует или запись недоступна.</PageState></div>
  if (editor.offering.kind !== "venue" || editor.offering.fulfillment.kind !== "venue") return <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Получен другой тип предложения" tone="danger">Публичная площадка не может быть показана как домик.</PageState></div>

  const locator = editor.editorial
  const activeBook = editor.priceBooks.find((book) => book.id === editor.offering.activePriceBookId) ?? editor.priceBooks.find((book) => book.state === "active")
  const cmsHref = locator ? editorialHref?.(locator.node.id) ?? null : null
  return <div className="space-y-3">
    <EditorSection title="Досье площадки"><dl className="grid gap-3 text-xs sm:grid-cols-2"><Detail label="Название" value={editor.offering.operationalName} /><Detail label="Код" value={editor.offering.code} /><Detail label="Состояние" value={stateLabel[editor.offering.state] ?? editor.offering.state} /><Detail label="Политика" value="Exclusive Resource · гости · RatePlan" /><Detail label="Вместимость" value="Operational Resource" /><Detail label="Редактирование" value={editor.capabilities.subject.canEdit ? "Доступно в CRM" : "Только чтение"} /></dl></EditorSection>
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold">Цена площадки</h2><p className="text-xs text-muted-foreground">{activeBook ? `Действующий тариф: ${activeBook.name}` : "Цена ещё не введена в действие"}</p></div>{editor.capabilities.pricing.canEditDraft ? <Button disabled={!pricingSaveAction || (pricingSaveState !== "dirty" && pricingSaveState !== "conflict")} onClick={() => pricingSaveAction?.()} size="sm">{pricingSaveState === "conflict" ? "Обновить версию" : pricingSaveState === "saving" ? "Сохраняем…" : editor.capabilities.pricing.canActivate ? "Сохранить и применить" : "Сохранить черновик"}</Button> : null}</div>
    {pricingSaveDetail ? <p className="text-xs text-muted-foreground" role="status">{pricingSaveDetail}</p> : null}
    <OfferingPricingWorkspace createCommandMeta={createCommandMeta} editor={editor} gateway={gateway} kind="venue" onReload={load} onSaveActionChange={onSaveActionChange} onSaveState={onSaveState} resourceView />
    <EditorSection title="CMS-черновик"><div className="flex items-center gap-3"><IconFileText aria-hidden="true" className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{locator?.currentRevision?.title ?? "Черновик не подготовлен"}</p><p className="text-[11px] text-muted-foreground">CMS владеет только editorial-контентом.</p></div>{cmsHref ? <Button nativeButton={false} render={<a href={cmsHref} />} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Открыть</Button> : null}</div></EditorSection>
  </div>
}

const stateLabel: Record<string, string> = { active: "Активно", draft: "Черновик", paused: "Приостановлено", archived: "В архиве" }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div> }
