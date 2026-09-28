import React, { useRef, useState } from 'react';
import { ArrowRight, MessageSquare, Play, Star, Volume2, VolumeX } from 'lucide-react';
import type { CmsHomeSectionConfig } from '@crm/contracts';
import { SiteSectionHeader } from '@crm/site-ui';
import { VIDEO_REELS } from '../../data/resortData';

export const ReviewsSection: React.FC<{ config: CmsHomeSectionConfig; fixture?: boolean }> = ({ config, fixture = false }) => {
  const [openReview, setOpenReview] = useState<string | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState(false);
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const activeVideo = VIDEO_REELS[activeVideoIdx] ?? VIDEO_REELS[0]!;

  const reviews = config.reviews ?? [];
  const averageRating = reviews.length ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length : 0;
  const photos = fixture ? [] : (config.cards ?? []).filter((card) => card.imageUrl);
  const activePhoto = photos.find((photo) => photo.id === activePhotoId) ?? photos[0];
  const selectMedia = (id: string) => { videoRef.current?.pause(); setPlaying(false); setVideoError(false); setActivePhotoId(id); };
  const toggleVideo = async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) { video.pause(); return; }
    try { await video.play(); } catch { setVideoError(true); }
  };
  if (!reviews.length) return null;

  return (
    <section id="reviews" data-section-key="reviews" className="w-full py-8">
      <SiteSectionHeader eyebrow={config.eyebrow} eyebrowIcon={<MessageSquare className="w-3 h-3" />} eyebrowTone="brand" title={config.title} description={config.description} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        <div className={fixture || photos.length ? "lg:col-span-5 flex flex-col gap-3" : "lg:col-span-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3"}>
          {fixture && <a href="https://yandex.ru/maps" target="_blank" rel="noreferrer" className="group bg-surface rounded-[var(--site-radius-xl)] p-4 flex items-center gap-4 hover:-translate-y-[3px] transition-transform">
            <span className="w-12 h-12 rounded-[var(--site-radius-sm)] bg-[var(--site-color-accent-red)] text-white inline-flex items-center justify-center text-[22px] font-semibold shrink-0">Я</span>
            <span className="flex-1 min-w-0"><span className="flex items-center gap-2"><span className="text-[22px] font-semibold tracking-[-.8px] leading-none">4.9 из 5.0</span><span className="flex gap-0.5 text-[var(--site-color-accent-amber)]">{Array.from({ length: 5 }).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}</span></span><span className="block text-[12px] text-ink-2 mt-1">480+ проверенных отзывов на Яндекс Картах</span></span>
            <span className="btn btn-soft group-hover:bg-green-soft group-hover:text-green-deep max-sm:!px-0 max-sm:!w-11"><span className="max-sm:hidden">Смотреть</span><span className="btn-arrow max-sm:!bg-transparent max-sm:!text-ink"><ArrowRight size={15} /></span></span>
          </a>}
          {!fixture && <div data-review-summary className="bg-surface rounded-[var(--site-radius-xl)] p-4 flex items-center gap-4">
            <span className="w-12 h-12 rounded-[var(--site-radius-sm)] bg-green-soft text-green-deep inline-flex items-center justify-center shrink-0"><MessageSquare size={22} aria-hidden="true" /></span>
            <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="text-[22px] font-semibold tracking-[-.8px] leading-none">{averageRating.toFixed(1)} из 5.0</span><span className="flex gap-0.5 text-[var(--site-color-accent-amber)]">{Array.from({ length: 5 }).map((_, index) => <Star key={index} size={14} fill={index < Math.round(averageRating) ? "currentColor" : "none"} />)}</span></span><span className="block text-[12px] text-ink-2 mt-1">Всего отзывов на сайте: {reviews.length}</span></span>
          </div>}
          {reviews.map((review) => {
            const isOpen = openReview === review.id;
            return <button data-review-card type="button" key={review.id} onMouseEnter={() => setOpenReview(review.id)} onFocus={(event) => { if (event.currentTarget.matches(':focus-visible')) setOpenReview(review.id); }} onClick={() => setOpenReview(isOpen ? null : review.id)} aria-expanded={isOpen} aria-label={`Отзыв: ${review.name}`} className="bg-surface rounded-[var(--site-radius-xl)] p-3 cursor-pointer text-left transition-transform duration-[var(--site-motion-normal)] ease-[var(--ease-spring)] hover:-translate-y-px">
              <span className="flex items-center gap-3"><span className="w-11 h-11 rounded-full bg-green-soft inline-flex items-center justify-center shrink-0">{review.avatarUrl ? <img src={review.avatarUrl} alt="" loading="lazy" className="w-11 h-11 rounded-full object-cover shrink-0" /> : <MessageSquare size={20} aria-hidden="true" />}</span><span className="flex-1 min-w-0"><span className="block text-[14px] font-semibold tracking-[-.3px] leading-tight">{review.name}</span>{(review.date || review.sourceLabel) && <span className="block text-[11px] text-ink-3 mt-0.5">{[review.date, review.sourceLabel].filter(Boolean).join(" · ")}</span>}</span><span className="flex items-center gap-1 text-[13px] font-semibold"><Star size={13} className="text-[var(--site-color-accent-amber)]" fill="currentColor" /> {review.rating}.0</span></span>
              <span data-review-body className={`grid pl-[56px] overflow-hidden transition-[grid-template-rows,opacity,margin] duration-500 ease-[var(--site-ease)] text-[12px] ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-2 text-ink-2' : 'grid-rows-[0fr] opacity-0 mt-0 text-ink-3'}`}><span className="min-h-0 overflow-hidden leading-relaxed">{review.text}</span></span>
              <span aria-hidden="true" className={`block pl-[56px] overflow-hidden whitespace-nowrap text-ellipsis text-[12px] text-ink-3 transition-[height,opacity,padding] duration-500 ease-[var(--site-ease)] ${isOpen ? 'h-0 opacity-0 pt-0' : 'h-5 opacity-70 pt-1'}`}>{review.text}</span>
            </button>;
          })}
        </div>
        {fixture && <div className="lg:col-span-7 flex flex-col gap-3">
          <button type="button" onClick={() => setPlaying((value) => !value)} className="relative rounded-[var(--site-radius-xl)] overflow-hidden aspect-video group cursor-pointer text-left" aria-label={playing ? 'Пауза' : 'Смотреть'}>
            <img src={activeVideo.thumbnail} alt={activeVideo.title} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${playing ? 'scale-105' : 'group-hover:scale-105'}`} /><span className="absolute inset-0 bg-black/25" /><span className="absolute left-4 top-4 chip on-img">{activeVideo.title}</span><span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-surface text-ink inline-flex items-center justify-center transition-all duration-300 ${playing ? 'opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100' : 'group-hover:bg-green group-hover:text-white group-hover:scale-105'}`}><Play size={22} className="ml-1" fill="currentColor" /></span><span className="absolute right-4 bottom-4 w-10 h-10 rounded-full bg-surface text-ink inline-flex items-center justify-center hover:bg-green hover:text-white transition-colors" onClick={(event) => { event.stopPropagation(); setMuted((value) => !value); }}>{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</span>
          </button>
          <div className="grid grid-cols-4 gap-2">{VIDEO_REELS.map((video, idx) => <button key={video.id} type="button" onClick={() => { setActiveVideoIdx(idx); setPlaying(false); }} className={`group relative rounded-[var(--site-radius-md)] overflow-hidden aspect-video text-left transition-all ${idx === activeVideoIdx ? 'outline outline-[3px] outline-green outline-offset-[-3px]' : 'opacity-80 hover:opacity-100'}`}><img src={video.thumbnail} alt={video.title} loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" /><span className="absolute inset-0 bg-black/30" /><span className="absolute left-2 bottom-2 right-2 text-white text-[11px] font-medium truncate leading-tight">{video.title}</span></button>)}</div>
        </div>}
        {!fixture && activePhoto && <div className="lg:col-span-7 flex flex-col gap-3">
          {activePhoto.videoUrl ? <div className="relative rounded-[var(--site-radius-xl)] overflow-hidden aspect-video bg-black">
            <video key={activePhoto.id} ref={videoRef} src={activePhoto.videoUrl} poster={activePhoto.imageUrl} preload="none" playsInline muted={muted} controls={playing} aria-label={`Видео: ${activePhoto.title}`} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setVideoError(true); }} className="h-full w-full object-cover" />
            {!playing && !videoError && <button type="button" onClick={() => void toggleVideo()} aria-label={`Смотреть видео: ${activePhoto.title}`} className="absolute inset-0 flex items-center justify-center bg-black/20 text-white transition-colors hover:bg-black/30"><span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface text-ink"><Play size={22} className="ml-1" fill="currentColor" /></span></button>}
            {videoError && <div role="alert" className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-lg bg-black/80 p-3 text-sm text-white"><span>Видео не загрузилось.</span><button type="button" onClick={() => { setVideoError(false); videoRef.current?.load(); void toggleVideo(); }} className="shrink-0 underline underline-offset-2">Повторить</button></div>}
            <span className="pointer-events-none absolute left-4 top-4 chip on-img">{activePhoto.title}</span>
            {!playing && !videoError && <button type="button" aria-label={muted ? "Включить звук" : "Выключить звук"} onClick={() => setMuted((value) => !value)} className="absolute bottom-4 right-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink">{muted ? <VolumeX size={16} /> : <Volume2 size={16} />}</button>}
          </div> : <figure className="relative rounded-[var(--site-radius-xl)] overflow-hidden aspect-video bg-bg">
            <img src={activePhoto.imageUrl} alt={activePhoto.title} className="w-full h-full object-cover" loading="lazy" />
            <figcaption className="absolute bottom-3 left-3 right-3 rounded-lg bg-black/65 p-2 text-sm text-white">{activePhoto.title}</figcaption>
          </figure>}
          {photos.length > 1 && <div className="grid grid-cols-4 gap-2">{photos.map((photo) => <button key={photo.id} type="button" onClick={() => selectMedia(photo.id)} aria-label={`${photo.videoUrl ? "Выбрать видео" : "Показать фото"}: ${photo.title}`} aria-pressed={photo.id === activePhoto.id} className={`relative rounded-[var(--site-radius-md)] overflow-hidden aspect-video ${photo.id === activePhoto.id ? "outline outline-[3px] outline-green outline-offset-[-3px]" : "opacity-80 hover:opacity-100"}`}><img src={photo.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />{photo.videoUrl && <span className="absolute inset-0 flex items-center justify-center text-white"><Play size={20} fill="currentColor" /></span>}</button>)}</div>}
        </div>}
      </div>
    </section>
  );
};
