import React, { useState } from 'react';
import { Home, Users, ArrowRight, Sparkles } from 'lucide-react';
import { HOUSES, HouseItem } from '../../data/resortData';

interface HousesSectionProps {
  onSelectHouse: (house: HouseItem) => void;
  onBookHouse: (houseTitle: string) => void;
}

export const HousesSection: React.FC<HousesSectionProps> = ({ onSelectHouse }) => {
  // Store photo hover index per house id
  const [hoveredIndexes, setHoveredIndexes] = useState<{ [key: string]: number }>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, houseId: string, photosCount: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const segmentWidth = width / photosCount;
    const index = Math.min(Math.floor(x / segmentWidth), photosCount - 1);
    setHoveredIndexes((prev) => ({ ...prev, [houseId]: index }));
  };

  const handleMouseLeave = (houseId: string) => {
    setHoveredIndexes((prev) => ({ ...prev, [houseId]: 0 }));
  };

  return (
    <section id="houses" className="w-full py-8">
      {/* Block Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-[#18191b] mb-2.5">
          <Home className="w-3 h-3 text-[#2B9E47]" />
          Глэмпинг в лесу
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#18191b] leading-tight tracking-tight">
            Домики для отдыха
          </h2>
          <p className="hidden md:block text-[13px] text-[#6b7280] max-w-md font-normal leading-relaxed text-left md:text-right">
            Панорамный A-frame с&nbsp;личным чаном на&nbsp;террасе или воздушный дом на&nbsp;дереве с&nbsp;видом на&nbsp;реку
          </p>
        </div>
      </div>

      {/* Grid on Desktop (2 columns) / Swiper on Mobile */}
      <div className="flex md:grid md:grid-cols-2 gap-6 overflow-x-auto md:overflow-visible pb-4 md:pb-0 snap-swiper no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        {HOUSES.map((house) => {
          const activePhotoIdx = hoveredIndexes[house.id] ?? 0;

          return (
            <div
              key={house.id}
              onClick={() => onSelectHouse(house)}
              className="w-[300px] sm:w-[360px] md:w-auto shrink-0 snap-swiper-card p-3 md:p-3.5 rounded-3xl bg-white flex flex-col justify-between cursor-pointer group transition-transform"
            >
              <div>
                {/* Image Container with 8-12px padding around, interactive 3-zone hover */}
                <div
                  onMouseMove={(e) => handleMouseMove(e, house.id, house.photos.length)}
                  onMouseLeave={() => handleMouseLeave(house.id)}
                  className="relative h-[240px] sm:h-[280px] w-full rounded-2xl overflow-hidden bg-neutral-100 mb-4 select-none"
                >
                  <img
                    src={house.photos[activePhotoIdx]}
                    alt={house.title}
                    className="w-full h-full object-cover transition-all duration-300 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

                  {/* 5-Day Availability Badges in Corner */}
                  <div className="absolute top-3 right-3 flex items-center gap-1 p-1 rounded-xl bg-black/40 backdrop-blur-xs">
                    {house.availability.map((item, dIdx) => (
                      <span
                        key={dIdx}
                        className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center ${
                          item.available
                            ? 'bg-[#2B9E47] text-white'
                            : 'bg-white/20 text-neutral-400 line-through'
                        }`}
                        title={`${item.day}: ${item.available ? 'Свободно' : 'Занято'}`}
                      >
                        {item.day}
                      </span>
                    ))}
                  </div>

                  {/* Hover indicator dashes */}
                  {house.photos.length > 1 && (
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 z-10">
                      {house.photos.map((_, pIdx) => (
                        <div
                          key={pIdx}
                          className={`h-1 rounded-full flex-1 transition-all ${
                            activePhotoIdx === pIdx ? 'bg-white' : 'bg-white/30'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Hover hint */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs text-[11px] font-medium text-[#18191b] flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#2B9E47]" />
                    <span>Наведите для фото</span>
                  </div>
                </div>

                {/* Content */}
                <div className="px-1.5">
                  {/* Title & Capacity */}
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="text-[20px] font-semibold text-[#18191b] group-hover:text-[#2B9E47] transition-colors leading-tight">
                      {house.title}
                    </h3>
                    {/* Capacity badge: user icon + number without word 'гостей' */}
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f7f7f7] text-[12px] font-medium text-[#18191b] shrink-0">
                      <Users className="w-3.5 h-3.5 text-[#2B9E47]" />
                      <span>{house.capacityNumber}</span>
                    </div>
                  </div>

                  {/* Short description */}
                  <p className="text-[13px] text-[#6b7280] leading-relaxed line-clamp-2 mb-3.5">
                    {house.description}
                  </p>

                  {/* Perks Bubbles */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {house.perks.map((perk, pIdx) => (
                      <span
                        key={pIdx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f7f7f7] text-[11px] font-medium text-[#2d3134]"
                      >
                        <span>{perk.icon}</span>
                        <span>{perk.text}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Row: Large Price & Action Arrow */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between px-1.5">
                <div>
                  <div className="text-[10px] font-medium text-[#6b7280] tracking-normal">
                    Стоимость суток
                  </div>
                  <div className="text-[22px] font-semibold text-[#18191b] tracking-tight">
                    от {house.priceFrom.toLocaleString('ru-RU')} ₽
                  </div>
                </div>

                {/* Arrow wrapped in circular pill */}
                <div className="h-[40px] px-4 rounded-full bg-[#f7f7f7] group-hover:bg-[#2B9E47] group-hover:text-white text-[#18191b] flex items-center gap-2 text-[13px] font-medium transition-all">
                  <span>Подробнее</span>
                  <div className="w-6 h-6 rounded-full bg-white group-hover:bg-white/20 flex items-center justify-center transition-colors">
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
