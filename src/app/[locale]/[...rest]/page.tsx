import { notFound } from 'next/navigation';
import { securityEvent } from '@/lib/security';

// Any unknown address inside a locale renders that locale's not-found page. Recorded:
// scanners walking /wp-admin, /phpmyadmin and friends show up on the security page.
export default async function CatchAll({ params }: PageProps<'/[locale]/[...rest]'>) {
  const { locale, rest } = await params;
  await securityEvent('not_found', `${locale === 'lv' ? '' : `/${locale}`}/${rest.join('/')}`);
  notFound();
}
