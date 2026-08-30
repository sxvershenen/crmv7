import React, { useState } from 'react';
import { Flame, Plus, Check } from 'lucide-react';
import { SAUNA_CHAN_DATA } from '../../data/resortData';

interface SaunaChanSectionProps {
  onAddAddon: (addonName: string) => void;
  onOpenBookingModal?: (itemName?: string) => void;
  onToast: (msg: string) => void;
}

export const SaunaChanSection: React.FC<SaunaChanSectionProps> = ({
  onAddAddon,
  onToast
}) => {
  const [activeTabs, setActiveTabs] = useState<{ [key: string]: string }>({
    sauna: "perks",
    chan: "perks"
  });

  const [hoveredPhotoIdx, setHoveredPhotoIdx] = useState<{ [key: string]: number }>({
    sauna: 0,
    chan: 0
  });

  const [addedItems, setAddedItems] = useState<{ [key: string]: boolean }>({});

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, key: string, count: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const segmentWidth = rect.width / count;
    const index = Math.min(Math.floor(x / segmentWidth), count - 1);
    setHoveredPhotoIdx((prev) => ({ ...prev, [key]: index }));
  };

  const handleAdd = (name: string, key: string) => {
    onAddAddon(name);
    setAddedItems((prev) => ({ ...prev, [key]: true }));
    onToast(`«${name}» добавлено в ваш план отдыха!`);
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [key]: false }));
    }, 2500);
  };

  const items = [
    { key: "sauna", data: SAUNA_CHAN_DATA.sauna, tag: "Парная на дровах" },
    { key: "chan", data: SAUNA_CHAN_DATA.chan, tag: "Купель под звёздами" }
  ];

  return (
    <section id="sauna" className="w-full py-8">
      {/* Block Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-[#18191b] mb-2.5">
          <Flame className="w-3 h-3 text-[#EE2F2E]" />
          СПА и здоровье
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#18191b] leading-tight tracking-tight">
            Баня и горячий чан
          </h2>
          <p className="hidden md:block text-[13px] text-[#6b7280] max-w-md font-normal leading-relaxed text-left md:text-right">
            Целебный хвойный пар, березовые веники и&nbsp;горячая купель с&nbsp;пихтой прямо под открытым небом
          </p>
        </div>
      </div>

      {/* 2 Blocks Side-by-Side on Desktop / Swiper on Mobile */}
      <div className="flex md:grid md:grid-cols-2 gap-6 overflow-x-auto md:overflow-visible pb-4 md:pb-0 snap-swiper no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        {items.map(({ key, data, tag }) => {
          const activeTab = activeTabs[key] || "perks";
          const activePhoto = hoveredPhotoIdx[key] || 0;
          const isAdded = addedItems[key];
          const activeTabContent = data.tabs.find((t) => t.id === activeTab)?.content;

          return (
            <div
              key={key}
              className="w-[300px] sm:w-[360px] md:w-auto shrink-0 snap-swiper-card p-3 md:p-3.5 rounded-3xl bg-white flex flex-col justify-between"
            >
              <div>
                {/* Photo with hover segments */}
                <div
                  onMouseMove={(e) => handleMouseMove(e, key, data.photos.length)}
                  onMouseLeave={() => setHoveredPhotoIdx((prev) => ({ ...prev, [key]: 0 }))}
                  className="relative h-[220px] sm:h-[260px] w-full rounded-2xl overflow-hidden bg-neutral-100 mb-4 select-none"
                >
                  <img
                    src={data.photos[activePhoto]}
                    alt={data.title}
                    className="w-full h-full object-cover transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                  {/* Tag */}
                  <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-xs text-[11px] font-semibold text-[#18191b]">
                    {tag}
                  </div>

                  {/* Photo Dash Indicators */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 z-10">
                    {data.photos.map((_, pIdx) => (
                      <div
                        key={pIdx}
                        className={`h-1 rounded-full flex-1 transition-all ${
                          activePhoto === pIdx ? 'bg-white' : 'bg-white/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="px-1.5">
                  <h3 className="text-[19px] font-semibold text-[#18191b] leading-snug mb-2">
                    {data.title}
                  </h3>

                  <p className="text-[13px] text-[#6b7280] leading-relaxed mb-4 line-clamp-2">
                    {data.description}
                  </p>

                  {/* Interactive Tabs: [Преимущества | Как проходит | Безопасность] */}
                  <div className="mb-4">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-[#f7f7f7] mb-2.5">
                      {data.tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTabs((prev) => ({ ...prev, [key]: tab.id }))}
                          className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all ${
                            activeTab === tab.id
                              ? 'bg-white text-[#18191b] shadow-xs'
                              : 'text-[#6b7280] hover:text-[#18191b]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {/* Tab Content */}
                    <div className="p-3 rounded-xl bg-[#f7f7f7] text-[12px] text-[#2d3134] leading-relaxed min-h-[64px]">
                      {activeTabContent}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom: Price + CTA Добавить [+] */}
              <div className="pt-3 border-t border-neutral-100 flex items-center justify-between px-1.5">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-[#6b7280] tracking-wider">
                    Стоимость
                  </div>
                  <div className="text-[20px] font-semibold text-[#18191b] tracking-tight">
                    {data.priceFrom}
                  </div>
                </div>

                {/* Add CTA */}
                <button
                  onClick={() => handleAdd(data.title, key)}
                  className={`h-[40px] px-4 rounded-full text-[13px] font-medium flex items-center gap-2 transition-all ${
                    isAdded
                      ? 'bg-[#2B9E47] text-white'
                      : 'bg-[#f7f7f7] hover:bg-[#2B9E47] hover:text-white text-[#18191b]'
                  }`}
                >
                  <span>{isAdded ? 'Добавлено' : 'Добавить'}</span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    isAdded ? 'bg-white/20' : 'bg-white'
                  }`}>
                    {isAdded ? (
                      <Check className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-[#18191b]" />
                    )}
                  </div>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
