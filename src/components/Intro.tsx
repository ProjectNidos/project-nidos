'use client';

import { useState } from 'react';
import { GlassIconReveal } from '@/components/ui/liquid-glass-logo-reveal';

/**
 * The logo reveal over the page on a full load, then a fade into the site. A click skips it.
 * Rendered on the server so the page never flashes first; `.intro` in globals.css hides it after a
 * few seconds even without scripts, and visitors who ask for less motion never see it.
 * It lives in the layout, so moving between pages inside the site does not replay it.
 */
export default function Intro({ label }: { label: string }) {
  const [state, setState] = useState<'on' | 'leaving' | 'gone'>('on');
  if (state === 'gone') return null;
  const leave = () => setState((s) => (s === 'on' ? 'leaving' : s));

  return (
    <div
      aria-hidden="true"
      data-intro={state}
      onClick={leave}
      onTransitionEnd={(e) => e.target === e.currentTarget && state === 'leaving' && setState('gone')}
      className={`intro fixed inset-0 z-[100] bg-ink transition-opacity duration-700 motion-reduce:hidden ${
        state === 'leaving' ? 'pointer-events-none opacity-0' : ''
      }`}
    >
      <GlassIconReveal
        logo="/brand/project-nidos-logo.png"
        label={label}
        look="dark"
        background="#292728"
        plateColor="#1d1b1c"
        originalColors
        loop={false}
        tileSize={460}
        onEnd={leave}
        className="size-full"
      />
    </div>
  );
}
