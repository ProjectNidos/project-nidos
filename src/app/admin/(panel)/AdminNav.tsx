'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/admin', label: 'Pieteikumi' },
  { href: '/admin/analitika', label: 'Analītika' },
  { href: '/admin/teksti', label: 'Teksti' },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-6 text-[15px]">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={path === l.href ? 'page' : undefined}
          className={path === l.href ? 'font-semibold underline underline-offset-8' : 'text-ink/70 hover:text-ink'}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
