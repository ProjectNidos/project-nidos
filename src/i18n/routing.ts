import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['lv', 'en'],
  defaultLocale: 'lv',
  // Latvian at /, English at /en. No Accept-Language redirects and no locale
  // cookie: visitors get no cookies at all (privacy policy, section 2).
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: false,
  pathnames: {
    '/': '/',
    '/privacy': { lv: '/privatuma-politika', en: '/privacy' },
  },
});

export const { Link, usePathname, getPathname } = createNavigation(routing);
