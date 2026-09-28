import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useForgivingHover } from '../../utils/useForgivingHover';
import { DEFAULT_CMS_FOOTER_DETAILS, type CmsFooterDetails } from '@crm/contracts';

interface FloatingHelperProps {
  contactDetails?: CmsFooterDetails;
}

export const FloatingHelper: React.FC<FloatingHelperProps> = ({ contactDetails = DEFAULT_CMS_FOOTER_DETAILS }) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const { expanded: isExpanded, open, closeSoon } = useForgivingHover();

  const handleManagerChat = () => {
    setIsConfirmOpen(true);
  };

  const confirmManagerChat = () => {
    setIsConfirmOpen(false);
    if (contactDetails.socialUrl) window.open(contactDetails.socialUrl, '_blank', 'noopener,noreferrer');
  };

  if (!contactDetails.socialUrl || !contactDetails.socialLabel) return null;

  return (
    <>
      {/* Desktop Floating Card (Bottom Right) */}
      <div
        data-site-component="floating-helper"
        className="hidden lg:flex fixed bottom-6 right-4 z-40 items-center"
        onPointerEnter={open}
        onPointerLeave={closeSoon}
        onFocusCapture={open}
        onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeSoon(); }}
      >
        {isConfirmOpen && (
          <div className="absolute bottom-full right-0 mb-3 w-[280px] rounded-3xl bg-white border border-neutral-200 shadow-xl p-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-[14px] font-semibold text-[#18191b]">Открыть сообщество?</div>
            <p className="text-[12px] text-[#6b7280] mt-1">Откроем страницу «{contactDetails.socialLabel}».</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setIsConfirmOpen(false)} className="h-10 flex-1 rounded-full bg-[#f7f7f7] text-[12px] font-medium text-[#18191b] hover:bg-neutral-200">Остаться</button>
              <button onClick={confirmManagerChat} className="h-10 flex-1 rounded-full bg-[#2B9E47] text-[12px] font-medium text-white hover:bg-[#23823a]">Перейти</button>
            </div>
          </div>
        )}
        <button
          onClick={handleManagerChat}
          aria-label="Открыть сообщество"
          aria-expanded={isExpanded}
          className={`site-floating-helper flex h-12 items-center overflow-hidden rounded-full bg-white border border-neutral-200/80 shadow-lg hover:border-neutral-300 transition-[width,padding,gap,border-color] duration-500 ease-[var(--ease-spring)] group cursor-pointer ${isExpanded ? 'w-[min(18rem,calc(100vw-2rem))] gap-2 p-1 pr-2' : 'w-12 gap-0 p-0.5'}`}
        >
          <div className="relative shrink-0">
            <span className="w-10 h-10 rounded-full bg-[#2B9E47] text-white flex items-center justify-center"><Send className="w-4 h-4 -rotate-12" /></span>
          </div>

          <div className={`text-left whitespace-nowrap overflow-hidden transition-[width,opacity] duration-300 ease-[var(--ease-out)] ${isExpanded ? 'w-[168px] min-w-0 flex-1 opacity-100' : 'w-0 shrink-0 opacity-0'}`}>
            <div className="text-[12px] font-semibold text-[#18191b] flex items-center gap-1.5 leading-none mb-1">
              Нужна помощь?
            </div>
            <div className="text-[11px] text-[#6b7280] leading-none">
              {contactDetails.socialLabel}
            </div>
          </div>

          <div className={`w-7 h-7 shrink-0 rounded-full bg-[#f7f7f7] group-hover:bg-[#2B9E47] group-hover:text-white items-center justify-center text-[#18191b] transition-[opacity,background-color,color] duration-300 ease-[var(--ease-out)] ${isExpanded ? 'flex opacity-100' : 'hidden'}`}>
            <Send className="w-3.5 h-3.5 -rotate-12" />
          </div>
        </button>
      </div>

      {/* Mobile Floating Avatar (Bottom Right, above bottom navbar) */}
      <div className="lg:hidden fixed bottom-20 right-4 z-40">
        {isConfirmOpen && (
          <div className="absolute bottom-full right-0 mb-3 w-[260px] rounded-3xl bg-white border border-neutral-200 shadow-xl p-4">
            <div className="text-[14px] font-semibold text-[#18191b]">Открыть сообщество?</div>
            <p className="text-[12px] text-[#6b7280] mt-1">Откроем страницу «{contactDetails.socialLabel}».</p>
            <div className="flex gap-2 mt-3"><button onClick={() => setIsConfirmOpen(false)} className="h-10 flex-1 rounded-full bg-[#f7f7f7] text-[12px]">Остаться</button><button onClick={confirmManagerChat} className="h-10 flex-1 rounded-full bg-[#2B9E47] text-white text-[12px]">Перейти</button></div>
          </div>
        )}
        <button
          onClick={handleManagerChat}
          className="relative w-12 h-12 rounded-full shadow-lg border-2 border-white overflow-visible bg-white flex items-center justify-center active:scale-95 transition-transform"
          aria-label="Открыть сообщество"
        >
          <span className="w-full h-full rounded-full bg-[#2B9E47] text-white flex items-center justify-center"><Send className="w-4 h-4 -rotate-12" /></span>
          <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-[#2B9E47] text-white flex items-center justify-center shadow">
            <Send className="w-2.5 h-2.5 -rotate-12" />
          </span>
        </button>
      </div>
    </>
  );
};
