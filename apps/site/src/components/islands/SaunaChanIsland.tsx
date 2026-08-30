import { SaunaChanSection } from "../../react/components/sections/SaunaChanSection";
import { navigateTo, openBooking, showToast } from "../../lib/site-events";

export function SaunaChanIsland() {
  return (
    <SaunaChanSection
      onAddAddon={() => navigateTo("quiz")}
      onOpenBookingModal={openBooking}
      onToast={showToast}
    />
  );
}

export default SaunaChanIsland;
