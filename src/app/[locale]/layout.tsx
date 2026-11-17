import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter } from 'next/font/google';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/env';
import Beacon from '@/components/Beacon';
import Intro from '@/components/Intro';
import '../globals.css';

// Served from our own origin by next/font: no request to Google at runtime.
// The same faces as dailradesdizains.lv: Inter for text, IBM Plex Mono for small labels.
// next/font serves them from this site, so no visitor request goes to Google.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], variable: '--font-plex-mono', display: 'swap' });

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
    <html lang={locale} className={`${inter.variable} ${mono.variable}`}>
      <body className="bg-paper font-sans text-ink antialiased">
        <NextIntlClientProvider>
          <Intro label="Project Nidos" />
          {children}
          <Beacon />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
