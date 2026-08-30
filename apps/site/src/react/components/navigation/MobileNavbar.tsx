import React from 'react';
import { Home, Sparkles, Phone, Calendar, Menu } from 'lucide-react';

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
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-neutral-200/80 px-2 py-1.5 safe-area-pb">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Item 1: Home */}
        <button
          onClick={() => onNavigate('hero')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors ${
            activeSection === 'hero' ? 'text-[#2B9E47]' : 'text-[#6b7280]'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium">Главная</span>
        </button>

        {/* Item 2: Houses */}
        <button
          onClick={() => onNavigate('houses')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors ${
            activeSection === 'houses' ? 'text-[#2B9E47]' : 'text-[#6b7280]'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium">Домики</span>
        </button>

        {/* Center: Green Call Button */}
        <button
          onClick={onOpenCallModal}
          className="w-12 h-12 -mt-4 rounded-full bg-[#2B9E47] text-white flex items-center justify-center shadow-lg hover:bg-[#23823a] active:scale-95 transition-all"
          aria-label="Позвонить"
        >
          <Phone className="w-5 h-5" />
        </button>

        {/* Item 4: Events */}
        <button
          onClick={() => onNavigate('events')}
          className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition-colors ${
            activeSection === 'events' ? 'text-[#2B9E47]' : 'text-[#6b7280]'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium">Афиша</span>
        </button>

        {/* Item 5: Drawer Menu */}
        <button
          onClick={onToggleMobileMenu}
          className="flex flex-col items-center justify-center p-1.5 rounded-xl text-[#6b7280] hover:text-[#18191b] transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 font-medium">Меню</span>
        </button>
      </div>
    </div>
  );
};
