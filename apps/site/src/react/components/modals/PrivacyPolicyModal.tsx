import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl p-6 md:p-8 my-auto animate-in fade-in zoom-in-95 duration-200"
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

        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-5 h-5 text-[#2B9E47]" />
          <span className="text-[11px] uppercase tracking-wider font-semibold text-[#6b7280]">
            Правовая информация
          </span>
        </div>

        <h3 className="text-[22px] font-semibold text-[#18191b] leading-tight mb-4">
          Политика обработки персональных данных и согласие
        </h3>

        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-4 text-[13px] text-[#2d3134] leading-relaxed">
          <p>
            Настоящая Политика конфиденциальности персональных данных (далее — Политика) действует в отношении всей информации, которую Индивидуальный предприниматель <strong>Норсеева Ирина Михайловна</strong> (ИНН 431900639521, ОГРНИП 318435000012345) может получить о Пользователе во время использования сайта базы отдыха «Свистоплясово».
          </p>

          <h4 className="font-semibold text-[#18191b]">1. Общие положения</h4>
          <p>
            1.1. Отправляя заявку, заполняя форму калькулятора или заказывая звонок на сайте, Пользователь выражает свое полное согласие на обработку его персональных данных в соответствии со статьей 9 Федерального закона от 27.07.2006 года № 152-ФЗ «О персональных данных».
          </p>

          <h4 className="font-semibold text-[#18191b]">2. Состав обрабатываемых данных</h4>
          <p>
            2.1. Имя, контактный номер телефона, адрес электронной почты, выбранный мессенджер для обратной связи, параметры бронирования (даты, состав гостей).
          </p>

          <h4 className="font-semibold text-[#18191b]">3. Цели обработки</h4>
          <p>
            3.1. Связь с Пользователем для подтверждения бронирования глэмпинга, согласования программы мероприятий, консультации по услугам базы отдыха и предоставления индивидуальных скидок по промокодам.
          </p>

          <h4 className="font-semibold text-[#18191b]">4. Защита и конфиденциальность</h4>
          <p>
            4.1. Администрация сайта гарантирует нераспространение персональных данных третьим лицам без законных оснований и принимает все необходимые организационные и технические меры для их защиты.
          </p>
        </div>

        <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-end">
          <button
            onClick={onClose}
            className="h-[48px] px-6 rounded-full bg-[#18191b] text-white text-[13px] font-medium hover:bg-neutral-800 transition-colors"
          >
            Понятно и согласен
          </button>
        </div>
      </div>
    </div>
  );
};
