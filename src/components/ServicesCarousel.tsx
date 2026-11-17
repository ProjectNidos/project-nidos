'use client';

import { SqueezeCarousel } from '@/components/ui/carousel-squeeze';
import { track } from '@/lib/analytics';

type Item = { id: string; title: string; text: string };

// Placeholders until the owner picks pictures: his palette, one colour per service.
// With pictures, add `image`, `imageAlt` and an `overlay` caption (its dark fade suits photos, not flat colour).
const COLORS = ['var(--color-peach)', 'var(--color-cream)', 'var(--color-olive)', 'var(--color-periwinkle)'];

/** Jumps to the contact form with this service already chosen. */
function askAbout(service: string) {
  track('service_click', service);
  const select = document.getElementById('service') as HTMLSelectElement | null;
  if (select) select.value = service;
}

export default function ServicesCarousel({
  items,
  label,
  ask,
  previous,
  next,
}: {
  items: Item[];
  label: string;
  ask: string;
  previous: string;
  next: string;
}) {
  return (
    <SqueezeCarousel
      // Sits on the hero video: light buttons, like the hero's own.
      accent="var(--color-paper)"
      accentForeground="var(--color-ink)"
      // Scales with the width it gets, so a phone still has room for the narrow panels:
      // the open panel is 16:9 of this height and the other three share what is left.
      height="min(240px, 30cqi)"
      gap="clamp(8px, 1.5cqi, 16px)"
      label={label}
      previousLabel={previous}
      nextLabel={next}
      slides={items.map((s, i) => ({
        id: s.id,
        title: s.title,
        description: s.text,
        background: COLORS[i % COLORS.length],
        action: ask,
        href: '#contact',
        onAction: () => askAbout(s.id),
      }))}
    />
  );
}
