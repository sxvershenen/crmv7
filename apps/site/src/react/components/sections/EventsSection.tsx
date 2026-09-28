import { Calendar } from "lucide-react"
import type { CmsHomeSectionConfig, PublicProgramSummary } from "@crm/contracts"
import { EmptyState, SiteEventFeatureCard, SiteResponsiveRail, SiteSectionHeader, SiteVkCommunityCard } from "@crm/site-ui"

import { EVENTS } from "../../data/resortData"
import { useSwipeHint } from "../../utils/useSwipeHint"

export function EventsSection({ config, onOpenBookingModal, published = [], fixture = false }: { published?: PublicProgramSummary[] | undefined; fixture?: boolean; config: CmsHomeSectionConfig; onOpenBookingModal: (title?: string) => void }) {
  const rail = useSwipeHint()
  const events = fixture ? EVENTS : published.filter((item) => item.requestAvailable && item.fulfillment.nextOccurrence).sort((a, b) => a.fulfillment.nextOccurrence!.startsAt.localeCompare(b.fulfillment.nextOccurrence!.startsAt)).map((item) => ({
    id: item.offeringId, title: item.title, description: item.summary ?? "", photo: "", seatsLeft: null,
    dayMonth: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: item.timezone }).format(new Date(item.fulfillment.nextOccurrence!.startsAt)),
  }))
  return <section id="events" data-section-key="events" data-analytics-id="home.events.view" className="w-full py-8"><SiteSectionHeader eyebrow={config.eyebrow} eyebrowIcon={<Calendar className="w-3 h-3 text-[var(--site-color-brand-500)]" />} eyebrowTone="brand" title={config.title} description={config.description} />{events.length ? <SiteResponsiveRail ref={rail} variant="events">{events.map((item) => <SiteEventFeatureCard key={item.id} onSelect={() => onOpenBookingModal(`Событие: ${item.title}`)} image={item.photo} title={item.title} description={item.description} dayMonth={item.dayMonth} seatsLeft={item.seatsLeft} />)}{fixture && <SiteVkCommunityCard />}</SiteResponsiveRail> : <EmptyState title="Пока нет ближайших событий" description="Новые даты появятся здесь, как только будет готова афиша." />}</section>
}
