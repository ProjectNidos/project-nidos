'use server';

import { headers } from 'next/headers';
import { validateLead, type LeadErrors } from '@/lib/leads';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { serviceClient } from '@/lib/supabase';
import { log } from '@/lib/log';

export type LeadState =
  | { status: 'idle' }
  | { status: 'sent' }
  | { status: 'invalid'; errors: LeadErrors }
  | { status: 'error'; error: 'rateLimited' | 'server' };

export async function sendLead(_prev: LeadState, form: FormData): Promise<LeadState> {
  const h = await headers();
  const requestId = h.get('x-request-id');
  if (!rateLimit(`lead:${clientIp(h)}`, 5, 10 * 60_000)) return { status: 'error', error: 'rateLimited' };

  const result = validateLead(form);
  if (!result.ok) {
    // A bot gets the same answer as a person, so it learns nothing.
    if ('spam' in result) return { status: 'sent' };
    return { status: 'invalid', errors: result.errors };
  }

  const { error } = await serviceClient().from('leads').insert(result.lead);
  if (error) {
    log('error', 'lead_insert_failed', { requestId, code: error.code });
    return { status: 'error', error: 'server' };
  }
  log('info', 'lead_received', { requestId, service: result.lead.service, locale: result.lead.locale });
  return { status: 'sent' };
}
