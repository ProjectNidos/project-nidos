import { describe, it, expect } from 'vitest';
import { validateLead } from '@/lib/leads';
import { eventSource } from '@/lib/analytics';
import { applyOverrides, EDITABLE_KEYS } from '@/lib/texts';
import { isAdminUser, SESSION_MAX_HOURS } from '@/lib/adminRole';

const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const good = { name: ' Anna ', email: 'anna@firma.lv', service: 'ai', message: 'Sveiki', locale: 'lv' };

describe('validateLead', () => {
  it('accepts a complete enquiry and trims it', () => {
    const r = validateLead(form(good));
    expect(r).toEqual({
      ok: true,
      lead: { name: 'Anna', email: 'anna@firma.lv', company: null, service: 'ai', message: 'Sveiki', locale: 'lv' },
    });
  });

  it('names every missing or bad field', () => {
    const r = validateLead(form({ name: '', email: 'not-an-email', service: 'pricing', message: ' ', locale: 'lv' }));
    expect(r).toEqual({
      ok: false,
      errors: { name: 'required', email: 'email', service: 'required', message: 'required' },
    });
  });

  it('rejects text over the database limits', () => {
    const r = validateLead(form({ ...good, message: 'x'.repeat(4001), company: 'y'.repeat(161) }));
    expect(r).toMatchObject({ ok: false, errors: { message: 'tooLong', company: 'tooLong' } });
  });

  it('flags a filled honeypot as spam', () => {
    expect(validateLead(form({ ...good, website: 'http://spam' }))).toEqual({ ok: false, spam: true });
  });

  it('falls back to Latvian for an unknown locale', () => {
    const r = validateLead(form({ ...good, locale: 'de' }));
    expect(r.ok && r.lead.locale).toBe('lv');
  });
});

describe('eventSource', () => {
  it('prefers a campaign tag over the referrer', () => {
    expect(eventSource({ referrer: 'https://www.google.com/', utmSource: 'linkedin', selfHost: 'projectnidos.eu' })).toBe('linkedin');
  });
  it('uses the referrer host without www', () => {
    expect(eventSource({ referrer: 'https://www.google.com/search?q=x', selfHost: 'projectnidos.eu' })).toBe('google.com');
  });
  it('treats our own site and junk as direct', () => {
    expect(eventSource({ referrer: 'https://projectnidos.eu/en', selfHost: 'projectnidos.eu' })).toBeNull();
    expect(eventSource({ referrer: 'not a url', selfHost: 'projectnidos.eu' })).toBeNull();
    expect(eventSource({ selfHost: 'projectnidos.eu' })).toBeNull();
  });
});

describe('applyOverrides', () => {
  const defaults = { hero: { title: 'Default', lead: 'Lead' }, contact: { heading: 'H' } };
  it('replaces editable keys and leaves the rest', () => {
    const out = applyOverrides(defaults, [{ key: 'hero.title', value: 'Edited' }]);
    expect(out).toEqual({ hero: { title: 'Edited', lead: 'Lead' }, contact: { heading: 'H' } });
    expect(defaults.hero.title).toBe('Default');
  });
  it('ignores keys that are not editable or do not exist', () => {
    const out = applyOverrides(defaults, [
      { key: 'hero.nope', value: 'x' },
      { key: '__proto__.polluted', value: 'x' },
    ]);
    expect(out).toEqual(defaults);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('skips text the message formatter would misread', () => {
    const out = applyOverrides(defaults, [{ key: 'hero.title', value: 'Price {from} <b>5</b>' }]);
    expect(out.hero.title).toBe('Default');
  });
  it('every editable key exists in both message files', async () => {
    const lv = (await import('../../messages/lv.json')).default as Record<string, unknown>;
    const en = (await import('../../messages/en.json')).default as Record<string, unknown>;
    const get = (o: Record<string, unknown>, k: string) =>
      k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown> | undefined)?.[p], o);
    for (const k of EDITABLE_KEYS) {
      expect(typeof get(lv, k), `lv ${k}`).toBe('string');
      expect(typeof get(en, k), `en ${k}`).toBe('string');
    }
  });
});

describe('isAdminUser', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const user = (role: string | undefined, signedInHoursAgo: number) => ({
    app_metadata: role ? { role } : {},
    last_sign_in_at: new Date(now - signedInHoursAgo * 3600e3).toISOString(),
  });
  it('needs the admin role', () => {
    expect(isAdminUser(user('admin', 1), now)).toBe(true);
    expect(isAdminUser(user(undefined, 1), now)).toBe(false);
    expect(isAdminUser(user('editor', 1), now)).toBe(false);
  });
  it('expires a sign-in after the session limit', () => {
    expect(isAdminUser(user('admin', SESSION_MAX_HOURS + 0.1), now)).toBe(false);
  });
  it('rejects a missing user or sign-in time', () => {
    expect(isAdminUser(null, now)).toBe(false);
    expect(isAdminUser({ app_metadata: { role: 'admin' } }, now)).toBe(false);
  });
});
