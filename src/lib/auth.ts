import 'server-only';
import type { User } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionClient, serviceClient } from './supabase';
import { isAdminUser } from './adminRole';
import { clientIp } from './rateLimit';
import { log } from './log';

/**
 * The authoritative admin check: call it at the top of every admin page,
 * action and route. getUser() validates the JWT with Supabase; the proxy's
 * redirect is only convenience.
 */
export async function getAdmin(): Promise<User | null> {
  const { data } = await (await sessionClient()).auth.getUser();
  return isAdminUser(data.user) ? data.user : null;
}

export async function requireAdmin(): Promise<User> {
  const user = await getAdmin();
  if (!user) redirect('/admin/login');
  return user;
}

/** Append to the audit log: who, what, when, from where. Failure is logged, never silent. */
export async function audit(e: {
  action: string;
  actor?: Pick<User, 'id' | 'email'> | null;
  actorEmail?: string;
  target?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const h = await headers();
  const { error } = await serviceClient()
    .from('audit_log')
    .insert({
      actor_id: e.actor?.id ?? null,
      actor_email: e.actor?.email ?? e.actorEmail ?? null,
      action: e.action,
      target: e.target ?? null,
      ip: clientIp(h),
      user_agent: h.get('user-agent')?.slice(0, 400) ?? null,
      meta: e.meta ?? {},
    });
  if (error) log('error', 'audit_write_failed', { action: e.action, code: error.code, requestId: h.get('x-request-id') });
}
