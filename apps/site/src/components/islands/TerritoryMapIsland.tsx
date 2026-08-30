import { TerritoryMapSection } from "../../react/components/sections/TerritoryMapSection";
import { openBooking } from "../../lib/site-events";

export function TerritoryMapIsland() {
  return <TerritoryMapSection onOpenBookingModal={openBooking} />;
}

export default TerritoryMapIsland;
