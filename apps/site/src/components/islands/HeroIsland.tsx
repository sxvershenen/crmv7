import { HeroSection } from "../../react/components/sections/HeroSection";
import { navigateTo, openBooking, openCall, showToast } from "../../lib/site-events";
import type { SiteHeroConfig } from "@crm/site-ui";

export function HeroIsland({ hero }: { hero?: SiteHeroConfig }) {
  return (
    <HeroSection
      {...(hero ? { config: hero } : {})}
      onOpenBookingModal={openBooking}
      onOpenCallModal={openCall}
      onNavigate={navigateTo}
      onToast={showToast}
    />
  );
}

export default HeroIsland;
