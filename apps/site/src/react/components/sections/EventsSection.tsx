import { Calendar } from "lucide-react"
import type { CmsHomeSectionConfig } from "@crm/contracts"
import { SiteEventFeatureCard, SiteResponsiveRail, SiteSectionHeader, SiteVkCommunityCard } from "@crm/site-ui"

import { EVENTS } from "../../data/resortData"
import { useSwipeHint } from "../../utils/useSwipeHint"

export function EventsSection({ config, onOpenBookingModal }: { config: CmsHomeSectionConfig; onOpenBookingModal: (title?: string) => void }) {
  const rail = useSwipeHint()
  return <section id="events" data-section-key="events" data-analytics-id="home.events.view" className="w-full py-8"><SiteSectionHeader eyebrow={config.eyebrow} eyebrowIcon={<Calendar className="w-3 h-3 text-[var(--site-color-brand-500)]" />} eyebrowTone="brand" title={config.title} description={config.description} /><SiteResponsiveRail ref={rail} variant="events">{EVENTS.map((item) => <SiteEventFeatureCard key={item.id} onSelect={() => onOpenBookingModal(`Событие: ${item.title}`)} image={item.photo} title={item.title} description={item.description} dayMonth={item.dayMonth} seatsLeft={item.seatsLeft} />)}<SiteVkCommunityCard /></SiteResponsiveRail></section>
}
