import type { CmsHomeSectionConfig, PublicVenueSummary } from "@crm/contracts"
import { VenuesSection } from "../../react/components/sections/VenuesSection";
import { openBooking } from "../../lib/site-events";

export function VenuesIsland({ config, published, fixture = false }: { config: CmsHomeSectionConfig; published?: PublicVenueSummary[] | undefined; fixture?: boolean }) {
  return <VenuesSection config={config} published={published} fixture={fixture} onOpenBookingModal={openBooking} />;
}

export default VenuesIsland;
