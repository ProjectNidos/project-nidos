'use client';

import { useEffect, useRef, useState } from 'react';

export type LogoItem = { src: string; alt: string };

/**
 * Logo carousel (21st.dev "AnimatedCarousel"), rebuilt without new dependencies on native scroll
 * snapping instead of Embla. Sits on the hero video, so the marks are light. It steps one logo every
 * `interval` ms and goes back to the start at the end, stops while hovered or focused, and never
 * moves for visitors who ask for less motion. People can also swipe or scroll it themselves.
 * Logos are files on this site (the CSP allows images from 'self' only). `label` names the strip
 * for screen readers; there is no visible title.
 */
export function AnimatedCarousel({
  label,
  logos,
  interval = 3000,
  className,
}: {
  label: string;
  logos: LogoItem[];
  interval?: number;
  className?: string;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const el = track.current;
    if (!el || held || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      const step = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + step, behavior: 'smooth' });
    }, interval);
    return () => window.clearInterval(timer);
  }, [held, interval]);

  return (
    <section
      aria-label={label}
      className={className}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <ul ref={track} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {logos.map((logo) => (
          <li key={logo.src} className="shrink-0 basis-1/3 snap-start md:basis-1/5">
            <div className="flex flex-col items-center gap-3 px-2 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- small local SVGs, nothing to optimise */}
              <img src={logo.src} alt="" height={40} className="h-10 w-auto max-w-28 object-contain" />
              <span className="text-center font-mono text-[10px] font-bold tracking-[0.3em] text-paper/70 uppercase">
                {logo.alt}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default AnimatedCarousel;
