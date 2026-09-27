import { useCallback, useMemo, useState } from "react"
import { IconAlertTriangle, IconArchive, IconCards, IconFileUpload, IconLayoutList, IconPhoto, IconRefresh, IconSearch } from "@tabler/icons-react"
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom"

import { Button, ClickableCard, EditorSection, FormField, Input, LoadingRows, PageFrame, PageNav, PageState, StatusBadge, Textarea } from "@crm/ui"

import { PageHeading, SegmentedControl } from "@admin/components/cms-ui"
import { cmsRepository } from "@admin/data/cms-repository"
import type { MediaAsset } from "@admin/entities/cms"
import { useAdminAuthSession } from "@admin/features/auth-session-context"
import { useRepository } from "@admin/features/use-repository"

const mediaStatus: Record<MediaAsset["status"], { label: string; tone: "success" | "info" | "danger" | "warning" | "neutral" }> = { ready: { label: "Готово", tone: "success" }, uploading: { label: "Загрузка", tone: "info" }, scanning: { label: "Проверка", tone: "info" }, converting: { label: "Обработка", tone: "warning" }, error: { label: "Ошибка обработки", tone: "danger" }, archived: { label: "Архив", tone: "neutral" } }

export function MediaLibraryPage() {
  const loader = useCallback(() => cmsRepository.getMedia(), []); const state = useRepository(loader); const [params, setParams] = useSearchParams(); const [view, setView] = useState<"grid" | "table">("grid"); const navigate = useNavigate(); const query = params.get("q") ?? ""; const filter = params.get("status") ?? "all"; const uploadOpen = params.get("upload") === "1"
  const { user } = useAdminAuthSession(); const canManageMedia = user.capabilities.canManageMedia === true
  const assets = useMemo(() => (state.data ?? []).filter((item) => (!query || `${item.title} ${item.filename} ${item.alt}`.toLowerCase().includes(query.toLowerCase())) && (filter === "all" || item.status === filter)), [filter, query, state.data])
  const setParam = (key: string, value?: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next, { replace: true }) }
  if (uploadOpen && !canManageMedia) return <PageFrame><PageState icon={IconAlertTriangle} title="Нет прав на загрузку медиа">Требуется capability canManageMedia. Библиотека остаётся доступна для просмотра.</PageState></PageFrame>
  if (state.error) return <PageFrame><PageHeading actions={<Button disabled size="sm" title={!canManageMedia ? "Нет права canManageMedia" : "Не удалось загрузить список файлов"}><IconFileUpload />Загрузить</Button>} description="Не удалось получить список файлов. Повторите загрузку после проверки соединения." title="Медиа" /><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Медиа пока недоступны">{state.error}</PageState></PageFrame>
  return <PageFrame><PageHeading actions={<Button disabled={!canManageMedia} onClick={() => setParam("upload", "1")} size="sm" title={!canManageMedia ? "Нет права canManageMedia" : undefined}><IconFileUpload />Загрузить</Button>} description="Загружайте фотографии для страниц сайта. Публичные версии появляются после проверки и обработки." title="Медиа" />{uploadOpen ? <UploadPanel onClose={() => setParam("upload")} onUploaded={state.reload} /> : null}<div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border bg-background p-2"><div className="relative min-w-[220px] flex-1"><IconSearch className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Поиск медиа" className="pl-8" onChange={(event) => setParam("q", event.target.value || undefined)} placeholder="Название, имя файла или alt" value={query} /></div><SegmentedControl ariaLabel="Статус" onChange={(value) => setParam("status", value === "all" ? undefined : value)} options={[{ value: "all", label: "Все" }, { value: "ready", label: "Готово" }, { value: "converting", label: "Обработка" }, { value: "error", label: "Ошибка" }]} value={filter as "all" | "ready" | "converting" | "error"} /><SegmentedControl ariaLabel="Вид медиа" onChange={setView} options={[{ value: "grid", label: "Сетка", icon: IconCards }, { value: "table", label: "Список", icon: IconLayoutList }]} value={view} /></div>
    {state.loading ? <div className="rounded-xl border bg-background"><LoadingRows count={4} /></div> : assets.length === 0 ? <PageState actionLabel="Сбросить" icon={IconPhoto} onAction={() => setParams(new URLSearchParams())} title="Файлы не найдены" /> : view === "grid" ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{assets.map((asset) => <MediaCard asset={asset} key={asset.id} onOpen={() => navigate(`/media/${asset.id}`)} />)}</div> : <div className="divide-y overflow-hidden rounded-xl border bg-background">{assets.map((asset) => <Link className="flex min-h-16 items-center gap-3 p-3 hover:bg-muted/35" key={asset.id} to={`/media/${asset.id}`}><MediaPreview asset={asset} className="size-11" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{asset.title}</p><p className="truncate text-[10px] text-muted-foreground">{asset.filename} · {asset.dimensions} · {asset.size}</p></div><StatusBadge tone={mediaStatus[asset.status].tone}>{mediaStatus[asset.status].label}</StatusBadge><span className="hidden text-[10px] text-muted-foreground sm:block">{asset.usageCount} usages</span></Link>)}</div>}
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
function MediaPreview({ asset, className }: { asset: MediaAsset; className?: string }) { return <div className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-muted ${className ?? ""}`} style={{ background: `linear-gradient(135deg, ${asset.dominant}, color-mix(in srgb, ${asset.dominant}, white 45%))` }}>{asset.previewUrl ? <img alt={asset.alt} className="size-full object-cover" src={asset.previewUrl} /> : asset.status === "error" ? <IconAlertTriangle className="size-6 text-white" /> : <IconPhoto className="size-6 text-white/80" />}</div> }

export function AssetPage() {
  const { assetId = "asset-hero" } = useParams(); const [params, setParams] = useSearchParams(); const pageId = params.get("pageId") ?? ""; const loader = useCallback(() => cmsRepository.getAsset(assetId, pageId ? { pageId } : undefined), [assetId, pageId]); const state = useRepository(loader); const [mutationError, setMutationError] = useState<string>(); const [replaceOpen, setReplaceOpen] = useState(false); const requestedTab = params.get("tab"); const tab = requestedTab === "variants" || requestedTab === "usage" ? requestedTab : "preview"
  if (state.error) return <PageFrame><PageState actionLabel="Повторить" icon={IconAlertTriangle} onAction={state.reload} title="Ассет пока недоступен">{state.error}</PageState></PageFrame>
  if (state.loading || !state.data) return <PageFrame><LoadingRows /></PageFrame>
  const asset = state.data; const tabs = [{ value: "preview", label: "Описание" }, { value: "variants", label: "Варианты" }, { value: "usage", label: "Где используется" }]
  const archive = async () => { setMutationError(undefined); try { await cmsRepository.archiveMedia(asset.id, asset.version ?? 1); state.reload() } catch (reason) { setMutationError(reason instanceof Error ? reason.message : "Не удалось архивировать asset") } }
  return <PageFrame><PageHeading actions={<><Button disabled={asset.publishedUsage || asset.status === "archived"} onClick={() => void archive()} size="sm" title={asset.publishedUsage ? "Файл используется на сайте: сначала замените или уберите его со страниц" : undefined} variant="outline"><IconArchive />Архивировать</Button><Button disabled={asset.status !== "ready"} onClick={() => setReplaceOpen((value) => !value)} size="sm" title={asset.status !== "ready" ? "Заменить можно только готовый asset" : undefined} variant="outline"><IconRefresh />Заменить</Button></>} description={`${asset.filename} · ${asset.dimensions} · ${asset.size}`} title={asset.title} />{mutationError ? <p className="mb-3 text-xs text-danger">{mutationError}</p> : null}{replaceOpen ? <ReplacementPanel asset={asset} onClose={() => setReplaceOpen(false)} onReplaced={() => { setMutationError(undefined); setReplaceOpen(false); state.reload() }} onError={(message) => setMutationError(message)} /> : null}<div className="mb-3 overflow-hidden rounded-xl border bg-background px-3"><PageNav items={tabs} onValueChange={(next) => { const copy = new URLSearchParams(params); copy.set("tab", next); setParams(copy, { replace: true }) }} value={tab} /></div>{tab === "preview" ? <AssetPreviewEditor asset={asset} onSaved={state.reload} /> : tab === "variants" ? <Variants asset={asset} /> : tab === "usage" ? <Usage asset={asset} pageId={pageId} onPageIdChange={(value) => { const copy = new URLSearchParams(params); if (value) copy.set("pageId", value); else copy.delete("pageId"); setParams(copy, { replace: true }) }} /> : <AssetPreviewEditor asset={asset} onSaved={state.reload} />}</PageFrame>
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

function AssetPreviewEditor({ asset, onSaved }: { asset: MediaAsset; onSaved: () => void }) { const [draft, setDraft] = useState(asset); const [error, setError] = useState<string>(); const save = async () => { setError(undefined); try { await cmsRepository.saveMediaMetadata(draft); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : "Не удалось сохранить metadata") } }; return <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]"><MediaPreview asset={asset} className="min-h-[420px] rounded-xl border" /><EditorSection title="Описание файла"><div className="space-y-4"><FormField htmlFor="asset-title" label="Название"><Input id="asset-title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} value={draft.title} /></FormField><FormField error={!draft.alt ? "Описание обязательно для изображения в контенте" : undefined} htmlFor="asset-alt" label="Alt"><Textarea id="asset-alt" onChange={(event) => setDraft({ ...draft, alt: event.target.value })} value={draft.alt} /></FormField><FormField htmlFor="asset-license" label="Права на использование"><Input id="asset-license" onChange={(event) => setDraft({ ...draft, license: event.target.value })} value={draft.license} /></FormField>{error ? <p className="text-xs text-danger">{error}</p> : null}<Button className="w-full" onClick={() => void save()}>Сохранить</Button></div></EditorSection></div> }
function Variants({ asset }: { asset: MediaAsset }) { const variants = asset.variants ?? []; return <EditorSection title="Подготовленные варианты">{variants.length ? <div className="divide-y rounded-lg border">{variants.map((variant) => <div className="flex min-h-14 items-center gap-3 px-3" key={variant.id}><IconPhoto className="size-4 text-muted-foreground" /><div className="min-w-0 flex-1"><p className="text-xs font-medium">{variant.format.toUpperCase()} · {variant.width}×{variant.height}</p><a className="block truncate text-[10px] text-primary hover:underline" href={variant.url} rel="noreferrer" target="_blank">{variant.url} · {Math.round(variant.byteSize / 1024)} KB</a></div><StatusBadge tone="success">Ready</StatusBadge></div>)}</div> : <PageState icon={IconPhoto} title="Варианты ещё не готовы">{asset.status === "error" ? "Обработка файла завершилась ошибкой." : asset.status === "ready" ? "Сервер не вернул готовые варианты файла." : "Обработка файла ещё выполняется."}</PageState>}</EditorSection> }
function Usage({ asset, pageId, onPageIdChange }: { asset: MediaAsset; pageId: string; onPageIdChange: (value: string) => void }) { const usages = asset.usages ?? []; return <EditorSection subtitle="Серверный фильтр по ID страницы или revision; точные JSON pointers остаются видимыми." title={`Used on · ${pageId ? `${usages.length} найдено` : asset.usageCount}`}><div className="mb-3 flex flex-wrap items-end gap-2"><FormField className="min-w-[240px] flex-1" htmlFor="media-usage-page" label="Страница / revision"><Input id="media-usage-page" onChange={(event) => onPageIdChange(event.target.value)} placeholder="UUID страницы или revision" value={pageId} /></FormField>{pageId ? <Button onClick={() => onPageIdChange("")} size="sm" variant="ghost">Сбросить</Button> : null}</div>{usages.length ? <div className="divide-y rounded-lg border">{usages.map((usage) => <div className="flex min-h-12 items-center gap-3 px-3 text-xs" key={`${usage.ownerType}:${usage.ownerId}:${usage.pointer}`}><span className="min-w-0 flex-1 truncate">{usage.path ? `${usage.path} · ` : ""}{usage.ownerType} · {usage.ownerId.slice(0, 8)} · {usage.pointer}</span><StatusBadge tone={usage.published ? "success" : "neutral"}>{usage.published ? "Published" : "Draft"}</StatusBadge></div>)}</div> : <PageState icon={IconPhoto} title={pageId ? "На этой странице asset не используется" : "Asset пока не используется"}>Usage graph не нашёл ссылок в выбранном scope.</PageState>}</EditorSection> }
