import { getTranslations, setRequestLocale } from 'next-intl/server';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import ServicesCarousel from '@/components/ServicesCarousel';
import { LogoMarquee } from '@/components/ui/logo-marquee';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';

const SERVICES = ['google_shop', 'ai', 'digitalization', 'support'] as const;

// What the company builds with (its own projects' code: Next.js sites and apps, Supabase/Postgres,
// Stripe payments, Claude and Gemini for AI, n8n automations, Railway hosting, GitHub), plus Google
// for the Google shop service. Marks from Simple Icons (CC0), white for the video, in public/logos/light.
const PLATFORMS = [
  { src: '/logos/light/nextdotjs.svg', alt: 'Next.js' },
  { src: '/logos/light/react.svg', alt: 'React' },
  { src: '/logos/light/typescript.svg', alt: 'TypeScript' },
  { src: '/logos/light/tailwindcss.svg', alt: 'Tailwind CSS' },
  { src: '/logos/light/supabase.svg', alt: 'Supabase' },
  { src: '/logos/light/postgresql.svg', alt: 'PostgreSQL' },
  { src: '/logos/light/stripe.svg', alt: 'Stripe' },
  { src: '/logos/light/claude.svg', alt: 'Claude' },
  { src: '/logos/light/googlegemini.svg', alt: 'Gemini' },
  { src: '/logos/light/n8n.svg', alt: 'n8n' },
  { src: '/logos/light/railway.svg', alt: 'Railway' },
  { src: '/logos/light/github.svg', alt: 'GitHub' },
  { src: '/logos/light/google.svg', alt: 'Google' },
];

export default async function Home({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <>
      <Header overlay />
      <main id="main">
        <Hero>
          <LogoMarquee label={t('platforms.heading')} logos={PLATFORMS} />
        </Hero>

        <section id="services" aria-labelledby="services-h" className="mx-auto max-w-6xl px-6 py-20 md:py-28">
          <h2 id="services-h" className="max-w-[20ch] text-[2rem] leading-tight font-light md:text-[2.5rem] lg:text-[3rem]">
            {t('services.heading')}
          </h2>
          <ServicesCarousel
            items={SERVICES.map((id) => ({ id, title: t(`services.items.${id}.title`), text: t(`services.items.${id}.text`) }))}
            label={t('services.label')}
            ask={t('services.ask')}
            previous={t('services.previous')}
            next={t('services.next')}
          />
        </section>

        <section id="about" aria-labelledby="about-h" className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 md:grid-cols-12 md:pb-28">
          <h2 id="about-h" className="text-[2rem] leading-tight font-light md:col-span-5 md:text-[2.5rem] lg:text-[3rem]">
            {t('about.heading')}
          </h2>
          <p className="max-w-[60ch] text-[16px] leading-[1.75] text-ink/80 md:col-span-6 md:text-[18px] md:col-start-7 md:pt-2">
            {t('about.text')}
          </p>
        </section>

        <section id="contact" aria-labelledby="contact-h" className="bg-paper-2">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-12 md:py-28">
            <div className="md:col-span-5">
              <h2 id="contact-h" className="text-[2rem] leading-tight font-light md:text-[2.5rem] lg:text-[3rem]">
                {t('contact.heading')}
              </h2>
              <p className="mt-4 max-w-[40ch] text-[16px] leading-[1.75] text-ink/80 md:text-[18px]">{t('contact.intro')}</p>
              <p className="mt-6 text-[16px]">
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
