'use client';

import { SqueezeCarousel } from '@/components/ui/carousel-squeeze';
import { track } from '@/lib/analytics';

type Item = { id: string; title: string; text: string };

// One photo per service, 1280x720 in public/media. Sources and licence: docs/picture-credits.md.
// No alt text: each panel is already named by its service title.
const image = (id: string) => `/media/service-${id}.jpg`;

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
      className="mt-14"
      // Scales with the width it gets, so a phone still has room for the narrow panels:
      // the open panel is 16:9 of this height and the other three share what is left.
      height="min(340px, 32cqi)"
      gap="clamp(8px, 1.5cqi, 16px)"
      label={label}
      previousLabel={previous}
      nextLabel={next}
      slides={items.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.text,
        copyKeys: { title: `services.items.${s.id}.title`, description: `services.items.${s.id}.text` },
        image: image(s.id),
        action: ask,
        href: '#contact',
        onAction: () => askAbout(s.id),
      }))}
    />
  );
}
