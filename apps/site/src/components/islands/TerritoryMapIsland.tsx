import type { CmsHomeSectionConfig } from "@crm/contracts"
import { TerritoryMapSection } from "../../react/components/sections/TerritoryMapSection";
import { openBooking } from "../../lib/site-events";

export function TerritoryMapIsland({ config }: { config: CmsHomeSectionConfig }) {
  return <TerritoryMapSection config={config} onOpenBookingModal={openBooking} />;
}

export default TerritoryMapIsland;
