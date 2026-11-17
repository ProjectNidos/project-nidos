import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function Footer() {
  const t = await getTranslations('footer');
  return (
    <footer className="border-t border-ink/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 text-[15px] tracking-[0.02em] text-ink/70 md:flex-row md:justify-between">
        <address className="not-italic leading-relaxed">
          <span className="font-medium text-ink">SIA Project Nidos</span>
          <br />
          {t('reg')}
          <br />
          {t('address')}
        </address>
        <div className="flex flex-col gap-2 md:items-end">
          <a href="mailto:support@projectnidos.eu" className="hover:text-ink">support@projectnidos.eu</a>
          <Link href="/privacy" className="text-[13px] uppercase tracking-[0.08em] underline underline-offset-4 hover:text-ink">{t('privacy')}</Link>
          <span className="text-[13px] uppercase tracking-[0.08em]">© {new Date().getFullYear()} SIA Project Nidos</span>
        </div>
      </div>
    </footer>
  );
}
