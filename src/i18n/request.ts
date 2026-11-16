import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';
import { applyOverrides } from '@/lib/texts';
import { getTextOverrides } from '@/lib/siteTexts';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const defaults = (await import(`../../messages/${locale}.json`)).default;
  return { locale, messages: applyOverrides(defaults, await getTextOverrides(locale)) };
});
