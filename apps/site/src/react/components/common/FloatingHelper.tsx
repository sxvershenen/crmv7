import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';

interface FloatingHelperProps {
  onOpenBookingModal?: () => void;
}

export const FloatingHelper: React.FC<FloatingHelperProps> = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const expandTimer = window.setTimeout(() => setIsExpanded(true), 60_000);
    const collapseTimer = window.setTimeout(() => setIsExpanded(false), 120_000);
    return () => {
      window.clearTimeout(expandTimer);
      window.clearTimeout(collapseTimer);
    };
  }, []);

  const handleManagerChat = () => {
    if (window.confirm('Перейти в ВКонтакте и написать менеджеру?')) {
      window.open('https://vk.com/im?sel=-123456789&message=' + encodeURIComponent('Здравствуйте! Подскажите, пожалуйста, по поводу отдыха в «Свистоплясово»'), '_blank');
    }
  };

  return (
    <>
      {/* Desktop Floating Card (Bottom Right) */}
      <div className="hidden lg:flex fixed bottom-6 right-6 z-40 items-center">
        <button
          onClick={handleManagerChat}
          className={`flex items-center overflow-hidden rounded-full bg-white border border-neutral-200/80 shadow-lg hover:border-neutral-300 hover:scale-[1.02] transition-all duration-500 group cursor-pointer ${isExpanded ? 'gap-3 p-2.5 pr-4' : 'w-14 h-14 p-2'}`}
        >
          {/* Avatar with pulsing online dot */}
          <div className="relative">
            <img
              src="https://images.pexels.com/photos/7551763/pexels-photo-7551763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=90&w=90"
              alt="Менеджер Алёна"
              className="w-10 h-10 rounded-full object-cover border border-neutral-200"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#2B9E47] border-2 border-white animate-pulse-dot"></span>
          </div>

          <div className={`text-left whitespace-nowrap transition-all duration-300 ${isExpanded ? 'max-w-[190px] opacity-100' : 'max-w-0 opacity-0 overflow-hidden'}`}>
            <div className="text-[12px] font-semibold text-[#18191b] flex items-center gap-1.5 leading-none mb-1">
              Нужна помощь?
              <span className="text-[10px] font-normal text-[#2B9E47] bg-[#2B9E47]/10 px-1.5 py-0.5 rounded-full">онлайн</span>
            </div>
            <div className="text-[11px] text-[#6b7280] leading-none">
              Наш менеджер подскажет в ВК
            </div>
          </div>

          <div className={`w-7 h-7 rounded-full bg-[#f7f7f7] group-hover:bg-[#2B9E47] group-hover:text-white flex items-center justify-center text-[#18191b] transition-colors ${isExpanded ? 'ml-1' : 'hidden'}`}>
            <Send className="w-3.5 h-3.5 -rotate-12" />
          </div>
        </button>
      </div>

      {/* Mobile Floating Avatar (Bottom Right, above bottom navbar) */}
      <div className="lg:hidden fixed bottom-20 right-4 z-40">
        <button
          onClick={handleManagerChat}
          className="relative w-12 h-12 rounded-full shadow-lg border-2 border-white overflow-visible bg-white flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Написать менеджеру в ВК"
        >
          <img
            src="https://images.pexels.com/photos/7551763/pexels-photo-7551763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=90&w=90"
            alt="Менеджер"
            className="w-full h-full rounded-full object-cover"
          />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#2B9E47] border-2 border-white animate-pulse-dot"></span>
          <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-[#2B9E47] text-white flex items-center justify-center shadow">
            <Send className="w-2.5 h-2.5 -rotate-12" />
          </span>
        </button>
      </div>
    </>
  );
};
