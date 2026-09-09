import React from 'react';
import { Home, Tent, Phone, PartyPopper, Menu } from 'lucide-react';

interface MobileNavbarProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  onOpenCallModal: () => void;
  onOpenBookingModal: () => void;
  onToggleMobileMenu: () => void;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = ({
  activeSection,
  onNavigate,
  onOpenCallModal,
  onToggleMobileMenu
}) => {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-[60] bg-surface" style={{ height: 'calc(var(--bottom-nav-h) + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="grid grid-cols-5 h-full items-center px-2">
        {/* Item 1: Home */}
        <button
          onClick={() => onNavigate('hero')}
          className={`flex flex-col items-center gap-1 transition-colors py-2 ${
            activeSection === 'hero' ? 'text-[var(--site-color-brand-500)]' : 'text-[var(--site-color-text-muted)] hover:text-[var(--site-color-brand-500)]'
          }`}
        >
          <Home size={20} strokeWidth={1.9} />
          <span className="text-[length:var(--site-text-micro)] font-[var(--site-weight-medium)]">Главная</span>
        </button>

        {/* Item 2: Houses */}
        <button
          onClick={() => onNavigate('houses')}
          className={`flex flex-col items-center gap-1 transition-colors py-2 ${
            activeSection === 'houses' ? 'text-[var(--site-color-brand-500)]' : 'text-[var(--site-color-text-muted)] hover:text-[var(--site-color-brand-500)]'
          }`}
        >
          <Tent size={20} strokeWidth={1.9} />
          <span className="text-[length:var(--site-text-micro)] font-[var(--site-weight-medium)]">Домики</span>
        </button>

        {/* Center: Green Call Button */}
        <button
          onClick={onOpenCallModal}
          className="flex flex-col items-center py-1"
          aria-label="Позвонить"
        >
          <span className="w-12 h-12 rounded-[var(--site-radius-round)] bg-[var(--site-color-brand-500)] text-[var(--site-color-text-inverse)] inline-flex items-center justify-center active:scale-95 transition-transform"><Phone size={20} /></span>
        </button>

        {/* Item 4: Events */}
        <button
          onClick={() => onNavigate('events')}
          className={`flex flex-col items-center gap-1 transition-colors py-2 ${
            activeSection === 'events' ? 'text-[var(--site-color-brand-500)]' : 'text-[var(--site-color-text-muted)] hover:text-[var(--site-color-brand-500)]'
          }`}
        >
          <PartyPopper size={20} strokeWidth={1.9} />
          <span className="text-[length:var(--site-text-micro)] font-[var(--site-weight-medium)]">События</span>
        </button>

        {/* Item 5: Drawer Menu */}
        <button
          onClick={onToggleMobileMenu}
          className="flex flex-col items-center gap-1 text-[var(--site-color-text-muted)] hover:text-[var(--site-color-brand-500)] transition-colors py-2"
        >
          <Menu size={20} strokeWidth={1.9} />
          <span className="text-[length:var(--site-text-micro)] font-[var(--site-weight-medium)]">Меню</span>
        </button>
      </div>
    </nav>
  );
};
