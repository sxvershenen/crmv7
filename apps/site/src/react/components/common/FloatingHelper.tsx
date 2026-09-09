import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useForgivingHover } from '../../utils/useForgivingHover';

interface FloatingHelperProps {
  onOpenBookingModal?: () => void;
}

export const FloatingHelper: React.FC<FloatingHelperProps> = () => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { expanded: isExpanded, open, closeSoon } = useForgivingHover();

  const handleManagerChat = () => {
    setIsConfirmOpen(true);
  };

  const confirmManagerChat = () => {
    setIsConfirmOpen(false);
    window.open('https://vk.com/im?sel=-123456789&message=' + encodeURIComponent('Здравствуйте! Подскажите, пожалуйста, по поводу отдыха в «Свистоплясово»'), '_blank');
  };

  return (
    <>
      {/* Desktop Floating Card (Bottom Right) */}
      <div
        data-site-component="floating-helper"
        className="hidden lg:flex fixed bottom-6 right-6 z-40 items-center"
        onPointerEnter={open}
        onPointerLeave={closeSoon}
        onFocusCapture={open}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeSoon(); }}
      >
        {isConfirmOpen && (
          <div className="absolute bottom-full right-0 mb-3 w-[280px] rounded-3xl bg-white border border-neutral-200 shadow-xl p-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-[14px] font-semibold text-[#18191b]">Перейти в ВКонтакте?</div>
            <p className="text-[12px] text-[#6b7280] mt-1">Откроем диалог с менеджером «Свистоплясово».</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setIsConfirmOpen(false)} className="h-10 flex-1 rounded-full bg-[#f7f7f7] text-[12px] font-medium text-[#18191b] hover:bg-neutral-200">Остаться</button>
              <button onClick={confirmManagerChat} className="h-10 flex-1 rounded-full bg-[#2B9E47] text-[12px] font-medium text-white hover:bg-[#23823a]">Перейти</button>
            </div>
          </div>
        )}
        <button
          onClick={handleManagerChat}
          aria-label="Написать менеджеру в ВК"
          aria-expanded={isExpanded}
          className={`site-floating-helper flex h-12 items-center overflow-hidden rounded-full bg-white border border-neutral-200/80 shadow-lg hover:border-neutral-300 hover:scale-[1.02] transition-[width,padding,gap,transform,border-color] duration-500 ease-[var(--ease-spring)] group cursor-pointer ${isExpanded ? 'w-[294px] gap-3 p-1 pr-3' : 'w-12 gap-0 p-0.5'}`}
        >
          {/* Avatar with pulsing online dot */}
          <div className="relative">
            <img
              src="https://images.pexels.com/photos/7551763/pexels-photo-7551763.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=90&w=90"
              alt="Менеджер Алёна"
              className="w-10 h-10 rounded-full object-cover border border-neutral-200"
            />
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#2B9E47] border-2 border-white"></span>
          </div>

          <div className={`text-left whitespace-nowrap overflow-hidden transition-[max-width,opacity] duration-300 ease-[var(--ease-out)] ${isExpanded ? 'max-w-[190px] opacity-100' : 'max-w-0 opacity-0'}`}>
            <div className="text-[12px] font-semibold text-[#18191b] flex items-center gap-1.5 leading-none mb-1">
              Нужна помощь?
              <span className="text-[10px] font-normal text-[#2B9E47] bg-[#2B9E47]/10 px-1.5 py-0.5 rounded-full">онлайн</span>
            </div>
            <div className="text-[11px] text-[#6b7280] leading-none">
              Наш менеджер подскажет в ВК
            </div>
          </div>

          <div className={`w-7 h-7 shrink-0 rounded-full bg-[#f7f7f7] group-hover:bg-[#2B9E47] group-hover:text-white flex items-center justify-center text-[#18191b] transition-[opacity,transform,background-color,color] duration-300 ease-[var(--ease-out)] ${isExpanded ? 'opacity-100 scale-100' : 'pointer-events-none opacity-0 scale-75'}`}>
            <Send className="w-3.5 h-3.5 -rotate-12" />
          </div>
        </button>
      </div>

      {/* Mobile Floating Avatar (Bottom Right, above bottom navbar) */}
      <div className="lg:hidden fixed bottom-20 right-4 z-40">
        {isConfirmOpen && (
          <div className="absolute bottom-full right-0 mb-3 w-[260px] rounded-3xl bg-white border border-neutral-200 shadow-xl p-4">
            <div className="text-[14px] font-semibold text-[#18191b]">Перейти в ВКонтакте?</div>
            <p className="text-[12px] text-[#6b7280] mt-1">Откроем диалог с менеджером.</p>
            <div className="flex gap-2 mt-3"><button onClick={() => setIsConfirmOpen(false)} className="h-10 flex-1 rounded-full bg-[#f7f7f7] text-[12px]">Остаться</button><button onClick={confirmManagerChat} className="h-10 flex-1 rounded-full bg-[#2B9E47] text-white text-[12px]">Перейти</button></div>
          </div>
        )}
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
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#2B9E47] border-2 border-white"></span>
          <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-[#2B9E47] text-white flex items-center justify-center shadow">
            <Send className="w-2.5 h-2.5 -rotate-12" />
          </span>
        </button>
      </div>
    </>
  );
};
