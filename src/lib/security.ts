import 'server-only';
import { after } from 'next/server';
import { headers } from 'next/headers';
import { serviceClient } from './supabase';
import { clientIp } from './rateLimit';
import { log } from './log';
import type { SecurityKind } from './securityLog';

/**
 * Records an attempt against the site for the admin security page. The write runs
 * after the response, so it never slows or breaks the request it describes.
 */
export async function securityEvent(kind: SecurityKind, path: string): Promise<void> {
  const h = await headers();
  const args = { p_kind: kind, p_ip: clientIp(h), p_path: path, p_ua: h.get('user-agent') ?? '' };
  after(async () => {
    try {
      const { error } = await serviceClient().rpc('log_security_event', args);
      if (error) log('warn', 'security_event_failed', { kind, code: error.code });
    } catch {
      log('warn', 'security_event_failed', { kind });
    }
  });
}
