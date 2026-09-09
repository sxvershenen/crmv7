import { SiteHero, type SiteHeroConfig } from "@crm/site-ui"

import { DEFAULT_HERO_CONFIG } from "../../../data/publicContentDefaults"
import { PROMO_CODES } from "../../data/resortData"
import { fireConfetti } from "../../utils/confetti"
import { applyPromo } from "../../../lib/site-events"

interface HeroSectionProps {
  onOpenBookingModal: (itemName?: string) => void
  onOpenCallModal: () => void
  onNavigate: (sectionId: string) => void
  onToast: (message: string) => void
  config?: SiteHeroConfig
}

export function HeroSection({ config, onNavigate, onOpenBookingModal, onOpenCallModal, onToast }: HeroSectionProps) {
  // SiteHero owns the canonical data-section-key="hero" marker.
  return <SiteHero
    config={config ?? DEFAULT_HERO_CONFIG}
    configured={Boolean(config)}
    promos={PROMO_CODES}
    onBooking={() => onOpenBookingModal()}
    onCall={onOpenCallModal}
    onNavigate={onNavigate}
    onPromoCopied={(promo) => {
      fireConfetti()
      applyPromo(promo.code)
      onToast(`Промокод ${promo.code} скопирован! Примените скидку ${promo.amount}`)
    }}
  />
}
