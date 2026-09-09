import { Home } from "lucide-react"
import { SiteHouseMedia, SiteResourceFeatureCard, SiteResponsiveRail, SiteSectionHeader } from "@crm/site-ui"

import { HOUSES, type HouseItem } from "../../data/resortData"
import { useSwipeHint } from "../../utils/useSwipeHint"

interface HousesSectionProps { onSelectHouse: (house: HouseItem) => void; onBookHouse: (houseTitle: string) => void }

export function HousesSection({ onSelectHouse }: HousesSectionProps) {
  const rail = useSwipeHint()
  return <section id="houses" data-section-key="houses" data-analytics-id="home.houses.view" className="w-full py-8"><SiteSectionHeader eyebrow="Глэмпинг в лесу" eyebrowIcon={<Home className="w-3 h-3 text-[var(--site-color-brand-500)]" />} title="Домики для отдыха" description={<>Панорамный A-frame с&nbsp;личным чаном на&nbsp;террасе или воздушный дом на&nbsp;дереве с&nbsp;видом на&nbsp;реку</>} /><SiteResponsiveRail ref={rail}>{HOUSES.map((house) => <SiteResourceFeatureCard key={house.id} onSelect={() => onSelectHouse(house)} title={house.title} capacity={house.capacityNumber} description={house.description} perks={house.perks} price={<>{house.priceFrom.toLocaleString("ru-RU")} ₽</>} media={<SiteHouseMedia title={house.title} photos={house.photos} />} />)}</SiteResponsiveRail></section>
}
