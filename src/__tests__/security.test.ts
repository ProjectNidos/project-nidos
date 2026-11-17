import { describe, it, expect } from 'vitest';
import { summarize, mergeLog, SPIKE, type SecurityRow, type AuditRow } from '@/lib/securityLog';

const NOW = new Date('2026-11-17T12:30:00Z');
const ago = (h: number) => new Date(NOW.getTime() - h * 3600e3).toISOString();
const ev = (o: Partial<SecurityRow>): SecurityRow => ({
  kind: 'not_found',
  ip: '203.0.113.7',
  count: 1,
  hour: ago(1),
  last_at: ago(1),
  paths: [],
  user_agent: null,
  ...o,
});
const au = (o: Partial<AuditRow>): AuditRow => ({
  action: 'login',
  created_at: ago(1),
  ip: '198.51.100.1',
  actor_email: 'admin@projectnidos.eu',
  target: null,
  ...o,
});

describe('summarize', () => {
  it('counts the last 24 hours per kind and leaves older rows out', () => {
    const s = summarize([ev({ count: 3 }), ev({ kind: 'contact_spam', count: 2 }), ev({ count: 50, hour: ago(30) })], [], NOW);
    expect(s.last24.not_found).toBe(3);
    expect(s.last24.contact_spam).toBe(2);
    expect(s.last24.login_rate_limited).toBe(0);
  });

  it('counts successful and failed sign-ins from the audit log, last 24 hours', () => {
    const s = summarize([], [au({}), au({ action: 'login_failed' }), au({ action: 'login_failed' }), au({ created_at: ago(25) })], NOW);
    expect(s.logins24).toEqual({ ok: 1, failed: 2 });
  });

  it('ranks addresses over 7 days, counting failed sign-ins too', () => {
    const s = summarize(
      [ev({ ip: 'a', count: 5 }), ev({ ip: 'b', count: 9, kind: 'contact_spam' }), ev({ ip: 'a', kind: 'crafted_request', count: 1 }), ev({ ip: 'old', count: 99, hour: ago(24 * 8) })],
      [au({ action: 'login_failed', ip: 'a' })],
      NOW,
    );
    expect(s.topIps).toEqual([
      { ip: 'b', total: 9, kinds: ['contact_spam'] },
      { ip: 'a', total: 7, kinds: ['not_found', 'crafted_request', 'login_failed'] },
    ]);
  });

  it(`flags an address with ${SPIKE}+ events in one hour, across kinds`, () => {
    const s = summarize(
      [ev({ ip: 'loud', count: SPIKE - 5 }), ev({ ip: 'loud', kind: 'contact_spam', count: 5 }), ev({ ip: 'quiet', count: SPIKE - 1 })],
      [],
      NOW,
    );
    expect(s.spikes).toEqual([{ ip: 'loud', hour: ago(1), count: SPIKE }]);
  });
});

describe('mergeLog', () => {
  it('puts security events and audit entries in one list, newest first', () => {
    const list = mergeLog([ev({ last_at: ago(2), ip: 'x' })], [au({ created_at: ago(1) }), au({ action: 'logout', created_at: ago(3) })]);
    expect(list.map((e) => e.type)).toEqual(['login', 'not_found', 'logout']);
    expect(list[1]).toMatchObject({ at: ago(2), ip: 'x', count: 1 });
  });
});
