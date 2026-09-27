import { HeroSection } from "../../react/components/sections/HeroSection";
import { navigateTo, openBooking, openCall, showToast } from "../../lib/site-events";
import type { SiteHeroConfig, SitePromoCode } from "@crm/site-ui";

export function HeroIsland({ hero, fixture = false, promos = [] }: { hero?: SiteHeroConfig; fixture?: boolean; promos?: SitePromoCode[] }) {
  return (
    <HeroSection fixture={fixture} promos={promos}
      {...(hero ? { config: hero } : {})}
      onOpenBookingModal={openBooking}
      onOpenCallModal={openCall}
      onNavigate={navigateTo}
      onToast={showToast}
    />
  );
}

export default HeroIsland;
