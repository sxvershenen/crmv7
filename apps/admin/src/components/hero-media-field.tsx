import { useEffect, useId, useRef, useState } from "react"
import { IconPhoto } from "@tabler/icons-react"

import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input } from "@crm/ui"
import { cmsRepository } from "@admin/data/cms-repository"
import type { MediaAsset } from "@admin/entities/cms"
import { readyImageUrl, useHeroImage } from "./hero-media"

export function HeroMediaField({ assetId, canUpload, editable, label, onChange }: { assetId: string; canUpload: boolean; editable: boolean; label: string; onChange: (assetId: string) => void }) {
  const allowUpload = editable && canUpload
  const uploadId = useId()
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)
  const pickerGeneration = useRef(0)
  const searchGeneration = useRef(0)
  const [query, setQuery] = useState("")
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()
  const [uploading, setUploading] = useState(false)
  const [uploadedId, setUploadedId] = useState<string>()
  const [uploadStatus, setUploadStatus] = useState<string>()
  const [uploadError, setUploadError] = useState<string>()
  const selected = useHeroImage(assetId)
  const changeOpen = (next: boolean) => { if (openRef.current !== next) pickerGeneration.current += 1; openRef.current = next; setOpen(next) }
  const openPicker = () => { setQuery(""); setAssets([]); setNextCursor(null); setLoadingMore(false); setError(undefined); setUploading(false); setUploadStatus(undefined); setUploadError(undefined); setUploadedId(undefined); setLoading(true); changeOpen(true) }
  const acceptUploaded = (asset: MediaAsset, generation: number) => {
    if (!openRef.current || generation !== pickerGeneration.current) return
    if (readyImageUrl(asset)) { onChange(asset.id); changeOpen(false); return }
    setUploadedId(asset.id)
    setUploadStatus(asset.status === "error" ? "Обработка файла завершилась ошибкой. Проверьте его в медиатеке." : "Файл загружен и обрабатывается. Проверьте готовность, не закрывая страницу.")
  }
  const upload = async (file: File) => {
    const generation = pickerGeneration.current
    setUploading(true); setUploadError(undefined); setUploadStatus("Загружаем файл…"); setUploadedId(undefined)
    try { acceptUploaded(await cmsRepository.uploadMedia(file), generation) }
    catch (reason) { if (generation === pickerGeneration.current) { setUploadStatus(undefined); setUploadError(reason instanceof Error ? reason.message : "Не удалось загрузить файл") } }
    finally { if (generation === pickerGeneration.current) setUploading(false) }
  }
  const checkUploaded = async () => {
    if (!uploadedId) return
    const generation = pickerGeneration.current
    setUploading(true); setUploadError(undefined)
    try { acceptUploaded(await cmsRepository.getAsset(uploadedId), generation) }
    catch (reason) { if (generation === pickerGeneration.current) setUploadError(reason instanceof Error ? reason.message : "Не удалось проверить файл") }
    finally { if (generation === pickerGeneration.current) setUploading(false) }
  }

  useEffect(() => {
    if (!open) return
    const request = ++searchGeneration.current
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(undefined)
      void cmsRepository.getMedia({ ...(query.trim() ? { q: query.trim() } : {}), state: "ready", limit: 30 }).then((page) => {
        if (active && request === searchGeneration.current) { setAssets(page.items.filter((item) => readyImageUrl(item))); setNextCursor(page.nextCursor) }
      }).catch(() => { if (active) { setAssets([]); setError("Не удалось загрузить изображения. Повторите поиск.") } }).finally(() => { if (active) setLoading(false) })
    }, query ? 250 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [open, query])
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    const request = searchGeneration.current
    setLoadingMore(true); setError(undefined)
    try {
      const page = await cmsRepository.getMedia({ ...(query.trim() ? { q: query.trim() } : {}), state: "ready", cursor: nextCursor, limit: 30 })
      if (openRef.current && request === searchGeneration.current) { setAssets((current) => [...current, ...page.items.filter((item) => readyImageUrl(item))]); setNextCursor(page.nextCursor) }
    } catch { if (request === searchGeneration.current) setError("Не удалось загрузить изображения. Повторите попытку.") }
    finally { if (request === searchGeneration.current) setLoadingMore(false) }
  }

  return <div className="space-y-2">
    <p className="text-xs font-medium">{label}</p>
    {assetId ? <div className="flex min-w-0 items-center gap-3 rounded-md border p-2">
      {readyImageUrl(selected) ? <img alt="" className="size-14 shrink-0 rounded object-cover" src={readyImageUrl(selected)} /> : <IconPhoto className="size-8 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 truncate text-xs">{selected?.title ?? "Изображение загружается или недоступно"}</span>
    </div> : <p className="text-xs text-muted-foreground">Не выбрано</p>}
    {editable ? <div className="flex flex-wrap gap-2"><Button onClick={openPicker} size="sm" type="button" variant="outline">Выбрать: {label.toLocaleLowerCase("ru-RU")}</Button>{assetId ? <Button onClick={() => onChange("")} size="sm" type="button" variant="ghost">Убрать: {label.toLocaleLowerCase("ru-RU")}</Button> : null}</div> : null}
    <Dialog onOpenChange={changeOpen} open={open}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Выбрать: {label.toLocaleLowerCase("ru-RU")}</DialogTitle><DialogDescription>Доступны готовые изображения с публичными WebP/AVIF версиями. Выбор сохраняется вместе со страницей.</DialogDescription></DialogHeader>
      {allowUpload ? <div className="space-y-2 rounded-md border p-3"><label className="block text-xs font-medium" htmlFor={uploadId}>Загрузить новое изображение</label><Input accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} id={uploadId} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file) }} type="file" />{uploadStatus ? <p className="text-xs" role="status">{uploadStatus}</p> : null}{uploadError ? <p className="text-xs text-danger" role="alert">{uploadError}</p> : null}{uploadedId && !uploadStatus?.startsWith("Обработка файла завершилась") ? <Button disabled={uploading} onClick={() => void checkUploaded()} size="sm" type="button" variant="outline">Проверить готовность</Button> : null}</div> : null}
      <Input aria-label="Поиск изображения" maxLength={200} onChange={(event) => { searchGeneration.current += 1; setQuery(event.target.value); setAssets([]); setNextCursor(null); setLoadingMore(false); setError(undefined); setLoading(true) }} placeholder="Поиск по названию или файлу" value={query} />
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {loading ? <p className="text-xs text-muted-foreground">Загружаем изображения…</p> : assets.length ? <div className="grid gap-2 sm:grid-cols-2">{assets.map((asset) => <button className="flex min-w-0 items-center gap-3 rounded-md border p-2 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary" key={asset.id} onClick={() => { onChange(asset.id); changeOpen(false) }} type="button"><img alt="" className="size-16 shrink-0 rounded object-cover" src={readyImageUrl(asset)} /><span className="min-w-0"><strong className="block truncate text-xs">{asset.title}</strong><span className="block truncate text-[11px] text-muted-foreground">{asset.dimensions} · {asset.alt || "без alt"}</span></span></button>)}</div> : !error ? <p className="text-xs text-muted-foreground">Готовых изображений не найдено.{allowUpload ? " Загрузите файл выше." : " Сохраните черновик страницы, затем загрузите файл в медиатеке."}</p> : null}
      {nextCursor ? <Button disabled={loading || loadingMore} onClick={() => void loadMore()} size="sm" type="button" variant="outline">{loadingMore ? "Загружаем…" : "Показать ещё"}</Button> : null}
    </DialogContent></Dialog>
  </div>
}
