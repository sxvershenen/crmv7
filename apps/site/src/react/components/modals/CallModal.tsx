import React from 'react';
import { X, Phone, Calendar, Sparkles, Copy, Check } from 'lucide-react';
import { useDialogBehavior } from '../../utils/useDialogBehavior';
import { DEFAULT_CMS_FOOTER_DETAILS, type CmsFooterDetails } from '@crm/contracts';

interface CallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
  contactDetails?: CmsFooterDetails;
  siteName?: string;
}

export const CallModal: React.FC<CallModalProps> = ({ isOpen, onClose, onToast, contactDetails = DEFAULT_CMS_FOOTER_DETAILS, siteName = 'Свистоплясово' }) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const dialogRef = useDialogBehavior(isOpen, onClose);

  if (!isOpen) return null;
  const phoneHref = (value: string) => `tel:${value.replace(/[^+\d]/g, '')}`;

  const handleCopy = async (phone: string, index: number) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedIndex(index);
      onToast(`Номер ${phone} скопирован!`);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch {
      onToast("Не удалось скопировать номер — выделите его вручную");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-dialog-title"
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

        <h3 id="call-dialog-title" className="text-[24px] font-semibold text-[#18191b] leading-tight mb-2">
          Позвонить в «{siteName}»
        </h3>
        <p className="text-[13px] text-[#6b7280] mb-6 leading-relaxed">
          Выберите номер для связи.
        </p>

        {/* Numbers list */}
        <div className="space-y-3">
          {contactDetails.bookingPhone && <div className="p-4 rounded-2xl bg-[#f7f7f7] transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#2B9E47]">
                <Calendar className="w-3 h-3" />
                Бронирование домиков и бани
              </span>
              <button
                onClick={() => handleCopy(contactDetails.bookingPhone, 1)}
                className="text-[#6b7280] hover:text-[#18191b] p-1 text-xs flex items-center gap-1"
                title="Скопировать"
              >
                {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-[#2B9E47]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-[20px] font-semibold text-[#18191b] mb-2 tracking-tight">
              {contactDetails.bookingPhone}
            </div>
            <a
              href={phoneHref(contactDetails.bookingPhone)}
              className="inline-flex items-center justify-center w-full h-[40px] px-4 rounded-full bg-[#2B9E47] text-white text-[13px] font-medium hover:bg-[#23823a] transition-colors"
            >
              <span>Позвонить для бронирования</span>
            </a>
          </div>}

          {/* Number 2: Events & Corporate */}
          {contactDetails.eventsPhone && <div className="p-4 rounded-2xl bg-[#f7f7f7] transition-all">
            <div className="flex items-center justify-between mb-1.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#FAAB2B]">
                <Sparkles className="w-3 h-3 text-[#FAAB2B]" />
                Организация праздников и свадеб
              </span>
              <button
                onClick={() => handleCopy(contactDetails.eventsPhone, 2)}
                className="text-[#6b7280] hover:text-[#18191b] p-1 text-xs flex items-center gap-1"
                title="Скопировать"
              >
                {copiedIndex === 2 ? <Check className="w-3.5 h-3.5 text-[#2B9E47]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <div className="text-[20px] font-semibold text-[#18191b] mb-2 tracking-tight">
              {contactDetails.eventsPhone}
            </div>
            <a
              href={phoneHref(contactDetails.eventsPhone)}
              className="inline-flex items-center justify-center w-full h-[40px] px-4 rounded-full bg-[#18191b] text-white text-[13px] font-medium hover:bg-neutral-800 transition-colors"
            >
              <span>Связаться с event-отделом</span>
            </a>
          </div>}
          {!contactDetails.bookingPhone && !contactDetails.eventsPhone && <p className="text-sm text-[#6b7280]">Телефоны пока не указаны.</p>}
        </div>

        {/* Footer note */}
        {contactDetails.socialUrl && contactDetails.socialLabel && <div className="mt-4 text-center">
          <p className="text-[11px] text-[#6b7280]">
            Также можно открыть <a href={contactDetails.socialUrl} target="_blank" rel="noreferrer" className="text-[#2B9E47] font-medium hover:underline">{contactDetails.socialLabel}</a>.
          </p>
        </div>}
      </div>
    </div>
  );
};
