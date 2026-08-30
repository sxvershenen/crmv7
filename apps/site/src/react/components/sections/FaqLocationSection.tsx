import React, { useState } from 'react';
import {
  HelpCircle,
  MapPin,
  Phone,
  Send,
  Mail,
  ChevronDown,
  Navigation,
  Clock,
  Car
} from 'lucide-react';
import { FAQ_ITEMS, FaqItem } from '../../data/resortData';

interface FaqLocationSectionProps {
  onOpenCallModal: () => void;
}

export const FaqLocationSection: React.FC<FaqLocationSectionProps> = ({ onOpenCallModal }) => {
  const [openFaqId, setOpenFaqId] = useState<string | null>(FAQ_ITEMS[0]!.id);
  const [isInteractiveMapLoaded] = useState(false);

  const toggleFaq = (id: string) => {
    setOpenFaqId(openFaqId === id ? null : id);
  };

  const handleOpenYandexNavigator = () => {
    window.open('https://yandex.ru/maps/?rtext=~58.553200,49.623400&rtt=auto', '_blank');
  };

  return (
    <section id="location" className="w-full py-8">
      {/* Block Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-[#18191b] mb-2.5">
          <HelpCircle className="w-3 h-3 text-[#2B9E47]" />
          Забота и ответы
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#18191b] leading-tight tracking-tight">
            Как добраться и&nbsp;частые вопросы
          </h2>
          <p className="hidden md:block text-[13px] text-[#6b7280] max-w-md font-normal leading-relaxed text-left md:text-right">
            Всё, что важно знать перед поездкой к&nbsp;нам в&nbsp;гости — от&nbsp;маршрута до&nbsp;правил заезда с&nbsp;питомцами
          </p>
        </div>
      </div>

      {/* Main Grid: Info & Map on Left (First on Mobile) / FAQ Accordion on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Route & Contacts Card */}
        <div className="lg:col-span-5 space-y-4">
          {/* Static Map Preview / Interactive Map Container */}
          <div className="relative h-[240px] rounded-3xl overflow-hidden bg-neutral-100 shadow-sm">
            {!isInteractiveMapLoaded ? (
              <>
                <img
                  src="https://images.pexels.com/photos/34923437/pexels-photo-34923437.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=500&w=800"
                  alt="Карта проезда"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center text-white">
                  <MapPin className="w-8 h-8 text-[#2B9E47] mb-2" />
                  <div className="text-[15px] font-semibold leading-tight mb-1">
                    Кировская область, дер. Свистоплясово
                  </div>
                  <div className="text-[12px] text-neutral-200 mb-3">
                    Координаты: 58.5532° N, 49.6234° E
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleOpenYandexNavigator}
                      className="h-[36px] px-4 rounded-full bg-[#2B9E47] hover:bg-[#23823a] text-white text-[12px] font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Маршрут в Яндекс.Картах</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <iframe
                title="Яндекс Карта"
                src="https://yandex.ru/map-widget/v1/?um=constructor%3Aexample&source=constructor"
                width="100%"
                height="100%"
                style={{ border: 0 }}
              />
            )}
          </div>

          {/* Travel Details & Drive Proof */}
          <div className="p-5 rounded-3xl bg-white space-y-3.5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#f7f7f7] flex items-center justify-center shrink-0">
                <Car className="w-4 h-4 text-[#2B9E47]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#2B9E47]">
                  30 минут на авто от Театральной площади
                </div>
                <div className="text-[12px] text-[#6b7280] mt-0.5 leading-snug">
                  Ровная асфальтированная трасса, регулярная чистка снега зимой.
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 pt-3 border-t border-neutral-100">
              <div className="w-9 h-9 rounded-xl bg-[#f7f7f7] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-[#FAAB2B]" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[#18191b]">
                  Заезд с 15:00 • Выезд до 12:00
                </div>
                <div className="text-[12px] text-[#6b7280] mt-0.5 leading-snug">
                  Возможен ранний заезд и поздний выезд по согласованию.
                </div>
              </div>
            </div>

            {/* Direct Contacts List */}
            <div className="pt-3 border-t border-neutral-100 space-y-1">
              <button
                onClick={onOpenCallModal}
                className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#f7f7f7] transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-xl bg-[#eaf5ec] text-[#2B9E47] flex items-center justify-center shrink-0"><Phone className="w-4 h-4" /></div>
                <div>
                  <div className="text-[13px] font-semibold text-[#18191b]">+7 (8332) 74-55-10</div>
                  <div className="text-[11px] text-[#6b7280]">Бронирование домиков</div>
                </div>
              </button>

              <a
                href="https://vk.com"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#f7f7f7] transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-[#eaf3ff] text-[#2876c9] flex items-center justify-center shrink-0"><Send className="w-4 h-4 -rotate-12" /></div>
                <div>
                  <div className="text-[13px] font-semibold text-[#18191b]">Связаться ВКонтакте</div>
                  <div className="text-[11px] text-[#6b7280]">vk.com/svistoplyasovo</div>
                </div>
              </a>

              <a
                href="mailto:info@svistoplyasovo.ru"
                className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-[#f7f7f7] transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-neutral-100 text-[#6b7280] flex items-center justify-center shrink-0"><Mail className="w-4 h-4" /></div>
                <div>
                  <div className="text-[13px] font-semibold text-[#18191b]">Написать на почту</div>
                  <div className="text-[11px] text-[#6b7280]">info@svistoplyasovo.ru</div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: FAQ Accordion (8-10 questions with large tap target) */}
        <div className="lg:col-span-7 space-y-2.5">
          {FAQ_ITEMS.map((faq: FaqItem) => {
            const isOpen = openFaqId === faq.id;

            return (
              <div
                key={faq.id}
                className="rounded-3xl bg-white transition-all overflow-hidden"
              >
                {/* Large Tap Zone Header */}
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 group"
                >
                  <span className="text-[14px] sm:text-[15px] font-semibold text-[#18191b] group-hover:text-[#2B9E47] transition-colors leading-snug">
                    {faq.question}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-full bg-[#f7f7f7] group-hover:bg-[#2B9E47] group-hover:text-white flex items-center justify-center text-[#18191b] transition-all shrink-0 ${
                      isOpen ? 'rotate-180 bg-[#2B9E47] text-white' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {/* Answer Content */}
                {isOpen && (
                  <div className="px-4 pb-5 sm:px-5 text-[13px] text-[#2d3134] leading-relaxed animate-in fade-in duration-150">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
