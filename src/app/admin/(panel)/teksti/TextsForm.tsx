'use client';

import { startTransition, useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { saveTexts, type TextsState } from '../../actions';
import { parsePreviewMessage, PREVIEW_TAG } from '@/lib/preview';
import PreviewPane from './PreviewPane';

type Cell = { value: string; edited: boolean; original: string };
type Row = { key: string; label: string; long?: boolean; lv: Cell; en: Cell };
type Field = HTMLInputElement | HTMLTextAreaElement;

const field = 'mt-1 block w-full rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[16px] leading-relaxed focus:border-ink focus:outline-none';
const small = 'text-[13px] font-semibold uppercase tracking-[0.08em]';

/** What the page will show: the typed text, or the default when the box is empty (as on save). */
const shown = (el: Field) => el.value.trim() || el.placeholder;

export default function TextsForm({ rows }: { rows: Row[] }) {
  const [state, action, pending] = useActionState<TextsState, FormData>(saveTexts, { message: null, error: false });
  const [locale, setLocale] = useState<'lv' | 'en'>('lv');
  const [previewOpen, setPreviewOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const lastKey = useRef<string | null>(null);
  const previewButton = useRef<HTMLButtonElement>(null);

  const post = useCallback((m: { type: 'text'; key: string; value: string } | { type: 'focus'; key: string }) => {
    frameRef.current?.contentWindow?.postMessage({ tag: PREVIEW_TAG, ...m }, location.origin);
  }, []);

  // Each time the preview (re)loads or navigates, send it every box of the shown language, unsaved edits included.
  useEffect(() => {
    const sendAll = () => {
      formRef.current
        ?.querySelectorAll<Field>(`[name^="${locale}:"]`)
        .forEach((el) => post({ type: 'text', key: el.name.slice(locale.length + 1), value: shown(el) }));
      if (lastKey.current) post({ type: 'focus', key: lastKey.current });
    };
    const onMessage = (e: MessageEvent) => {
      const msg = parsePreviewMessage(e, { origin: location.origin, source: frameRef.current?.contentWindow });
      if (msg?.type !== 'ready') return;
      // The admin may switch language with the site's own LV/EN link inside the preview: follow it.
      const framed = frameRef.current?.contentDocument?.documentElement.lang;
      if ((framed === 'lv' || framed === 'en') && framed !== locale) setLocale(framed);
      else sendAll();
    };
    window.addEventListener('message', onMessage);
    sendAll(); // in case the preview said ready before this page hydrated
    return () => window.removeEventListener('message', onMessage);
  }, [locale, post]);

  // Stable, so the phone layer's focus effect doesn't re-run on every render.
  const closePreview = useCallback(() => {
    setPreviewOpen(false);
    previewButton.current?.focus();
  }, []);

  const focus = (key: string) => {
    lastKey.current = key;
    post({ type: 'focus', key });
  };

  const langTab = (value: 'lv' | 'en', label: string) => (
    <button
      type="button"
      aria-pressed={locale === value}
      onClick={() => setLocale(value)}
      className={`${small} rounded-[3px] px-4 py-2 ${locale === value ? 'bg-ink text-paper' : 'text-ink/70 hover:text-ink'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <form
        ref={formRef}
        action={action}
        // Submit without React's automatic form reset, so a refused save never wipes the edits
        // (the preview would keep showing text that no longer exists in the form).
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => action(data));
        }}
      >
        <div className="flex gap-1" role="group" aria-label="Valoda">
          {langTab('lv', 'Latviski')}
          {langTab('en', 'Angliski')}
        </div>

        <div className="mt-6 grid gap-6">
          {rows.map((r) => (
            <fieldset key={r.key} className="border-t border-ink/10 pt-5">
              <legend className="text-[16px] font-medium">{r.label}</legend>
              {(['lv', 'en'] as const).map((l) => {
                const cell = r[l];
                const Tag = r.long ? 'textarea' : 'input';
                // The other language stays in the form, hidden, so one save keeps both.
                return (
                  <label key={l} hidden={l !== locale} className="mt-2 block text-[14px] text-ink/70">
                    {cell.edited ? <span className="rounded-[3px] bg-olive px-1.5 py-0.5 text-[12px] text-ink">mainīts</span> : null}
                    <Tag
                      name={`${l}:${r.key}`}
                      aria-label={`${r.label} (${l.toUpperCase()})`}
                      defaultValue={cell.value}
                      placeholder={cell.original}
                      maxLength={2000}
                      onInput={(e) => post({ type: 'text', key: r.key, value: shown(e.currentTarget) })}
                      onFocus={() => focus(r.key)}
                      {...(r.long ? { rows: 4 } : {})}
                      className={field}
                    />
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>

        <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-paper py-4">
          <button type="submit" disabled={pending} className="rounded-[4px] bg-ink px-8 py-3 text-[15px] font-medium text-paper disabled:opacity-60">
            {pending ? 'Saglabā…' : 'Saglabāt'}
          </button>
          <button
            ref={previewButton}
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="rounded-[4px] border border-ink/30 px-5 py-3 text-[15px] font-medium hover:border-ink lg:hidden"
          >
            Priekšskatīt
          </button>
          {state.message ? (
            <p role="status" className={`rounded-[3px] px-3 py-1.5 text-[15px] ${state.error ? 'bg-peach' : 'bg-olive'}`}>
              {state.message}
            </p>
          ) : null}
        </div>
      </form>

      <PreviewPane
        locale={locale}
        frameRef={frameRef}
        open={previewOpen}
        onClose={closePreview}
      />
    </div>
  );
}
