import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconBuildingCommunity, IconExternalLink, IconFileText, IconReceipt2 } from "@tabler/icons-react"

import type { InternalOfferingEditor } from "@crm/contracts"
import { Button, EditorSection, PageState, StatusBadge } from "@crm/ui"

import { isOfferingEditorConflict, offeringEditorErrorMessage, type OfferingEditorGateway } from "./gateway.js"

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
  useEffect(() => { void load(); onNavigationGuardChange?.(null); return () => onNavigationGuardChange?.(null) }, [load, onNavigationGuardChange])

  if (loading && !editor) return <div aria-label="Загрузка досье площадки" className="space-y-3" role="status"><div className="h-28 animate-pulse rounded-xl bg-muted" /><div className="h-40 animate-pulse rounded-xl bg-muted" /></div>
  if (error) return <div className="rounded-xl border bg-background"><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title={conflict ? "Версия досье изменилась" : "Площадка не открылась"} tone="danger">{error}</PageState></div>
  if (!editor) return <div className="rounded-xl border bg-background"><PageState icon={IconBuildingCommunity} title="Площадка не найдена">Связь с Catalog Offering отсутствует или запись недоступна.</PageState></div>
  if (editor.offering.kind !== "venue" || editor.offering.fulfillment.kind !== "venue") return <div className="rounded-xl border bg-background"><PageState icon={IconAlertTriangle} title="Получен другой тип предложения" tone="danger">Публичная площадка не может быть показана как домик.</PageState></div>

  const locator = editor.editorial
  const activeBook = editor.priceBooks.find((book) => book.id === editor.offering.activePriceBookId) ?? editor.priceBooks.find((book) => book.state === "active")
  const cmsHref = locator ? editorialHref?.(locator.node.id) ?? null : null
  return <div className="space-y-3">
    <EditorSection title="Досье площадки"><dl className="grid gap-3 text-xs sm:grid-cols-2"><Detail label="Название" value={editor.offering.operationalName} /><Detail label="Код" value={editor.offering.code} /><Detail label="Состояние" value={stateLabel[editor.offering.state] ?? editor.offering.state} /><Detail label="Политика" value="Exclusive Resource · гости · RatePlan" /><Detail label="Вместимость" value="Operational Resource" /><Detail label="Редактирование" value={editor.capabilities.subject.canEdit ? "Доступно в CRM" : "Только чтение"} /></dl></EditorSection>
    <EditorSection title="PriceBook runtime" subtitle="Цена принадлежит существующему PriceBook API; interval availability здесь не отображается."><div className="flex items-center gap-3 rounded-lg border p-3"><IconReceipt2 aria-hidden="true" className="size-5 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-xs font-medium">{activeBook?.name ?? "Активный прайс-лист не задан"}</p><p className="text-[11px] text-muted-foreground">{activeBook ? `${activeBook.ratePlans.length} тариф(ов) · ${activeBook.currency}` : "Площадка доступна только по запросу до настройки цены."}</p></div><StatusBadge tone={activeBook ? "success" : "warning"}>{activeBook ? "Подключён" : "Не готов"}</StatusBadge></div>{!editor.capabilities.pricing.canEditDraft ? <p className="mt-3 text-xs text-muted-foreground">Прайс-лист доступен только для чтения: нет права изменять цены.</p> : <p className="mt-3 text-xs text-muted-foreground">Изменение draft/activation выполняется общим PriceBook runtime.</p>}</EditorSection>
    <EditorSection title="CMS-черновик"><div className="flex items-center gap-3"><IconFileText aria-hidden="true" className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{locator?.currentRevision?.title ?? "Черновик не подготовлен"}</p><p className="text-[11px] text-muted-foreground">CMS владеет только editorial-контентом.</p></div>{cmsHref ? <Button nativeButton={false} render={<a href={cmsHref} />} size="sm" variant="outline"><IconExternalLink aria-hidden="true" />Открыть</Button> : null}</div></EditorSection>
  </div>
}

const stateLabel: Record<string, string> = { active: "Активно", draft: "Черновик", paused: "Приостановлено", archived: "В архиве" }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div> }
