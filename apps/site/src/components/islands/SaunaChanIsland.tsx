import type { CmsHomeSectionConfig } from "@crm/contracts"
import { EmptyState, SiteSectionHeader } from "@crm/site-ui"
import { Flame } from "lucide-react"
import { SaunaChanSection } from "../../react/components/sections/SaunaChanSection";
import { navigateTo, openBooking, showToast } from "../../lib/site-events";

export function SaunaChanIsland({ config, fixture = false }: { config: CmsHomeSectionConfig; fixture?: boolean }) {
  if (!fixture) return <section id="sauna" data-section-key="sauna-chan" data-analytics-id="home.sauna.view" className="w-full py-8"><SiteSectionHeader eyebrow={config.eyebrow} eyebrowIcon={<Flame className="w-3 h-3 text-[var(--site-color-accent-red)]" />} title={config.title} description={config.description} /><EmptyState title="Подробности скоро" description="Скоро расскажем больше о бане и горячем чане." /></section>
  return (
    <SaunaChanSection config={config}
      onAddAddon={() => navigateTo("quiz")}
      onOpenBookingModal={openBooking}
      onToast={showToast}
    />
  );
}

export default SaunaChanIsland;
