import { useCallback, useEffect, useState } from "react"
import { IconAlertTriangle, IconHome, IconLink, IconSettings, IconTent } from "@tabler/icons-react"

import type { InternalOfferingEditor } from "@crm/contracts"
import { Button, EditorFrame, PageNav } from "@crm/ui"

import {
  offeringEditorErrorMessage,
  type OfferingEditorCommandMetaFactory,
  type OfferingEditorGateway,
} from "./gateway.js"
import {
  CampgroundBindingEditor,
  HouseBindingEditor,
  type OfferingEditorSubjectCommandMetaFactory,
} from "./house-binding-editor.js"
import {
  HouseAddOnEditor,
  type OfferingEditorAddOnsCommandMetaFactory,
} from "./house-addon-editor.js"
import type {
  CampgroundOfferingWorkspaceProps,
  HouseOfferingWorkspaceProps,
  HouseOfferingWorkspaceTab,
  SaveState,
} from "./house-offering-workspace-model.js"
import {
  OfferingOverview,
  OfferingSidebar,
  ResourceSaleHeader,
  ResourceSiteCard,
  WorkspaceLoading,
  WorkspaceState,
} from "./house-offering-overview.js"
import { allowOfferingEditorClose } from "./house-offering-helpers.js"
import { OfferingPricingWorkspace as PricingWorkspace } from "./offering-pricing-workspace.js"

export type {
  CampgroundOfferingWorkspaceProps,
  CampgroundOfferingWorkspaceTab,
  HouseOfferingWorkspaceProps,
  HouseOfferingWorkspaceTab,
} from "./house-offering-workspace-model.js"
export { OfferingPricingWorkspace } from "./offering-pricing-workspace.js"

/**
 * Route-neutral offering workspace. Its host may bind the tab to URL state and
 * use `onEditorChange` to invalidate a transport-specific cache.
 */
export function HouseOfferingWorkspace({
  createCommandMeta,
  createSubjectCommandMeta,
  createAddOnsCommandMeta,
  gateway,
  initialTab = "overview",
  editorialHref,
  offeringId,
  onBack,
  onEditorChange,
  onOpenEditorial,
  onNavigationGuardChange,
  onTabChange,
  layout = "standalone",
}: HouseOfferingWorkspaceProps) {
  return <StayOfferingWorkspace createAddOnsCommandMeta={createAddOnsCommandMeta} createCommandMeta={createCommandMeta} createSubjectCommandMeta={createSubjectCommandMeta} {...(editorialHref ? { editorialHref } : {})} gateway={gateway} initialTab={initialTab} kind="house" layout={layout} offeringId={offeringId} {...(onBack ? { onBack } : {})} {...(onEditorChange ? { onEditorChange } : {})} {...(onOpenEditorial ? { onOpenEditorial } : {})} {...(onNavigationGuardChange ? { onNavigationGuardChange } : {})} {...(onTabChange ? { onTabChange } : {})} />
}

export function CampgroundOfferingWorkspace(props: CampgroundOfferingWorkspaceProps) {
  return <StayOfferingWorkspace {...props} kind="campground" />
}

function StayOfferingWorkspace({
  createCommandMeta,
  createSubjectCommandMeta,
  createAddOnsCommandMeta,
  gateway,
  initialTab = "overview",
  kind,
  editorialHref,
  offeringId,
  onBack,
  onEditorChange,
  onOpenEditorial,
  onNavigationGuardChange,
  onTabChange,
  layout = "standalone",
}: HouseOfferingWorkspaceProps & { kind: "house" | "campground" }) {
  const [editor, setEditor] = useState<InternalOfferingEditor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = kind === "campground" ? await gateway.getCampgroundEditor(offeringId) : await gateway.getHouseEditor(offeringId)
      setEditor(next)
      if (next) onEditorChange?.(next)
    } catch (loadError) {
      setError(offeringEditorErrorMessage(loadError, kind === "campground" ? "Не удалось открыть кемпинг." : "Не удалось открыть домик."))
    } finally {
      setLoading(false)
    }
  }, [gateway, kind, offeringId, onEditorChange])

  useEffect(() => { void load() }, [load])

  // Keep the mounted editor during a refresh so a local draft can survive a
  // conflict recovery reload and remain visible for comparison.
  if (loading && !editor) return <WorkspaceLoading />
  if (error) return <WorkspaceState actionLabel="Повторить" icon={IconAlertTriangle} onAction={() => void load()} title={kind === "campground" ? "Кемпинг не открылся" : "Домик не открылся"} tone="danger">{error}</WorkspaceState>
  if (!editor) return <WorkspaceState icon={kind === "campground" ? IconTent : IconHome} title={kind === "campground" ? "Кемпинг не найден" : "Домик не найден"}>Возможно, он был удалён или у вас нет доступа.</WorkspaceState>

  return <HouseOfferingEditor {...(editorialHref ? { editorialHref } : {})} {...(onBack ? { onBack } : {})} {...(onNavigationGuardChange ? { onNavigationGuardChange } : {})} {...(onOpenEditorial ? { onOpenEditorial } : {})} {...(onTabChange ? { onTabChange } : {})} createAddOnsCommandMeta={createAddOnsCommandMeta} createCommandMeta={createCommandMeta} createSubjectCommandMeta={createSubjectCommandMeta} editor={editor} gateway={gateway} initialTab={initialTab} kind={kind} layout={layout} onReload={load} />
}

export type HouseOfferingEditorProps = {
  createCommandMeta: OfferingEditorCommandMetaFactory
  createSubjectCommandMeta: OfferingEditorSubjectCommandMetaFactory
  createAddOnsCommandMeta: OfferingEditorAddOnsCommandMetaFactory
  editor: InternalOfferingEditor
  editorialHref?: (nodeId: string) => string | null
  gateway: OfferingEditorGateway
  initialTab?: HouseOfferingWorkspaceTab
  kind?: "house" | "campground"
  onBack?: () => void
  onNavigationGuardChange?: (guard: (() => boolean) | null) => void
  onOpenEditorial?: (nodeId: string) => void
  onReload: () => Promise<void>
  onTabChange?: (tab: HouseOfferingWorkspaceTab) => void
  layout?: "standalone" | "embedded"
}

/** Data-presentational editor for hosts that already own server-state loading. */
export function HouseOfferingEditor({ createAddOnsCommandMeta, createCommandMeta, createSubjectCommandMeta, editor, editorialHref, gateway, initialTab = "overview", kind = "house", layout = "standalone", onBack, onNavigationGuardChange, onOpenEditorial, onReload, onTabChange }: HouseOfferingEditorProps) {
  const [tab, setTab] = useState<HouseOfferingWorkspaceTab>(initialTab)
  const [pricingSaveState, setPricingSaveState] = useState<SaveState>("saved")
  const [pricingSaveDetail, setPricingSaveDetail] = useState("Изменения отсутствуют")
  const [pricingSaveAction, setPricingSaveAction] = useState<(() => void) | null>(null)
  const [subjectSaveState, setSubjectSaveState] = useState<SaveState>("saved")
  const [subjectSaveDetail, setSubjectSaveDetail] = useState("Изменения отсутствуют")
  const [subjectSaveAction, setSubjectSaveAction] = useState<(() => void) | null>(null)
  const [addOnsSaveState, setAddOnsSaveState] = useState<SaveState>("saved")
  const [addOnsSaveDetail, setAddOnsSaveDetail] = useState("Изменения отсутствуют")
  const [addOnsSaveAction, setAddOnsSaveAction] = useState<(() => void) | null>(null)
  const handlePricingSaveActionChange = useCallback((action: (() => void) | null) => setPricingSaveAction(() => action), [])
  const handleSubjectSaveActionChange = useCallback((action: (() => void) | null) => setSubjectSaveAction(() => action), [])
  const handleAddOnsSaveActionChange = useCallback((action: (() => void) | null) => setAddOnsSaveAction(() => action), [])
  const handleSubjectSaveState = useCallback((state: SaveState, detail: string) => { setSubjectSaveState(state); setSubjectSaveDetail(detail) }, [])
  const handleAddOnsSaveState = useCallback((state: SaveState, detail: string) => { setAddOnsSaveState(state); setAddOnsSaveDetail(detail) }, [])

  useEffect(() => setTab(initialTab), [initialTab])
  const setActiveTab = (value: string) => {
    const next = value as HouseOfferingWorkspaceTab
    setTab(next)
    onTabChange?.(next)
  }
  const navigation = <PageNav ariaLabel="Разделы предложения" items={[
    { icon: IconHome, label: "Обзор", value: "overview" },
    { icon: IconLink, label: kind === "campground" ? "Места и зона" : "Состав", value: "composition" },
    { icon: IconSettings, label: "Цены", value: "pricing" },
  ]} onValueChange={setActiveTab} value={tab} />
  const pricingWritable = editor.capabilities.pricing.canEditDraft
  const subjectWritable = editor.capabilities.subject.canManageBindings
  const compositionSave = addOnsSaveState !== "saved" ? { action: addOnsSaveAction, detail: addOnsSaveDetail, state: addOnsSaveState } : { action: subjectSaveAction, detail: subjectSaveDetail, state: subjectSaveState }
  const activeSaveState = tab === "pricing" ? pricingSaveState : tab === "composition" ? compositionSave.state : "saved"
  const activeSaveDetail = tab === "pricing" ? pricingSaveDetail : tab === "composition" ? compositionSave.detail : "Изменения отсутствуют"
  const activeSaveAction = tab === "pricing" ? pricingSaveAction : tab === "composition" ? compositionSave.action : null
  const isDirty = [pricingSaveState, subjectSaveState, addOnsSaveState].some((state) => state === "dirty" || state === "conflict" || state === "saving")
  const navigationGuard = useCallback(() => {
    return allowOfferingEditorClose(isDirty, () => typeof window === "undefined" || window.confirm("Есть несохранённые изменения. Закрыть редактор?"))
  }, [isDirty])

  useEffect(() => {
    onNavigationGuardChange?.(isDirty ? navigationGuard : null)
    return () => onNavigationGuardChange?.(null)
  }, [isDirty, navigationGuard, onNavigationGuardChange])

  useEffect(() => {
    if (!isDirty || typeof window === "undefined") return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [isDirty])

  const close = () => { if (onBack && navigationGuard()) onBack() }
  const canRunPrimaryAction = activeSaveState === "dirty" || activeSaveState === "conflict"
  const footerActions = <>
    {onBack ? <Button onClick={close} size="sm" variant="outline">Закрыть</Button> : null}
    {tab === "pricing" && pricingWritable ? <Button disabled={!activeSaveAction || !canRunPrimaryAction} onClick={() => activeSaveAction?.()} size="sm">{activeSaveState === "conflict" ? "Обновить версию" : activeSaveState === "saving" ? "Сохранение…" : "Сохранить условия"}</Button> : null}
    {tab === "composition" && subjectWritable ? <Button disabled={!subjectSaveAction || !(subjectSaveState === "dirty" || subjectSaveState === "conflict")} onClick={() => subjectSaveAction?.()} size="sm" variant="outline">{subjectSaveState === "conflict" ? "Обновить версию" : subjectSaveState === "saving" ? "Сохранение…" : "Сохранить состав"}</Button> : null}
    {tab === "composition" && editor.capabilities.addOns.canAssign ? <Button disabled={!addOnsSaveAction || !(addOnsSaveState === "dirty" || addOnsSaveState === "conflict")} onClick={() => addOnsSaveAction?.()} size="sm">{addOnsSaveState === "conflict" ? "Обновить услуги" : addOnsSaveState === "saving" ? "Сохранение…" : "Сохранить услуги"}</Button> : null}
  </>

  const embeddedSave = addOnsSaveState !== "saved" ? { detail: addOnsSaveDetail, state: addOnsSaveState } : { detail: pricingSaveDetail, state: pricingSaveState }
  const embeddedFooterActions = <>
    {pricingWritable ? <Button disabled={!pricingSaveAction || !(pricingSaveState === "dirty" || pricingSaveState === "conflict")} onClick={() => pricingSaveAction?.()} size="sm" variant={addOnsSaveState === "saved" ? "default" : "outline"}>{pricingSaveState === "conflict" ? "Обновить цены" : pricingSaveState === "saving" ? "Сохранение…" : "Сохранить цены"}</Button> : null}
    {editor.capabilities.addOns.canAssign ? <Button disabled={!addOnsSaveAction || !(addOnsSaveState === "dirty" || addOnsSaveState === "conflict")} onClick={() => addOnsSaveAction?.()} size="sm">{addOnsSaveState === "conflict" ? "Обновить услуги" : addOnsSaveState === "saving" ? "Сохранение…" : "Сохранить услуги"}</Button> : null}
  </>

  const content = <>
    <div hidden={tab !== "overview"}><OfferingOverview editor={editor} kind={kind} {...(editorialHref ? { editorialHref } : {})} {...(onOpenEditorial ? { onOpenEditorial } : {})} /></div>
    <div className="space-y-3" hidden={tab !== "composition"}>{kind === "campground" ? <CampgroundBindingEditor createCommandMeta={createSubjectCommandMeta} editor={editor} gateway={gateway} onReload={onReload} onSaveActionChange={handleSubjectSaveActionChange} onSaveState={handleSubjectSaveState} /> : <HouseBindingEditor createCommandMeta={createSubjectCommandMeta} editor={editor} gateway={gateway} onReload={onReload} onSaveActionChange={handleSubjectSaveActionChange} onSaveState={handleSubjectSaveState} />}<HouseAddOnEditor createCommandMeta={createAddOnsCommandMeta} editor={editor} gateway={gateway} onReload={onReload} onSaveActionChange={handleAddOnsSaveActionChange} onSaveState={handleAddOnsSaveState} /></div>
    <div hidden={tab !== "pricing"}><PricingWorkspace createCommandMeta={createCommandMeta} editor={editor} gateway={gateway} kind={kind} onReload={onReload} onSaveActionChange={handlePricingSaveActionChange} onSaveState={(state, detail) => { setPricingSaveState(state); setPricingSaveDetail(detail) }} /></div>
  </>

  if (layout === "embedded") {
    return <div className="space-y-3" data-slot="embedded-offering-editor">
      <ResourceSaleHeader editor={editor} />
      <PricingWorkspace createCommandMeta={createCommandMeta} editor={editor} gateway={gateway} kind={kind} onReload={onReload} onSaveActionChange={handlePricingSaveActionChange} onSaveState={(state, detail) => { setPricingSaveState(state); setPricingSaveDetail(detail) }} resourceView />
      <ResourceSiteCard editor={editor} {...(editorialHref ? { editorialHref } : {})} {...(onOpenEditorial ? { onOpenEditorial } : {})} />
      <HouseAddOnEditor compact createCommandMeta={createAddOnsCommandMeta} editor={editor} gateway={gateway} onReload={onReload} onSaveActionChange={handleAddOnsSaveActionChange} onSaveState={handleAddOnsSaveState} />
      <div className="flex flex-col gap-2 rounded-xl border bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between" data-slot="embedded-offering-actions"><div className="min-w-0"><p className="text-xs font-medium">{embeddedSave.state === "dirty" ? "Есть изменения" : embeddedSave.state === "saving" ? "Сохранение…" : embeddedSave.state === "conflict" ? "Данные изменились" : "Сохранено"}</p><p className="truncate text-[11px] text-muted-foreground">{embeddedSave.detail}</p></div><div className="flex shrink-0 items-center gap-2">{embeddedFooterActions}</div></div>
    </div>
  }

  return <EditorFrame footerActions={footerActions} navigation={navigation} saveDetail={activeSaveDetail} saveState={activeSaveState} sidebar={<OfferingSidebar editor={editor} />}>
    {content}
  </EditorFrame>
}
