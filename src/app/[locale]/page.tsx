import { getTranslations, setRequestLocale } from 'next-intl/server';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import ServicesCarousel from '@/components/ServicesCarousel';
import { AnimatedCarousel } from '@/components/ui/logo-carousel';
import ContactForm from '@/components/ContactForm';
import Footer from '@/components/Footer';

const SERVICES = ['google_shop', 'ai', 'digitalization', 'support'] as const;

// Platforms the company's own copy says it works with (stores, payments, messaging), plus Google for
// the Google shop service. Marks from Simple Icons (CC0), stored in public/logos.
const PLATFORMS = [
  { src: '/logos/google.svg', alt: 'Google' },
  { src: '/logos/shopify.svg', alt: 'Shopify' },
  { src: '/logos/woocommerce.svg', alt: 'WooCommerce' },
  { src: '/logos/prestashop.svg', alt: 'PrestaShop' },
  { src: '/logos/stripe.svg', alt: 'Stripe' },
  { src: '/logos/paypal.svg', alt: 'PayPal' },
  { src: '/logos/googlepay.svg', alt: 'Google Pay' },
  { src: '/logos/applepay.svg', alt: 'Apple Pay' },
  { src: '/logos/whatsapp.svg', alt: 'WhatsApp' },
];

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
          <ServicesCarousel
            items={SERVICES.map((id) => ({ id, title: t(`services.items.${id}.title`), text: t(`services.items.${id}.text`) }))}
            label={t('services.label')}
            ask={t('services.ask')}
            previous={t('services.previous')}
            next={t('services.next')}
          />
        </section>

        <AnimatedCarousel
          title={t('platforms.heading')}
          logos={PLATFORMS}
          className="mx-auto max-w-6xl px-6 pb-20 md:pb-28"
        />

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
