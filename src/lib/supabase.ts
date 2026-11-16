import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Every Supabase call runs on the server; the browser never talks to Supabase.
// Unset (local run, preview without a database): a host that never resolves, so every
// call fails like an unreachable database and the usual error handling applies.
const url = () => process.env.SUPABASE_URL || 'https://unconfigured.invalid';
const key = (name: string) => process.env[name] || 'unconfigured';
const publishable = () => key('SUPABASE_PUBLISHABLE_KEY');

// A slow database must not hang a page render.
const timedFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(5000) });

const noSession = { persistSession: false, autoRefreshToken: false };

/** Anonymous client for public reads (site texts). RLS applies. */
export const publicClient = () =>
  createClient(url(), publishable(), { auth: noSession, global: { fetch: timedFetch } });

/** Service client: bypasses RLS. Only for validated server-side writes (leads, events, audit). */
export const serviceClient = () =>
  createClient(url(), key('SUPABASE_SECRET_KEY'), { auth: noSession, global: { fetch: timedFetch } });

/**
 * The signed-in admin's client: RLS applies with their JWT. Cookies lose
 * maxAge/expires, so closing the browser ends the session.
 */
export async function sessionClient() {
  const store = await cookies();
  return createServerClient(url(), publishable(), {
    global: { fetch: timedFetch },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, { ...options, maxAge: undefined, expires: undefined }));
        } catch {
          // Server Components cannot set cookies; the proxy refreshes them instead.
        }
      },
    },
  });
}
