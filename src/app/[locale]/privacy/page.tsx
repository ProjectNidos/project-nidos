import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from '@/i18n/routing';
import PrivacyEn, { UPDATED_EN } from '@/content/PrivacyEn';
import PrivacyLv, { UPDATED_LV } from '@/content/PrivacyLv';

export async function generateMetadata({ params }: PageProps<'/[locale]/privacy'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  return {
    title: `${t('title')} — Project Nidos`,
    description: t('description'),
    alternates: {
      canonical: locale === 'en' ? '/en/privacy' : '/privatuma-politika',
      languages: { lv: '/privatuma-politika', en: '/en/privacy', 'x-default': '/privatuma-politika' },
    },
  };
}

export default async function PrivacyPage({ params }: PageProps<'/[locale]/privacy'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('privacy');
  const en = locale === 'en';

  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-[72ch] px-6 py-16 md:py-24">
        <Link href="/" className="font-mono text-[10px] font-bold uppercase tracking-[0.5em] text-ink/60 underline underline-offset-4 hover:text-ink">
          {t('back')}
        </Link>
        <h1 className="mt-8 text-[2.25rem] leading-tight font-light md:text-[3.25rem]">{t('title')}</h1>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.3em] text-ink/55">
          {en ? `Last updated ${UPDATED_EN}` : `Atjaunināta ${UPDATED_LV}`}
        </p>
        {en ? <PrivacyEn /> : <PrivacyLv />}
      </main>
      <Footer />
    </>
  );
}
