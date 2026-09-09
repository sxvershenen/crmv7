import { useState } from "react"
import { ArrowUpRight, Sparkles, Users } from "lucide-react"
import { SiteSecondaryAction } from "./homepage"

export interface SiteAvailabilityDay { day: string; available: boolean }

export function SiteHouseMedia({ photos, title }: { availability?: SiteAvailabilityDay[]; photos: string[]; title: string }) {
  const [active, setActive] = useState(0)
  const choosePhoto = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setActive(Math.min(Math.floor((event.clientX - rect.left) / (rect.width / photos.length)), photos.length - 1))
  }
  return <div onMouseMove={choosePhoto} onMouseLeave={() => setActive(0)} className="card-img relative aspect-[4/3] w-full bg-bg select-none"><img src={photos[active] ?? photos[0]} alt={title} className="w-full h-full object-cover" />{photos.length > 1 ? <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 z-10">{photos.map((photo, index) => <div key={`${photo}-${index}`} className={`h-1 rounded-full flex-1 transition-all ${active === index ? "bg-surface" : "bg-surface/30"}`} />)}</div> : null}</div>
}

export function SiteSpaMedia({ photos, title }: { photos: string[]; title: string }) {
  const [active, setActive] = useState(0)
  const choosePhoto = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setActive(Math.min(Math.floor((event.clientX - rect.left) / (rect.width / photos.length)), photos.length - 1))
  }
  return <div onMouseMove={choosePhoto} onMouseLeave={() => setActive(0)} className="card-img relative aspect-[16/10] w-full bg-bg select-none"><img src={photos[active] ?? photos[0]} alt={title} className="w-full h-full object-cover" /><div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 z-10">{photos.map((photo, index) => <div key={`${photo}-${index}`} className={`h-1 rounded-full flex-1 transition-all ${active === index ? "bg-surface" : "bg-surface/30"}`} />)}</div></div>
}

export function SiteVkCommunityCard() {
  return <div className="w-[min(380px,calc(100vw-48px))] md:w-auto shrink-0 snap-swiper-card p-5 rounded-[var(--site-radius-lg)] bg-[var(--site-color-brand-500)] text-[var(--site-color-text-inverse)] flex flex-col justify-between cursor-pointer group hover:-translate-y-1 active:scale-[.99] transition-transform duration-[var(--site-motion-normal)] ease-[var(--site-ease)]"><div><div className="flex items-center justify-between mb-4"><div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--site-radius-round)] bg-[var(--site-color-surface-inverse-medium)] text-[var(--site-color-text-inverse)] text-[length:var(--site-text-eyebrow)] font-[var(--site-weight-medium)] uppercase tracking-[var(--site-tracking-eyebrow)]"><Sparkles className="w-3 h-3" />Группа ВКонтакте</div><div className="w-9 h-9 rounded-[var(--site-radius-round)] bg-[var(--site-color-surface-inverse-medium)] flex items-center justify-center text-[var(--site-color-text-inverse)] group-hover:bg-[var(--site-color-surface)] group-hover:text-[var(--site-color-brand-500)] transition-colors"><ArrowUpRight className="w-4 h-4" /></div></div><h3 className="text-[length:var(--site-text-title-sm)] font-[var(--site-weight-semibold)] text-[var(--site-color-text-inverse)] leading-snug mb-2.5">Все свежие новости в&nbsp;нашей ленте ВК</h3><p className="text-[length:var(--site-text-caption)] text-[var(--site-color-text-inverse)]/90 leading-relaxed font-[var(--site-weight-regular)]">Делимся фотографиями улыбок наших гостей, публикуем внезапные скидки и&nbsp;горящие даты каждый день!</p><div className="mt-5 p-3 rounded-[var(--site-radius-md)] bg-[var(--site-color-surface-inverse-soft)] backdrop-blur-xs flex items-center gap-3"><div className="flex -space-x-2"><img src="https://images.pexels.com/photos/7551760/pexels-photo-7551760.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=60&w=60" alt="Гость" className="w-7 h-7 rounded-[var(--site-radius-round)] border-2 border-[var(--site-color-brand-500)] object-cover" /><img src="https://images.pexels.com/photos/7551783/pexels-photo-7551783.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=60&w=60" alt="Гость" className="w-7 h-7 rounded-[var(--site-radius-round)] border-2 border-[var(--site-color-brand-500)] object-cover" /><img src="https://images.pexels.com/photos/8556685/pexels-photo-8556685.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=60&w=60" alt="Гость" className="w-7 h-7 rounded-[var(--site-radius-round)] border-2 border-[var(--site-color-brand-500)] object-cover" /></div><div><div className="text-[length:var(--site-text-body-sm)] font-[var(--site-weight-semibold)] text-[var(--site-color-text-inverse)] flex items-center gap-1 leading-none"><Users className="w-3.5 h-3.5" />14&nbsp;840</div><div className="text-[length:var(--site-text-eyebrow)] text-[var(--site-color-text-inverse)]/80 mt-0.5">подписчиков сейчас</div></div></div></div><div className="mt-5"><SiteSecondaryAction href="https://vk.com">Перейти в сообщество</SiteSecondaryAction></div></div>
}
