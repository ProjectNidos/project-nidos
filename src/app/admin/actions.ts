'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sessionClient } from '@/lib/supabase';
import { audit, requireAdmin } from '@/lib/auth';
import { isAdminUser } from '@/lib/adminRole';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { EDITABLE, FORBIDDEN_CHARS, MAX_TEXT, getText } from '@/lib/texts';
import { log } from '@/lib/log';
import { LEAD_STATUSES } from '@/lib/leads';
import lv from '../../../messages/lv.json';
import en from '../../../messages/en.json';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Sign in / out ────────────────────────────────────────────────────────────
export type SignInState = { error: string | null };

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 254);
  const password = String(form.get('password') ?? '').slice(0, 200);
  const ip = clientIp(await headers());
  // Both per address and per account, so neither rotating IPs nor rotating accounts helps.
  if (!rateLimit(`login-ip:${ip}`, 10, 15 * 60_000) || !rateLimit(`login:${email}`, 5, 15 * 60_000)) {
    return { error: 'Pārāk daudz mēģinājumu. Mēģiniet vēlreiz pēc 15 minūtēm.' };
  }

  const supabase = await sessionClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !isAdminUser(data.user)) {
    if (data.user) await supabase.auth.signOut({ scope: 'local' });
    await audit({ action: 'login_failed', actorEmail: email });
    // Same message whatever went wrong: no hint whether the account exists.
    return { error: 'Nepareizs e-pasts vai parole.' };
  }
  await audit({ action: 'login', actor: data.user });
  redirect('/admin');
}

export async function signOut(): Promise<void> {
  const user = await requireAdmin();
  await (await sessionClient()).auth.signOut({ scope: 'local' });
  await audit({ action: 'logout', actor: user });
  redirect('/admin/login');
}

// ── Leads ────────────────────────────────────────────────────────────────────
export async function setLeadStatus(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = String(form.get('id'));
  const status = String(form.get('status'));
  if (!UUID.test(id) || !(LEAD_STATUSES as readonly string[]).includes(status)) return;
  const { error } = await (await sessionClient()).from('leads').update({ status }).eq('id', id);
  if (error) {
    log('error', 'lead_status_failed', { code: error.code });
    throw new Error('Neizdevās saglabāt statusu.');
  }
  await audit({ action: 'lead_status', actor: user, target: id, meta: { status } });
  revalidatePath('/admin');
}

/** GDPR erasure: removes the enquiry for good. */
export async function deleteLead(form: FormData): Promise<void> {
  const user = await requireAdmin();
  const id = String(form.get('id'));
  if (!UUID.test(id)) return;
  const { error } = await (await sessionClient()).from('leads').delete().eq('id', id);
  if (error) {
    log('error', 'lead_delete_failed', { code: error.code });
    throw new Error('Neizdevās dzēst pieteikumu.');
  }
  await audit({ action: 'lead_delete', actor: user, target: id });
  revalidatePath('/admin');
}

// ── Site texts ───────────────────────────────────────────────────────────────
export type TextsState = { message: string | null; error: boolean };
const DEFAULTS = { lv, en } as const;

export async function saveTexts(_prev: TextsState, form: FormData): Promise<TextsState> {
  const user = await requireAdmin();
  const supabase = await sessionClient();
  const { data: current, error: readError } = await supabase.from('site_texts').select('key, locale, value');
  if (readError) return { message: 'Neizdevās nolasīt tekstus. Mēģiniet vēlreiz.', error: true };
  const now = new Map(current.map((r) => [`${r.locale}:${r.key}`, r.value as string]));

  const upserts: { key: string; locale: string; value: string; updated_by: string; updated_at: string }[] = [];
  const resets: { key: string; locale: string }[] = [];
  for (const { key, label } of EDITABLE) {
    for (const locale of ['lv', 'en'] as const) {
      const raw = form.get(`${locale}:${key}`);
      if (raw === null) continue;
      const value = String(raw).trim();
      if (value.length > MAX_TEXT) return { message: `Par garu: ${label} (${locale.toUpperCase()}).`, error: true };
      if (FORBIDDEN_CHARS.test(value))
        return { message: `Simboli { } < > nav atļauti: ${label} (${locale.toUpperCase()}).`, error: true };
      const isDefault = !value || value === getText(DEFAULTS[locale], key);
      const id = `${locale}:${key}`;
      if (isDefault && now.has(id)) resets.push({ key, locale });
      if (!isDefault && now.get(id) !== value)
        upserts.push({ key, locale, value, updated_by: user.id, updated_at: new Date().toISOString() });
    }
  }
  if (!upserts.length && !resets.length) return { message: 'Nav izmaiņu.', error: false };

  if (upserts.length) {
    const { error } = await supabase.from('site_texts').upsert(upserts);
    if (error) return { message: 'Neizdevās saglabāt. Mēģiniet vēlreiz.', error: true };
  }
  for (const locale of ['lv', 'en'] as const) {
    const keys = resets.filter((r) => r.locale === locale).map((r) => r.key);
    if (!keys.length) continue;
    const { error } = await supabase.from('site_texts').delete().eq('locale', locale).in('key', keys);
    if (error) return { message: 'Neizdevās atjaunot sākotnējos tekstus.', error: true };
  }
  const changed = [...upserts, ...resets].map((r) => `${r.locale}:${r.key}`);
  await audit({ action: 'texts_saved', actor: user, meta: { changed } });
  revalidatePath('/admin/teksti');
  return { message: `Saglabāts (${changed.length}). Izmaiņas lapā redzamas uzreiz.`, error: false };
}
