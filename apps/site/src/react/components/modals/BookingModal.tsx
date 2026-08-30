import React from 'react';
import { X, Phone, ArrowUpRight, Sparkles, Send } from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCallModal: () => void;
  initialItemName?: string;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  onOpenCallModal,
  initialItemName
}) => {
  if (!isOpen) return null;

  const handleVkClick = () => {
    const text = encodeURIComponent(
      initialItemName 
        ? `Здравствуйте! Хочу забронировать: ${initialItemName} в «Свистоплясово». Подскажите, пожалуйста, свободные даты.`
        : `Здравствуйте! Хочу забронировать отдых в «Свистоплясово». Подскажите, пожалуйста, свободные даты.`
    );
    window.open(`https://vk.com/im?sel=-123456789&message=${text}`, '_blank');
    onClose();
  };

  const handleCallClick = () => {
    onClose();
    onOpenCallModal();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center rounded-full bg-[#f7f7f7] text-[#18191b] hover:bg-neutral-200 transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Eyebrow */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f7f7f7] text-[10px] font-medium tracking-wider uppercase text-[#18191b] mb-3">
          <Sparkles className="w-3 h-3 text-[#2B9E47]" />
          Индивидуальный сервис
        </div>

        <h3 className="text-[24px] font-semibold text-[#18191b] leading-tight mb-2">
          Забронировать отдых
        </h3>
        
        {initialItemName && (
          <div className="mb-3 px-3 py-1.5 rounded-xl bg-[#f7f7f7] text-[12px] font-medium text-[#2B9E47] inline-block">
            Выбрано: {initialItemName}
          </div>
        )}

        <p className="text-[13px] text-[#6b7280] mb-6 leading-relaxed">
          Мы бережно относимся к пожеланиям каждого гостя, поэтому бронируем лично — без бездушных роботов. Выберите удобный способ связи:
        </p>

        {/* Action Methods */}
        <div className="space-y-3">
          {/* Method 1: VK */}
          <button
            onClick={handleVkClick}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#f7f7f7] hover:bg-[#eaf5ec] text-left transition-colors group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#2B9E47] text-white flex items-center justify-center shrink-0">
                <Send className="w-5 h-5 -rotate-12" />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[#18191b] flex items-center gap-1.5">
                  Написать ВКонтакте
                  <span className="px-1.5 py-0.5 rounded-md bg-[#2B9E47]/10 text-[#2B9E47] text-[10px] font-medium">быстро</span>
                </div>
                <div className="text-[12px] text-[#6b7280]">
                  Ответим за 3 минуты в диалоге группы
                </div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#18191b] group-hover:bg-[#2B9E47] group-hover:text-white transition-colors">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </button>

          {/* Method 2: Phone call */}
          <button
            onClick={handleCallClick}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-[#f7f7f7] hover:bg-neutral-200 text-left transition-colors group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-[#18191b] text-white flex items-center justify-center shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[15px] font-semibold text-[#18191b]">
                  Позвонить менеджеру
                </div>
                <div className="text-[12px] text-[#6b7280]">
                  2 линии: бронь домиков или праздники
                </div>
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#18191b] group-hover:bg-[#18191b] group-hover:text-white transition-colors">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* Guarantee note */}
        <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center gap-2 text-[11px] text-[#6b7280]">
          <span className="w-2 h-2 rounded-full bg-[#2B9E47]"></span>
          Работаем ежедневно с 09:00 до 21:00 без выходных
        </div>
      </div>
    </div>
  );
};
