/** Public site origin, used for metadata, sitemap and our own-referrer check. */
export const SITE_URL = (process.env.SITE_URL ?? 'https://projectnidos.eu').replace(/\/+$/, '');
export const SITE_HOST = new URL(SITE_URL).host;
