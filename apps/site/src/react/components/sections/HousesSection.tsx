import { Home } from "lucide-react"
import type { CmsHomeSectionConfig } from "@crm/contracts"
import { SiteHouseMedia, SiteResourceFeatureCard, SiteResponsiveRail, SiteSectionHeader } from "@crm/site-ui"

import { HOUSES } from "../../data/resortData"
import { homepageHouse, offeringPriceLabel, type HomepageHouse } from "../../../lib/content/homepage-commerce"
import type { PublicHouseSummary } from "@crm/contracts"
import { useSwipeHint } from "../../utils/useSwipeHint"

interface HousesSectionProps { config: CmsHomeSectionConfig; published?: PublicHouseSummary[] | undefined; fixture?: boolean; onSelectHouse: (house: HomepageHouse) => void; onBookHouse: (houseTitle: string) => void }

export function HousesSection({ config, onSelectHouse, published = [], fixture = false }: HousesSectionProps) {
  const rail = useSwipeHint()
  const houses: HomepageHouse[] = fixture ? HOUSES : published.map(homepageHouse)
  if (!houses.length) return null
  return <section id="houses" data-section-key="houses" data-analytics-id="home.houses.view" className="w-full py-8"><SiteSectionHeader eyebrow={config.eyebrow} eyebrowIcon={<Home className="w-3 h-3 text-[var(--site-color-brand-500)]" />} title={config.title} description={config.description} /><SiteResponsiveRail ref={rail}>{houses.map((house) => <SiteResourceFeatureCard key={house.id} onSelect={() => onSelectHouse(house)} title={house.title} capacity={house.capacityNumber} description={house.description} perks={house.perks} price={house.publicOffering ? offeringPriceLabel(house.publicOffering) : `${house.priceFrom?.toLocaleString("ru-RU")} ₽`} priceBasisLabel={house.publicOffering ? house.publicOffering.priceBasisLabel ?? "Стоимость" : undefined} status={house.publicOffering?.readiness === "archived" ? "Архив" : house.publicOffering?.readiness === "temporarily_unavailable" ? "Временно недоступно" : undefined} media={<SiteHouseMedia title={house.title} photos={house.photos} />} />)}</SiteResponsiveRail></section>
}
