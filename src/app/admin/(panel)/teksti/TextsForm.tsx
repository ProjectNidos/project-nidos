'use client';

import { useActionState } from 'react';
import { saveTexts, type TextsState } from '../../actions';

type Cell = { value: string; edited: boolean; original: string };
type Row = { key: string; label: string; long?: boolean; lv: Cell; en: Cell };

const field = 'mt-1 block w-full rounded-[4px] border border-ink/25 bg-paper px-3 py-2 text-[16px] leading-relaxed focus:border-ink focus:outline-none';

export default function TextsForm({ rows }: { rows: Row[] }) {
  const [state, action, pending] = useActionState<TextsState, FormData>(saveTexts, { message: null, error: false });

  return (
    <form action={action} className="mt-8">
      <div className="grid gap-8">
        {rows.map((r) => (
          <fieldset key={r.key} className="border-t border-ink/10 pt-6">
            <legend className="text-[16px] font-medium">{r.label}</legend>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {(['lv', 'en'] as const).map((locale) => {
                const cell = r[locale];
                const Tag = r.long ? 'textarea' : 'input';
                return (
                  <label key={locale} className="block text-[14px] text-ink/70">
                    {locale === 'lv' ? 'Latviski' : 'Angliski'}
                    {cell.edited ? <span className="ml-2 rounded-[3px] bg-olive px-1.5 py-0.5 text-[12px] text-ink">mainīts</span> : null}
                    <Tag
                      name={`${locale}:${r.key}`}
                      defaultValue={cell.value}
                      placeholder={cell.original}
                      maxLength={2000}
                      {...(r.long ? { rows: 3 } : {})}
                      className={field}
                    />
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="sticky bottom-0 mt-10 flex flex-wrap items-center gap-4 border-t border-ink/10 bg-paper py-4">
        <button type="submit" disabled={pending} className="rounded-[4px] bg-ink px-8 py-3 text-[15px] font-medium text-paper disabled:opacity-60">
          {pending ? 'Saglabā…' : 'Saglabāt'}
        </button>
        {state.message ? (
          <p role="status" className={`rounded-[3px] px-3 py-1.5 text-[15px] ${state.error ? 'bg-peach' : 'bg-olive'}`}>
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
