import React from 'react';
import { Phone, Send } from 'lucide-react';
import type { SiteBrandConfig } from '@crm/site-ui';
import { DEFAULT_PUBLIC_NAVIGATION } from '../../../data/publicContentDefaults';

interface MobileHeaderProps {
  onOpenCallModal: () => void;
  onOpenBookingModal: () => void;
  onNavigate: (sectionId: string) => void;
  brand?: SiteBrandConfig;
  configuredColors?: boolean;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onOpenCallModal,
  onOpenBookingModal,
  onNavigate,
  brand = DEFAULT_PUBLIC_NAVIGATION.brand,
  configuredColors = false,
}) => {
  const navigateBrand = () => {
    if (brand.href.startsWith('/#')) {
      onNavigate(brand.href.slice(2));
      return;
    }
    window.location.assign(brand.href);
  };

  return (
    <header className="lg:hidden sticky top-0 z-40 bg-[var(--site-color-surface-glass-strong)] backdrop-blur-md border-b border-[var(--site-color-divider)] px-4 py-2.5 flex items-center justify-between">
      {/* Brand */}
      <div 
        onClick={navigateBrand}
        className="flex items-center gap-2.5 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-[var(--site-radius-sm)] bg-[var(--site-color-brand-500)] text-[var(--site-color-text-inverse)] flex items-center justify-center font-[var(--site-weight-bold)] text-[length:var(--site-text-caption)] tracking-tighter" style={configuredColors ? { backgroundColor: brand.color } : undefined}>
          {brand.mark}
        </div>
        <div>
          <div className="text-[length:var(--site-text-body-sm)] font-[var(--site-weight-semibold)] text-[var(--site-color-text)] leading-tight">
            {brand.title}
          </div>
          <div className="text-[length:var(--site-text-nano)] text-[var(--site-color-text-muted)]">
            {brand.subtitle}
          </div>
        </div>
      </div>

      {/* Quick Action Pills */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenCallModal}
          className="w-8 h-8 rounded-[var(--site-radius-round)] bg-[var(--site-color-bg)] text-[var(--site-color-text)] flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Позвонить"
        >
          <Phone className="w-3.5 h-3.5 text-[var(--site-color-text)]" />
        </button>

        <button
          onClick={() => onOpenBookingModal()}
          className="h-[32px] px-3 rounded-[var(--site-radius-round)] bg-[var(--site-color-brand-500)] text-[var(--site-color-text-inverse)] text-[length:var(--site-text-micro)] font-[var(--site-weight-medium)] flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Send className="w-3 h-3 -rotate-12" />
          <span>Бронь</span>
        </button>
      </div>
    </header>
  );
};
