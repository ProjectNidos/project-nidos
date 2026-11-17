'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { sendLead, type LeadState } from '@/app/[locale]/actions';
import { Link } from '@/i18n/routing';
import { track } from '@/lib/analytics';

const SERVICES = ['google_shop', 'ai', 'digitalization', 'support'] as const;

/** Daiļrades form labels. */
const labelText = 'block font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-ink/60';
const field =
  'mt-1 block w-full rounded-none border-0 border-b border-ink/30 bg-transparent px-0 py-2 text-[16px] outline-none focus:border-ink';

export default function ContactForm({ locale }: { locale: string }) {
  const t = useTranslations('contact');
  const ts = useTranslations('services.items');
  const tf = useTranslations('footer');
  const [state, action, pending] = useActionState<LeadState, FormData>(sendLead, { status: 'idle' });
  const started = useRef(false);

  useEffect(() => {
    if (state.status === 'sent') track('contact_submit');
  }, [state]);

  if (state.status === 'sent') {
    return (
      <p role="status" className="rounded-[4px] bg-olive px-6 py-8 text-[14px] leading-[1.75] md:text-[16px]">
        {t('success')}
      </p>
    );
  }

  const errors = state.status === 'invalid' ? state.errors : {};
  const err = (name: keyof typeof errors) =>
    errors[name] ? (
      <span id={`${name}-error`} className="mt-1 inline-block rounded-[3px] bg-peach px-2 py-0.5 text-[13px]">
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
          <select id="service" name="service" required defaultValue="" className={field} {...a11y('service')}>
            <option value="" disabled>
              {t('choose')}
            </option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {ts(`${s}.title`)}
              </option>
            ))}
            <option value="other">{t('other')}</option>
          </select>
          {err('service')}
        </label>
      </div>
      <label className="block">
        <span className={labelText}>{t('message')}</span>
        <textarea name="message" required maxLength={4000} rows={5} className={`${field} resize-y`} {...a11y('message')} />
        {err('message')}
      </label>

      {state.status === 'error' ? (
        <p role="alert" className="rounded-[3px] bg-peach px-3 py-2 text-[14px]">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-[13px] text-ink/70">
          {t('privacyNote')}{' '}
          <Link href="/privacy" className="underline underline-offset-4">
            {tf('privacy')}
          </Link>
        </p>
        <button
          type="submit"
          disabled={pending}
          className="min-h-14 rounded-[4px] bg-ink px-8 font-mono text-[11px] font-bold uppercase tracking-[0.5em] text-paper transition-opacity disabled:opacity-60"
        >
          {pending ? t('sending') : t('send')}
        </button>
      </div>
    </form>
  );
}
