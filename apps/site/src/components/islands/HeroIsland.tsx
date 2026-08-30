import { HeroSection } from "../../react/components/sections/HeroSection";
import { navigateTo, openBooking, openCall, showToast } from "../../lib/site-events";

export function HeroIsland() {
  return (
    <HeroSection
      onOpenBookingModal={openBooking}
      onOpenCallModal={openCall}
      onNavigate={navigateTo}
      onToast={showToast}
    />
  );
}

export default HeroIsland;
