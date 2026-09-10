import type { CmsHomeSectionConfig } from "@crm/contracts"
import { HousesSection } from "../../react/components/sections/HousesSection";
import { openBooking, openHouse } from "../../lib/site-events";

export function HousesIsland({ config }: { config: CmsHomeSectionConfig }) {
    return (
    <HousesSection config={config}
      onSelectHouse={openHouse}
      onBookHouse={(houseTitle) => openBooking(`Дом: ${houseTitle}`)}
    />
  );
}

export default HousesIsland;
