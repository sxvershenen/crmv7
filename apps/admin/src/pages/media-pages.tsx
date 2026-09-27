import { useCallback, useEffect, useRef, useState } from "react"
import { IconAlertTriangle, IconArchive, IconCards, IconFileUpload, IconLayoutList, IconPhoto, IconRefresh, IconSearch } from "@tabler/icons-react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"

import { Button, ClickableCard, EditorSection, FormField, Input, LoadingRows, PageFrame, PageNav, PageState, StatusBadge, Textarea } from "@crm/ui"

import { PageHeading, SegmentedControl } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import type { MediaAsset } from "@admin/entities/cms"
import { useAdminAuthSession } from "@admin/features/auth-session-context"
import { useRepository } from "@admin/features/use-repository"
import { UnsavedChangesGuard } from "@admin/features/unsaved-changes-guard"
import { AdminApiError } from "@admin/lib/api-client"

const mediaStatus: Record<MediaAsset["status"], { label: string; tone: "success" | "info" | "danger" | "warning" | "neutral" }> = { ready: { label: "Готово", tone: "success" }, uploading: { label: "Загрузка", tone: "info" }, scanning: { label: "Проверка", tone: "info" }, converting: { label: "Обработка", tone: "warning" }, error: { label: "Ошибка обработки", tone: "danger" }, archived: { label: "Архив", tone: "neutral" } }

export function MediaLibraryPage() {
  const [params, setParams] = useSearchParams(); const [view, setView] = useState<"grid" | "table">("grid"); const navigate = useNavigate(); const query = params.get("q") ?? ""; const filter = params.get("status") ?? "all"; const uploadOpen = params.get("upload") === "1"
  const serverState = filter === "ready" ? "ready" : filter === "converting" ? "processing" : filter === "error" ? "failed" : undefined
  const loader = useCallback(() => cmsRepository.getMedia({ ...(query.trim() ? { q: query.trim() } : {}), ...(serverState ? { state: serverState } : {}), limit: 30 }), [query, serverState])
  const state = useRepository(loader)
  const [older, setOlder] = useState<MediaAsset[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>()
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string>()
  const requestKey = `${query}\u0000${filter}`
  const activeRequestKey = useRef(requestKey)
  activeRequestKey.current = requestKey
  useEffect(() => { setOlder([]); setNextCursor(undefined); setLoadingMore(false); setMoreError(undefined) }, [query, filter])
  const { user } = useAdminAuthSession(); const canManageMedia = user.capabilities.canManageMedia === true
  const assets = [...(state.data?.items ?? []), ...older]
  const cursor = nextCursor === undefined ? state.data?.nextCursor : nextCursor
  const loadMore = async () => {
    if (!cursor || loadingMore) return
    const startedFor = requestKey
    setLoadingMore(true); setMoreError(undefined)
    try {
      const page = await cmsRepository.getMedia({ ...(query.trim() ? { q: query.trim() } : {}), ...(serverState ? { state: serverState } : {}), cursor, limit: 30 })
      if (activeRequestKey.current === startedFor) { setOlder((current) => [...current, ...page.items]); setNextCursor(page.nextCursor) }
    } catch (error) { if (activeRequestKey.current === startedFor) setMoreError(error instanceof Error ? error.message : "Не удалось загрузить файлы") }
    finally { if (activeRequestKey.current === startedFor) setLoadingMore(false) }
  }
  const setParam = (key: string, value?: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }) }
  if (uploadOpen && !canManageMedia) return <PageFrame><PageState icon={IconAlertTriangle} title="Нет прав на загрузку медиа">Требуется capability canManageMedia. Библиотека остаётся доступна для просмотра.</PageState></PageFrame>
  if (state.error) return <PageFrame><PageHeading actions={<Button disabled size="sm" title={!canManageMedia ? "Нет права canManageMedia" : "Не удалось загрузить список файлов"}><IconFileUpload />Загрузить</Button>} description="Не удалось получить список файлов. Повторите загрузку после проверки соединения." title="Медиа" /><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Медиа пока недоступны">{state.error}</PageState></PageFrame>
  return <PageFrame><PageHeading actions={<Button disabled={!canManageMedia} onClick={() => setParam("upload", "1")} size="sm" title={!canManageMedia ? "Нет права canManageMedia" : undefined}><IconFileUpload />Загрузить</Button>} description="Загружайте фотографии для страниц сайта. Публичные версии появляются после проверки и обработки." title="Медиа" />{uploadOpen ? <UploadPanel onClose={() => setParam("upload")} onUploaded={() => { setOlder([]); setNextCursor(undefined); state.reload() }} /> : null}<div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-background p-2"><div className="relative min-w-[220px] flex-1"><IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Поиск медиа" className="pl-8" maxLength={200} onChange={(event) => setParam("q", event.target.value || undefined)} placeholder="Название, имя файла или alt" value={query} /></div><SegmentedControl ariaLabel="Статус" onChange={(value) => setParam("status", value === "all" ? undefined : value)} options={[{ value: "all", label: "Все" }, { value: "ready", label: "Готово" }, { value: "converting", label: "Обработка" }, { value: "error", label: "Ошибка" }]} value={filter as "all" | "ready" | "converting" | "error"} /><SegmentedControl ariaLabel="Вид медиа" onChange={setView} options={[{ value: "grid", label: "Сетка", icon: IconCards }, { value: "table", label: "Список", icon: IconLayoutList }]} value={view} /></div>
    {state.loading ? <div className="rounded-xl border bg-background"><LoadingRows count={4} /></div> : assets.length === 0 ? <PageState actionLabel="Сбросить" icon={IconPhoto} onAction={() => setParams(new URLSearchParams())} title="Файлы не найдены" /> : <>{view === "grid" ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{assets.map((asset) => <MediaCard asset={asset} key={asset.id} onOpen={() => navigate(`/media/${asset.id}`)} />)}</div> : <div className="divide-y overflow-hidden rounded-xl border bg-background">{assets.map((asset) => <Link className="flex min-h-16 items-center gap-3 p-3 hover:bg-muted/35" key={asset.id} to={`/media/${asset.id}`}><MediaPreview asset={asset} className="size-11" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{asset.title}</p><p className="truncate text-[10px] text-muted-foreground">{asset.filename} · {asset.dimensions} · {asset.size}</p></div><StatusBadge tone={mediaStatus[asset.status].tone}>{mediaStatus[asset.status].label}</StatusBadge><span className="hidden text-[10px] text-muted-foreground sm:block">{asset.usageCount} usages</span></Link>)}</div>}{cursor ? <Button className="mt-4" disabled={loadingMore} onClick={() => void loadMore()} variant="outline">{loadingMore ? "Загружаем…" : "Показать ещё"}</Button> : null}{moreError ? <p className="mt-2 text-xs text-danger" role="alert">{moreError}</p> : null}</>}
  </PageFrame>
}

function UploadPanel({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const [file, setFile] = useState<File>()
  const [status, setStatus] = useState("Выберите JPEG, PNG, WebP или AVIF")
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const upload = async (next: File) => {
    setFile(next)
    setError(undefined)
    setBusy(true)
    setStatus("Загружаем файл")
    try {
      const uploaded = await cmsRepository.uploadMedia(next)
      setStatus(uploaded.status === "ready" ? "Файл готов" : uploaded.status === "error" ? "Обработка файла завершилась ошибкой" : "Файл загружен. Обработка продолжается.")
      onUploaded()
    } catch (reason) {
      setStatus("Не удалось загрузить файл")
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить файл")
    } finally {
      setBusy(false)
    }
  }
  return <EditorSection actions={<Button onClick={onClose} size="xs" variant="ghost">Закрыть</Button>} className="mb-3" subtitle="Исходный файл хранится приватно; публичная версия появляется после проверки." title="Загрузка файла"><label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-xs hover:bg-muted/30"><IconFileUpload className="size-5" /><span>{file?.name ?? "Выбрать файл"}</span><Input accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={busy} onChange={(event) => { const next = event.target.files?.[0]; if (next) void upload(next) }} type="file" /></label>{file ? <p className="mt-3 text-xs" role="status">{status}</p> : null}{error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}</EditorSection>
}

function MediaCard({ asset, onOpen }: { asset: MediaAsset; onOpen: () => void }) { return <ClickableCard className="overflow-hidden" onClick={onOpen}><MediaPreview asset={asset} className="aspect-[4/3] w-full rounded-none" /><div className="p-3"><div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{asset.title}</p><p className="truncate text-[10px] text-muted-foreground">{asset.filename}</p></div><StatusBadge tone={mediaStatus[asset.status].tone}>{mediaStatus[asset.status].label}</StatusBadge></div><div className="mt-3 flex justify-between text-[10px] text-muted-foreground"><span>{asset.dimensions}</span><span>{asset.usageCount} usages</span></div></div></ClickableCard> }
function MediaPreview({ asset, className }: { asset: MediaAsset; className?: string }) { return <div className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-muted ${className ?? ""}`} style={{ background: `linear-gradient(135deg, ${asset.dominant}, color-mix(in srgb, ${asset.dominant}, white 45%))` }}>{asset.previewUrl ? <img alt={asset.alt} className="size-full object-cover" src={asset.previewUrl} style={{ objectPosition: `${(asset.focalPoint?.x ?? 0.5) * 100}% ${(asset.focalPoint?.y ?? 0.5) * 100}%` }} /> : asset.status === "error" ? <IconAlertTriangle className="size-6 text-white" /> : <IconPhoto className="size-6 text-white/80" />}</div> }

export function AssetPage() {
  const { assetId = "asset-hero" } = useParams(); const [params, setParams] = useSearchParams(); const pageId = params.get("pageId") ?? ""; const path = params.get("path") ?? ""; const loader = useCallback(() => cmsRepository.getAsset(assetId, pageId || path ? { ...(pageId ? { pageId } : {}), ...(path ? { path } : {}) } : undefined), [assetId, pageId, path]); const state = useRepository(loader); const [mutationError, setMutationError] = useState<string>(); const [replaceOpen, setReplaceOpen] = useState(false); const requestedTab = params.get("tab"); const tab = requestedTab === "variants" || requestedTab === "usage" ? requestedTab : "preview"
  const { user } = useAdminAuthSession(); const canManageMedia = user.capabilities.canManageMedia === true
  if (state.error) return <PageFrame><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Ассет пока недоступен">{state.error}</PageState></PageFrame>
  if (state.loading || !state.data) return <PageFrame><LoadingRows /></PageFrame>
  const asset = state.data; const tabs = [{ value: "preview", label: "Описание" }, { value: "variants", label: "Варианты" }, { value: "usage", label: "Где используется" }]
  const archive = async () => { if (!canManageMedia || !window.confirm(`Архивировать «${asset.title}»? Существующие версии и история использования сохранятся.`)) return; setMutationError(undefined); try { await cmsRepository.archiveMedia(asset.id, asset.version ?? 1); state.reload() } catch (reason) { setMutationError(reason instanceof Error ? reason.message : "Не удалось архивировать файл") } }
  return <PageFrame><PageHeading actions={<><Button disabled={!canManageMedia || asset.publishedUsage || asset.status === "archived"} onClick={() => void archive()} size="sm" title={!canManageMedia ? "Нет права управлять медиа" : asset.publishedUsage ? "Файл связан с опубликованным контентом: сначала уберите использование" : undefined} variant="outline"><IconArchive />Архивировать</Button><Button disabled={!canManageMedia || asset.status !== "ready"} onClick={() => setReplaceOpen((value) => !value)} size="sm" title={!canManageMedia ? "Нет права управлять медиа" : asset.status !== "ready" ? "Заменить можно только готовый файл" : undefined} variant="outline"><IconRefresh />Заменить</Button></>} description={`${asset.filename} · ${asset.dimensions} · ${asset.size}`} title={asset.title} />{mutationError ? <p className="mb-3 text-xs text-danger">{mutationError}</p> : null}{asset.publishedUsage ? <p className="mb-3 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs">Архивирование недоступно: файл связан с опубликованным контентом. Откройте «Где используется», чтобы найти источник.</p> : null}{replaceOpen && canManageMedia ? <ReplacementPanel asset={asset} onClose={() => setReplaceOpen(false)} onReplaced={() => { setMutationError(undefined); setReplaceOpen(false); state.reload() }} onError={(message) => setMutationError(message)} /> : null}<div className="mb-3 overflow-hidden rounded-xl border bg-background px-3"><PageNav items={tabs} onValueChange={(next) => { const copy = new URLSearchParams(params); copy.set("tab", next); setParams(copy, { replace: true }) }} value={tab} /></div>{tab === "preview" ? <AssetPreviewEditor asset={asset} canManageMedia={canManageMedia} key={`${asset.id}:${asset.version}`} onSaved={state.reload} /> : tab === "variants" ? <Variants asset={asset} /> : tab === "usage" ? <Usage asset={asset} pageId={pageId} path={path} onClearPageId={() => { const copy = new URLSearchParams(params); copy.delete("pageId"); setParams(copy, { replace: true }) }} onPathChange={(value) => { const copy = new URLSearchParams(params); if (value) copy.set("path", value); else copy.delete("path"); setParams(copy, { replace: true }) }} /> : null}</PageFrame>
}
function ReplacementPanel({ asset, onClose, onReplaced, onError }: { asset: MediaAsset; onClose: () => void; onReplaced: () => void; onError: (message: string) => void }) {
  const [file, setFile] = useState<File>()
  const [status, setStatus] = useState("Выберите новый файл")
  const [busy, setBusy] = useState(false)
  const replace = async (next: File) => {
    setFile(next)
    setBusy(true)
    setStatus("Загружаем замену")
    try {
      await cmsRepository.replaceMedia(asset.id, next, asset.version ?? 1)
      onReplaced()
    } catch (reason) {
      setStatus("Не удалось заменить файл")
      onError(reason instanceof Error ? reason.message : "Не удалось заменить файл")
    } finally {
      setBusy(false)
    }
  }
  return <EditorSection actions={<Button onClick={onClose} size="xs" variant="ghost">Закрыть</Button>} className="mb-3" subtitle="Замену и её статус подтверждает сервер; опубликованные ссылки не меняются автоматически." title="Заменить исходный файл"><label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-xs hover:bg-muted/30"><IconRefresh className="size-5" /><span>{file?.name ?? "Выбрать новый JPEG, PNG, WebP или AVIF"}</span><Input accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={busy} onChange={(event) => { const next = event.target.files?.[0]; if (next) void replace(next) }} type="file" /></label>{file ? <p className="mt-3 text-xs" role="status">{status}</p> : null}</EditorSection>
}

function AssetPreviewEditor({ asset, canManageMedia, onSaved }: { asset: MediaAsset; canManageMedia: boolean; onSaved: () => void }) {
  const [draft, setDraft] = useState(asset)
  const [tagsText, setTagsText] = useState((asset.tags ?? []).join(", "))
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const tags = tagsText.split(",").map((tag) => tag.trim()).filter(Boolean)
  const dirty = draft.title !== asset.title || draft.alt !== asset.alt || (draft.caption ?? "") !== (asset.caption ?? "") || (draft.credit ?? "") !== (asset.credit ?? "") || draft.license !== asset.license || tagsText !== (asset.tags ?? []).join(", ") || draft.focalPoint?.x !== asset.focalPoint?.x || draft.focalPoint?.y !== asset.focalPoint?.y
  const change = (patch: Partial<MediaAsset>) => { setDraft((current) => ({ ...current, ...patch })); setSaved(false); setError(undefined) }
  const changeFocal = (axis: "x" | "y", percent: number) => change({ focalPoint: { x: draft.focalPoint?.x ?? 0.5, y: draft.focalPoint?.y ?? 0.5, [axis]: Math.max(0, Math.min(100, percent)) / 100 } })
  const save = async () => {
    if (!canManageMedia || busy || !dirty) return
    if (!draft.title.trim()) { setError("Укажите название файла."); return }
    if (tags.length > 50 || tags.some((tag) => tag.length > 80)) { setError("Укажите не более 50 меток длиной до 80 символов каждая."); return }
    setError(undefined); setBusy(true)
    try {
      await cmsRepository.saveMediaMetadata({ ...draft, title: draft.title.trim(), tags })
      setSaved(true)
      onSaved()
    } catch (reason) {
      setError(reason instanceof AdminApiError && reason.isConflict ? "Файл изменён в другой сессии. Обновите страницу перед повторным сохранением." : reason instanceof Error ? reason.message : "Не удалось сохранить описание файла")
    } finally { setBusy(false) }
  }
  return <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
    <UnsavedChangesGuard includeSearch when={dirty && !saved} />
    <MediaPreview asset={draft} className="min-h-[320px] rounded-xl border lg:min-h-[420px]" />
    <EditorSection title="Описание файла"><div className="space-y-4">
      {!canManageMedia ? <p className="text-xs text-muted-foreground">Для изменения описания нужно право управления медиа.</p> : null}
      <FormField htmlFor="asset-title" label="Название"><Input id="asset-title" maxLength={240} onChange={(event) => change({ title: event.target.value })} readOnly={!canManageMedia} value={draft.title} /></FormField>
      <FormField htmlFor="asset-alt" label="Alt-текст"><Textarea id="asset-alt" maxLength={500} onChange={(event) => change({ alt: event.target.value })} placeholder="Опишите важное на изображении; для декоративного оставьте пустым" readOnly={!canManageMedia} value={draft.alt} /></FormField>
      <FormField htmlFor="asset-caption" label="Подпись"><Textarea id="asset-caption" maxLength={1000} onChange={(event) => change({ caption: event.target.value })} readOnly={!canManageMedia} value={draft.caption ?? ""} /></FormField>
      <FormField htmlFor="asset-credit" label="Автор / источник"><Input id="asset-credit" maxLength={500} onChange={(event) => change({ credit: event.target.value })} readOnly={!canManageMedia} value={draft.credit ?? ""} /></FormField>
      <FormField htmlFor="asset-license" label="Права на использование"><Input id="asset-license" maxLength={500} onChange={(event) => change({ license: event.target.value })} readOnly={!canManageMedia} value={draft.license} /></FormField>
      <FormField htmlFor="asset-tags" label="Метки через запятую"><Input id="asset-tags" onChange={(event) => { setTagsText(event.target.value); setSaved(false); setError(undefined) }} readOnly={!canManageMedia} value={tagsText} /></FormField>
      <div className="grid gap-3 sm:grid-cols-2"><FormField htmlFor="asset-focal-x" label="Фокус по горизонтали, %"><Input id="asset-focal-x" max={100} min={0} onChange={(event) => changeFocal("x", Number(event.target.value))} readOnly={!canManageMedia} type="number" value={Math.round((draft.focalPoint?.x ?? 0.5) * 100)} /></FormField><FormField htmlFor="asset-focal-y" label="Фокус по вертикали, %"><Input id="asset-focal-y" max={100} min={0} onChange={(event) => changeFocal("y", Number(event.target.value))} readOnly={!canManageMedia} type="number" value={Math.round((draft.focalPoint?.y ?? 0.5) * 100)} /></FormField></div>
      {error ? <p className="text-xs text-danger" role="alert">{error}</p> : null}{saved ? <p className="text-xs text-success" role="status">Описание сохранено</p> : null}
      <Button className="w-full" disabled={!canManageMedia || !dirty || busy} onClick={() => void save()}>{busy ? "Сохраняем…" : "Сохранить описание"}</Button>
    </div></EditorSection>
  </div>
}
function Variants({ asset }: { asset: MediaAsset }) { const variants = asset.variants ?? []; return <EditorSection title="Подготовленные варианты">{variants.length ? <div className="divide-y rounded-lg border">{variants.map((variant) => <div className="flex min-h-14 items-center gap-3 px-3" key={variant.id}><IconPhoto className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-xs font-medium">{variant.format.toUpperCase()} · {variant.width}×{variant.height}</p><a className="block truncate text-[10px] text-primary hover:underline" href={variant.url} rel="noreferrer" target="_blank">{variant.url} · {Math.round(variant.byteSize / 1024)} KB</a></div><StatusBadge tone="success">Ready</StatusBadge></div>)}</div> : <PageState icon={IconPhoto} title="Варианты ещё не готовы">{asset.status === "error" ? "Обработка файла завершилась ошибкой." : asset.status === "ready" ? "Сервер не вернул готовые варианты файла." : "Обработка файла ещё выполняется."}</PageState>}</EditorSection> }
function Usage({ asset, pageId, path, onClearPageId, onPathChange }: { asset: MediaAsset; pageId: string; path: string; onClearPageId: () => void; onPathChange: (value: string) => void }) {
  const [pathInput, setPathInput] = useState(path)
  const [pathError, setPathError] = useState<string>()
  useEffect(() => setPathInput(path), [path])
  const usages = asset.usages ?? []
  const total = asset.usageTotal ?? usages.length
  const search = () => {
    const normalized = pathInput.trim()
    if (normalized && !/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/.test(normalized)) { setPathError("Укажите адрес страницы вида /domiki/lesnoy"); return }
    setPathError(undefined)
    onPathChange(normalized)
  }
  return <EditorSection subtitle="Показаны ссылки на файл в редакциях CMS и публикациях. Статус относится к источнику ссылки." title={`Где используется · ${total}`}>
    <form className="mb-3 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); search() }}><FormField className="min-w-[220px] flex-1" htmlFor="media-usage-path" label="Адрес страницы"><Input id="media-usage-path" maxLength={2048} onChange={(event) => { setPathInput(event.target.value); setPathError(undefined) }} placeholder="/domiki/lesnoy" value={pathInput} /></FormField><Button size="sm" type="submit" variant="outline">Найти</Button>{path ? <Button onClick={() => onPathChange("")} size="sm" type="button" variant="ghost">Сбросить</Button> : null}</form>
    {pathError ? <p className="mb-3 text-xs text-danger" role="alert">{pathError}</p> : null}
    {pageId ? <p className="mb-3 text-xs text-muted-foreground">Открыт фильтр по странице. <Button onClick={onClearPageId} size="xs" variant="link">Сбросить</Button></p> : null}
    {asset.usagesTruncated ? <p className="mb-3 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-xs">Показаны первые {usages.length} из {total} ссылок. Укажите адрес страницы, чтобы сузить список.</p> : null}
    {usages.length ? <div className="divide-y rounded-lg border">{usages.map((usage) => <div className="flex flex-wrap items-center gap-3 px-3 py-3 text-xs" key={`${usage.ownerType}:${usage.ownerId}:${usage.pageId ?? ""}:${usage.pointer}`}><div className="min-w-0 w-full sm:w-auto sm:flex-1"><p className="break-all font-medium">{usage.path ?? (usage.ownerType === "cms_site_settings_revision" ? "Общие настройки сайта" : "Без адреса страницы")}</p><p className="mt-0.5 text-muted-foreground">{usageLabel(usage.ownerType)}</p><details className="mt-1 text-muted-foreground"><summary className="cursor-pointer">Технические детали</summary><p className="break-all">{usage.ownerId} · {usage.pointer}</p></details></div><StatusBadge tone={usage.published ? "success" : "neutral"}>{usage.published ? "Опубликованная ссылка" : "Черновик"}</StatusBadge>{usage.pageId ? <Link className="text-primary hover:underline" to={`/content/tree?selected=${encodeURIComponent(usage.pageId)}`}>Открыть страницу</Link> : null}{usage.ownerType === "release" ? <Link className="text-primary hover:underline" to={`/releases/${usage.ownerId}`}>Открыть публикацию</Link> : null}</div>)}</div> : <PageState icon={IconPhoto} title={asset.usagesTruncated && !path && !pageId ? "Места использования не загружены" : pageId || path ? "На выбранной странице файл не найден" : "Ссылки на файл не найдены"}>{asset.usagesTruncated && !path && !pageId ? "Уточните адрес страницы или повторите загрузку файла." : asset.usageCount > 0 && !path && !pageId ? "Сервер сообщил об использовании, но не вернул места размещения. Повторите загрузку." : "В выбранной области ссылок на файл нет."}</PageState>}
  </EditorSection>
}

function usageLabel(ownerType: string) { return ownerType === "cms_revision" ? "Редакция страницы" : ownerType === "cms_site_settings_revision" ? "Редакция общих настроек" : ownerType === "release" ? "Публикация" : ownerType === "cms_block_revision" ? "Общий блок" : "Файл сайта" }
