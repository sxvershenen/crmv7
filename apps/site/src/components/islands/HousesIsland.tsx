import { HousesSection } from "../../react/components/sections/HousesSection";
import { openBooking, openHouse } from "../../lib/site-events";

export function HousesIsland() {
  return (
    <HousesSection
      onSelectHouse={openHouse}
      onBookHouse={(houseTitle) => openBooking(`Дом: ${houseTitle}`)}
    />
  );
}

export default HousesIsland;
