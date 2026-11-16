'use client';

import { track } from '@/lib/analytics';

/** Jumps to the contact form with this service already chosen. */
export default function AskLink({ service, className, children }: { service: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href="#contact"
      className={className}
      onClick={() => {
        track('service_click', service);
        const select = document.getElementById('service') as HTMLSelectElement | null;
        if (select) select.value = service;
      }}
    >
      {children}
    </a>
  );
}
