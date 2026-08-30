import React from 'react';
import { X, Phone, Calendar, Sparkles, Copy, Check } from 'lucide-react';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const CallModal: React.FC<CallModalProps> = ({ isOpen, onClose, onToast }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);

  if (!isOpen) return null;

  const handleCopy = (phone: string, index: number) => {
    navigator.clipboard.writeText(phone);
    setCopiedIndex(index);
    onToast(`Номер ${phone} скопирован!`);
    setTimeout(() => setCopiedIndex(null), 2000);
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
          <Phone className="w-3 h-3 text-[#2B9E47]" />
          Прямая связь с базой
        </div>

        <h3 className="text-[24px] font-semibold text-[#18191b] leading-tight mb-2">
          Позвонить в «Свистоплясово»
        </h3>
        <p className="text-[13px] text-[#6b7280] mb-6 leading-relaxed">
          Выберите нужный отдел — мы на связи каждый день с 09:00 до 21:00 и с радостью ответим на все вопросы.
        </p>

        {/* Numbers list */}
        <div className="space-y-3">
          {/* Number 1: Glamping & Chan */}
          <div className="p-4 rounded-2xl bg-[#f7f7f7] transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#2B9E47]">
                <Calendar className="w-3 h-3" />
                Бронирование домиков и бани
              </span>
              <button
                onClick={() => handleCopy("+7 (8332) 77-55-11", 1)}
                className="text-[#6b7280] hover:text-[#18191b] p-1 text-xs flex items-center gap-1"
                title="Скопировать"
              >
                {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-[#2B9E47]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-[20px] font-semibold text-[#18191b] mb-2 tracking-tight">
              +7 (8332) 77-55-11
            </div>
            <a
              href="tel:+78332775511"
              className="inline-flex items-center justify-center w-full h-[40px] px-4 rounded-full bg-[#2B9E47] text-white text-[13px] font-medium hover:bg-[#23823a] transition-colors"
            >
              <span>Позвонить для бронирования</span>
            </a>
          </div>

          {/* Number 2: Events & Corporate */}
          <div className="p-4 rounded-2xl bg-[#f7f7f7] transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#FAAB2B]">
                <Sparkles className="w-3 h-3 text-[#FAAB2B]" />
                Организация праздников и свадеб
              </span>
              <button
                onClick={() => handleCopy("+7 (922) 995-33-22", 2)}
                className="text-[#6b7280] hover:text-[#18191b] p-1 text-xs flex items-center gap-1"
                title="Скопировать"
              >
                {copiedIndex === 2 ? <Check className="w-3.5 h-3.5 text-[#2B9E47]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-[20px] font-semibold text-[#18191b] mb-2 tracking-tight">
              +7 (922) 995-33-22
            </div>
            <a
              href="tel:+79229953322"
              className="inline-flex items-center justify-center w-full h-[40px] px-4 rounded-full bg-[#18191b] text-white text-[13px] font-medium hover:bg-neutral-800 transition-colors"
            >
              <span>Связаться с event-отделом</span>
            </a>
          </div>
        </div>

        {/* Footer note */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-[#6b7280]">
            Либо напишите нам в <a href="https://vk.com" target="_blank" rel="noreferrer" className="text-[#2B9E47] font-medium hover:underline">ВКонтакте</a> — отвечаем в течение 3 минут.
          </p>
        </div>
      </div>
    </div>
  );
};
