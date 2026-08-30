import React, { useState } from 'react';
import { Layers, Users, ArrowUpRight, Filter, ChevronDown } from 'lucide-react';
import { VENUES, VenueItem } from '../../data/resortData';

interface VenuesSectionProps {
  onOpenBookingModal: (venueTitle?: string) => void;
}

export const VenuesSection: React.FC<VenuesSectionProps> = ({ onOpenBookingModal }) => {
  const [capacityFilter, setCapacityFilter] = useState<'all' | 'small' | 'medium' | 'large'>('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const filteredVenues = VENUES.filter((venue) => {
    if (capacityFilter === 'small') return venue.capacityNumber <= 30;
    if (capacityFilter === 'medium') return venue.capacityNumber > 30 && venue.capacityNumber <= 70;
    if (capacityFilter === 'large') return venue.capacityNumber > 70;
    return true;
  });

  return (
    <section id="venues" className="w-full py-8">
      {/* Block Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-[#18191b] mb-2.5">
            <Layers className="w-3 h-3 text-[#18191b]" />
            Локации для аренды
          </div>

          <div className="flex flex-col md:flex-row md:items-end gap-2 md:gap-4">
            <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#18191b] leading-tight tracking-tight">
              Площадки и залы
            </h2>
            <p className="hidden md:block text-[13px] text-[#6b7280] max-w-md font-normal leading-relaxed">
              От уютных лесных беседок у мангала до панорамного банкетного зала на 150 гостей
            </p>
          </div>
        </div>

        {/* Dropdown Sort by Capacity & Format */}
        <div className="relative shrink-0">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="h-[40px] px-4 rounded-full bg-white text-[#18191b] text-[13px] font-medium inline-flex items-center gap-2 hover:bg-neutral-100 transition-colors"
          >
            <Filter className="w-4 h-4 text-[#18191b]" />
            <span className="hidden sm:inline">
              {capacityFilter === 'all' && 'Все площадки (5)'}
              {capacityFilter === 'small' && 'До 30 гостей'}
              {capacityFilter === 'medium' && 'От 30 до 70 гостей'}
              {capacityFilter === 'large' && 'От 70 до 300 гостей'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-[46px] w-52 bg-white rounded-2xl p-2 border border-neutral-200 shadow-xl z-30 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => {
                  setCapacityFilter('all');
                  setDropdownOpen(false);
                }}
                className={`w-full text-left p-2 rounded-xl text-[12px] font-medium transition-colors ${
                  capacityFilter === 'all' ? 'bg-[#f7f7f7] text-[#2B9E47]' : 'text-[#18191b] hover:bg-[#f7f7f7]'
                }`}
              >
                Все площадки (5)
              </button>
              <button
                onClick={() => {
                  setCapacityFilter('small');
                  setDropdownOpen(false);
                }}
                className={`w-full text-left p-2 rounded-xl text-[12px] font-medium transition-colors ${
                  capacityFilter === 'small' ? 'bg-[#f7f7f7] text-[#2B9E47]' : 'text-[#18191b] hover:bg-[#f7f7f7]'
                }`}
              >
                Камерные (до 30 человек)
              </button>
              <button
                onClick={() => {
                  setCapacityFilter('medium');
                  setDropdownOpen(false);
                }}
                className={`w-full text-left p-2 rounded-xl text-[12px] font-medium transition-colors ${
                  capacityFilter === 'medium' ? 'bg-[#f7f7f7] text-[#2B9E47]' : 'text-[#18191b] hover:bg-[#f7f7f7]'
                }`}
              >
                Средние (до 70 человек)
              </button>
              <button
                onClick={() => {
                  setCapacityFilter('large');
                  setDropdownOpen(false);
                }}
                className={`w-full text-left p-2 rounded-xl text-[12px] font-medium transition-colors ${
                  capacityFilter === 'large' ? 'bg-[#f7f7f7] text-[#2B9E47]' : 'text-[#18191b] hover:bg-[#f7f7f7]'
                }`}
              >
                Масштабные (до 300 человек)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 5 Cards Row on Desktop / Swiper on Mobile */}
      <div className="flex lg:grid lg:grid-cols-5 gap-4 overflow-x-auto lg:overflow-visible pb-4 lg:pb-0 snap-swiper no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
        {filteredVenues.map((venue: VenueItem) => (
          <div
            key={venue.id}
            onClick={() => onOpenBookingModal(`Площадка: ${venue.title}`)}
            className="w-[260px] sm:w-[280px] lg:w-auto shrink-0 snap-swiper-card p-3 rounded-3xl bg-white flex flex-col justify-between cursor-pointer group transition-transform"
          >
            <div>
              {/* Image with 8-12px padding inside card */}
              <div className="relative h-[180px] w-full rounded-2xl overflow-hidden bg-neutral-100 mb-3.5">
                <img
                  src={venue.photo}
                  alt={venue.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />

                {/* Arrow Icon in bubble */}
                <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-[#18191b] group-hover:bg-[#2B9E47] group-hover:text-white transition-colors">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>

                {/* Area badge */}
                <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] text-white font-medium">
                  {venue.area}
                </div>
              </div>

              {/* Title & Capacity Bubble */}
              <div className="flex items-center justify-between gap-1.5 mb-1.5 px-1">
                <h3 className="text-[15px] font-semibold text-[#18191b] group-hover:text-[#2B9E47] transition-colors leading-tight truncate">
                  {venue.title}
                </h3>
                {/* Guest bubble with user icon + capacity */}
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f7f7f7] text-[11px] font-medium text-[#18191b] shrink-0">
                  <Users className="w-3 h-3 text-[#2B9E47]" />
                  <span>{venue.capacityNumber}</span>
                </div>
              </div>

              {/* Short Description */}
              <p className="text-[12px] text-[#6b7280] leading-relaxed line-clamp-2 mb-3 px-1">
                {venue.shortDesc}
              </p>

              {/* Suitable-for bubbles */}
              <div className="flex flex-wrap gap-1 px-1 mb-2">
                {venue.suitableFor.map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-full bg-[#f7f7f7] text-[10px] font-medium text-[#2d3134]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Bottom action trigger */}
            <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-[11px] font-medium text-[#2B9E47] px-1">
              <span>Забронировать зал</span>
              <ArrowUpRight className="w-3 h-3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
