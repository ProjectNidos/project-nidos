'use client';

import { startTransition, useActionState, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { sendLead, type LeadState } from '@/app/[locale]/actions';
import { Link } from '@/i18n/routing';
import { track } from '@/lib/analytics';
import { THANKS_EVENT } from '@/lib/preview';

const SERVICES = ['google_shop', 'ai', 'digitalization', 'support'] as const;

/** Field labels: small capitals, kept readable (Inter, little letter spacing, dark enough). */
const labelText = 'block text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/80';
const field =
  'mt-1 block w-full rounded-none border-0 border-b border-ink/30 bg-transparent px-0 py-2 text-[18px] outline-none focus:border-ink';

export default function ContactForm({ locale }: { locale: string }) {
  const t = useTranslations('contact');
  const ts = useTranslations('services.items');
  const tf = useTranslations('footer');
  const [state, action, pending] = useActionState<LeadState, FormData>(sendLead, { status: 'idle' });
  const started = useRef(false);
  // Admin live preview only: shows the thank-you box while its text is being edited.
  const [previewThanks, setPreviewThanks] = useState(false);

  useEffect(() => {
    if (state.status === 'sent') track('contact_submit');
  }, [state]);

  useEffect(() => {
    const on = (e: Event) => setPreviewThanks((e as CustomEvent<boolean>).detail === true);
    window.addEventListener(THANKS_EVENT, on);
    return () => window.removeEventListener(THANKS_EVENT, on);
  }, []);

  if (state.status === 'sent' || previewThanks) {
    return (
      <p role="status" data-k="contact.success" className="rounded-[4px] bg-olive px-6 py-8 text-[16px] leading-[1.75] md:text-[18px]">
        {t('success')}
      </p>
    );
  }

  const errors = state.status === 'invalid' ? state.errors : {};
  const err = (name: keyof typeof errors) =>
    errors[name] ? (
      <span id={`${name}-error`} className="mt-1 inline-block rounded-[3px] bg-peach px-2 py-0.5 text-[15px]">
        {t(`errors.${errors[name]}`)}
      </span>
    ) : null;
  const a11y = (name: keyof typeof errors) =>
    errors[name] ? { 'aria-invalid': true, 'aria-describedby': `${name}-error` } : {};

  return (
    <form
      action={action}
      // With JavaScript, submit without React's automatic form reset, so a
      // validation error never wipes what the visitor typed.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
      noValidate
      className="grid gap-6"
      onFocus={() => {
        if (!started.current) {
          started.current = true;
          track('contact_start');
        }
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot: hidden from people and screen readers, filled by bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className={labelText}>{t('name')}</span>
          <input name="name" required maxLength={120} autoComplete="name" className={field} {...a11y('name')} />
          {err('name')}
        </label>
        <label className="block">
          <span className={labelText}>{t('email')}</span>
          <input name="email" type="email" required maxLength={254} autoComplete="email" className={field} {...a11y('email')} />
          {err('email')}
        </label>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className={labelText}>{t('company')}</span>
          <input name="company" maxLength={160} autoComplete="organization" className={field} {...a11y('company')} />
          {err('company')}
        </label>
        <label className="block">
          <span className={labelText}>{t('service')}</span>
          {/* Safari draws its own select box; appearance-none makes it match the other fields. */}
          <span className="relative block">
            <select id="service" name="service" required defaultValue="" className={`${field} appearance-none pr-8`} {...a11y('service')}>
              <option value="" disabled>
                {t('choose')}
              </option>
              {SERVICES.map((s) => (
                <option key={s} value={s} data-k={`services.items.${s}.title`}>
                  {ts(`${s}.title`)}
                </option>
              ))}
              <option value="other">{t('other')}</option>
            </select>
            <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute right-1 bottom-3.5 size-4 text-ink/70">
              <path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {err('service')}
        </label>
      </div>
      <label className="block">
        <span className={labelText}>{t('message')}</span>
        <textarea name="message" required maxLength={4000} rows={5} className={`${field} resize-y`} {...a11y('message')} />
        {err('message')}
      </label>

      {state.status === 'error' ? (
        <p role="alert" className="rounded-[3px] bg-peach px-3 py-2 text-[16px]">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[15px] text-ink/70">
          {t('privacyNote')}{' '}
          <Link href="/privacy" className="underline underline-offset-4">
            {tf('privacy')}
          </Link>
        </p>
        <button
          type="submit"
          disabled={pending}
          className="min-h-14 rounded-[4px] bg-ink px-8 text-[13px] font-bold uppercase tracking-[0.15em] text-paper transition-opacity disabled:opacity-60"
        >
          {pending ? t('sending') : t('send')}
        </button>
      </div>
    </form>
  );
}
