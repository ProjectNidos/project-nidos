'use client';

import { useLocale } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';

export default function LanguageSwitch({ label }: { label: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  return (
    <ul aria-label={label} className="flex items-center gap-2">
      {(['lv', 'en'] as const).map((l) => (
        <li key={l}>
          <Link
            href={pathname}
            locale={l}
            lang={l}
            aria-current={l === locale ? 'true' : undefined}
            className={l === locale ? 'font-semibold' : 'opacity-70 hover:opacity-100'}
          >
            {l.toUpperCase()}
          </Link>
        </li>
      ))}
    </ul>
  );
}
