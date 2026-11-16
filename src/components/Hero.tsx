'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

export default function Hero() {
  const t = useTranslations('hero');
  const video = useRef<HTMLVideoElement>(null);
  // Follows the video's own play/pause events, so it is right even when autoplay is blocked.
  const [playing, setPlaying] = useState(false);

  // Respect reduced motion: show the still frame instead.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) video.current?.pause();
  }, []);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  return (
    <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-ink text-paper">
      <video
        ref={video}
        className="absolute inset-0 size-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/hero-poster.jpg"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      >
        <source src="/media/hero-960.mp4" type="video/mp4" media="(max-width: 767px)" />
        <source src="/media/hero-1280.mp4" type="video/mp4" />
      </video>
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/50 to-ink/30" />

      <div className="relative mx-auto w-full max-w-6xl px-6 pt-32 pb-16 md:pb-24">
        <h1 className="max-w-[18ch] text-[2.25rem] leading-[1.1] font-light md:text-[3.5rem]">{t('title')}</h1>
        <p className="mt-6 max-w-[52ch] text-[15px] leading-relaxed text-paper/90 md:text-[16px]">{t('lead')}</p>
        <a
          href="#contact"
          className="mt-10 inline-block rounded-[4px] bg-paper px-7 py-3 text-[14px] font-medium text-ink transition-colors hover:bg-cream"
        >
          {t('cta')}
        </a>
      </div>

      <button
        type="button"
        onClick={toggle}
        className="absolute right-6 bottom-6 z-10 rounded-[4px] border border-paper/60 px-3 py-1.5 text-[12px] text-paper hover:bg-paper/10"
      >
        {playing ? t('pause') : t('play')}
      </button>
    </section>
  );
}
