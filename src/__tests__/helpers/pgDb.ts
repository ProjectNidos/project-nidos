import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Real Postgres (PGlite) with every migration applied. The bootstrap stands in
 * for what Supabase provides before migrations run: the API roles, auth.users,
 * and auth.jwt()/auth.uid() reading the same `request.jwt.claims` setting
 * PostgREST sets per request.
 */
const BOOTSTRAP = `
  set timezone to 'UTC';
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  grant usage on schema public to anon, authenticated, service_role;
`;

const MIGRATIONS = path.resolve(process.cwd(), 'supabase/migrations');

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const f of fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
  }
  return db;
}

/** Run `fn` as an API role with the given JWT claims, then switch back. */
export async function as<T>(
  db: PGlite,
  role: 'anon' | 'authenticated' | 'service_role',
  claims: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(claims)]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

export const ADMIN = { sub: '00000000-0000-0000-0000-00000000000a', app_metadata: { role: 'admin' } };
export const USER = { sub: '00000000-0000-0000-0000-00000000000b', app_metadata: {} };

export async function seedLead(db: PGlite, over: Partial<Record<string, string>> = {}): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into public.leads (name, email, service, message, locale, status, updated_at)
     values ($1, $2, $3, $4, $5, $6, coalesce($7::timestamptz, now())) returning id`,
    [
      over.name ?? 'Anna',
      over.email ?? 'anna@example.lv',
      over.service ?? 'ai',
      over.message ?? 'Sveiki',
      over.locale ?? 'lv',
      over.status ?? 'new',
      over.updated_at ?? null,
    ],
  );
  return r.rows[0].id;
}
