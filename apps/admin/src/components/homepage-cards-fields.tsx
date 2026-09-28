import type { CmsHomeSectionDraft } from "@crm/contracts"
import { Button, FormField, Input, Textarea } from "@crm/ui"

import { HomeOfferingsField } from "./home-offerings-field"
import { HeroMediaField } from "./hero-media-field"
import { readyImageUrl } from "./hero-media"

type Card = NonNullable<CmsHomeSectionDraft["cards"]>[number]

export function HomepageCardsFields({ id, sectionKey, value, editable, canUploadMedia, onChange }: {
  id: string
  sectionKey: string
  value: CmsHomeSectionDraft
  editable: boolean
  canUploadMedia: boolean
  onChange: (value: CmsHomeSectionDraft) => void
}) {
  const cards = value.cards ?? []
  const label = sectionKey === "programs" ? "Направления программ" : sectionKey === "sauna-chan" ? "Баня и чан" : "Видео к отзывам"
  const update = (index: number, patch: Partial<Card>) => onChange({ ...value, cards: cards.map((card, position) => position === index ? { ...card, ...patch } : card) })
  const move = (index: number, offset: number) => {
    const target = index + offset
    if (target < 0 || target >= cards.length) return
    const next = [...cards]
    ;[next[index], next[target]] = [next[target]!, next[index]!]
    onChange({ ...value, cards: next })
  }
  return <div className="space-y-3">
    <p className="text-sm font-medium">{label}</p>
    <p className="text-xs text-muted-foreground">{sectionKey === "reviews" ? "Вставьте прямую HTTPS-ссылку на MP4/WebM и выберите обложку из медиатеки. Пока ссылки нет, на сайте показывается фото." : "Фото можно выбрать или загрузить в медиатеку. Цены и доступность меняются в CRM."}</p>
    <ol className="space-y-3">{cards.map((card, index) => <li key={card.id} className="space-y-2 rounded-lg border p-3">
      <FormField htmlFor={`${id}-${card.id}-title`} label={`Название ${index + 1}`}><Input id={`${id}-${card.id}-title`} maxLength={240} disabled={!editable} value={card.title} onChange={(event) => update(index, { title: event.target.value })} /></FormField>
      <FormField htmlFor={`${id}-${card.id}-description`} label={sectionKey === "reviews" ? "Пометка или источник (только в CMS)" : "Описание"}><Textarea id={`${id}-${card.id}-description`} maxLength={1000} disabled={!editable} value={card.description} onChange={(event) => update(index, { description: event.target.value })} /></FormField>
      {sectionKey === "reviews" && <FormField htmlFor={`${id}-${card.id}-video`} label="Прямая ссылка на видео (MP4/WebM)"><Input id={`${id}-${card.id}-video`} maxLength={2048} disabled={!editable} placeholder="https://example.com/video.mp4" type="url" value={card.videoUrl ?? ""} onChange={(event) => update(index, { videoUrl: event.target.value })} /></FormField>}
      {card.imageUrl && <img src={card.imageUrl} alt="" className="h-24 w-32 rounded-md object-cover" />}
      {card.imageUrl && !card.imageAssetId && <p className="text-xs text-muted-foreground">Сейчас используется внешняя ссылка. Выберите файл из медиатеки, чтобы управлять им здесь.</p>}
      <HeroMediaField assetId={card.imageAssetId ?? ""} canUpload={canUploadMedia} editable={editable} label={`${sectionKey === "reviews" ? "Обложка видео" : "Фото карточки"} ${index + 1}`} onChange={(imageAssetId) => update(index, { imageAssetId: imageAssetId || null, imageUrl: imageAssetId ? card.imageUrl : "" })} onSelectAsset={(asset) => update(index, { imageAssetId: asset.id, imageUrl: readyImageUrl(asset) ?? "" })} />
      <details><summary className="cursor-pointer text-xs">Вставить адрес изображения</summary><FormField htmlFor={`${id}-${card.id}-image`} label="HTTPS-ссылка или публичный адрес CMS"><Input id={`${id}-${card.id}-image`} maxLength={2048} disabled={!editable} placeholder="https://…" value={card.imageUrl} onChange={(event) => update(index, { imageAssetId: null, imageUrl: event.target.value })} /></FormField></details>
      {sectionKey === "programs" && <HomeOfferingsField kind="program" ids={card.selectedOfferingIds} editable={editable} onChange={(selectedOfferingIds) => update(index, { selectedOfferingIds })} />}
      {sectionKey === "sauna-chan" && <HomeOfferingsField kind="scheduled_resource" maxSelected={1} ids={card.selectedOfferingIds} editable={editable} onChange={(selectedOfferingIds) => update(index, { selectedOfferingIds })} />}
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" disabled={!editable || index === 0} onClick={() => move(index, -1)}>↑</Button>
        <Button type="button" size="sm" variant="outline" disabled={!editable || index === cards.length - 1} onClick={() => move(index, 1)}>↓</Button>
        <Button type="button" size="sm" variant="outline" disabled={!editable} onClick={() => onChange({ ...value, cards: cards.filter((_, position) => position !== index) })}>Удалить</Button>
      </div>
    </li>)}</ol>
    <Button type="button" size="sm" variant="outline" disabled={!editable || cards.length >= 12} onClick={() => onChange({ ...value, cards: [...cards, { id: crypto.randomUUID(), title: "", description: "", imageUrl: "", ...(sectionKey === "programs" ? { selectedOfferingIds: [] } : {}) }] })}>Добавить карточку</Button>
  </div>
}
