import 'server-only';
import { cache } from 'react';
import { publicClient } from './supabase';
import { log } from './log';

/** The owner's text edits for one locale. On any database trouble the site shows its defaults. */
export const getTextOverrides = cache(async (locale: string): Promise<{ key: string; value: string }[]> => {
  if (!process.env.SUPABASE_URL) return [];
  try {
    const { data, error } = await publicClient().from('site_texts').select('key, value').eq('locale', locale);
    if (error) throw error;
    return data ?? [];
  } catch (e) {
    log('warn', 'site_texts_unavailable', { error: (e as { message?: string })?.message ?? String(e) });
    return [];
  }
});
