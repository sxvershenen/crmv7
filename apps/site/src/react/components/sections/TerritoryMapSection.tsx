import React, { useState } from 'react';
import { Compass, MapPin, ArrowRight, Home, Flame, Layers, Sparkles } from 'lucide-react';
import { MAP_SPOTS, MapSpot } from '../../data/resortData';

interface TerritoryMapSectionProps {
  onOpenBookingModal: (title?: string) => void;
}

export const TerritoryMapSection: React.FC<TerritoryMapSectionProps> = ({ onOpenBookingModal }) => {
  const [activeSpotId, setActiveSpotId] = useState<string>(MAP_SPOTS[0]!.id);

  const activeSpot: MapSpot = MAP_SPOTS.find((s) => s.id === activeSpotId) || MAP_SPOTS[0]!;

  const getSpotIcon = (category: string) => {
    switch (category) {
      case 'Глэмпинг': return <Home className="w-3.5 h-3.5" />;
      case 'СПА комплекс': return <Flame className="w-3.5 h-3.5" />;
      case 'Площадка': return <Layers className="w-3.5 h-3.5" />;
      default: return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  return (
    <section id="map" className="w-full py-8">
      {/* Block Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-[#18191b] mb-2.5">
          <Compass className="w-3 h-3 text-[#18191b]" />
          Территория 12 гектаров
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#18191b] leading-tight tracking-tight">
            Карта базы отдыха
          </h2>
          <p className="hidden md:block text-[13px] text-[#6b7280] max-w-md font-normal leading-relaxed text-left md:text-right">
            Нажимайте на&nbsp;метки локаций, чтобы исследовать расположение домиков, бани и&nbsp;шатров
          </p>
        </div>
      </div>

      {/* Main Map Box */}
      <div className="space-y-4">
        {/* Interactive Map Visual */}
        <div className="relative w-full h-[320px] sm:h-[420px] rounded-3xl overflow-hidden bg-neutral-800 select-none shadow-sm">
          {/* Stylized Map Backdrop Image */}
          <img
            src="https://images.pexels.com/photos/34923437/pexels-photo-34923437.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=800&w=1400"
            alt="Карта территории"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-[#1e2d24]/50" />

          {/* Territory river & trails stylized graphic lines */}
          <div className="absolute top-4 left-4 px-3 py-1.5 rounded-xl bg-black/40 backdrop-blur-xs text-white text-[11px] font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2B9E47]"></span>
            <span>Интерактивная схема территории</span>
          </div>

          {/* Hotspot Markers */}
          {MAP_SPOTS.map((spot) => {
            const isActive = activeSpotId === spot.id;

            return (
              <div
                key={spot.id}
                style={{ top: `${spot.y}%`, left: `${spot.x}%` }}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
              >
                <button
                  onClick={() => setActiveSpotId(spot.id)}
                  className={`relative flex items-center justify-center transition-all group ${
                    isActive ? 'scale-125 z-30' : 'scale-100 hover:scale-110'
                  }`}
                  aria-label={spot.title}
                >
                  {/* Ping wave for active marker */}
                  {isActive && (
                    <span className="absolute inset-0 rounded-full bg-[#2B9E47] animate-ping opacity-60" />
                  )}

                  {/* Marker Circle */}
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-colors ${
                      isActive ? 'bg-[#2B9E47]' : 'bg-[#18191b]/90 hover:bg-[#2B9E47]'
                    }`}
                  >
                    {getSpotIcon(spot.category)}
                  </div>

                  {/* Label tooltip on PC */}
                  <div className="hidden sm:block absolute top-full mt-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[10px] font-medium pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    {spot.title}
                  </div>
                </button>
              </div>
            );
          })}
        </div>

        {/* Spot Preview Card & Building Pills */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Active Spot Detail Preview (Concise, fit for mobile) */}
          <div className="lg:col-span-5 p-4 rounded-3xl bg-white flex items-center gap-4 transition-all">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-neutral-100 shrink-0">
              <img
                src={activeSpot.photo}
                alt={activeSpot.title}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#2B9E47] mb-0.5">
                {activeSpot.category}
              </div>
              <h3 className="text-[15px] font-semibold text-[#18191b] leading-tight truncate">
                {activeSpot.title}
              </h3>
              <p className="text-[12px] text-[#6b7280] mt-1 line-clamp-2 leading-relaxed">
                {activeSpot.description}
              </p>

              <div className="flex flex-wrap gap-1 mt-2">
                {activeSpot.features.map((f, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-full bg-[#f7f7f7] text-[10px] text-[#2d3134] font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={() => onOpenBookingModal(`Локация: ${activeSpot.title}`)}
              className="w-9 h-9 rounded-full bg-[#f7f7f7] hover:bg-[#2B9E47] hover:text-white flex items-center justify-center text-[#18191b] transition-colors shrink-0"
              title="Забронировать"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Building Selector Pills */}
          <div className="lg:col-span-7 flex flex-wrap items-center content-center gap-2">
            {MAP_SPOTS.map((spot) => {
              const isActive = activeSpotId === spot.id;

              return (
                <button
                  key={spot.id}
                  onClick={() => setActiveSpotId(spot.id)}
                  className={`px-3.5 py-2 rounded-2xl text-[12px] font-medium flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-[#18191b] text-white shadow-sm'
                      : 'bg-white text-[#18191b] hover:bg-neutral-100'
                  }`}
                >
                  <MapPin className={`w-3.5 h-3.5 ${isActive ? 'text-[#2B9E47]' : 'text-[#6b7280]'}`} />
                  <span>{spot.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
