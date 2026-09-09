import { useEffect, useRef } from 'react';

export const useSwipeHint = () => {
  const swiperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = swiperRef.current;
    if (!element) return;

    let returnTimer: number | undefined;
    let finishTimer: number | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting || element.scrollWidth <= element.clientWidth) return;

        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          element.dataset.swipeHint = 'playing';
          element.scrollTo({ left: Math.min(72, element.scrollWidth - element.clientWidth), behavior: 'smooth' });
          returnTimer = window.setTimeout(() => element.scrollTo({ left: 0, behavior: 'smooth' }), 700);
          finishTimer = window.setTimeout(() => { element.dataset.swipeHint = 'done'; }, 1400);
        } else element.dataset.swipeHint = 'disabled';
        observer.disconnect();
      },
      { threshold: 0.3 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (returnTimer !== undefined) window.clearTimeout(returnTimer);
      if (finishTimer !== undefined) window.clearTimeout(finishTimer);
    };
  }, []);

  return swiperRef;
};
