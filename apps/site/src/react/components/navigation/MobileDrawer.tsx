import React from 'react';
import { X, Home, Flame, Sparkles, Layers, CalendarDays, Compass, MapPin, Phone, Send, Calculator } from 'lucide-react';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (sectionId: string) => void;
  onOpenBookingModal: () => void;
  onOpenCallModal: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenBookingModal,
  onOpenCallModal
}) => {
  if (!isOpen) return null;

  const links = [
    { id: "hero", label: "Главная страница", icon: <Home className="w-4 h-4 text-[#2B9E47]" /> },
    { id: "houses", label: "Глэмпинг и домики", icon: <Sparkles className="w-4 h-4 text-[#2B9E47]" /> },
    { id: "sauna", label: "Кедровая баня и чан", icon: <Flame className="w-4 h-4 text-[#EE2F2E]" /> },
    { id: "programs", label: "Программы праздников", icon: <Sparkles className="w-4 h-4 text-[#FAAB2B]" /> },
    { id: "venues", label: "Площадки и залы", icon: <Layers className="w-4 h-4 text-[#18191b]" /> },
    { id: "events", label: "Ближайшие события", icon: <CalendarDays className="w-4 h-4 text-[#2B9E47]" /> },
    { id: "map", label: "Карта территории 12 га", icon: <Compass className="w-4 h-4 text-[#18191b]" /> },
    { id: "quiz", label: "Калькулятор отдыха", icon: <Calculator className="w-4 h-4 text-[#2B9E47]" /> },
    { id: "location", label: "Как добраться и FAQ", icon: <MapPin className="w-4 h-4 text-[#18191b]" /> },
  ];

  return (
    <div className="lg:hidden fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-xs">
      <div 
        className="relative w-full max-w-xs bg-white h-full p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Top header */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100">
            <div>
              <div className="text-[15px] font-semibold text-[#18191b]">
                СВИСТОПЛЯСОВО
              </div>
              <div className="text-[11px] text-[#6b7280]">
                Глэмпинг & База отдыха
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#f7f7f7] flex items-center justify-center text-[#18191b]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Links list */}
          <div className="space-y-1">
            {links.map((link) => (
              <button
                key={link.id}
                onClick={() => {
                  onNavigate(link.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#f7f7f7] text-[13px] font-medium text-[#18191b] text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-xl bg-[#f7f7f7] flex items-center justify-center shrink-0">
                  {link.icon}
                </div>
                <span>{link.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom actions */}
        <div className="pt-6 border-t border-neutral-100 space-y-2.5">
          <button
            onClick={() => {
              onClose();
              onOpenBookingModal();
            }}
            className="w-full h-[48px] px-4 rounded-full bg-[#2B9E47] text-white text-[13px] font-medium flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            <span>Забронировать отдых</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onOpenCallModal();
            }}
            className="w-full h-[40px] px-4 rounded-full bg-[#f7f7f7] text-[#18191b] text-[13px] font-medium flex items-center justify-center gap-2"
          >
            <Phone className="w-4 h-4" />
            <span>Позвонить (2 номера)</span>
          </button>

          <a
            href="https://vk.com"
            target="_blank"
            rel="noreferrer"
            className="w-full h-[38px] px-4 rounded-full bg-[#f7f7f7] text-[#18191b] text-[12px] font-medium flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5 text-[#2B9E47] -rotate-12" />
            <span>Сообщество ВКонтакте (14.8k)</span>
          </a>
        </div>
      </div>
    </div>
  );
};
