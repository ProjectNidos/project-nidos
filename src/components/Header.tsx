import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import LanguageSwitch from './LanguageSwitch';

/** `overlay`: light text over the hero video. Otherwise ink on paper. */
export default async function Header({ overlay = false }: { overlay?: boolean }) {
  const t = await getTranslations('nav');
  const tone = overlay ? 'absolute inset-x-0 top-0 z-20 text-paper' : 'border-b border-ink/10 text-ink';
  const section = (id: string) => ({ pathname: '/' as const, hash: id });

  return (
    <header className={tone}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:bg-paper focus:px-3 focus:py-2 focus:text-ink">
        {t('skip')}
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-5">
        <Link href="/" aria-label={t('home')} className="text-[17px] font-semibold tracking-tight">
          Project Nidos
        </Link>
        <nav className="flex items-center gap-6 text-[13px]">
          <ul className="hidden items-center gap-6 sm:flex">
            <li><Link href={section('services')}>{t('services')}</Link></li>
            <li><Link href={section('about')}>{t('about')}</Link></li>
            <li><Link href={section('contact')}>{t('contact')}</Link></li>
          </ul>
          <LanguageSwitch label={t('language')} />
        </nav>
      </div>
    </header>
  );
}
