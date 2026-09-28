import { Button, FormField, Input, Textarea } from "@crm/ui"
import type { HeroConfig, MediaAsset } from "@admin/entities/cms"
import { HeroMediaField } from "./hero-media-field"

type Slide = NonNullable<HeroConfig["slides"]>[number]
type FeatureCard = NonNullable<HeroConfig["featureCards"]>[number]

function move<T>(items: T[], index: number, offset: number): T[] {
  const next = [...items]
  const target = index + offset
  if (target < 0 || target >= next.length) return items
  ;[next[index], next[target]] = [next[target]!, next[index]!]
  return next
}

export function HeroCompositionFields({ hero, editable, canUploadMedia, onChange }: {
  hero: HeroConfig
  editable: boolean
  canUploadMedia: boolean
  onChange: (patch: Partial<HeroConfig>) => void
}) {
  const slides = hero.slides ?? []
  const cards = hero.featureCards ?? []
  const updateSlide = (index: number, patch: Partial<Slide>) => onChange({ slides: slides.map((item, position) => position === index ? { ...item, ...patch } : item) })
  const updateCard = (index: number, patch: Partial<FeatureCard>) => onChange({ featureCards: cards.map((item, position) => position === index ? { ...item, ...patch } : item) })
  const addSlide = (asset: MediaAsset) => onChange({ slides: [...slides, { id: crypto.randomUUID(), imageAssetId: asset.id, image: null, title: hero.title, tagline: hero.description || null, focalPoint: { x: 0.5, y: 0.5 } }] })
  const addCard = (asset: MediaAsset) => onChange({ featureCards: [...cards, { id: crypto.randomUUID(), imageAssetId: asset.id, image: null, title: asset.title, description: null, href: "/#houses", target: "_self" }] })

  return <div className="space-y-5 rounded-lg border p-3 sm:p-4">
    <FormField htmlFor="hero-badge" label="Плашка над первым экраном"><Input id="hero-badge" maxLength={160} placeholder="30 минут от Кирова" readOnly={!editable} value={hero.badge?.label ?? ""} onChange={(event) => onChange({ badge: event.target.value ? { label: event.target.value, icon: hero.badge?.icon ?? null } : null })} /></FormField>
    <div className="space-y-3">
      <div><p className="text-sm font-medium">Слайды первого экрана</p><p className="text-xs text-muted-foreground">Если слайдов нет, используется основной фон выше. До пяти слайдов с отдельным фото и текстом.</p></div>
      {slides.map((slide, index) => <div key={slide.id} className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2"><strong className="text-xs">Слайд {index + 1}</strong><div className="flex gap-1"><Button type="button" size="sm" variant="outline" disabled={!editable || index === 0} onClick={() => onChange({ slides: move(slides, index, -1) })} aria-label={`Поднять слайд ${index + 1}`}>↑</Button><Button type="button" size="sm" variant="outline" disabled={!editable || index === slides.length - 1} onClick={() => onChange({ slides: move(slides, index, 1) })} aria-label={`Опустить слайд ${index + 1}`}>↓</Button><Button type="button" size="sm" variant="outline" disabled={!editable} onClick={() => onChange({ slides: slides.filter((_, position) => position !== index) })} aria-label={`Удалить слайд ${index + 1}`}>Удалить</Button></div></div>
        <HeroMediaField assetId={slide.imageAssetId} canUpload={canUploadMedia} editable={editable} label={`Фото слайда ${index + 1}`} onChange={(assetId) => assetId ? updateSlide(index, { imageAssetId: assetId, image: null }) : onChange({ slides: slides.filter((_, position) => position !== index) })} onSelectAsset={(asset) => updateSlide(index, { imageAssetId: asset.id, image: null })} />
        <FormField htmlFor={`hero-slide-${slide.id}-title`} label="Заголовок"><Input id={`hero-slide-${slide.id}-title`} maxLength={240} readOnly={!editable} value={slide.title} onChange={(event) => updateSlide(index, { title: event.target.value })} /></FormField>
        <FormField htmlFor={`hero-slide-${slide.id}-tagline`} label="Подзаголовок"><Textarea id={`hero-slide-${slide.id}-tagline`} maxLength={500} readOnly={!editable} value={slide.tagline ?? ""} onChange={(event) => updateSlide(index, { tagline: event.target.value || null })} /></FormField>
      </div>)}
      {editable && slides.length < 5 ? <HeroMediaField assetId="" canUpload={canUploadMedia} editable label="Добавить слайд: выберите фото" onChange={() => {}} onSelectAsset={addSlide} /> : null}
      {slides.length > 1 ? <label className="flex items-center gap-2 text-xs"><input type="checkbox" disabled={!editable} checked={Boolean(hero.autoplayMs)} onChange={(event) => onChange({ autoplayMs: event.target.checked ? 6000 : null })} />Переключать слайды автоматически</label> : null}
    </div>
    <div className="space-y-3">
      <div><p className="text-sm font-medium">Карточки справа на первом экране</p><p className="text-xs text-muted-foreground">На сайте видны первые две карточки. Ссылка ведёт в нужный раздел сайта.</p></div>
      {cards.map((card, index) => <div key={card.id} className="space-y-3 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2"><strong className="text-xs">Карточка {index + 1}</strong><div className="flex gap-1"><Button type="button" size="sm" variant="outline" disabled={!editable || index === 0} onClick={() => onChange({ featureCards: move(cards, index, -1) })} aria-label={`Поднять карточку ${index + 1}`}>↑</Button><Button type="button" size="sm" variant="outline" disabled={!editable || index === cards.length - 1} onClick={() => onChange({ featureCards: move(cards, index, 1) })} aria-label={`Опустить карточку ${index + 1}`}>↓</Button><Button type="button" size="sm" variant="outline" disabled={!editable} onClick={() => onChange({ featureCards: cards.filter((_, position) => position !== index) })} aria-label={`Удалить карточку ${index + 1}`}>Удалить</Button></div></div>
        <HeroMediaField assetId={card.imageAssetId} canUpload={canUploadMedia} editable={editable} label={`Фото карточки ${index + 1}`} onChange={(assetId) => assetId ? updateCard(index, { imageAssetId: assetId, image: null }) : onChange({ featureCards: cards.filter((_, position) => position !== index) })} onSelectAsset={(asset) => updateCard(index, { imageAssetId: asset.id, image: null })} />
        <FormField htmlFor={`hero-card-${card.id}-title`} label="Название"><Input id={`hero-card-${card.id}-title`} maxLength={160} readOnly={!editable} value={card.title} onChange={(event) => updateCard(index, { title: event.target.value })} /></FormField>
        <FormField htmlFor={`hero-card-${card.id}-description`} label="Подпись"><Input id={`hero-card-${card.id}-description`} maxLength={500} readOnly={!editable} value={card.description ?? ""} onChange={(event) => updateCard(index, { description: event.target.value || null })} /></FormField>
        <FormField htmlFor={`hero-card-${card.id}-href`} label="Ссылка"><Input id={`hero-card-${card.id}-href`} maxLength={2048} placeholder="/#houses" readOnly={!editable} value={card.href} onChange={(event) => updateCard(index, { href: event.target.value })} /></FormField>
      </div>)}
      {editable && cards.length < 2 ? <HeroMediaField assetId="" canUpload={canUploadMedia} editable label="Добавить карточку: выберите фото" onChange={() => {}} onSelectAsset={addCard} /> : null}
    </div>
  </div>
}
