import React, { useState } from 'react';
import { Star, MessageSquare, ArrowUpRight, Play } from 'lucide-react';
import { REVIEWS_DATA, VIDEO_REELS, ReviewItem } from '../../data/resortData';

export const ReviewsSection: React.FC = () => {
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);

  const activeVideo = VIDEO_REELS[activeVideoIdx] ?? VIDEO_REELS[0]!;

  return (
    <section id="reviews" className="w-full py-8">
      {/* Block Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-[10px] font-semibold tracking-wider uppercase text-[#18191b] mb-2.5">
          <MessageSquare className="w-3 h-3 text-[#2B9E47]" />
          Репутация и видео
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 md:gap-4">
          <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#18191b] leading-tight tracking-tight">
            Отзывы и живая атмосфера
          </h2>
          <p className="hidden md:block text-[13px] text-[#6b7280] max-w-md font-normal leading-relaxed text-left md:text-right">
            Честные впечатления наших гостей и&nbsp;видеоэкскурсии по&nbsp;территории базы
          </p>
        </div>
      </div>

      {/* Main Grid: Reviews on Left / 16:9 Video Switcher on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Yandex Badge + Verified Reviews */}
        <div className="lg:col-span-6 space-y-3">
          {/* Yandex Maps Trust Card */}
          <a
            href="https://yandex.ru/maps"
            target="_blank"
            rel="noreferrer"
            className="p-5 rounded-3xl bg-white flex items-center justify-between hover:scale-[1.01] transition-transform group"
          >
            <div className="flex items-center gap-3.5">
              {/* Yandex Red Pill Logo */}
              <div className="w-12 h-12 rounded-2xl bg-[#EE2F2E] text-white flex items-center justify-center font-bold text-xl shrink-0">
                Я
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[22px] font-semibold text-[#18191b] tracking-tight">
                    4.9 из 5.0
                  </span>
                  <div className="flex items-center text-[#FAAB2B]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                </div>
                <div className="text-[12px] text-[#6b7280] mt-0.5">
                  480+ проверенных отзывов на Яндекс Картах
                </div>
              </div>
            </div>

            <div className="w-8 h-8 rounded-full bg-[#f7f7f7] group-hover:bg-[#EE2F2E] group-hover:text-white flex items-center justify-center text-[#18191b] transition-colors shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </a>

          {/* Review Cards List */}
          <div className="space-y-3">
            {REVIEWS_DATA.map((rev) => (
              <div
                key={rev.id}
                onClick={() => setSelectedReview(rev)}
                className="p-4 rounded-3xl bg-white cursor-pointer group transition-all"
              >
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={rev.avatar}
                      alt={rev.name}
                      className="w-9 h-9 rounded-full object-cover border border-neutral-100"
                    />
                    <div>
                      <div className="text-[13px] font-semibold text-[#18191b] group-hover:text-[#2B9E47] transition-colors">
                        {rev.name}
                      </div>
                      <div className="text-[11px] text-[#6b7280]">
                        {rev.date} • <span className="text-[#2B9E47]">{rev.houseOrEvent}</span>
                      </div>
                    </div>
                  </div>

                  {/* Rating Stars */}
                  <div className="flex items-center text-[#FAAB2B]">
                    {[...Array(rev.rating)].map((_, idx) => (
                      <Star key={idx} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                </div>

                <p className="text-[12px] text-[#2d3134] leading-relaxed line-clamp-3">
                  «{rev.text}»
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: 16:9 Video Player & Video Switcher (no wrapper) */}
        <div className="lg:col-span-6 space-y-3">
          {/* Active 16:9 Video Canvas */}
          <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-neutral-900 shadow-sm group">
            <img
              src={activeVideo.thumbnail}
              alt={activeVideo.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/30" />

            {/* Play Button Disc */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/90 group-hover:bg-[#2B9E47] group-hover:text-white text-[#18191b] flex items-center justify-center shadow-lg transition-all transform group-hover:scale-110">
                <Play className="w-6 h-6 fill-current ml-1" />
              </div>
            </div>

            {/* Video Meta Info */}
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-white">
              <div>
                <span className="px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-xs text-[10px] font-medium uppercase tracking-wider mb-2 inline-block">
                  {activeVideo.tag}
                </span>
                <h3 className="text-[16px] font-semibold leading-snug">
                  {activeVideo.title}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-black/60 text-[11px] font-mono">
                {activeVideo.duration}
              </span>
            </div>
          </div>

          {/* Video Switcher Thumbnails (4 items) */}
          <div className="grid grid-cols-4 gap-2">
            {VIDEO_REELS.map((vid, idx) => {
              const isActive = activeVideoIdx === idx;

              return (
                <button
                  key={vid.id}
                  onClick={() => setActiveVideoIdx(idx)}
                  className={`relative aspect-video rounded-2xl overflow-hidden text-left transition-all ${
                    isActive ? 'ring-2 ring-[#2B9E47]' : 'opacity-80 hover:opacity-100 hover:ring-2 hover:ring-neutral-300'
                  }`}
                >
                  <img src={vid.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                  {isActive && (
                    <span className="absolute inset-0 bg-[#2B9E47]/20 flex items-center justify-center">
                      <Play className="w-3.5 h-3.5 text-white fill-white" />
                    </span>
                  )}
                  <div className="absolute bottom-1.5 left-2 right-2 text-[10px] font-medium text-white truncate">
                    {vid.tag}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Review Detail Modal */}
      {selectedReview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div 
            className="relative w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <img src={selectedReview.avatar} alt="" className="w-12 h-12 rounded-full object-cover" />
                <div>
                  <h4 className="text-[16px] font-semibold text-[#18191b]">{selectedReview.name}</h4>
                  <p className="text-[12px] text-[#6b7280]">{selectedReview.date} • {selectedReview.houseOrEvent}</p>
                </div>
              </div>
              <div className="flex text-[#FAAB2B]">
                {[...Array(selectedReview.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
            </div>

            <p className="text-[14px] text-[#2d3134] leading-relaxed mb-6">
              «{selectedReview.text}»
            </p>

            <button
              onClick={() => setSelectedReview(null)}
              className="w-full h-[40px] rounded-full bg-[#f7f7f7] hover:bg-neutral-200 text-[#18191b] text-[13px] font-medium transition-colors"
            >
              Закрыть отзыв
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
