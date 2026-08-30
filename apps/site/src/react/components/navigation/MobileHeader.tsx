import React from 'react';
import { Phone, Send } from 'lucide-react';

interface MobileHeaderProps {
  onOpenCallModal: () => void;
  onOpenBookingModal: () => void;
  onNavigate: (sectionId: string) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  onOpenCallModal,
  onOpenBookingModal,
  onNavigate
}) => {
  return (
    <header className="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-100 px-4 py-2.5 flex items-center justify-between">
      {/* Brand */}
      <div 
        onClick={() => onNavigate('hero')}
        className="flex items-center gap-2.5 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-xl bg-[#2B9E47] text-white flex items-center justify-center font-bold text-xs tracking-tighter">
          СВ
        </div>
        <div>
          <div className="text-[13px] font-semibold text-[#18191b] leading-tight">
            СВИСТОПЛЯСОВО
          </div>
          <div className="text-[9px] text-[#6b7280]">
            Глэмпинг в Кирове
          </div>
        </div>
      </div>

      {/* Quick Action Pills */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenCallModal}
          className="w-8 h-8 rounded-full bg-[#f7f7f7] text-[#18191b] flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Позвонить"
        >
          <Phone className="w-3.5 h-3.5 text-[#18191b]" />
        </button>

        <button
          onClick={() => onOpenBookingModal()}
          className="h-[32px] px-3 rounded-full bg-[#2B9E47] text-white text-[11px] font-medium flex items-center gap-1.5 active:scale-95 transition-transform"
        >
          <Send className="w-3 h-3 -rotate-12" />
          <span>Бронь</span>
        </button>
      </div>
    </header>
  );
};
