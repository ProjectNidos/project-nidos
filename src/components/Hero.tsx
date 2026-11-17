'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';

/**
 * The video opening. `children` run the full width along its bottom edge, over the video (the logo strip).
 * The video fills the large viewport (lvh), so on iOS it also covers the area behind Safari's floating
 * bottom bar instead of showing the next section there; the strip is lifted by that bar's height
 * (lvh − svh, zero on desktop) so it stays in view.
 */
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
    <section className="relative flex min-h-[100lvh] flex-col justify-end overflow-hidden bg-ink text-paper">
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

      <div className="relative mx-auto w-full max-w-6xl px-6 pt-32 pb-12 md:pb-16">
        <h1 data-k="hero.title" className="max-w-[18ch] text-[34px] leading-[1.1] font-light md:text-[64px]">{t('title')}</h1>
        <p data-k="hero.lead" className="mt-6 max-w-[52ch] text-[16px] leading-[1.75] text-paper/90 md:text-[18px]">{t('lead')}</p>
        <a
          href="#contact"
          data-k="hero.cta"
          className="mt-10 inline-block rounded-[4px] bg-paper px-10 py-5 text-[13px] font-bold uppercase tracking-[0.15em] text-ink transition-colors hover:bg-cream"
        >
          {t('cta')}
        </a>
      </div>
      {children ? <div className="relative w-full pb-[calc(100lvh-100svh+1.5rem)] md:pb-[calc(100lvh-100svh+2rem)]">{children}</div> : null}
    </section>
  );
}
