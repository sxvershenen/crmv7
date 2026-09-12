import type { CmsHomeSectionConfig, PublicHouseSummary } from "@crm/contracts"
import { HousesSection } from "../../react/components/sections/HousesSection";
import { openBooking, openHouse } from "../../lib/site-events";

export function HousesIsland({ config, published, fixture = false }: { config: CmsHomeSectionConfig; published?: PublicHouseSummary[] | undefined; fixture?: boolean }) {
    return (
    <HousesSection config={config} published={published} fixture={fixture}
      onSelectHouse={openHouse}
      onBookHouse={(houseTitle) => openBooking(`Дом: ${houseTitle}`)}
    />
  );
}

export default HousesIsland;
