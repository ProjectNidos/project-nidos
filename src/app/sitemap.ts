import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (lv: string, en: string, priority: number) =>
    [lv, en].map((path) => ({
      url: `${SITE_URL}${path}`,
      priority,
      alternates: { languages: { lv: `${SITE_URL}${lv}`, en: `${SITE_URL}${en}` } },
    }));
  return [...page('/', '/en', 1), ...page('/privatuma-politika', '/en/privacy', 0.3)];
}
