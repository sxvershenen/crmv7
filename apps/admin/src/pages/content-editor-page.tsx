import { useCallback, useEffect, useRef, useState } from "react"
import { IconAlertTriangle, IconArchive, IconArrowLeft, IconBrandDatabricks, IconBrowser, IconCode, IconDots, IconExternalLink, IconEyeOff, IconFileAnalytics, IconGitCompare, IconHistory, IconLayoutBoard, IconLink, IconListDetails, IconPhoto, IconRocket, IconSearch, IconSettings } from "@tabler/icons-react"
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"

import { Alert, AlertDescription, AlertTitle, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, EditorFrame, EditorSection, FormField, FormSelect, Input, ListRow, ListSection, LoadingRows, PageNav, PageState, StatusBadge, Switch, Textarea, type EditorSaveState } from "@crm/ui"

import { ContentStatusBadge, InheritanceControl, PreviewDeviceSwitch, SourceMarker } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import { createPartnersEditorSection } from "@admin/data/partners-section"
import { createWhyUsEditorSection } from "@admin/data/why-us-section"
import { createHomepageSectionEditorSection } from "@admin/data/homepage-section"
import { createEditorialSection } from "@admin/data/editorial-section"
import { PartnersSectionFields } from "@admin/components/partners-section-fields"
import { WhyUsSectionFields } from "@admin/components/why-us-section-fields"
import { HomepageSectionFields } from "@admin/components/homepage-section-fields"
import { EditorialSectionFields } from "@admin/components/editorial-section-fields"
import { HeroMediaField } from "@admin/components/hero-media-field"
import { HomePromotionsField } from "@admin/components/home-promotions-field"
import { readyImageUrl, useHeroImage } from "@admin/components/hero-media"
import { CmsConflictError, type CmsRevisionHistoryEntry, type ContentNode, type EditorRecord, type InheritanceMode } from "@admin/entities/cms"
import { useAdminAuthSession } from "@admin/features/auth-session-context"
import { useRepository } from "@admin/features/use-repository"
import { UnsavedChangesGuard } from "@admin/features/unsaved-changes-guard"
import { AdminApiError } from "@admin/lib/api-client"
import type { CmsPublicationPreview } from "@crm/contracts/publication"
import type { CmsNodePublicationStatus } from "@crm/contracts/content"

type EditorKind = EditorRecord["kind"]
type ContentEditorTab = "content" | "composition" | "seo" | "media" | "code" | "analytics" | "versions" | "media-seo"
type PublicationGate = { eligible: boolean; blockers: readonly string[] }

export type ContentEditorPageProps = {
  externalEditHref?: string
  kind: EditorKind
  nodeId?: string
  publicationGate?: PublicationGate
  returnLabel?: string
  returnTo?: string
  workspace?: "default" | "offering"
  workspaceSubjectLabel?: string
}

const commonTabs = [
  { value: "content", label: "Содержимое", compactLabel: "Контент", icon: IconListDetails }, { value: "composition", label: "Текст и блоки", compactLabel: "Блоки", icon: IconLayoutBoard }, { value: "seo", label: "SEO", icon: IconSearch }, { value: "media", label: "Медиа", icon: IconPhoto }, { value: "code", label: "Файлы и код", compactLabel: "Код", icon: IconCode, capability: "canManageSiteCode" as const }, { value: "analytics", label: "Аналитика", compactLabel: "Метрики", icon: IconFileAnalytics, capability: "canViewAnalytics" as const }, { value: "versions", label: "История", icon: IconHistory },
]
const offeringTabs = [
  { value: "content", editorTab: "content", label: "Содержимое", compactLabel: "Контент", icon: IconListDetails },
  { value: "page-composition", editorTab: "composition", label: "Блоки страницы", compactLabel: "Блоки", icon: IconLayoutBoard },
  { value: "media", editorTab: "media", label: "Медиа", icon: IconPhoto },
  { value: "seo", editorTab: "seo", label: "SEO", icon: IconSearch },
  { value: "publication", editorTab: "versions", label: "Публикация и история", compactLabel: "Публикация", icon: IconHistory },
]
const homepageEditableSections = ["events", "houses", "sauna-chan", "programs", "venues", "blog", "reviews", "map", "faq", "calculator"] as const

/** Canonical CMS editor. Offering dossiers pass only the located node id and host navigation. */
export function ContentEditorPage({ externalEditHref, kind, nodeId, publicationGate, returnLabel = "Закрыть", returnTo, workspace = "default", workspaceSubjectLabel = "домика" }: ContentEditorPageProps) {
  const { user } = useAdminAuthSession()
  const params = useParams(); const id = nodeId ?? (kind === "home" ? "home" : params.nodeId ?? params.entityId ?? "new")
  const loader = useCallback(() => cmsRepository.getEditor(id, kind), [id, kind]); const repositoryState = useRepository(loader)
  const statusNodeId = repositoryState.data?.id
  const statusLoader = useCallback(() => statusNodeId && statusNodeId !== "new" ? cmsRepository.getPublicationStatus(statusNodeId) : Promise.resolve(null), [statusNodeId]); const publicationStatus = useRepository(statusLoader)
  const topologyLoader = useCallback(() => cmsRepository.getNodes({}), []); const topologyState = useRepository(topologyLoader)
  const accessLoader = useCallback(() => cmsRepository.getAccess(), []); const accessState = useRepository(accessLoader)
  const [draft, setDraft] = useState<EditorRecord>(); const [persistedDraft, setPersistedDraft] = useState<EditorRecord>(); const [saveState, setSaveState] = useState<EditorSaveState>("saved"); const [mutationError, setMutationError] = useState<string>(); const [publishing, setPublishing] = useState(false); const [unpublishing, setUnpublishing] = useState(false); const [publicationPreview, setPublicationPreview] = useState<CmsPublicationPreview>(); const [searchParams, setSearchParams] = useSearchParams(); const navigate = useNavigate(); const location = useLocation(); const tab = searchParams.get("tab") ?? "content"; const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop")
  const [previewing, setPreviewing] = useState(false)
  const [previewLink, setPreviewLink] = useState<string>()
  const publicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL || (import.meta.env.DEV ? "http://localhost:4321" : undefined)
  const initializedParentQuery = useRef<string | undefined>(undefined)
  useEffect(() => { if (repositoryState.data) { setDraft(repositoryState.data); setPersistedDraft(repositoryState.data); setSaveState(repositoryState.data.id === "new" ? "dirty" : "saved") } }, [repositoryState.data])
  useEffect(() => {
    if (!draft || draft.id !== "new") return
    const requestedParentId = searchParams.get("parentNodeId")
    const initializationKey = `${id}:${requestedParentId ?? ""}`
    if (initializedParentQuery.current === initializationKey) return
    if (!requestedParentId) { initializedParentQuery.current = initializationKey; return }
    if (!topologyState.data) return
    initializedParentQuery.current = initializationKey
    const parentNode = topologyState.data.find((node) => node.id === requestedParentId)
    if (!parentNode || parentNode.status === "archived") { setMutationError("Выбранный родительский раздел не найден или архивирован."); return }
    if (draft.parentNodeId === parentNode.id) return
    setDraft(withParentPlacement(draft, parentNode.id, topologyState.data)); setSaveState("dirty"); setMutationError(undefined)
  }, [draft, id, searchParams, topologyState.data])
  const hasUnsavedWork = saveState === "dirty" || saveState === "saving" || saveState === "conflict"
  const revisionState = draft?.revisionState ?? draft?.status
  const editable = accessState.data?.canEditContent === true && (revisionState === "draft" || revisionState === "published") && (draft?.schemaVersion === undefined || draft.schemaVersion === 1)
  const update = (patch: Partial<EditorRecord>) => { if (!draft || !editable) return; setDraft({ ...draft, ...patch }); setPublicationPreview(undefined); setPreviewLink(undefined); setSaveState("dirty"); setMutationError(undefined) }
  const updateSection = (idToUpdate: string, mode: InheritanceMode) => { if (!draft) return; const section = draft.sections.find((item) => item.id === idToUpdate); update({ sections: draft.sections.map((item) => item.id === idToUpdate ? { ...item, mode } : item), ...(section?.label.toLocaleLowerCase("ru-RU") === "hero" ? { hero: { ...draft.hero, mode } } : {}) }) }
  const save = async () => { if (!draft || !editable) return; setSaveState("saving"); setMutationError(undefined); try { const saved = await cmsRepository.saveEditor(draft, draft.version); setDraft(saved); setPersistedDraft(saved); setSaveState("saved"); if (draft.id === "new") navigate(editorHref(saved), { replace: true, state: location.state }) } catch (error) { setSaveState(error instanceof CmsConflictError ? "conflict" : "dirty"); if (!(error instanceof CmsConflictError)) setMutationError(mutationMessage(error, "Не удалось сохранить")) } }
  const openPreview = async () => {
    if (!draft || !publicSiteUrl || cmsRepository.mode !== "api" || !accessState.data?.canViewContent || saveState === "conflict" || previewing) return
    const popup = window.open("about:blank", "_blank")
    if (popup) popup.opener = null
    let current = draft
    let saveCompleted = saveState !== "dirty" && draft.id !== "new"
    setPreviewing(true)
    setPreviewLink(undefined)
    setMutationError(undefined)
    try {
      if (!saveCompleted) {
        if (!editable) throw new Error("Сначала сохраните черновик")
        setSaveState("saving")
        current = await cmsRepository.saveEditor(current, current.version)
        saveCompleted = true
        setDraft(current)
        setPersistedDraft(current)
        setSaveState("saved")
        if (draft.id === "new") navigate(editorHref(current), { replace: true, state: location.state })
      }
      const issued = await cmsRepository.getPreviewToken(current.id, current.version)
      const url = new URL(issued.previewPath, publicSiteUrl)
      url.searchParams.set("__cms_preview", issued.token)
      if (popup) popup.location.replace(url.href)
      else setPreviewLink(url.href)
    } catch (error) {
      popup?.close()
      setDraft(current)
      setSaveState(error instanceof CmsConflictError ? "conflict" : saveCompleted ? "saved" : "dirty")
      setMutationError(mutationMessage(error, "Не удалось открыть предпросмотр"))
    } finally {
      setPreviewing(false)
    }
  }
  const restoreRevision = async (entry: CmsRevisionHistoryEntry) => {
    if (!draft || !editable || saveState !== "saved" || publishing || previewing || unpublishing) return
    if (!window.confirm(`Вернуть содержимое редакции ${entry.revision} в новый черновик? Текущий URL и связи с CRM сохранятся. Опубликованная страница не изменится, пока вы не опубликуете новый черновик.`)) return
    setSaveState("saving")
    setMutationError(undefined)
    try {
      const restored = await cmsRepository.restoreRevision(draft.id, entry.id, draft.version)
      setDraft(restored)
      setPersistedDraft(restored)
      setPublicationPreview(undefined)
      setPreviewLink(undefined)
      setSaveState("saved")
    } catch (error) {
      setSaveState(error instanceof CmsConflictError ? "conflict" : "saved")
      setMutationError(mutationMessage(error, "Не удалось восстановить редакцию"))
    }
  }
  const transition = async (action: "submit" | "return" | "approve" | "archive") => { if (!draft || draft.id === "new") return; const hasLocalChanges = saveState === "dirty"; if (action === "archive" && !window.confirm(`Архивировать «${draft.internalName}»? История редакций сохранится. Архивирование не снимает страницу с сайта, если она уже опубликована.${hasLocalChanges ? " Несохранённые изменения будут потеряны." : ""}`)) return; const shouldSaveFirst = action === "submit" && hasLocalChanges; let saveCompleted = !hasLocalChanges; let current = draft; setSaveState("saving"); setMutationError(undefined); try { if (shouldSaveFirst) { current = await cmsRepository.saveEditor(current, current.version); saveCompleted = true; setDraft(current); setPersistedDraft(current); setSaveState("saved") } const saved = action === "submit" ? await cmsRepository.submitReview(current.id, current.version) : action === "return" ? await cmsRepository.returnToDraft(current.id, current.version) : action === "approve" ? await cmsRepository.approve(current.id, current.version) : await cmsRepository.archive(current.id, current.version); setDraft(saved); setPersistedDraft(saved); setSaveState("saved") } catch (error) { setDraft(current); setSaveState(error instanceof CmsConflictError ? "conflict" : saveCompleted ? "saved" : "dirty"); setMutationError(mutationMessage(error, "Операция не выполнена")) } }
  const preparePublish = async () => { if (!draft || !accessState.data?.canPublishContent || publicationGate?.eligible === false) return; const hadLocalChanges = saveState === "dirty" || draft.id === "new"; let saveCompleted = !hadLocalChanges; let current = draft; setPublishing(true); setSaveState("saving"); setMutationError(undefined); try { if (hadLocalChanges) { current = await cmsRepository.saveEditor(current, current.version); saveCompleted = true; setDraft(current); setPersistedDraft(current); setSaveState("saved"); if (draft.id === "new") navigate(editorHref(current), { replace: true, state: location.state }) } const preview = await cmsRepository.getPublicationPreview(current.id); setPublicationPreview(preview); setSaveState("saved") } catch (error) { setDraft(current); setSaveState(error instanceof CmsConflictError ? "conflict" : saveCompleted ? "saved" : "dirty"); setMutationError(mutationMessage(error, "Не удалось собрать предпросмотр публикации")) } finally { setPublishing(false) } }
  const publish = async () => { if (!draft || !publicationPreview?.canPublish) return; setPublishing(true); setSaveState("saving"); setMutationError(undefined); try { const published = await cmsRepository.publish(draft.id, draft.version, publicationPreview); setDraft(published); setPersistedDraft(published); setPublicationPreview(undefined); setSaveState("saved"); publicationStatus.reload() } catch (error) { setSaveState(error instanceof CmsConflictError ? "conflict" : "saved"); setPublicationPreview(undefined); setMutationError(mutationMessage(error, "Предпросмотр устарел: обновите его перед публикацией")) } finally { setPublishing(false) } }
  const unpublish = async () => {
    if (!draft || draft.kind === "home" || !accessState.data?.canPublishContent || !publicationStatus.data?.active) return
    setUnpublishing(true)
    setMutationError(undefined)
    try {
      const status = await cmsRepository.getPublicationStatus(draft.id)
      if (!status.active || !status.path) throw new Error("Страница уже снята с сайта. Обновите редактор.")
      if (!window.confirm(`Снять страницу «${draft.internalName}» с сайта? Адрес ${status.path} исчезнет из карты сайта и после обновления публикации будет отвечать 404. Черновик и история сохранятся.${draft.status === "archived" ? " Для повторной публикации сначала потребуется восстановить материал из архива." : " Страницу можно будет опубликовать снова."}`)) return
      await cmsRepository.unpublish(draft.id, draft.version, status)
      setPublicationPreview(undefined)
    } catch (error) {
      setMutationError(mutationMessage(error, "Не удалось снять страницу с сайта"))
    } finally {
      publicationStatus.reload()
      setUnpublishing(false)
    }
  }
  const recoverConflict = async () => { if (!draft || draft.id === "new") return; setMutationError(undefined); try { const server = await cmsRepository.getEditor(draft.id, kind); const recovered = mergeLocalEditorChanges(persistedDraft ?? draft, draft, server); setPersistedDraft(server); setDraft(recovered); setSaveState("dirty"); setMutationError(`Загружена серверная версия ${server.version}. Локальные изменения сохранены в форме; проверьте их перед повторным сохранением.`) } catch (error) { setMutationError(mutationMessage(error, "Не удалось загрузить серверную версию")) } }
  const back = () => { const routeState = location.state as { backTo?: unknown } | null; const routeBackTo = typeof routeState?.backTo === "string" ? routeState.backTo : kind === "category" ? "/content/categories" : kind === "profile" ? "/content/public-profiles" : kind === "home" ? "/" : "/content/pages"; navigate(returnTo ?? routeBackTo) }
  if (repositoryState.error) { const denied = repositoryState.cause instanceof AdminApiError && repositoryState.cause.isPermissionDenied; return <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={repositoryState.reload} title={denied ? "Нет доступа к контенту" : "Редактор недоступен"}>{repositoryState.error}</PageState> }
  if (repositoryState.loading || !draft || (id !== "home" && id !== "new" && draft.id !== id) || accessState.loading || topologyState.loading) return <div className="p-4"><LoadingRows count={7} /></div>
  if (workspace === "offering" && draft.kind !== "profile") return <PageState icon={IconAlertTriangle} title="Связана страница другого типа" tone="danger">Редактор не открыл материал, чтобы не изменить чужую страницу.</PageState>
  if (workspace === "default" && draft.id !== "new" && location.pathname !== editorHref(draft)) return <Navigate replace state={location.state} to={`${editorHref(draft)}${location.search}`} />
  const allowedCommonTabs = commonTabs.filter((item) => (!("capability" in item) || user.capabilities[item.capability] === true) && !(cmsRepository.mode === "api" && item.value === "code"))
  const allowedOfferingTabs = offeringTabs
  const editorTabs = workspace === "offering" ? allowedOfferingTabs : kind === "home" ? [{ value: "content", label: "Основное", icon: IconLayoutBoard }, ...allowedCommonTabs.filter((item) => item.value === "composition").map((item) => ({ ...item, label: "Секции" })), ...allowedCommonTabs.slice(2)] : allowedCommonTabs
  const selectedTab = editorTabs.find((item) => item.value === tab) ?? editorTabs[0]!
  const effectiveTab = ("editorTab" in selectedTab ? selectedTab.editorTab : selectedTab.value) as ContentEditorTab
  const navigation = <><UnsavedChangesGuard when={hasUnsavedWork} /><PageNav items={editorTabs} onValueChange={(nextTab) => { const next = new URLSearchParams(searchParams); next.set("tab", nextTab); setSearchParams(next, { replace: true }) }} value={selectedTab.value} /></>
  const actions = <><EditorWorkflowStatus draft={draft} /><DropdownMenu><DropdownMenuTrigger render={<Button aria-label="Ещё" size="icon-sm" variant="ghost" />}><IconDots /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled>Дублировать · API operation отсутствует</DropdownMenuItem><DropdownMenuItem disabled={draft.kind === "home" || !accessState.data?.canPublishContent || !publicationStatus.data?.active || publicationStatus.loading || Boolean(publicationStatus.error) || publishing || unpublishing || saveState === "saving" || saveState === "conflict"} onClick={() => void unpublish()} title={draft.kind === "home" ? "Главную страницу нельзя снять с сайта" : undefined}><IconEyeOff />{unpublishing ? "Снимаем с сайта…" : "Снять с сайта"}</DropdownMenuItem><DropdownMenuItem disabled={!accessState.data?.canEditContent || draft.id === "new" || draft.status === "archived" || saveState === "saving" || saveState === "conflict" || unpublishing} onClick={() => void transition("archive")}><IconArchive />Архивировать</DropdownMenuItem></DropdownMenuContent></DropdownMenu></>
  const saveDetailProps = saveState === "conflict" ? { saveDetail: "На сервере уже есть более новые правки." } : {}
  const previewDisabled = cmsRepository.mode !== "api" || !publicSiteUrl || !accessState.data?.canViewContent || draft.status === "archived" || saveState === "saving" || saveState === "conflict" || previewing
  const previewTitle = cmsRepository.mode !== "api" ? "В деморежиме публичный предпросмотр недоступен" : !publicSiteUrl ? "Адрес публичного сайта не настроен" : undefined
  const publishBlocked = publicationGate?.eligible === false
  const publishTitle = !accessState.data?.canPublishContent ? "Нет права публикации" : publishBlocked ? "Публикация закрыта до готовности public projection" : publicationPreview && !publicationPreview.canPublish ? "Исправьте blocker'ы предпросмотра" : undefined
  return <div><div className="flex min-h-12 items-center gap-2 border-b bg-background px-3 sm:px-5 lg:px-6"><Button aria-label={returnLabel} onClick={back} size="icon-sm" variant="ghost"><IconArrowLeft /></Button><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{draft.internalName}</h2><p className="truncate text-[10px] text-muted-foreground">{draft.url} · {workspace === "offering" ? `Страница ${workspaceSubjectLabel}` : draft.id === "new" ? "Новый черновик" : `Редакция ${draft.revision ?? draft.version}`}</p></div><PreviewDeviceSwitch onChange={setDevice} value={device} /></div><EditorFrame actions={actions} footerActions={<><Button onClick={back} size="sm" variant="outline">{returnLabel}</Button><Button disabled={previewDisabled} onClick={() => void openPreview()} size="sm" title={previewTitle} variant="outline"><IconBrowser />{previewing ? "Открываем…" : "Предпросмотр"}</Button><Button disabled={!editable || saveState === "saving" || saveState === "saved"} onClick={() => void save()} size="sm" variant="outline">Сохранить</Button>{revisionState === "draft" && draft.id !== "new" ? <Button disabled={!accessState.data?.canEditContent || saveState === "saving" || saveState === "conflict"} onClick={() => void transition("submit")} size="sm" variant="outline">{saveState === "dirty" ? "Сохранить и отправить" : "Отправить на проверку"}</Button> : null}{revisionState === "review" ? <><Button disabled={!accessState.data?.canReviewContent || saveState === "saving"} onClick={() => void transition("return")} size="sm" variant="outline">Вернуть в черновик</Button><Button disabled={!accessState.data?.canReviewContent || saveState === "saving"} onClick={() => void transition("approve")} size="sm">Одобрить</Button></> : null}<Button disabled={!accessState.data?.canPublishContent || publishBlocked || publishing || unpublishing || draft.status === "archived" || saveState === "conflict" || Boolean(publicationPreview && !publicationPreview.canPublish)} onClick={() => void (publicationPreview ? publish() : preparePublish())} size="sm" title={publishTitle}><IconRocket />{publishing ? "Проверяем…" : publicationPreview ? "Подтвердить публикацию" : saveState === "dirty" ? "Сохранить и опубликовать" : "Опубликовать"}</Button></>} mobileActions={actions} navigation={navigation} {...saveDetailProps} saveState={saveState} sidebar={<EditorSidebar draft={draft} {...(externalEditHref ? { externalEditHref } : {})} location={location.pathname} publicationStatus={publicationStatus.data ?? null} publicationStatusError={publicationStatus.error} publicationStatusLoading={publicationStatus.loading} onReloadPublicationStatus={publicationStatus.reload} />}>
    {publicationPreview ? <PublicationPreviewPanel preview={publicationPreview} /> : null}{accessState.error ? <Alert className="mb-3" variant="destructive"><IconAlertTriangle /><AlertTitle>Права не определены</AlertTitle><AlertDescription>{accessState.error}</AlertDescription></Alert> : null}{topologyState.error ? <Alert className="mb-3" variant="destructive"><IconAlertTriangle /><AlertTitle>Структура сайта недоступна</AlertTitle><AlertDescription>{topologyState.error}</AlertDescription></Alert> : null}{draft.importedFromCrm ? <Alert className="mb-3 border-info/30"><IconBrandDatabricks /><AlertTitle>Страница связана с CRM</AlertTitle><AlertDescription>Здесь оформляются тексты, блоки, медиа и SEO. Цена и условия работы остаются в CRM.</AlertDescription></Alert> : null}{publishBlocked ? <PublicationBlockedAlert blockers={publicationGate.blockers} subjectLabel={workspaceSubjectLabel} /> : null}{draft.schemaVersion !== undefined && draft.schemaVersion !== 1 ? <Alert className="mb-3"><IconAlertTriangle /><AlertTitle>Новая версия формата</AlertTitle><AlertDescription>Эта редакция использует schema {draft.schemaVersion}. Её можно просмотреть, но текущая форма не будет пересохранять неизвестные поля.</AlertDescription></Alert> : null}{!editable && !accessState.error && revisionState !== "published" ? <Alert className="mb-3"><IconAlertTriangle /><AlertTitle>{revisionState === "review" ? "Материал на проверке" : revisionState === "approved" ? "Материал одобрен" : "Режим только для чтения"}</AlertTitle><AlertDescription>{revisionState === "review" ? "Проверьте материал: его можно одобрить или вернуть в черновик." : revisionState === "approved" ? "Редакция готова к публикации; для новых правок верните её в черновик." : revisionState !== "draft" ? "Запись сейчас нельзя редактировать." : "У сессии нет права редактирования."}</AlertDescription></Alert> : null}{mutationError ? <Alert className="mb-3" variant="destructive"><IconAlertTriangle /><AlertTitle>Операция не выполнена</AlertTitle><AlertDescription>{mutationError}</AlertDescription></Alert> : null}{previewLink ? <Alert className="mb-3"><IconBrowser /><AlertTitle>Предпросмотр готов</AlertTitle><AlertDescription>Браузер заблокировал новое окно. <a href={previewLink} rel="noreferrer noopener" target="_blank">Открыть предпросмотр</a>.</AlertDescription></Alert> : null}{saveState === "conflict" ? <ConflictState onKeepLocal={() => void recoverConflict()} onReload={repositoryState.reload} /> : null}<EditorTabContent canUploadMedia={user.capabilities.canManageMedia === true} device={device} draft={draft} editable={editable} kind={kind} nodes={topologyState.data ?? []} topologyAvailable={!topologyState.error} onRestoreRevision={restoreRevision} restoreDisabled={saveState !== "saved" || publishing || previewing || unpublishing} tab={effectiveTab} update={update} updateSection={updateSection} workspace={workspace} />
  </EditorFrame></div>
}

function PublicationPreviewPanel({ preview }: { preview: CmsPublicationPreview }) {
  const blockers = preview.issues.filter((issue) => issue.severity === "error")
  return <EditorSection actions={<StatusBadge tone={preview.canPublish ? "success" : "danger"}>{preview.canPublish ? "Готово" : `${blockers.length} ошибок`}</StatusBadge>} subtitle="Проверьте страницы и причины блокировки перед подтверждением." title="Что изменится после публикации">
    <div className="mt-3 divide-y rounded-lg border">{preview.changes.length ? preview.changes.map((change) => <div className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[90px_1fr]" key={`${change.nodeId}:${change.afterPath ?? change.beforePath}`}><StatusBadge tone={change.change === "removed" ? "warning" : "info"}>{change.change}</StatusBadge><span className="font-mono">{change.beforePath ?? "∅"} {change.beforePath !== change.afterPath ? `→ ${change.afterPath ?? "∅"}` : ""}</span></div>) : <p className="p-3 text-xs text-muted-foreground">Отличий от active release нет.</p>}</div>
    {preview.issues.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-xs">{preview.issues.map((issue, index) => <li className={issue.severity === "error" ? "text-danger" : "text-warning"} key={`${issue.code}:${index}`}><strong>{issue.code}</strong>: {issue.message}</li>)}</ul> : <p className="mt-3 text-xs text-success">Контент, CRM dependencies, URL, SEO/schema и cache blast-radius проверены.</p>}
    <details className="mt-3 rounded-lg border px-3 py-2 text-xs"><summary className="cursor-pointer font-medium">Технические сведения</summary><div className="mt-3 grid gap-3 md:grid-cols-3"><PreviewMetric label="Затронутые URL" value={String(preview.affectedPaths.length)} /><PreviewMetric label="Зависимости" value={String(preview.dependencies.length)} /><PreviewMetric label="Cache tags" value={String(preview.cacheTags.length)} /></div><p className="mt-3 break-all text-[10px] text-muted-foreground">Base release: {preview.baseReleaseId ?? "пусто"} · версия {preview.activeReleaseVersion} · hash {preview.previewHash}</p></details>
  </EditorSection>
}
function PreviewMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border p-3"><p className="text-[10px] text-muted-foreground">{label}</p><strong className="mt-1 block text-lg">{value}</strong></div> }

export function EditorTabContent({ canUploadMedia = false, device, draft, editable, kind, nodes = [], topologyAvailable = true, onRestoreRevision, restoreDisabled = false, tab, update, updateSection, workspace = "default" }: { canUploadMedia?: boolean; device: "desktop" | "tablet" | "mobile"; draft: EditorRecord; editable: boolean; kind: EditorKind; nodes?: ContentNode[]; topologyAvailable?: boolean; onRestoreRevision?: (entry: CmsRevisionHistoryEntry) => Promise<void>; restoreDisabled?: boolean; tab: ContentEditorTab; update: (patch: Partial<EditorRecord>) => void; updateSection: (id: string, mode: InheritanceMode) => void; workspace?: "default" | "offering" }) {
  if (tab === "composition") return <CompositionTab draft={draft} editable={editable} updateSection={updateSection} update={update} />
  if (tab === "media-seo") return <div className="space-y-3"><SeoTab draft={draft} editable={editable} update={update} /><LinkedState title="Медиа этой страницы" detail="Галерея, alt-тексты и точки фокуса остаются в canonical media manager." href="/media" label="Открыть медиатеку" icon={IconPhoto} /></div>
  if (tab === "seo") return <SeoTab draft={draft} editable={editable} update={update} />
  if (tab === "media") return <LinkedState title="Медиа этой страницы" detail="Здесь видны изображения и файлы, а также блоки, в которых они используются." href="/media" label="Открыть медиатеку" icon={IconPhoto} />
  if (tab === "code") return <LinkedState title="Artifact ещё не привязан к странице" detail="Вкладка сохранена для controlled code workflow. До P4.8 здесь нет page → artifact API, поэтому CMS не имитирует файловое сохранение и не изменяет production checkout." href="/code" label="Открыть code workspace" icon={IconCode} />
  if (tab === "analytics") return <LinkedState title="Page analytics" detail="Stable page / section / action IDs и aggregates; без raw IP, contacts и form values." href="/analytics/content" label="Открыть отчёт" icon={IconFileAnalytics} />
  if (tab === "versions") return <VersionTab draft={draft} editable={editable} key={`${draft.id}:${draft.revision ?? draft.version}`} {...(onRestoreRevision ? { onRestoreRevision } : {})} restoreDisabled={restoreDisabled} />
  return <ContentTab canUploadMedia={canUploadMedia} device={device} draft={draft} editable={editable} kind={kind} nodes={nodes} topologyAvailable={topologyAvailable} update={update} offering={workspace === "offering"} />
}

function ContentTab({ canUploadMedia, device, draft, editable, kind, nodes, topologyAvailable, update, offering = false }: { canUploadMedia: boolean; device: string; draft: EditorRecord; editable: boolean; kind: EditorKind; nodes: ContentNode[]; topologyAvailable: boolean; update: (patch: Partial<EditorRecord>) => void; offering?: boolean }) {
  if (offering) return <div className="space-y-3" data-layout="offering-dossier" data-testid="offering-dossier">
    <EditorSection subtitle="Название, адрес и краткий текст публичной страницы." title="Основное">
      <div className="grid items-start gap-3 sm:grid-cols-6"><FormField className="sm:col-span-6" htmlFor="public-title" label="Заголовок страницы"><Input id="public-title" onChange={(event) => update({ publicTitle: event.target.value })} readOnly={!editable} value={draft.publicTitle} /></FormField>{kind !== "home" ? <RoutePlacementFields compact draft={draft} editable={editable} nodes={nodes} topologyAvailable={topologyAvailable} update={update} /> : null}<FormField className="sm:col-span-6" htmlFor="description" label="Короткое описание"><Textarea id="description" onChange={(event) => update({ description: event.target.value })} readOnly={!editable} value={draft.description} /></FormField></div>
    </EditorSection>
    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)]"><HeroEditor canUploadMedia={canUploadMedia} compact draft={draft} editable={editable} update={update} /><PreviewPanel device={device} draft={draft} /></div>
  </div>
  return <div className="space-y-3"><EditorSection subtitle={kind === "profile" ? "Маркетинговые поля редактируются здесь; операционные данные ниже приходят из CRM." : "Название, адрес страницы и её назначение."} title={kind === "home" ? "Главная страница" : "Основное"}><div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="internal-name" label="Внутреннее имя"><Input id="internal-name" readOnly title="Системное имя" value={draft.internalName} /></FormField><FormField htmlFor="public-title" label="Заголовок H1"><Input id="public-title" onChange={(event) => update({ publicTitle: event.target.value })} readOnly={!editable} value={draft.publicTitle} /></FormField>{kind !== "home" ? <RoutePlacementFields draft={draft} editable={editable} nodes={nodes} topologyAvailable={topologyAvailable} update={update} /> : null}<FormField className="sm:col-span-2" htmlFor="description" label="Описание и назначение"><Textarea id="description" onChange={(event) => update({ description: event.target.value })} readOnly={!editable} value={draft.description} /></FormField></div></EditorSection>
    <HeroEditor canUploadMedia={canUploadMedia} draft={draft} editable={editable} update={update} />
    {kind === "home" ? <HomeSections draft={draft} /> : kind === "profile" ? <CrmSnapshot {...(draft.readonlyCrm ? { data: draft.readonlyCrm } : {})} /> : null}
    <PreviewPanel device={device} draft={draft} />
  </div>
}

function RoutePlacementFields({ draft, editable, nodes, topologyAvailable, update, compact = false }: { draft: EditorRecord; editable: boolean; nodes: ContentNode[]; topologyAvailable: boolean; update: (patch: Partial<EditorRecord>) => void; compact?: boolean }) {
  const [parentSearch, setParentSearch] = useState("")
  const descendants = descendantIds(draft.id, nodes)
  const hasChildren = nodes.some((node) => node.parentId === draft.id)
  const moveReason = !topologyAvailable ? "Структура сайта не загружена. URL и родитель остаются без изменений." : draft.id !== "new" && draft.hasPublishedRevision ? "URL уже публиковался: для переноса нужен редирект." : draft.id !== "new" && hasChildren ? "У страницы есть дочерние URL: нужен atomic subtree move." : undefined
  const routeEditable = editable && !moveReason
  const search = parentSearch.trim().toLocaleLowerCase("ru-RU")
  const candidates = nodes.filter((node) => node.status !== "archived" && node.id !== draft.id && !descendants.has(node.id) && (!search || `${node.title} ${node.path}`.toLocaleLowerCase("ru-RU").includes(search)))
  const currentParent = nodes.find((node) => node.id === draft.parentNodeId)
  if (currentParent && !candidates.some((node) => node.id === currentParent.id)) candidates.unshift(currentParent)
  const changeParent = (parentNodeId: string | null) => update(withParentPlacement(draft, parentNodeId, nodes))
  const changeSlug = (slug: string) => update({ slug, url: routePath(nodes.find((node) => node.id === draft.parentNodeId)?.path, slug, draft.parentNodeId ? undefined : draft.url) })
  return <>
    <FormField className={compact ? "sm:col-span-2" : ""} htmlFor="slug" label={compact ? "Адрес страницы" : "Slug"}><Input id="slug" onChange={(event) => changeSlug(event.target.value)} readOnly={!routeEditable} value={draft.slug} /></FormField>
    <div className={compact ? "space-y-2 sm:col-span-4" : "space-y-2"}>
      <FormField htmlFor="parent-search" label="Найти родительский раздел"><Input disabled={!routeEditable} id="parent-search" onChange={(event) => setParentSearch(event.target.value)} placeholder="Название или URL" value={parentSearch} /></FormField>
      <FormField htmlFor="parent" label="Родительский раздел"><select className="h-9 w-full rounded-md border bg-background px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50" disabled={!routeEditable} id="parent" onChange={(event) => changeParent(event.target.value || null)} value={draft.parentNodeId ?? ""}><option value="">Корень сайта</option>{candidates.map((node) => <option key={node.id} value={node.id}>{node.title} · {node.path}</option>)}</select></FormField>
    </div>
    <Alert className={`${compact ? "sm:col-span-6" : "sm:col-span-2"} ${moveReason ? "border-warning/35" : "border-info/25"}`}><IconLink /><AlertTitle>{moveReason ? "Перенос сейчас недоступен" : "Адрес страницы"}</AlertTitle><AlertDescription>{moveReason ?? <span className="font-mono">{draft.url}</span>}</AlertDescription></Alert>
  </>
}

function HeroEditor({ canUploadMedia, draft, editable, update, compact = false }: { canUploadMedia: boolean; draft: EditorRecord; editable: boolean; update: (patch: Partial<EditorRecord>) => void; compact?: boolean }) {
  const change = <K extends keyof EditorRecord["hero"]>(key: K, value: EditorRecord["hero"][K]) => update({ hero: { ...draft.hero, [key]: value } })
  const own = draft.hero.mode === "override"
  const modeOptions = [{ value: "inherit", label: "Общие настройки" }, { value: "override", label: "Настроить здесь" }, { value: "disabled", label: "Скрыть первый экран" }]
  return <EditorSection subtitle={compact ? "Первый экран публичной страницы: текст, кнопки и фото." : "Шаблон этой страницы. Можно унаследовать общий hero, заменить любые элементы или полностью скрыть."} title={compact ? "Первый экран" : "Hero этой страницы"}>
    <div className="grid gap-3">
      <FormSelect disabled={!editable} id="hero-mode" label={compact ? "Вариант первого экрана" : "Как показывать"} onValueChange={(value) => change("mode", value as InheritanceMode)} options={compact ? modeOptions : [{ value: "inherit", label: "Как на сайте по умолчанию" }, { value: "override", label: "Настроить для этой страницы" }, { value: "disabled", label: "Не показывать" }]} value={draft.hero.mode} />
      {draft.hero.mode === "disabled" ? <Alert className="border-warning/30"><IconAlertTriangle /><AlertTitle>{compact ? "Первый экран скрыт" : "Hero скрыт на этой странице"}</AlertTitle><AlertDescription>Проверьте, что заголовок страницы и основной призыв к действию остаются доступны в другом блоке.</AlertDescription></Alert> : null}
      {own ? <><div className={compact ? "grid gap-3 sm:grid-cols-6" : "grid gap-4 sm:grid-cols-2"}><FormField className={compact ? "sm:col-span-2" : ""} htmlFor="hero-eyebrow" label="Надпись над заголовком"><Input id="hero-eyebrow" onChange={(event) => change("eyebrow", event.target.value)} readOnly={!editable} value={draft.hero.eyebrow} /></FormField><FormField className={compact ? "sm:col-span-4" : ""} htmlFor="hero-title" label={compact ? "Заголовок первого экрана" : "Заголовок hero"}><Input id="hero-title" onChange={(event) => change("title", event.target.value)} readOnly={!editable} value={draft.hero.title} /></FormField><FormField className="sm:col-span-6" htmlFor="hero-description" label="Текст"><Textarea id="hero-description" onChange={(event) => change("description", event.target.value)} readOnly={!editable} value={draft.hero.description} /></FormField></div>
        <div className="grid gap-4 sm:grid-cols-2"><FormField htmlFor="hero-primary-label" label="Основная кнопка · текст"><Input id="hero-primary-label" onChange={(event) => change("primaryCtaLabel", event.target.value)} readOnly={!editable} value={draft.hero.primaryCtaLabel} /></FormField><FormField htmlFor="hero-primary-target" label="Основная кнопка · ссылка"><Input id="hero-primary-target" onChange={(event) => change("primaryCtaTarget", event.target.value)} readOnly={!editable} value={draft.hero.primaryCtaTarget} /></FormField><label className="flex min-h-9 items-center gap-2 text-xs"><Switch checked={draft.hero.primaryCtaEnabled} disabled={!editable} onCheckedChange={(checked) => change("primaryCtaEnabled", checked)} size="sm" />Показывать основную кнопку</label><FormField htmlFor="hero-secondary-label" label="Вторая кнопка · текст"><Input id="hero-secondary-label" onChange={(event) => change("secondaryCtaLabel", event.target.value)} readOnly={!editable} value={draft.hero.secondaryCtaLabel} /></FormField><FormField htmlFor="hero-secondary-target" label="Вторая кнопка · ссылка"><Input id="hero-secondary-target" onChange={(event) => change("secondaryCtaTarget", event.target.value)} readOnly={!editable} value={draft.hero.secondaryCtaTarget} /></FormField><label className="flex min-h-9 items-center gap-2 text-xs"><Switch checked={draft.hero.secondaryCtaEnabled} disabled={!editable} onCheckedChange={(checked) => change("secondaryCtaEnabled", checked)} size="sm" />Показывать вторую кнопку</label></div>
        <div className="grid gap-4 sm:grid-cols-2"><HeroMediaField assetId={draft.hero.desktopImage} canUpload={canUploadMedia} editable={editable} label="Фоновое изображение" onChange={(id) => change("desktopImage", id)} /><HeroMediaField assetId={draft.hero.mobileImage} canUpload={canUploadMedia} editable={editable} label="Фон для телефона" onChange={(id) => change("mobileImage", id)} /><FormField htmlFor="hero-overlay" label="Затемнение фона, %"><Input id="hero-overlay" max={90} min={0} onChange={(event) => change("overlay", Math.max(0, Math.min(90, Number(event.target.value))))} readOnly={!editable} type="number" value={draft.hero.overlay} /></FormField><FormSelect disabled={!editable} id="hero-focal" label="Фокус изображения" onValueChange={(value) => change("focalPosition", value as EditorRecord["hero"]["focalPosition"])} options={[{ value: "left", label: "Слева" }, { value: "center", label: "По центру" }, { value: "right", label: "Справа" }]} value={draft.hero.focalPosition} /><FormSelect disabled={!editable} id="hero-alignment" label="Выравнивание текста" onValueChange={(value) => change("alignment", value as EditorRecord["hero"]["alignment"])} options={[{ value: "left", label: "Слева" }, { value: "center", label: "По центру" }]} value={draft.hero.alignment} /><p className="text-xs text-muted-foreground sm:col-span-2">Если фон для телефона не выбран, используется обычное фоновое изображение.</p></div>{draft.kind === "home" ? <HomePromotionsField editable={editable} ids={draft.hero.promotionIds} onChange={(ids) => change("promotionIds", ids)} /> : null}</> : draft.hero.mode === "inherit" ? <div className="rounded-lg border bg-muted/25 p-3"><p className="text-xs font-medium">Используются общие настройки hero</p><p className="mt-1 text-[10px] text-muted-foreground">Чтобы заменить текст, кнопки или изображения только здесь, выберите «Настроить для этой страницы».</p></div> : null}
    </div>
  </EditorSection>
}

function CompositionTab({ draft, editable, updateSection, update }: { draft: EditorRecord; editable: boolean; updateSection: (id: string, mode: InheritanceMode) => void; update: (patch: Partial<EditorRecord>) => void }) {
  return <EditorSection subtitle={draft.kind === "home" ? "Выберите секцию, чтобы изменить её содержимое. Изменения сохраняются вместе со страницей." : "Общие настройки можно заменить или скрыть только для этой страницы."} title={draft.kind === "home" ? "Секции главной" : "Секции страницы"}><div className="space-y-3">{draft.sections.map((section) => <div key={section.id}>
    <InheritanceControl disabled={!editable || section.editorialUnsupported || ((section.key === "partners" && !section.partnersConfig) || (section.key === "why-us" && !section.whyUsConfig))} onChange={(mode) => updateSection(section.id, mode)} section={section} />
    {section.mode === "override" && section.partnersConfig && <PartnersSectionFields id={section.id} value={section.partnersConfig} editable={editable} onChange={(partnersConfig) => update({ sections: draft.sections.map((current) => current.id === section.id ? { ...current, partnersConfig } : current) })} />}
    {section.mode === "override" && section.whyUsConfig && <WhyUsSectionFields id={section.id} value={section.whyUsConfig} editable={editable} onChange={(whyUsConfig) => update({ sections: draft.sections.map((current) => current.id === section.id ? { ...current, whyUsConfig } : current) })} />}
    {section.mode === "override" && section.homepageConfig && <HomepageSectionFields id={section.id} {...(section.key ? { sectionKey: section.key } : {})} value={section.homepageConfig} editable={editable} onChange={(homepageConfig) => update({ sections: draft.sections.map((current) => current.id === section.id ? { ...current, homepageConfig } : current) })} />}
    {section.mode === "override" && section.editorialConfig && <EditorialSectionFields id={section.id} value={section.editorialConfig} editable={editable} showAuthor={draft.kind === "article"} onChange={(editorialConfig) => update({ sections: draft.sections.map((current) => current.id === section.id ? { ...current, editorialConfig } : current) })} />}
    {section.editorialUnsupported && <p className="mt-2 text-xs text-muted-foreground">Эта текстовая секция содержит неподдерживаемую настройку. Форма не изменяет её; обратитесь к техническому администратору.</p>}
    {section.key === "partners" && !section.partnersConfig && <p className="mt-2 text-xs text-muted-foreground">Редактор этой версии или составной конфигурации пока недоступен. Сохранение остальных полей не изменяет её содержимое.</p>}
    {section.key === "why-us" && !section.whyUsConfig && <p className="mt-2 text-xs text-muted-foreground">Редактор этой версии или составной конфигурации пока недоступен. Сохранение остальных полей не изменяет её содержимое.</p>}
  </div>)}
  {draft.kind === "home" && !draft.sections.some((section) => section.key === "partners") && <Button disabled={!editable} onClick={() => update({ sections: [...draft.sections, createPartnersEditorSection()] })} size="sm" variant="outline">Добавить секцию «Партнёры»</Button>}
  {draft.kind === "home" && !draft.sections.some((section) => section.key === "why-us") && <Button disabled={!editable} onClick={() => update({ sections: [...draft.sections, createWhyUsEditorSection()] })} size="sm" variant="outline">Добавить секцию «О нас»</Button>}
  {draft.kind === "home" && homepageEditableSections.filter((key) => !draft.sections.some((section) => section.key === key)).map((key) => <Button key={key} disabled={!editable} onClick={() => update({ sections: [...draft.sections, createHomepageSectionEditorSection(key)] })} size="sm" variant="outline">Добавить секцию «{homepageSectionLabel(key)}»</Button>)}
  {(draft.kind === "article" || draft.kind === "landing" || draft.kind === "profile") && !draft.sections.some((section) => section.editorialConfig || section.editorialUnsupported) && <Button disabled={!editable} onClick={() => update({ sections: [...draft.sections, createEditorialSection()] })} size="sm" variant="outline">Добавить текст страницы</Button>}
  </div></EditorSection>
}

function homepageSectionLabel(key: (typeof homepageEditableSections)[number]) { return ({ events: "Ближайшие события", houses: "Домики", "sauna-chan": "Баня и чан", programs: "Программы", venues: "Площадки", blog: "Блог", reviews: "Отзывы", map: "Карта", faq: "Вопросы и ответы", calculator: "Подбор отдыха" } as const)[key] }

function mergeLocalEditorChanges(persisted: EditorRecord, local: EditorRecord, server: EditorRecord): EditorRecord {
  return {
    ...server,
    publicTitle: changed(persisted.publicTitle, local.publicTitle) ? local.publicTitle : server.publicTitle,
    description: changed(persisted.description, local.description) ? local.description : server.description,
    slug: changed(persisted.slug, local.slug) ? local.slug : server.slug,
    url: changed(persisted.url, local.url) ? local.url : server.url,
    ...(changed(persisted.parentNodeId, local.parentNodeId) && local.parentNodeId !== undefined ? { parentNodeId: local.parentNodeId } : {}),
    ...(changed(persisted.sortOrder, local.sortOrder) && local.sortOrder !== undefined ? { sortOrder: local.sortOrder } : {}),
    seoTitle: changed(persisted.seoTitle, local.seoTitle) ? local.seoTitle : server.seoTitle,
    seoDescription: changed(persisted.seoDescription, local.seoDescription) ? local.seoDescription : server.seoDescription,
    indexPolicy: changed(persisted.indexPolicy, local.indexPolicy) ? local.indexPolicy : server.indexPolicy,
    hero: mergeLocalHeroChanges(persisted.hero, local.hero, server.hero),
    sections: mergeLocalSectionChanges(persisted.sections, local.sections, server.sections),
  }
}

function mergeLocalHeroChanges(persisted: EditorRecord["hero"], local: EditorRecord["hero"], server: EditorRecord["hero"]): EditorRecord["hero"] {
  const fields = ["mode", "eyebrow", "title", "description", "primaryCtaLabel", "primaryCtaTarget", "primaryCtaEnabled", "secondaryCtaLabel", "secondaryCtaTarget", "secondaryCtaEnabled", "desktopImage", "mobileImage", "overlay", "focalPosition", "alignment", "promotionIds"] as const
  return fields.reduce((result, field) => changed(persisted[field], local[field]) ? { ...result, [field]: local[field] } : result, { ...server })
}

function mergeLocalSectionChanges(persisted: EditorRecord["sections"], local: EditorRecord["sections"], server: EditorRecord["sections"]): EditorRecord["sections"] {
  const before = new Map(persisted.map((section) => [section.id, section]))
  const current = new Map(server.map((section) => [section.id, section]))
  const merged = server.map((section) => {
    const localSection = local.find((item) => item.id === section.id)
    const persistedSection = before.get(section.id)
    if (!localSection || !persistedSection) return section
    return {
      ...section,
      mode: changed(persistedSection.mode, localSection.mode) ? localSection.mode : section.mode,
      ...(changed(persistedSection.partnersConfig, localSection.partnersConfig) ? { partnersConfig: localSection.partnersConfig } : {}),
      ...(changed(persistedSection.whyUsConfig, localSection.whyUsConfig) ? { whyUsConfig: localSection.whyUsConfig } : {}),
      ...(changed(persistedSection.homepageConfig, localSection.homepageConfig) ? { homepageConfig: localSection.homepageConfig } : {}),
      ...(changed(persistedSection.editorialConfig, localSection.editorialConfig) ? { editorialConfig: localSection.editorialConfig } : {}),
    }
  })
  for (const section of local) if (!before.has(section.id) && !current.has(section.id)) merged.push(section)
  return merged
}

function changed(left: unknown, right: unknown) { return JSON.stringify(left) !== JSON.stringify(right) }

function SeoTab({ draft, editable, update }: { draft: EditorRecord; editable: boolean; update: (patch: Partial<EditorRecord>) => void }) { return <div className="space-y-3"><Alert className={draft.seoChecks.blockers ? "border-danger/30" : "border-success/30"}><IconSearch /><AlertTitle>{draft.seoChecks.passed} checks passed · {draft.seoChecks.warnings} warning · {draft.seoChecks.blockers} blocker</AlertTitle><AlertDescription>Оценка собрана из явных правил, а не из магического score.</AlertDescription></Alert><EditorSection title="Metadata"><div className="grid gap-4"><FormField htmlFor="seo-title" label="SEO title"><Input id="seo-title" onChange={(event) => update({ seoTitle: event.target.value })} readOnly={!editable} value={draft.seoTitle} /></FormField><FormField htmlFor="seo-description" label="SEO description"><Textarea id="seo-description" onChange={(event) => update({ seoDescription: event.target.value })} readOnly={!editable} value={draft.seoDescription} /></FormField><FormField htmlFor="canonical" label="Canonical"><Input id="canonical" readOnly value={draft.seoCanonical?.mode === "custom" ? draft.seoCanonical.url : `Адрес этой страницы: ${draft.url}`} /></FormField><FormField htmlFor="indexing" label="Индексация"><FormSelect disabled={!editable} id="indexing" label="Индексация" onValueChange={(value) => update({ indexPolicy: value as EditorRecord["indexPolicy"] })} options={[{ value: "index_follow", label: "Индексировать" }, { value: "noindex_follow", label: "Не индексировать" }, { value: "noindex_nofollow", label: "Не индексировать и не переходить по ссылкам" }]} value={draft.indexPolicy} /></FormField></div></EditorSection><EditorSection subtitle="Как результат может выглядеть в поиске" title="Snippet preview"><div className="max-w-2xl rounded-lg border p-4"><p className="text-base text-[#1a0dab]">{draft.seoTitle}</p><p className="mt-1 text-xs text-[#006621]">Адрес страницы: {draft.url}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{draft.seoDescription}</p></div></EditorSection></div> }

function EditorSidebar({ draft, externalEditHref, location, publicationStatus, publicationStatusError, publicationStatusLoading, onReloadPublicationStatus }: {
  draft: EditorRecord
  externalEditHref?: string
  location: string
  publicationStatus: CmsNodePublicationStatus | null
  publicationStatusError: string | undefined
  publicationStatusLoading: boolean
  onReloadPublicationStatus: () => void
}) {
  const activePath = publicationStatus?.active ? publicationStatus.path : null
  const publicationLabel = draft.id === "new" ? "Новый черновик" : publicationStatusError ? "Проверка недоступна" : publicationStatusLoading || !publicationStatus ? "Проверяем…" : activePath ? "В активной публикации" : "Не в активной публикации"
  return <div className="space-y-3">
    <section className="overflow-hidden rounded-xl border bg-background">
      <ListSection count={6} icon={IconSettings} title="Страница">
        <ListRow><Summary label="Редакция" value={<EditorWorkflowStatus draft={draft} />} /></ListRow>
        <ListRow><Summary label="URL черновика" value={<span className="font-mono">{draft.url}</span>} /></ListRow>
        <ListRow><Summary label="Активная публикация" value={publicationLabel} /></ListRow>
        <ListRow><Summary label="Ответственный" value={draft.owner} /></ListRow>
        <ListRow><Summary label="Обновлено" value={draft.updatedLabel} /></ListRow>
        <ListRow><Summary label="История публикации" value={draft.reviewLabel} /></ListRow>
      </ListSection>
      {activePath ? <p className="break-all border-t px-4 py-2 font-mono text-[10px] text-muted-foreground">Публичный URL: {activePath}</p> : null}
      {publicationStatusError ? <div className="border-t px-4 py-2 text-xs text-destructive">{publicationStatusError} <Button onClick={onReloadPublicationStatus} size="xs" variant="outline">Повторить</Button></div> : null}
      <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">Статус показывает состав активной публикации; доставка до сайта проверяется отдельно.</p>
    </section>
    <section className="rounded-xl border bg-background p-4"><h3 className="text-[13px] font-semibold">Готовность страницы</h3><div className="mt-3 grid grid-cols-3 divide-x text-center"><Quality value={draft.seoChecks.passed} label="Готово" tone="success" /><Quality value={draft.seoChecks.warnings} label="Проверить" tone="warning" /><Quality value={draft.seoChecks.blockers} label="Исправить" tone="danger" /></div><Link className="mt-3 flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs hover:bg-muted" to={`/seo/pages/${draft.id}?return=${encodeURIComponent(location)}`}><IconSearch className="size-4" />SEO-отчёт</Link></section>
    {externalEditHref ? <a className="flex items-center gap-2 rounded-xl border bg-info-subtle p-3 text-xs font-medium text-info-foreground hover:brightness-95" href={externalEditHref}><IconBrandDatabricks className="size-4" />Цена и работа ресурса — в CRM<IconExternalLink className="ml-auto size-3" /></a> : null}
  </div>
}

function EditorWorkflowStatus({ draft }: { draft: EditorRecord }) { return draft.revisionState === "approved" ? <StatusBadge tone="info">Одобрено</StatusBadge> : <ContentStatusBadge status={draft.status} /> }

function Summary({ label, value }: { label: string; value: React.ReactNode }) { return <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2"><span className="text-[10px] text-muted-foreground">{label}</span><span className="min-w-0 truncate text-right text-xs font-medium">{value}</span></div> }
function Quality({ label, tone, value }: { label: string; tone: string; value: number }) { return <div><p className={`text-lg font-semibold text-${tone}`}>{value}</p><p className="text-[9px] text-muted-foreground">{label}</p></div> }

function ConflictState({ onKeepLocal, onReload }: { onKeepLocal?: (() => void) | undefined; onReload: () => void }) { return <Alert className="mb-3 border-danger/30" variant="destructive"><IconGitCompare /><AlertTitle>Страница уже изменена в другой вкладке</AlertTitle><AlertDescription><p>Локальный текст остаётся в форме. Можно загрузить свежую серверную версию и перенести на неё только свои изменения либо полностью перейти к серверному варианту.</p><div className="mt-2 flex flex-wrap gap-2">{onKeepLocal ? <Button onClick={onKeepLocal} size="xs" variant="outline">Сверить с сервером</Button> : null}<Button onClick={onReload} size="xs" variant="outline">Загрузить серверную версию</Button></div></AlertDescription></Alert> }

const publicationBlockerLabels: Record<string, string> = {
  cms_node_archived: "Материал в архиве",
  cms_node_kind_incompatible: "Тип страницы не совместим с этой записью",
  offering_not_active: "Рабочая запись ещё не активна",
  public_profile_mismatch: "Публичный профиль связан с другой редакцией",
  public_profile_missing: "Показ на сайте не настроен",
  revision_relation_mismatch: "Связь редакции не совпадает",
  revision_relation_missing: "Редакция не связана с рабочей записью",
  safe_public_projection_missing: "Данные для сайта ещё не подготовлены",
}

function PublicationBlockedAlert({ blockers, subjectLabel }: { blockers: readonly string[]; subjectLabel: string }) {
  return <Alert className="mb-3 border-warning/35"><IconAlertTriangle /><AlertTitle>Публикация {subjectLabel} закрыта</AlertTitle><AlertDescription><p>Черновик можно редактировать и проверять, но сайт не изменится, пока не готовы цена, страница и безопасная публикация.</p><ul className="mt-2 list-disc space-y-1 pl-4">{blockers.map((blocker) => <li key={blocker}>{publicationBlockerLabels[blocker] ?? blocker}</li>)}</ul></AlertDescription></Alert>
}

function HomeSections({ draft }: { draft: EditorRecord }) { return <EditorSection actions={<Button onClick={() => window.location.assign("?tab=composition")} size="xs" variant="outline">Настроить</Button>} subtitle="Порядок и visibility приходят из сохранённой revision; текст и CTA — typed fields в композиции." title="Секции главной"><div className="divide-y rounded-lg border">{draft.sections.filter((section) => section.key !== "hero").map((section) => <div className="flex min-h-12 items-center gap-3 px-3" key={section.id}><span className="text-muted-foreground">⋮⋮</span><span className="min-w-0 flex-1 text-xs font-medium">{section.label}</span><SourceMarker source={section.source === "Эта страница" ? "CMS" : section.source === "Источник наследования" ? "inherited" : "computed"} /><StatusBadge tone={section.mode === "disabled" ? "warning" : "success"}>{section.mode === "disabled" ? "Скрыто" : section.mode === "inherit" ? "Наследует" : "Настроено"}</StatusBadge></div>)}</div></EditorSection> }
function CrmSnapshot({ data }: { data?: NonNullable<EditorRecord["readonlyCrm"]> }) { if (!data) return null; return <EditorSection actions={<SourceMarker source="CRM" />} subtitle="Authoritative values не дублируются в CMS." title="Данные CRM · readonly"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(data).map(([key, value]) => <div className="rounded-lg border bg-muted/25 p-3" key={key}><p className="text-[10px] text-muted-foreground">{key}</p><p className="mt-1 text-xs font-medium">{value}</p></div>)}</div></EditorSection> }
function PreviewPanel({ device, draft }: { device: string; draft: EditorRecord }) { const api = cmsRepository.mode === "api"; const own = draft.hero.mode === "override"; const title = own ? draft.hero.title : draft.publicTitle; const description = own ? draft.hero.description : draft.description; const asset = useHeroImage(draft.hero.desktopImage); const savedBackground = draft.hero.sourcePolicy?.mode === "override" && draft.hero.sourcePolicy.config.backgroundAssetId === draft.hero.desktopImage ? draft.hero.sourcePolicy.config.background?.variants.find((variant) => variant.format === "webp" || variant.format === "avif")?.url : undefined; const mobileAsset = useHeroImage(draft.hero.mobileImage); const savedMobile = draft.hero.sourcePolicy?.mode === "override" && draft.hero.sourcePolicy.config.mobileBackgroundAssetId === draft.hero.mobileImage ? draft.hero.sourcePolicy.config.mobileBackground?.variants.find((variant) => variant.format === "webp" || variant.format === "avif")?.url : undefined; const backgroundImage = readyImageUrl(asset) ?? savedBackground; const image = device === "mobile" ? readyImageUrl(mobileAsset) ?? savedMobile ?? backgroundImage : backgroundImage; return <EditorSection actions={<StatusBadge tone="info">{device === "mobile" ? "Телефон" : device === "tablet" ? "Планшет" : "Компьютер"}</StatusBadge>} subtitle="Упрощённый макет текущего черновика до публикации." title="Как выглядит hero">{draft.hero.mode === "disabled" ? <PageState icon={IconPhoto} title="Hero скрыт">На этой странице первым будет следующий включённый блок.</PageState> : <div className={`mx-auto overflow-hidden rounded-lg border bg-neutral-900 text-white transition-all ${device === "mobile" ? "max-w-[360px]" : device === "tablet" ? "max-w-[720px]" : "max-w-none"}`}><div className={`relative flex min-h-64 flex-col justify-end overflow-hidden p-6 ${draft.hero.alignment === "center" ? "items-center text-center" : "items-start text-left"}`} style={{ backgroundColor: "#24372d", backgroundImage: image ? `url(${image})` : "linear-gradient(135deg,#173f2c,#3c3934)", backgroundPosition: draft.hero.focalPosition, backgroundSize: "cover" }}><span className="absolute inset-0 bg-black" style={{ opacity: draft.hero.overlay / 100 }} /><div className="relative z-10"><p className="text-[10px] uppercase tracking-[.15em] text-white/70">{own ? draft.hero.eyebrow : "Свистоплясово"}</p><h3 className="mt-2 max-w-xl text-2xl font-semibold">{title}</h3><p className="mt-2 max-w-lg text-xs leading-5 text-white/75">{description}</p><div className={`mt-4 flex flex-wrap gap-2 ${draft.hero.alignment === "center" ? "justify-center" : "justify-start"}`}>{draft.hero.primaryCtaEnabled ? <Button disabled={api} size="sm" title={api ? "Интерактивный предпросмотр подключается отдельно" : undefined}>{draft.hero.primaryCtaLabel || "Подобрать отдых"}</Button> : null}{own && draft.hero.secondaryCtaEnabled && draft.hero.secondaryCtaLabel ? <Button className="border-white/35 bg-white/10 text-white" disabled={api} size="sm" variant="outline">{draft.hero.secondaryCtaLabel}</Button> : null}</div></div></div></div>}</EditorSection> }
function VersionTab({ draft, editable, onRestoreRevision, restoreDisabled }: { draft: EditorRecord; editable: boolean; onRestoreRevision?: (entry: CmsRevisionHistoryEntry) => Promise<void>; restoreDisabled: boolean }) {
  const loader = useCallback(() => draft.id === "new" ? Promise.resolve({ items: [] as CmsRevisionHistoryEntry[], nextBefore: null }) : cmsRepository.getRevisionHistory(draft.id), [draft.id])
  const state = useRepository(loader)
  const [older, setOlder] = useState<CmsRevisionHistoryEntry[]>([])
  const [nextBefore, setNextBefore] = useState<number | null | undefined>()
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string>()
  const [selected, setSelected] = useState<CmsRevisionHistoryEntry>()
  const [comparison, setComparison] = useState<EditorRecord>()
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState<string>()
  const comparisonRequest = useRef(0)
  const items = [...(state.data?.items ?? []), ...older]
  const cursor = nextBefore === undefined ? state.data?.nextBefore : nextBefore
  const compare = async (entry: CmsRevisionHistoryEntry) => {
    const request = ++comparisonRequest.current
    setSelected(entry); setComparison(undefined); setComparisonError(undefined); setComparisonLoading(true)
    try {
      const revision = await cmsRepository.getRevisionEditor(draft.id, entry.id)
      if (request === comparisonRequest.current) setComparison(revision)
    } catch (error) {
      if (request === comparisonRequest.current) setComparisonError(mutationMessage(error, "Не удалось открыть редакцию"))
    } finally {
      if (request === comparisonRequest.current) setComparisonLoading(false)
    }
  }
  const loadMore = async () => {
    if (cursor === null || cursor === undefined || loadingMore) return
    setLoadingMore(true); setMoreError(undefined)
    try {
      const page = await cmsRepository.getRevisionHistory(draft.id, cursor)
      setOlder((current) => [...current, ...page.items]); setNextBefore(page.nextBefore)
    } catch (reason) { setMoreError(reason instanceof Error ? reason.message : "Не удалось загрузить историю") }
    finally { setLoadingMore(false) }
  }
  const differences = comparison ? revisionDifferences(draft, comparison) : []
  const selectedIsCurrent = selected?.revision === (draft.revision ?? draft.version)
  return <EditorSection subtitle="Сохранённые редакции этой страницы, от новых к старым. Восстановление создаёт черновик и не меняет сайт до публикации." title="История правок">
    {state.loading && !state.data ? <LoadingRows /> : state.error ? <PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="История недоступна">{state.error}</PageState> : items.length ? <div className="divide-y rounded-lg border">{items.map((entry) => <div className="flex min-h-16 items-start gap-3 px-3 py-3" key={entry.id}><IconHistory className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1 text-xs"><div className="flex flex-wrap items-center gap-2"><strong>Редакция {entry.revision}</strong><StatusBadge tone={entry.state === "published" ? "success" : entry.state === "archived" ? "neutral" : "info"}>{revisionStateLabel(entry.state)}</StatusBadge>{entry.revision === (draft.revision ?? draft.version) ? <span className="text-muted-foreground">Текущая</span> : null}</div><p className="mt-1 truncate">{entry.title} · {entry.path}</p><p className="mt-1 text-[10px] text-muted-foreground">{entry.createdAt ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt)) : "Дата не указана"}{entry.createdBy ? ` · Автор ${entry.createdBy.slice(0, 8)}` : ""}</p></div><Button aria-label={`Сравнить редакцию ${entry.revision}`} onClick={() => void compare(entry)} size="xs" variant="outline">Сравнить</Button></div>)}</div> : <PageState icon={IconHistory} title="Истории пока нет">Сохраните первую редакцию страницы.</PageState>}
    {cursor ? <Button className="mt-3" disabled={loadingMore} onClick={() => void loadMore()} size="sm" variant="outline">{loadingMore ? "Загружаем…" : "Показать более ранние"}</Button> : null}
    {moreError ? <p className="mt-2 text-xs text-danger" role="alert">{moreError}</p> : null}
    {selected ? <section aria-label={`Сравнение редакции ${selected.revision}`} className="mt-4 rounded-lg border bg-background p-3">
      <h3 className="text-sm font-semibold">Редакция {selected.revision} и текущая</h3>
      {comparisonLoading ? <p className="mt-2 text-xs text-muted-foreground">Загружаем редакцию…</p> : comparisonError ? <p className="mt-2 text-xs text-danger" role="alert">{comparisonError}</p> : comparison ? <>
        {differences.length ? <div className="mt-3 divide-y rounded-md border">{differences.map((item) => <div className="grid gap-1 p-2 text-xs sm:grid-cols-[150px_1fr_1fr] sm:gap-3" key={item.label}><strong>{item.label}</strong><span><span className="text-muted-foreground">Сейчас: </span>{item.current}</span><span><span className="text-muted-foreground">Редакция {selected.revision}: </span>{item.previous}</span></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">Поля, доступные в редакторе, совпадают. Дополнительные SEO-настройки могут отличаться.</p>}
        {selected.path !== draft.url ? <p className="mt-3 text-xs text-warning">В старой редакции URL был {selected.path}. При восстановлении останется нынешний адрес {draft.url}.</p> : null}
        <p className="mt-3 text-xs text-muted-foreground">Связи с CRM и текущий URL сохраняются. Для проверки всех блоков после восстановления откройте предпросмотр.</p>
        {!selectedIsCurrent && onRestoreRevision ? <Button className="mt-3" disabled={!editable || restoreDisabled || (comparison.schemaVersion !== undefined && comparison.schemaVersion !== 1)} onClick={() => void onRestoreRevision(selected)} size="sm" variant="outline">Вернуть в новый черновик</Button> : null}
        {restoreDisabled ? <p className="mt-2 text-xs text-muted-foreground">Сохраните текущие правки перед восстановлением.</p> : null}
      </> : null}
    </section> : null}
  </EditorSection>
}
function revisionDifferences(current: EditorRecord, previous: EditorRecord) {
  const rows: Array<{ label: string; current: string; previous: string }> = []
  const add = (label: string, now: string, then: string) => { if (now !== then) rows.push({ label, current: now || "—", previous: then || "—" }) }
  add("Заголовок", current.publicTitle, previous.publicTitle)
  add("Описание", current.description, previous.description)
  add("SEO-заголовок", current.seoTitle, previous.seoTitle)
  add("SEO-описание", current.seoDescription, previous.seoDescription)
  add("Индексация", current.indexPolicy, previous.indexPolicy)
  if (JSON.stringify(current.hero) !== JSON.stringify(previous.hero)) rows.push({ label: "Первый экран", current: heroRevisionSummary(current), previous: heroRevisionSummary(previous) })
  const sections = new Map([...current.sections, ...previous.sections].map((section) => [section.id, section.label]))
  for (const [id, label] of sections) {
    const now = current.sections.find((section) => section.id === id)
    const then = previous.sections.find((section) => section.id === id)
    if (JSON.stringify(now) !== JSON.stringify(then)) rows.push({ label: `Блок «${label}»`, current: sectionRevisionSummary(now), previous: sectionRevisionSummary(then) })
  }
  return rows
}
function heroRevisionSummary(record: EditorRecord) { return record.hero.mode === "disabled" ? "Скрыт" : record.hero.mode === "inherit" ? "Наследуется" : `${record.hero.title || "Без заголовка"} · ${record.hero.desktopImage ? "фон выбран" : "без фона"}` }
function sectionRevisionSummary(section: EditorRecord["sections"][number] | undefined) { if (!section) return "Отсутствует"; const config = section.homepageConfig; return `${section.mode === "disabled" ? "Скрыт" : section.mode === "inherit" ? "Наследуется" : "Настроен"}${config?.title ? ` · ${config.title}` : ""}${config?.faq ? ` · ${config.faq.length} вопросов` : ""}${config?.reviews ? ` · ${config.reviews.length} отзывов` : ""}` }
function revisionStateLabel(state: CmsRevisionHistoryEntry["state"]) { return ({ draft: "Черновик", review: "На проверке", approved: "Одобрена", scheduled: "Запланирована", published: "Публиковалась", superseded: "Заменена", archived: "Архив" } as const)[state] }
function LinkedState({ detail, href, icon, label, title }: { detail: string; href: string; icon: React.ElementType; label: string; title: string }) { return <EditorSection title={title}><PageState actionLabel={label} icon={icon} onAction={() => window.location.assign(href)} title={title}>{detail}</PageState></EditorSection> }
function editorHref(record: EditorRecord) { return record.kind === "home" ? "/content/home" : record.kind === "category" ? `/content/categories/${record.id}` : record.kind === "profile" ? `/content/public-profiles/resource/${record.id}` : record.kind === "article" ? `/content/articles/${record.id}` : `/content/pages/${record.id}` }
function routePath(parentPath: string | undefined, slug: string, currentPath?: string) { const cleanSlug = slug.replace(/^\/+|\/+$/g, ""); const commercialPrefix = currentPath?.match(/^\/(domiki|kemping|poshadki|dopy|programmy|meropriyatiya)\/[^/]+$/)?.[1]; const base = parentPath && parentPath !== "/" ? parentPath.replace(/\/$/, "") : commercialPrefix ? `/${commercialPrefix}` : ""; return `${base}/${cleanSlug}` }
function descendantIds(nodeId: string, nodes: ContentNode[]) { const result = new Set<string>(); if (nodeId === "new") return result; const queue = [nodeId]; while (queue.length) { const parentId = queue.shift()!; for (const node of nodes) if (node.parentId === parentId && !result.has(node.id)) { result.add(node.id); queue.push(node.id) } } return result }
function withParentPlacement(draft: EditorRecord, parentNodeId: string | null, nodes: ContentNode[]): EditorRecord { const parent = nodes.find((node) => node.id === parentNodeId); const siblingOrders = nodes.filter((node) => node.id !== draft.id && node.parentId === parentNodeId).map((node) => node.sortOrder); const sortOrder = draft.parentNodeId === parentNodeId && draft.sortOrder !== undefined ? draft.sortOrder : Math.min(100000, (siblingOrders.length ? Math.max(...siblingOrders) : 0) + 10); return { ...draft, parentNodeId, parent: parent?.title ?? "Корень сайта", sortOrder, url: routePath(parent?.path, draft.slug, parentNodeId === null && draft.parentNodeId === null ? draft.url : undefined) } }
function mutationMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback
  if (!(error instanceof AdminApiError)) return error.message
  const topologyLabels: Record<string, string> = { CMS_PARENT_INVALID: "Родительский раздел недоступен. Выберите другой активный раздел.", CMS_PARENT_CYCLE: "Этот родитель создаст цикл в дереве. Выберите другой раздел.", CMS_ROUTE_INVALID: "URL не соответствует выбранному родителю и slug.", CMS_SUBTREE_MOVE_REQUIRED: "У страницы есть дочерние URL. Для переноса нужен atomic subtree move.", CMS_REDIRECT_REQUIRED: "URL уже был опубликован. Создайте redirect proposal перед переносом.", CMS_RELEASE_STALE: "Публикация сайта изменилась. Обновите страницу и попробуйте снова." }
  const fields = Object.entries(error.fieldErrors ?? {}).flatMap(([field, messages]) => messages.map((message) => `${field}: ${message}`))
  const issues = error.rawCode === "CMS_UNPUBLISH_BLOCKED" && Array.isArray(error.details.issues)
    ? error.details.issues.flatMap((item) => item && typeof item === "object" && "message" in item && typeof item.message === "string" ? [item.message] : []).slice(0, 5)
    : []
  return [topologyLabels[error.rawCode ?? ""] ?? error.message, ...issues, ...fields, ...(error.requestId ? [`Request ID: ${error.requestId}`] : [])].join(" · ")
}
