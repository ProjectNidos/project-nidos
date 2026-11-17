import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, as, ADMIN, USER } from '../helpers/pgDb';

let db: PGlite;
beforeAll(async () => {
  db = await freshDb();
}, 60_000);
beforeEach(async () => {
  await db.exec(`truncate public.security_events restart identity`);
});

const log = (kind: string, ip = '203.0.113.7', path = '/wp-admin', ua = 'curl/8') =>
  as(db, 'service_role', {}, () => db.query(`select public.log_security_event($1, $2, $3, $4)`, [kind, ip, path, ua]));
type Row = { kind: string; ip: string; count: number; paths: string[]; user_agent: string };
const rows = async () =>
  (await db.query<Row>(`select kind, ip, count, paths, user_agent from public.security_events order by id`)).rows;

describe('security events', () => {
  it('counts repeats from one address in the same hour on one row', async () => {
    await log('not_found');
    await log('not_found');
    await log('not_found', '203.0.113.7', '/.env');
    expect(await rows()).toEqual([
      { kind: 'not_found', ip: '203.0.113.7', count: 3, paths: ['/wp-admin', '/.env'], user_agent: 'curl/8' },
    ]);
  });

  it('keeps at most 10 sample paths, however many it counts', async () => {
    for (let i = 0; i < 15; i++) await log('not_found', '203.0.113.7', `/p${i}`);
    const [r] = await rows();
    expect(r.count).toBe(15);
    expect(r.paths).toHaveLength(10);
  });

  it('gives each kind and each address its own row', async () => {
    await log('not_found');
    await log('contact_spam');
    await log('not_found', '198.51.100.1');
    expect((await rows()).map((r) => `${r.kind}@${r.ip}`)).toEqual([
      'not_found@203.0.113.7',
      'contact_spam@203.0.113.7',
      'not_found@198.51.100.1',
    ]);
  });

  it('clips oversized input and refuses an unknown kind', async () => {
    await log('crafted_request', 'x'.repeat(500), '/' + 'y'.repeat(500), 'z'.repeat(900));
    const [r] = await rows();
    expect(r.ip).toHaveLength(64);
    expect(r.paths[0]).toHaveLength(200);
    expect(r.user_agent).toHaveLength(300);
    await expect(log('made_up')).rejects.toThrow();
  });

  it('visitors and signed-in non-admins can neither record nor read', async () => {
    await log('not_found');
    await as(db, 'anon', {}, async () => {
      await expect(db.query(`select public.log_security_event('not_found', '1.1.1.1', '/', '')`)).rejects.toThrow(
        /permission denied/,
      );
      await expect(db.query(`select * from public.security_events`)).rejects.toThrow(/permission denied/);
    });
    await as(db, 'authenticated', USER, async () => {
      await expect(db.query(`select public.log_security_event('not_found', '1.1.1.1', '/', '')`)).rejects.toThrow(
        /permission denied/,
      );
      expect((await db.query(`select * from public.security_events`)).rows).toHaveLength(0);
    });
  });

  it('an admin reads them but cannot change them', async () => {
    await log('not_found');
    await as(db, 'authenticated', ADMIN, async () => {
      expect((await db.query(`select * from public.security_events`)).rows).toHaveLength(1);
      await expect(db.query(`delete from public.security_events`)).rejects.toThrow(/permission denied/);
    });
  });

  it('are deleted after 30 days by the nightly cleanup', async () => {
    await log('not_found');
    await db.query(
      `insert into public.security_events (hour, kind, ip, first_at, last_at)
       values (now() - interval '31 days', 'not_found', '198.51.100.9', now() - interval '31 days', now() - interval '31 days')`,
    );
    await db.query(`select public.purge_expired()`);
    expect((await rows()).map((r) => r.ip)).toEqual(['203.0.113.7']);
  });
});
