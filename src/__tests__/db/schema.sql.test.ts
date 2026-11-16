import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, as, ADMIN, USER, seedLead } from '../helpers/pgDb';

let db: PGlite;
beforeAll(async () => {
  db = await freshDb();
}, 60_000);
beforeEach(async () => {
  await db.exec(`truncate public.leads, public.site_events, public.site_texts, public.audit_log restart identity`);
});

describe('leads access', () => {
  it('visitors (anon) can neither read nor write leads', async () => {
    await seedLead(db);
    await as(db, 'anon', {}, async () => {
      await expect(db.query(`select * from public.leads`)).rejects.toThrow(/permission denied/);
      await expect(
        db.query(`insert into public.leads (name,email,service,message,locale) values ('x','x@y.z','ai','m','lv')`),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it('a signed-in user without the admin role sees no leads', async () => {
    await seedLead(db);
    const rows = await as(db, 'authenticated', USER, () => db.query(`select * from public.leads`));
    expect(rows.rows).toHaveLength(0);
  });

  it('an admin reads leads, changes status, and deletes them', async () => {
    const id = await seedLead(db);
    await as(db, 'authenticated', ADMIN, async () => {
      expect((await db.query(`select * from public.leads`)).rows).toHaveLength(1);
      await db.query(`update public.leads set status = 'contacted' where id = $1`, [id]);
      await db.query(`delete from public.leads where id = $1`, [id]);
    });
    expect((await db.query(`select * from public.leads`)).rows).toHaveLength(0);
  });

  it('an admin cannot rewrite what the visitor sent', async () => {
    const id = await seedLead(db);
    await as(db, 'authenticated', ADMIN, async () => {
      await expect(db.query(`update public.leads set message = 'changed' where id = $1`, [id])).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  it('rejects an unknown service or status', async () => {
    await expect(seedLead(db, { service: 'pricing' })).rejects.toThrow();
    await expect(seedLead(db, { status: 'spam' })).rejects.toThrow();
  });
});

describe('site texts', () => {
  it('anyone can read them, only an admin can change them', async () => {
    await as(db, 'authenticated', ADMIN, () =>
      db.query(`insert into public.site_texts (key, locale, value) values ('hero.title', 'lv', 'Sveiki')`),
    );
    const read = await as(db, 'anon', {}, () => db.query(`select value from public.site_texts`));
    expect(read.rows).toEqual([{ value: 'Sveiki' }]);
    await as(db, 'authenticated', USER, async () => {
      await expect(
        db.query(`insert into public.site_texts (key, locale, value) values ('hero.lead', 'lv', 'x')`),
      ).rejects.toThrow(/row-level security/);
    });
    await as(db, 'anon', {}, async () => {
      await expect(db.query(`delete from public.site_texts`)).rejects.toThrow(/permission denied/);
    });
  });
});

describe('audit log', () => {
  it('is append-only: an admin can read it but not change or delete it', async () => {
    await db.query(`insert into public.audit_log (action) values ('login')`);
    await as(db, 'authenticated', ADMIN, async () => {
      expect((await db.query(`select * from public.audit_log`)).rows).toHaveLength(1);
      await expect(db.query(`delete from public.audit_log`)).rejects.toThrow(/permission denied/);
      await expect(db.query(`update public.audit_log set action = 'x'`)).rejects.toThrow(/permission denied/);
    });
  });
});

describe('admin_analytics', () => {
  async function event(visitor: string, name: string, extra: Record<string, string> = {}) {
    await db.query(
      `insert into public.site_events (visitor, name, path, detail, source, device)
       values ($1, $2, $3, $4, $5, $6)`,
      [visitor.padEnd(32, '0'), name, extra.path ?? '/', extra.detail ?? null, extra.source ?? null, extra.device ?? 'desktop'],
    );
  }

  it('counts the visitor flow from visit to sent form', async () => {
    await event('a', 'page_view', { source: 'google.com' });
    await event('a', 'service_click', { detail: 'ai' });
    await event('a', 'contact_start');
    await event('a', 'contact_submit');
    await event('b', 'page_view', { source: 'google.com', device: 'mobile' });
    await event('b', 'service_click', { detail: 'support' });
    await event('c', 'page_view', { path: '/en' });

    const r = await as(db, 'authenticated', ADMIN, () =>
      db.query<{ s: Record<string, unknown> }>(`select public.admin_analytics(30) as s`),
    );
    const s = r.rows[0].s;
    expect(s.visitors).toBe(3);
    expect(s.pageViews).toBe(3);
    expect(s.funnel).toEqual({ visited: 3, clickedService: 2, startedForm: 1, sentForm: 1 });
    expect(s.sources).toEqual([
      { label: 'google.com', count: 2 },
      { label: null, count: 1 },
    ]);
    expect(s.services).toEqual(
      expect.arrayContaining([
        { label: 'ai', count: 1 },
        { label: 'support', count: 1 },
      ]),
    );
    expect(s.devices).toEqual(
      expect.arrayContaining([
        { label: 'desktop', count: 2 },
        { label: 'mobile', count: 1 },
      ]),
    );
  });

  it('shows a non-admin nothing', async () => {
    await event('a', 'page_view');
    const r = await as(db, 'authenticated', USER, () =>
      db.query<{ s: Record<string, unknown> }>(`select public.admin_analytics(30) as s`),
    );
    expect(r.rows[0].s.visitors).toBe(0);
  });
});

describe('purge_expired (retention)', () => {
  it('removes old enquiries and events, keeps recent ones and won clients', async () => {
    await seedLead(db, { name: 'old', updated_at: new Date(Date.now() - 400 * 864e5).toISOString() });
    await seedLead(db, { name: 'old-won', status: 'won', updated_at: new Date(Date.now() - 400 * 864e5).toISOString() });
    await seedLead(db, { name: 'recent' });
    await db.query(
      `insert into public.site_events (visitor, name, created_at) values (repeat('0', 32), 'page_view', now() - interval '14 months')`,
    );
    await db.query(`select public.purge_expired()`);
    const names = (await db.query<{ name: string }>(`select name from public.leads order by name`)).rows.map((r) => r.name);
    expect(names).toEqual(['old-won', 'recent']);
    expect((await db.query(`select * from public.site_events`)).rows).toHaveLength(0);
  });

  it('cannot be called through the API', async () => {
    await as(db, 'anon', {}, async () => {
      await expect(db.query(`select public.purge_expired()`)).rejects.toThrow(/permission denied/);
    });
  });
});
