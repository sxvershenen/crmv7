import { Home } from "lucide-react"
import type { CmsHomeSectionConfig } from "@crm/contracts"
import { SiteHouseMedia, SiteResourceFeatureCard, SiteResponsiveRail, SiteSectionHeader } from "@crm/site-ui"

import { HOUSES, type HouseItem } from "../../data/resortData"
import { useSwipeHint } from "../../utils/useSwipeHint"

interface HousesSectionProps { config: CmsHomeSectionConfig; onSelectHouse: (house: HouseItem) => void; onBookHouse: (houseTitle: string) => void }

export function HousesSection({ config, onSelectHouse }: HousesSectionProps) {
  const rail = useSwipeHint()
  return <section id="houses" data-section-key="houses" data-analytics-id="home.houses.view" className="w-full py-8"><SiteSectionHeader eyebrow={config.eyebrow} eyebrowIcon={<Home className="w-3 h-3 text-[var(--site-color-brand-500)]" />} title={config.title} description={config.description} /><SiteResponsiveRail ref={rail}>{HOUSES.map((house) => <SiteResourceFeatureCard key={house.id} onSelect={() => onSelectHouse(house)} title={house.title} capacity={house.capacityNumber} description={house.description} perks={house.perks} price={<>{house.priceFrom.toLocaleString("ru-RU")} ₽</>} media={<SiteHouseMedia title={house.title} photos={house.photos} />} />)}</SiteResponsiveRail></section>
}
