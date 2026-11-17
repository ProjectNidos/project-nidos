import { getTranslations } from 'next-intl/server';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from '@/i18n/routing';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-6xl px-6 py-28">
        <h1 className="text-[2rem] leading-tight font-light md:text-[2.75rem]">{t('title')}</h1>
        <p className="mt-4 text-[14px] leading-[1.7] text-ink/80">{t('text')}</p>
        <Link href="/" className="mt-10 inline-block rounded-[4px] bg-ink px-7 py-3 text-[14px] font-medium text-paper">
          {t('back')}
        </Link>
      </main>
      <Footer />
    </>
  );
}
