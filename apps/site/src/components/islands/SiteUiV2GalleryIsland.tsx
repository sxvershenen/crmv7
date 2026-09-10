import { useState } from "react"
import { Calendar, Filter, Flame, Home, Layers, Sparkles } from "lucide-react"
import {
  SiteActionSectionHeader,
  SiteEventFeatureCard,
  SiteFilterMenu,
  SiteHero,
  SiteHouseMedia,
  SiteResourceFeatureCard,
  SiteResponsiveRail,
  SiteSectionHeader,
  SiteSpaFeatureCard,
  SiteSpaMedia,
  SiteVkCommunityCard,
} from "@crm/site-ui"

import { DEFAULT_HERO_CONFIG, DEFAULT_HOMEPAGE_SECTION_CONFIGS } from "../../data/publicContentDefaults"
import { EVENTS, HOUSES, PROMO_CODES, SAUNA_CHAN_DATA } from "../../data/resortData"
import { navigateTo, openBooking, openCall, showToast } from "../../lib/site-events"
import { BookingQuizSection } from "../../react/components/sections/BookingQuizSection"
import { FaqLocationSection } from "../../react/components/sections/FaqLocationSection"
import { ProgramsSection } from "../../react/components/sections/ProgramsSection"
import { ReviewsSection } from "../../react/components/sections/ReviewsSection"
import { TerritoryMapSection } from "../../react/components/sections/TerritoryMapSection"
import { VenuesSection } from "../../react/components/sections/VenuesSection"

export default function SiteUiV2GalleryIsland() {
  const [filterOpen, setFilterOpen] = useState(false)
  const [spaAdded, setSpaAdded] = useState(false)
  const sauna = SAUNA_CHAN_DATA.sauna
  const saunaPrice = sauna.priceFrom.match(/\d[\d\s]*/)?.[0]?.trim() ?? sauna.priceFrom

  return <>
    <section aria-labelledby="v2-hero-title" className="site-section site-section--compact">
      <SiteSectionHeader eyebrow="Hero · главная" eyebrowIcon={<Sparkles className="w-3 h-3 text-[var(--site-color-accent-amber)]" />} title="Hero и промокоды" description="Каноничный hero нового public-дизайна: slider, CTA, chooser и полнокарточное копирование промокода." titleId="v2-hero-title" />
      <SiteHero config={{ ...DEFAULT_HERO_CONFIG, autoplayMs: 0 }} promos={PROMO_CODES} onBooking={() => openBooking()} onCall={openCall} onNavigate={navigateTo} onPromoCopied={(promo) => showToast(`Промокод ${promo.code} скопирован`)} />
    </section>

    <section aria-labelledby="v2-headings-title" className="site-section site-section--compact">
      <SiteSectionHeader eyebrow="Section anatomy" eyebrowIcon={<Calendar className="w-3 h-3 text-[var(--site-color-brand-500)]" />} eyebrowTone="brand" title="Заголовки секций главной" description="Обычный и action-вариант с реальным filter menu." titleId="v2-headings-title" />
      <div className="grid gap-5 lg:grid-cols-2"><div className="p-5 rounded-[var(--site-radius-lg)] bg-[var(--site-color-surface-muted)]"><SiteSectionHeader eyebrow="Глэмпинг в лесу" eyebrowIcon={<Home className="w-3 h-3 text-[var(--site-color-brand-500)]" />} title="Домики для отдыха" description="Desktop description скрывается на mobile как на главной." /></div><div className="p-5 rounded-[var(--site-radius-lg)] bg-[var(--site-color-surface-muted)]"><SiteActionSectionHeader eyebrow="Локации для аренды" eyebrowIcon={<Layers className="w-3 h-3" />} title="Площадки и залы" action={<SiteFilterMenu width="md" label="Все площадки (5)" icon={<Filter className="w-4 h-4" />} open={filterOpen} onToggle={() => setFilterOpen((open) => !open)} options={[{ id: "all", label: "Все площадки (5)", selected: true, onSelect: () => setFilterOpen(false) }, { id: "small", label: "Камерные (до 30 человек)", selected: false, onSelect: () => setFilterOpen(false) }]} />} /></div></div>
    </section>

    <section aria-labelledby="v2-events-title" className="site-section site-section--compact">
      <SiteSectionHeader eyebrow="Афиша на весну" eyebrowIcon={<Calendar className="w-3 h-3 text-[var(--site-color-brand-500)]" />} eyebrowTone="brand" title="События и social CTA" description="Реальные карточки EventsSection и четвёртая VK-карточка." titleId="v2-events-title" />
      <SiteResponsiveRail variant="events">{EVENTS.map((event) => <SiteEventFeatureCard key={event.id} image={event.photo} title={event.title} description={event.description} dayMonth={event.dayMonth} seatsLeft={event.seatsLeft} onSelect={() => openBooking(`Событие: ${event.title}`)} />)}<SiteVkCommunityCard /></SiteResponsiveRail>
    </section>

    <section aria-labelledby="v2-houses-title" className="site-section site-section--compact">
      <SiteSectionHeader eyebrow="Глэмпинг в лесу" eyebrowIcon={<Home className="w-3 h-3 text-[var(--site-color-brand-500)]" />} title="Карточки домиков" description="Media hover segments, perks, pricing и CTA разделяют те же shared contracts, что и HousesSection." titleId="v2-houses-title" />
      <SiteResponsiveRail>{HOUSES.map((house) => <SiteResourceFeatureCard key={house.id} title={house.title} capacity={house.capacityNumber} description={house.description} perks={house.perks} price={<>{house.priceFrom.toLocaleString("ru-RU")} ₽</>} onSelect={() => openBooking(`Дом: ${house.title}`)} media={<SiteHouseMedia title={house.title} photos={house.photos} />} />)}</SiteResponsiveRail>
    </section>

    <section aria-labelledby="v2-spa-title" className="site-section site-section--compact">
      <SiteSectionHeader eyebrow="СПА и здоровье" eyebrowIcon={<Flame className="w-3 h-3 text-[var(--site-color-accent-red)]" />} title="SPA-card: описание и add-state" description="Тот же shared component показывает единый content block и состояние добавления." titleId="v2-spa-title" />
      <div className="max-w-[680px]"><SiteSpaFeatureCard title={sauna.title} description={sauna.description} price={<>{saunaPrice} ₽</>} added={spaAdded} onAdd={() => setSpaAdded((added) => !added)} onSelect={() => undefined} media={<SiteSpaMedia title={sauna.title} photos={sauna.photos} />} /></div>
    </section>

    <div data-gallery-component="programs"><ProgramsSection config={DEFAULT_HOMEPAGE_SECTION_CONFIGS.programs} onOpenBookingModal={openBooking} /></div>
    <div data-gallery-component="venues"><VenuesSection config={DEFAULT_HOMEPAGE_SECTION_CONFIGS.venues} onOpenBookingModal={openBooking} /></div>
    <div data-gallery-component="reviews"><ReviewsSection config={DEFAULT_HOMEPAGE_SECTION_CONFIGS.reviews} /></div>
    <div data-gallery-component="map"><TerritoryMapSection config={DEFAULT_HOMEPAGE_SECTION_CONFIGS.map} onOpenBookingModal={openBooking} /></div>
    <div data-gallery-component="faq"><FaqLocationSection config={DEFAULT_HOMEPAGE_SECTION_CONFIGS.faq} onOpenCallModal={openCall} /></div>
    <div data-gallery-component="calculator"><BookingQuizSection config={DEFAULT_HOMEPAGE_SECTION_CONFIGS.calculator} onOpenPrivacyPolicy={() => showToast("Политика обработки данных")} onToast={showToast} /></div>
  </>
}
