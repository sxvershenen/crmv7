import { useState } from "react"
import { Flame } from "lucide-react"
import type { CmsHomeSectionConfig } from "@crm/contracts"
import { EmptyState, SiteResponsiveRail, SiteSectionHeader, SiteSpaFeatureCard, SiteSpaMedia } from "@crm/site-ui"

import { SAUNA_CHAN_DATA } from "../../data/resortData"
import { useSwipeHint } from "../../utils/useSwipeHint"

interface SaunaChanSectionProps { config: CmsHomeSectionConfig; fixture?: boolean; onAddAddon: (addonName: string) => void; onOpenBookingModal?: (itemName?: string) => void; onToast: (message: string) => void }

export function SaunaChanSection({ config, fixture = false, onAddAddon, onOpenBookingModal, onToast }: SaunaChanSectionProps) {
  const rail = useSwipeHint()
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({})
  const items = [{ key: "sauna", data: SAUNA_CHAN_DATA.sauna }, { key: "chan", data: SAUNA_CHAN_DATA.chan }]
  const add = (name: string, key: string) => {
    onAddAddon(name)
    setAddedItems((current) => ({ ...current, [key]: true }))
    onToast(`«${name}» добавлено в ваш план отдыха!`)
    window.setTimeout(() => setAddedItems((current) => ({ ...current, [key]: false })), 2500)
  }
  return <section id="sauna" data-section-key="sauna-chan" data-analytics-id="home.sauna.view" className="w-full py-8"><SiteSectionHeader eyebrow={config.eyebrow} eyebrowIcon={<Flame className="w-3 h-3 text-[var(--site-color-accent-red)]" />} title={config.title} description={config.description} />{fixture ? <SiteResponsiveRail ref={rail}>{items.map(({ data, key }) => { const price = data.priceFrom.match(/\d[\d\s]*/)?.[0]?.trim() ?? data.priceFrom; return <SiteSpaFeatureCard key={key} onSelect={() => window.location.assign(`/resources/${key}`)} onAdd={() => add(data.title, key)} title={data.title} description={data.description} price={<>{price} ₽</>} added={Boolean(addedItems[key])} media={<SiteSpaMedia title={data.title} photos={data.photos} />} /> })}</SiteResponsiveRail> : config.cards?.length ? <SiteResponsiveRail ref={rail}>{config.cards.map((card) => <SiteSpaFeatureCard key={card.id} actionIcon="plus" onSelect={() => onOpenBookingModal?.(card.title)} title={card.title} description={card.description} media={<SiteSpaMedia title={card.title} photos={card.imageUrl ? [card.imageUrl] : []} />} />)}</SiteResponsiveRail> : <EmptyState title="Подробности скоро" description="Скоро расскажем больше о бане и горячем чане." />}</section>
}
