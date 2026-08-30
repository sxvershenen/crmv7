import { VenuesSection } from "../../react/components/sections/VenuesSection";
import { openBooking } from "../../lib/site-events";

export function VenuesIsland() {
  return <VenuesSection onOpenBookingModal={openBooking} />;
}

export default VenuesIsland;
