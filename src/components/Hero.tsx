'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

/** The video opening. `children` sit along its bottom edge (the services carousel). */
export default function Hero({ children }: { children?: React.ReactNode }) {
  const t = useTranslations('hero');
  const video = useRef<HTMLVideoElement>(null);

  // Started here, not with autoPlay, so a reduced-motion visitor never sees the clip move:
  // they get the still frame. ponytail: no pause control, the owner's choice; WCAG 2.2.2
  // wants one for motion over 5 s, so add a small pause button back if an audit asks.
  useEffect(() => {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) void video.current?.play().catch(() => {});
  }, []);

  return (
    <section className="relative flex min-h-[100svh] items-end overflow-hidden bg-ink text-paper">
      <video
        ref={video}
        className="absolute inset-0 size-full object-cover"
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/hero-poster.jpg"
        aria-hidden="true"
      >
        <source src="/media/hero-960.mp4" type="video/mp4" media="(max-width: 767px)" />
        <source src="/media/hero-1280.mp4" type="video/mp4" />
      </video>
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/50 to-ink/30" />

      <div className="relative mx-auto w-full max-w-6xl px-6 pt-32 pb-10 md:pb-14">
        <h1 className="max-w-[18ch] text-[26px] leading-[1.1] font-light md:text-[64px]">{t('title')}</h1>
        <p className="mt-6 max-w-[52ch] text-[14px] leading-[1.75] text-paper/90 md:text-[16px]">{t('lead')}</p>
        <a
          href="#contact"
          className="mt-10 inline-block rounded-[4px] bg-paper px-10 py-5 text-[10px] font-black uppercase tracking-[0.5em] text-ink transition-colors hover:bg-cream"
        >
          {t('cta')}
        </a>
        {children}
      </div>
    </section>
  );
}
