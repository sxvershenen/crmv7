import React, { useState } from 'react';
import { ArrowRight, Compass, Flame, Home, Layers, MapPin, Sparkles } from 'lucide-react';
import { SiteSectionHeader } from '@crm/site-ui';
import { MAP_SPOTS, type MapSpot } from '../../data/resortData';

interface TerritoryMapSectionProps { onOpenBookingModal: (title?: string) => void; }

const SpotIcon = ({ category, size = 18 }: { category: string; size?: number }) => {
  if (category === 'Глэмпинг') return <Home size={size} strokeWidth={1.9} />;
  if (category === 'СПА комплекс') return <Flame size={size} strokeWidth={1.9} />;
  if (category === 'Площадка') return <Layers size={size} strokeWidth={1.9} />;
  return <Sparkles size={size} strokeWidth={1.9} />;
};

export const TerritoryMapSection: React.FC<TerritoryMapSectionProps> = ({ onOpenBookingModal }) => {
  const [activeSpotId, setActiveSpotId] = useState(MAP_SPOTS[0]!.id);
  const activeSpot: MapSpot = MAP_SPOTS.find((spot) => spot.id === activeSpotId) ?? MAP_SPOTS[0]!;

  return <section id="map" data-section-key="map" className="w-full py-8">
    <SiteSectionHeader eyebrow="Схема" eyebrowIcon={<Compass className="w-3 h-3" />} eyebrowTone="brand" title="Карта базы" description={<>Нажмите на&nbsp;кругляш — покажем, что это за&nbsp;строение и&nbsp;где оно стоит.</>} />
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
      <div className="lg:col-span-8 relative rounded-[var(--site-radius-xl)] overflow-hidden bg-green-soft aspect-[4/3] lg:aspect-[16/9]">
        <svg viewBox="0 0 800 450" className="absolute inset-0 w-full h-full" preserveAspectRatio="none" aria-hidden="true">
          <ellipse cx="180" cy="120" rx="170" ry="100" fill="#d2ead9" /><ellipse cx="620" cy="90" rx="200" ry="90" fill="#d2ead9" /><ellipse cx="300" cy="330" rx="240" ry="110" fill="#d2ead9" />
          <path d="M-10 400 C 120 360, 200 430, 330 380 S 560 300, 640 330 S 760 380, 820 340" stroke="#bfe0f4" strokeWidth="26" fill="none" strokeLinecap="round" />
          <path d="M 820 380 C 700 350, 660 250, 560 220 S 380 140, 260 170 S 150 210, 120 250" stroke="#fff" strokeWidth="14" fill="none" strokeLinecap="round" /><path d="M 820 380 C 700 350, 660 250, 560 220 S 380 140, 260 170 S 150 210, 120 250" stroke="#e8f0ea" strokeWidth="2" strokeDasharray="10 12" fill="none" />
          {[[60,60],[110,40],[250,70],[300,50],[560,50],[700,60],[740,120],[90,320],[150,380],[420,300],[470,340],[230,290]].map(([x,y], i) => <g key={i}><circle cx={x} cy={y} r="10" fill="#2b9e47" opacity=".32" /><circle cx={x} cy={y} r="4" fill="#2b9e47" opacity=".5" /></g>)}
          <text x="30" y="430" fontSize="12" fill="#5c665f" fontFamily="Inter">река Быстрица</text><text x="620" y="440" fontSize="12" fill="#5c665f" fontFamily="Inter">въезд →</text>
        </svg>
        {MAP_SPOTS.map((spot) => { const on = spot.id === activeSpotId; return <button key={spot.id} type="button" onClick={() => setActiveSpotId(spot.id)} aria-label={spot.title} className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group" style={{ left: `${spot.x}%`, top: `${spot.y}%` }}>
          {on && <span className="absolute inset-0 rounded-full bg-green animate-ping opacity-30" />}
          <span className={`relative w-11 h-11 lg:w-12 lg:h-12 rounded-full inline-flex items-center justify-center transition-all duration-300 ${on ? 'bg-green text-white scale-110' : 'bg-surface text-ink group-hover:bg-green group-hover:text-white group-hover:scale-105'}`}><SpotIcon category={spot.category} /></span>
          <span className={`absolute left-1/2 -translate-x-1/2 top-full mt-1.5 whitespace-nowrap text-[11px] font-medium px-2 h-6 rounded-full bg-surface inline-flex items-center transition-opacity ${on ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{spot.title}</span>
        </button>; })}
      </div>
      <div className="lg:col-span-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">{MAP_SPOTS.map((spot) => <button key={spot.id} type="button" onClick={() => setActiveSpotId(spot.id)} aria-pressed={spot.id === activeSpotId} className={`chip !h-8 ${spot.id === activeSpotId ? '!bg-green !text-white' : ''}`}><MapPin size={13} />{spot.title}</button>)}</div>
        <div key={activeSpot.id} className="card group/card flex items-center gap-3 lg:flex-col lg:items-stretch animate-in fade-in slide-in-from-bottom-2 duration-300">
          <span className="card-img relative w-[92px] h-[92px] lg:w-full lg:h-auto lg:aspect-[16/10] shrink-0"><img src={activeSpot.photo} alt={activeSpot.title} loading="lazy" /><button type="button" onClick={() => onOpenBookingModal(`Локация: ${activeSpot.title}`)} className="arrow-bubble green absolute right-2 top-2 z-10 hidden lg:inline-flex" title="Забронировать" aria-label={`Забронировать: ${activeSpot.title}`}><ArrowRight size={16} /></button></span>
          <span className="flex-1 min-w-0 lg:px-2 lg:pt-3 lg:pb-2 flex flex-col gap-1"><span className="flex items-center gap-2"><span className="icon-tile !w-7 !h-7 !rounded-[var(--site-radius-xs)] hidden lg:inline-flex"><SpotIcon category={activeSpot.category} size={14} /></span><h3 className="text-[16px] font-semibold tracking-[-.4px] leading-tight">{activeSpot.title}</h3></span><span className="text-[12px] lg:text-[13px] text-ink-2 line-clamp-2 lg:line-clamp-3">{activeSpot.description}</span></span>
        </div>
      </div>
    </div>
  </section>;
};
