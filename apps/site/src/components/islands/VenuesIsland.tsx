import type { CmsHomeSectionConfig } from "@crm/contracts"
import { VenuesSection } from "../../react/components/sections/VenuesSection";
import { openBooking } from "../../lib/site-events";

export function VenuesIsland({ config }: { config: CmsHomeSectionConfig }) {
  return <VenuesSection config={config} onOpenBookingModal={openBooking} />;
}

export default VenuesIsland;
