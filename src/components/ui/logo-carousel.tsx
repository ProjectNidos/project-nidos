'use client';

import { type CSSProperties, Fragment, useEffect, useId, useRef, useState } from 'react';

export type LogoItem = { src: string; alt: string };

/**
 * Logo carousel (21st.dev "AnimatedCarousel"), rebuilt without new dependencies: native scroll
 * snapping instead of Embla, a CSS letter roll instead of Motion. It steps one logo every
 * `interval` ms and goes back to the start at the end, stops while hovered or focused, and never
 * moves for visitors who ask for less motion. People can also swipe or scroll it themselves.
 * Logos are files on this site (the CSP allows images from 'self' only).
 */
export function AnimatedCarousel({
  title,
  logos,
  interval = 3000,
  className,
}: {
  title: string;
  logos: LogoItem[];
  interval?: number;
  className?: string;
}) {
  const id = useId();
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
      aria-labelledby={id}
      className={className}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      <h2 id={id} className="max-w-[24ch] text-[1.5rem] leading-tight font-light md:text-[2rem] lg:text-[2.5rem]">
        <TextRoll>{title}</TextRoll>
      </h2>
      <ul ref={track} className="no-scrollbar mt-10 flex snap-x snap-mandatory overflow-x-auto">
        {logos.map((logo) => (
          <li key={logo.src} className="shrink-0 basis-1/3 snap-start md:basis-1/5">
            <div className="flex flex-col items-center gap-3 px-2 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- small local SVGs, nothing to optimise */}
              <img src={logo.src} alt="" height={40} className="h-10 w-auto max-w-28 object-contain" />
              <span className="text-center font-mono text-[10px] font-bold tracking-[0.3em] text-ink/60 uppercase">
                {logo.alt}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The letters rise into place once the title scrolls into view (21st.dev TextRoll, in CSS: see
 * `.text-roll` in globals.css). Without scripts, or before it is seen, the title simply shows.
 */
function TextRoll({ children }: { children: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<'still' | 'waiting' | 'shown'>('still');

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setState(entry.isIntersecting ? 'shown' : 'waiting');
        if (entry.isIntersecting) io.disconnect();
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  let i = 0;
  return (
    <span ref={ref} className="text-roll" data-state={state}>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {children.split(' ').map((word, w) => (
          <Fragment key={w}>
            {w > 0 && ' '}
            <span className="inline-block overflow-hidden pb-[0.12em] align-bottom">
              {[...word].map((ch) => (
                <span key={i} className="roll-letter inline-block" style={{ '--i': i++ } as CSSProperties}>
                  {ch}
                </span>
              ))}
            </span>
          </Fragment>
        ))}
      </span>
    </span>
  );
}

export default AnimatedCarousel;
