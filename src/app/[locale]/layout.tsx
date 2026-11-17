import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/env';
import Beacon from '@/components/Beacon';
import PreviewBridge from '@/components/PreviewBridge';
import { NidosSplash } from '@/components/nidos-splash';
import '../globals.css';

// Inter, as on dailradesdizains.lv. next/font serves it from this site, so no visitor request goes to Google.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });

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
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang={locale} className={inter.variable}>
      <body className="bg-paper font-sans text-ink antialiased">
        <NidosSplash nonce={nonce} />
        <NextIntlClientProvider>
          {children}
          <Beacon />
          <PreviewBridge />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
