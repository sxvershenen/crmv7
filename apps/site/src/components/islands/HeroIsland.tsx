import { HeroSection } from "../../react/components/sections/HeroSection";
import { navigateTo, openBooking, openCall, showToast } from "../../lib/site-events";
import type { SiteHeroConfig } from "@crm/site-ui";

export function HeroIsland({ hero, fixture = false }: { hero?: SiteHeroConfig; fixture?: boolean }) {
  return (
    <HeroSection fixture={fixture}
      {...(hero ? { config: hero } : {})}
      onOpenBookingModal={openBooking}
      onOpenCallModal={openCall}
      onNavigate={navigateTo}
      onToast={showToast}
    />
  );
}

export default HeroIsland;
