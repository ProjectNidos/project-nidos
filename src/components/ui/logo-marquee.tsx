import { cn } from '@/lib/utils';

export type LogoItem = { src: string; alt: string };

/**
 * An endless row of logos that drifts sideways (started from the 21st.dev logo carousel; now pure
 * CSS, no script). The row is drawn twice and the track slides by exactly one copy, so the loop
 * has no seam. Visitors who ask for less motion get a still row. `label` names it for screen
 * readers; the second copy is hidden from them. Logos are files on this site (CSP: 'self' only).
 */
export function LogoMarquee({ label, logos, className }: { label: string; logos: LogoItem[]; className?: string }) {
  const row = (copy: boolean) => (
    <ul aria-hidden={copy || undefined} className="flex shrink-0 items-center gap-16 pr-16 md:gap-24 md:pr-24">
      {logos.map((logo) => (
        <li key={logo.src} className="flex flex-col items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- small local SVGs, nothing to optimise */}
          <img
            src={logo.src}
            alt=""
            height={40}
            className="h-10 w-auto max-w-28 object-contain drop-shadow-[0_1px_3px_rgb(0_0_0/0.5)]"
          />
          <span className="text-[13px] font-semibold tracking-[0.08em] whitespace-nowrap text-white uppercase [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
            {logo.alt}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <section aria-label={label} className={cn('marquee overflow-hidden', className)}>
      <div className="marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </section>
  );
}

export default LogoMarquee;
