import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/env';
import Beacon from '@/components/Beacon';
import '../globals.css';

// Served from our own origin by next/font: no request to Google at runtime.
const figtree = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-figtree', display: 'swap' });

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: t('title'),
    description: t('description'),
    alternates: { canonical: locale === 'en' ? '/en' : '/', languages: { lv: '/', en: '/en', 'x-default': '/' } },
    openGraph: { title: t('title'), description: t('description'), images: ['/media/hero-poster.jpg'], locale, type: 'website' },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Render per request: the CSP nonce and the owner's latest texts.
  await connection();
  setRequestLocale(locale);

  return (
    <html lang={locale} className={figtree.variable}>
      <body className="bg-paper font-sans text-ink antialiased">
        <NextIntlClientProvider>
          {children}
          <Beacon />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
