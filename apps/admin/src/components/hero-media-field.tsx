import { useEffect, useState } from "react"
import { IconPhoto } from "@tabler/icons-react"

import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input } from "@crm/ui"
import { cmsRepository } from "@admin/data/cms-repository"
import type { MediaAsset } from "@admin/entities/cms"
import { readyImageUrl, useHeroImage } from "./hero-media"

export function HeroMediaField({ assetId, editable, label, onChange }: { assetId: string; editable: boolean; label: string; onChange: (assetId: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const selected = useHeroImage(assetId)
  const openPicker = () => { setQuery(""); setAssets([]); setError(undefined); setLoading(true); setOpen(true) }

  useEffect(() => {
    if (!open) return
    let active = true
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError(undefined)
      void cmsRepository.getMedia({ ...(query.trim() ? { q: query.trim() } : {}), state: "ready" }).then((items) => {
        if (active) setAssets(items.filter((item) => readyImageUrl(item)))
      }).catch(() => { if (active) { setAssets([]); setError("Не удалось загрузить изображения. Повторите поиск.") } }).finally(() => { if (active) setLoading(false) })
    }, query ? 250 : 0)
    return () => { active = false; window.clearTimeout(timer) }
  }, [open, query])

  return <div className="space-y-2">
    <p className="text-xs font-medium">{label}</p>
    {assetId ? <div className="flex min-w-0 items-center gap-3 rounded-md border p-2">
      {readyImageUrl(selected) ? <img alt="" className="size-14 shrink-0 rounded object-cover" src={readyImageUrl(selected)} /> : <IconPhoto className="size-8 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 truncate text-xs">{selected?.title ?? "Изображение загружается или недоступно"}</span>
    </div> : <p className="text-xs text-muted-foreground">Не выбрано</p>}
    {editable ? <div className="flex flex-wrap gap-2"><Button onClick={openPicker} size="sm" type="button" variant="outline">Выбрать: {label.toLocaleLowerCase("ru-RU")}</Button>{assetId ? <Button onClick={() => onChange("")} size="sm" type="button" variant="ghost">Убрать: {label.toLocaleLowerCase("ru-RU")}</Button> : null}</div> : null}
    <Dialog onOpenChange={setOpen} open={open}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader><DialogTitle>Выбрать: {label.toLocaleLowerCase("ru-RU")}</DialogTitle><DialogDescription>Доступны готовые изображения с публичными WebP/AVIF версиями. Выбор сохраняется вместе со страницей.</DialogDescription></DialogHeader>
      <Input aria-label="Поиск изображения" onChange={(event) => { setQuery(event.target.value); setAssets([]); setError(undefined); setLoading(true) }} placeholder="Поиск по названию или файлу" value={query} />
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {loading ? <p className="text-xs text-muted-foreground">Загружаем изображения…</p> : assets.length ? <div className="grid gap-2 sm:grid-cols-2">{assets.map((asset) => <button className="flex min-w-0 items-center gap-3 rounded-md border p-2 text-left hover:border-primary focus-visible:outline-2 focus-visible:outline-primary" key={asset.id} onClick={() => { onChange(asset.id); setOpen(false) }} type="button"><img alt="" className="size-16 shrink-0 rounded object-cover" src={readyImageUrl(asset)} /><span className="min-w-0"><strong className="block truncate text-xs">{asset.title}</strong><span className="block truncate text-[11px] text-muted-foreground">{asset.dimensions} · {asset.alt || "без alt"}</span></span></button>)}</div> : !error ? <p className="text-xs text-muted-foreground">Готовых изображений не найдено. Сначала сохраните черновик страницы, затем загрузите файл в разделе «Медиа».</p> : null}
      {assets.length >= 100 ? <p className="text-xs text-muted-foreground">Показаны первые 100 файлов. Уточните поиск, чтобы найти остальные.</p> : null}
    </DialogContent></Dialog>
  </div>
}
