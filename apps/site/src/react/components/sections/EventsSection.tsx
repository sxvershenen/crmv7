import React, { useRef, useEffect, useState } from 'react';
import { Calendar, ArrowRight, ArrowUpRight, Send, Users, Sparkles } from 'lucide-react';
import { EVENTS } from '../../data/resortData';

interface EventsSectionProps {
  onOpenBookingModal: (title?: string) => void;
}

export const EventsSection: React.FC<EventsSectionProps> = ({ onOpenBookingModal }) => {
  const swiperRef = useRef<HTMLDivElement>(null);
  const [hasNudged, setHasNudged] = useState(false);

  // Mobile swipe hint animation when scrolled into view
  useEffect(() => {
    const el = swiperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !hasNudged) {
          el.classList.add('animate-swipe-hint');
          setHasNudged(true);
          setTimeout(() => {
            el.classList.remove('animate-swipe-hint');
          }, 2000);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNudged]);

  return (
    <section id="events" className="w-full py-8">
      {/* Block Header */}
      <div className="mb-6">
        {/* Eyebrow */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eaf5ec] text-[10px] font-semibold tracking-wider uppercase text-[#237c39] mb-2.5">
          <Calendar className="w-3 h-3 text-[#2B9E47]" />
          Афиша на весну
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#18191b] leading-tight tracking-tight">
            Ближайшие события
          </h2>
          <p className="hidden md:block text-[13px] text-[#6b7280] max-w-md font-normal leading-relaxed text-left md:text-right">
            Повод выбраться из&nbsp;города на&nbsp;свежий воздух уже есть — присоединяйтесь к&nbsp;нашим душевным встречам
          </p>
        </div>
      </div>

      {/* Grid on Desktop (4 columns) / Swiper on Mobile (snap-swiper with peek) */}
      <div
        ref={swiperRef}
        className="flex md:grid md:grid-cols-2 xl:grid-cols-4 gap-4 overflow-x-auto md:overflow-visible pb-4 md:pb-0 snap-swiper no-scrollbar -mx-4 px-4 md:mx-0 md:px-0"
      >
        {/* 3 Event Cards */}
        {EVENTS.map((item) => (
          <div
            key={item.id}
            onClick={() => onOpenBookingModal(`Событие: ${item.title}`)}
            className="w-[280px] sm:w-[320px] md:w-auto shrink-0 snap-swiper-card p-3 rounded-3xl bg-white flex flex-col justify-between cursor-pointer group transition-transform duration-200"
          >
            <div>
              {/* Photo 1:1 with rounded corners and padding */}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-neutral-100 mb-3.5">
                <img
                  src={item.photo}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

                {/* Date Badge on Image */}
                <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-xs text-[#18191b] text-[12px] font-semibold flex items-center gap-1.5 shadow-sm">
                  <Calendar className="w-3.5 h-3.5 text-[#2B9E47]" />
                  <span>{item.dayMonth}</span>
                </div>

                {/* Remaining seats */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-end text-[11px] text-white">
                  <span className="px-2 py-1 rounded-lg bg-[#2B9E47] text-white font-medium">
                    Осталось {item.seatsLeft} мест
                  </span>
                </div>
              </div>

              {/* Title and Short Description */}
              <div className="px-1">
                <h3 className="text-[16px] font-semibold text-[#18191b] leading-snug group-hover:text-[#2B9E47] transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-[12px] text-[#6b7280] mt-1.5 leading-relaxed line-clamp-3">
                  {item.description}
                </p>
              </div>
            </div>

            {/* Bottom Arrow Action */}
            <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between px-1">
              <span className="text-[12px] font-medium text-[#18191b]">
                Записаться
              </span>
              <div className="w-8 h-8 rounded-full bg-[#f7f7f7] group-hover:bg-[#2B9E47] group-hover:text-white flex items-center justify-center text-[#18191b] transition-colors">
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        ))}

        {/* 4th Card: Green VK Community CTA Card */}
        <div className="w-[280px] sm:w-[320px] md:w-auto shrink-0 snap-swiper-card p-5 rounded-3xl bg-[#2B9E47] text-white flex flex-col justify-between cursor-pointer group">
          <div>
            {/* Top row */}
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-[10px] font-medium uppercase tracking-wider">
                <Sparkles className="w-3 h-3" />
                Группа ВКонтакте
              </div>
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:bg-white group-hover:text-[#2B9E47] transition-colors">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>

            <h3 className="text-[20px] font-semibold text-white leading-snug mb-2.5">
              Все свежие новости в&nbsp;нашей ленте ВК
            </h3>

            <p className="text-[12px] text-white/90 leading-relaxed font-normal">
              Делимся фотографиями улыбок наших гостей, публикуем внезапные скидки и&nbsp;горящие даты каждый день!
            </p>

            {/* Avatar group proof */}
            <div className="mt-5 p-3 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center gap-3">
              <div className="flex -space-x-2">
                <img
                  src="https://images.pexels.com/photos/7551760/pexels-photo-7551760.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=60&w=60"
                  alt="Гость"
                  className="w-7 h-7 rounded-full border-2 border-[#2B9E47] object-cover"
                />
                <img
                  src="https://images.pexels.com/photos/7551783/pexels-photo-7551783.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=60&w=60"
                  alt="Гость"
                  className="w-7 h-7 rounded-full border-2 border-[#2B9E47] object-cover"
                />
                <img
                  src="https://images.pexels.com/photos/8556685/pexels-photo-8556685.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=60&w=60"
                  alt="Гость"
                  className="w-7 h-7 rounded-full border-2 border-[#2B9E47] object-cover"
                />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-white flex items-center gap-1 leading-none">
                  <Users className="w-3.5 h-3.5" />
                  14&nbsp;840
                </div>
                <div className="text-[10px] text-white/80 mt-0.5">
                  подписчиков сейчас
                </div>
              </div>
            </div>
          </div>

          <a
            href="https://vk.com"
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-5 w-full h-[48px] px-4 rounded-full bg-white text-[#2B9E47] text-[13px] font-medium flex items-center justify-center gap-2 hover:bg-neutral-100 transition-colors"
          >
            <Send className="w-3.5 h-3.5 -rotate-12" />
            <span>Перейти в сообщество</span>
          </a>
        </div>
      </div>
    </section>
  );
};
