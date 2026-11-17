import { getTranslations, setRequestLocale } from 'next-intl/server';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import AskLink from '@/components/AskLink';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';

const SERVICES = [
  { id: 'google_shop', color: 'bg-peach' },
  { id: 'ai', color: 'bg-cream' },
  { id: 'digitalization', color: 'bg-olive' },
  { id: 'support', color: 'bg-periwinkle' },
] as const;

export default async function Home({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <>
      <Header overlay />
      <main id="main">
        <Hero />

        <section id="services" aria-labelledby="services-h" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <h2 id="services-h" className="max-w-[20ch] text-[1.75rem] leading-tight font-light md:text-[2.5rem] lg:text-[3rem]">
            {t('services.heading')}
          </h2>

          {/* Numbered tabs joined by a line, then the cards: the owner's own sketch. */}
          <ol className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
            <span
              aria-hidden="true"
              className="absolute top-5 right-[calc((100%-4.5rem)/8)] left-[calc((100%-4.5rem)/8)] hidden h-px bg-ink md:block"
            />
            {SERVICES.map((s, i) => (
              <li key={s.id} className="flex flex-col items-center">
                <span
                  aria-hidden="true"
                  className={`relative z-10 grid size-10 place-items-center rounded-[3px] text-[15px] font-semibold ${s.color}`}
                >
                  {i + 1}
                </span>
                <span aria-hidden="true" className="h-5 w-px bg-ink" />
                <div className={`flex w-full flex-1 flex-col rounded-[4px] p-6 md:min-h-64 ${s.color}`}>
                  <h3 className="text-[20px] leading-snug font-medium lg:text-[24px]">{t(`services.items.${s.id}.title`)}</h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-ink/80 md:text-[14px]">{t(`services.items.${s.id}.text`)}</p>
                  <AskLink service={s.id} className="mt-auto pt-6 text-[13px] font-medium underline underline-offset-4">
                    {t('services.ask')}
                  </AskLink>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="about" aria-labelledby="about-h" className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 md:grid-cols-12 md:pb-28">
          <h2 id="about-h" className="text-[1.75rem] leading-tight font-light md:col-span-5 md:text-[2.5rem] lg:text-[3rem]">
            {t('about.heading')}
          </h2>
          <p className="max-w-[60ch] text-[14px] leading-[1.75] text-ink/80 md:col-span-6 md:text-[16px] md:col-start-7 md:pt-2">
            {t('about.text')}
          </p>
        </section>

        <section id="contact" aria-labelledby="contact-h" className="bg-paper-2">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-12 md:py-28">
            <div className="md:col-span-5">
              <h2 id="contact-h" className="text-[1.75rem] leading-tight font-light md:text-[2.5rem] lg:text-[3rem]">
                {t('contact.heading')}
              </h2>
              <p className="mt-4 max-w-[40ch] text-[14px] leading-[1.75] text-ink/80 md:text-[16px]">{t('contact.intro')}</p>
              <p className="mt-6 text-[14px]">
                <a href="mailto:support@projectnidos.eu" className="underline underline-offset-4">
                  support@projectnidos.eu
                </a>
              </p>
            </div>
            <div className="md:col-span-6 md:col-start-7">
              <ContactForm locale={locale} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
