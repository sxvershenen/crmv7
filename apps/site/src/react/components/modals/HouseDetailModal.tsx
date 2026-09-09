import React, { useEffect, useState } from 'react';
import { X, Users, CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { HouseItem } from '../../data/resortData';
import { useDialogBehavior } from '../../utils/useDialogBehavior';

interface HouseDetailModalProps {
  house: HouseItem | null;
  isOpen: boolean;
  onClose: () => void;
  onBook: (title: string) => void;
}

export const HouseDetailModal: React.FC<HouseDetailModalProps> = ({
  house,
  isOpen,
  onClose,
  onBook
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const dialogRef = useDialogBehavior(isOpen, onClose);

  useEffect(() => setActivePhotoIndex(0), [house?.id]);

  if (!isOpen || !house) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/50 backdrop-blur-xs overflow-y-auto" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="house-dialog-title"
        className="relative w-full max-w-3xl bg-white rounded-3xl p-5 md:p-8 my-auto animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-20 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 md:bg-[#f7f7f7] text-[#18191b] hover:bg-neutral-200 transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Gallery */}
        <div className="relative mb-6 rounded-2xl overflow-hidden bg-neutral-100">
          <div className="h-[240px] md:h-[360px] w-full">
            <img 
              src={house.photos[activePhotoIndex] || house.photos[0]} 
              alt={house.title} 
              className="w-full h-full object-cover transition-all duration-300"
            />
          </div>

          {/* Photo Thumbnails */}
          {house.photos.length > 1 && (
            <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 p-1.5 rounded-xl bg-black/40 backdrop-blur-xs w-max mx-auto">
              {house.photos.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePhotoIndex(idx)}
                  aria-label={`Показать фото ${idx + 1} из ${house.photos.length}`}
                  aria-current={activePhotoIndex === idx ? "true" : undefined}
                  className={`w-12 h-8 rounded-lg overflow-hidden border-2 transition-all ${
                    activePhotoIndex === idx ? 'border-white scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Capacity badge */}
          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-xs text-[12px] font-medium text-[#18191b] flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#2B9E47]" />
            {house.capacityNumber}
          </div>
        </div>

        {/* Header & Title */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
          <div>
            <h2 id="house-dialog-title" className="text-[26px] md:text-[30px] font-semibold text-[#18191b] leading-tight">
              {house.title}
            </h2>
            <p className="text-[14px] text-[#6b7280] mt-1">
              {house.undertitle}
            </p>
          </div>

          <div className="shrink-0 text-left md:text-right">
            <div className="text-[11px] uppercase tracking-wider text-[#6b7280] font-medium">Стоимость суток</div>
            <div className="text-[26px] font-semibold text-[#2B9E47] tracking-tight">
              от {house.priceFrom.toLocaleString('ru-RU')} ₽
            </div>
          </div>
        </div>

        {/* Availability Schedule */}
        <div className="mb-6 p-4 rounded-2xl bg-[#f7f7f7]">
          <div className="text-[12px] font-medium text-[#18191b] mb-2.5 flex items-center justify-between">
            <span>Доступность на ближайшие 5 дней:</span>
            <span className="text-[11px] text-[#6b7280]">Обновлено сегодня</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {house.availability.map((item, idx) => (
              <div 
                key={idx}
                className={`py-2 px-1 text-center rounded-xl text-xs font-semibold flex flex-col items-center justify-center gap-1 ${
                  item.available 
                    ? 'bg-[#2B9E47] text-white' 
                    : 'bg-neutral-200 text-neutral-400 line-through'
                }`}
              >
                <span>{item.day}</span>
                <span className="text-[10px] font-normal">
                  {item.available ? 'Свободно' : 'Занято'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-6">
          <h4 className="text-[14px] font-semibold text-[#18191b] mb-2">О доме</h4>
          <p className="text-[13px] text-[#2d3134] leading-relaxed">
            {house.detailedDescription}
          </p>
        </div>

        {/* Specs Grid */}
        <div className="mb-6">
          <h4 className="text-[14px] font-semibold text-[#18191b] mb-2.5">Характеристики и удобства</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-[13px]">
            {house.specs.map((s, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2.5 rounded-xl bg-[#f7f7f7]">
                <CheckCircle className="w-4 h-4 text-[#2B9E47] shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-[#18191b]">{s.label}: </span>
                  <span className="text-[#6b7280]">{s.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security & Cleanliness note */}
        <div className="mb-6 flex items-center gap-2.5 text-[12px] text-[#6b7280] bg-neutral-50 p-3 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-[#2B9E47] shrink-0" />
          <span>Перед каждым заездом проводится озонирование, смена белья премиум-сатин и дезинфекция чана.</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-neutral-100">
          <button
            onClick={() => {
              onClose();
              onBook(house.title);
            }}
            className="w-full sm:flex-1 h-[48px] px-6 rounded-full bg-[#2B9E47] text-white text-[14px] font-medium flex items-center justify-center gap-3 hover:bg-[#23823a] transition-all group"
          >
            <span>Забронировать {house.title}</span>
            <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-0.5 transition-transform">
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </button>
          
          <button
            onClick={onClose}
            className="w-full sm:w-auto h-[48px] px-6 rounded-full bg-[#f7f7f7] text-[#18191b] text-[13px] font-medium hover:bg-neutral-200 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
