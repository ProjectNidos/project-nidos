/**
 * The admin security page's arithmetic: what the last day looked like, who was loudest
 * this week, and one merged log. Pure, so it is tested without a database.
 */
export const SECURITY_KINDS = [
  'login_rate_limited',
  'contact_rate_limited',
  'contact_spam',
  'not_found',
  'crafted_request',
] as const;
export type SecurityKind = (typeof SECURITY_KINDS)[number];

/** Events from one address within one hour that count as a spike. */
export const SPIKE = 20;

export type SecurityRow = {
  kind: SecurityKind;
  ip: string;
  count: number;
  hour: string;
  last_at: string;
  paths: string[];
  user_agent: string | null;
};
export type AuditRow = { action: string; created_at: string; ip: string | null; actor_email: string | null; target: string | null };

export const LABELS: Record<string, string> = {
  login_rate_limited: 'Pieteikšanās bloķēta (pārāk daudz mēģinājumu)',
  contact_rate_limited: 'Kontaktforma bloķēta (pārāk daudz sūtījumu)',
  contact_spam: 'Kontaktformas surogātpasts (bots)',
  not_found: 'Neesoša adrese (meklē vājās vietas)',
  crafted_request: 'Viltots administratora pieprasījums',
  login: 'Pieteikšanās',
  login_failed: 'Neveiksmīga pieteikšanās',
  logout: 'Iziešana',
  lead_status: 'Pieteikuma statuss mainīts',
  lead_delete: 'Pieteikums dzēsts',
  lead_export: 'Pieteikums lejupielādēts',
  texts_saved: 'Teksti saglabāti',
  'admin.role_granted': 'Piešķirtas administratora tiesības',
};

const HOUR = 3600e3;

export function summarize(events: SecurityRow[], audit: AuditRow[], now: Date) {
  const since = (h: number) => now.getTime() - h * HOUR;
  const day = events.filter((e) => Date.parse(e.hour) >= since(24));

  const last24 = Object.fromEntries(SECURITY_KINDS.map((k) => [k, 0])) as Record<SecurityKind, number>;
  for (const e of day) last24[e.kind] += e.count;

  const audit24 = audit.filter((a) => Date.parse(a.created_at) >= since(24));
  const logins24 = {
    ok: audit24.filter((a) => a.action === 'login').length,
    failed: audit24.filter((a) => a.action === 'login_failed').length,
  };

  const byIp = new Map<string, { ip: string; total: number; kinds: string[] }>();
  const add = (ip: string, kind: string, n: number) => {
    const s = byIp.get(ip) ?? { ip, total: 0, kinds: [] };
    s.total += n;
    if (!s.kinds.includes(kind)) s.kinds.push(kind);
    byIp.set(ip, s);
  };
  for (const e of events) if (Date.parse(e.hour) >= since(24 * 7)) add(e.ip, e.kind, e.count);
  for (const a of audit)
    if (a.action === 'login_failed' && a.ip && Date.parse(a.created_at) >= since(24 * 7)) add(a.ip, a.action, 1);
  const topIps = [...byIp.values()].sort((x, y) => y.total - x.total).slice(0, 10);

  const perHour = new Map<string, { ip: string; hour: string; count: number }>();
  for (const e of day) {
    const k = `${e.ip}|${e.hour}`;
    const s = perHour.get(k) ?? { ip: e.ip, hour: e.hour, count: 0 };
    s.count += e.count;
    perHour.set(k, s);
  }
  const spikes = [...perHour.values()].filter((s) => s.count >= SPIKE).sort((x, y) => y.count - x.count);

  return { last24, logins24, topIps, spikes };
}

export type LogEntry = {
  at: string;
  type: string;
  ip: string | null;
  count: number;
  who: string | null;
  detail: string | null;
};

/** Security events and audit entries in one list, newest first. */
export function mergeLog(events: SecurityRow[], audit: AuditRow[]): LogEntry[] {
  return [
    ...events.map((e) => ({
      at: e.last_at,
      type: e.kind,
      ip: e.ip,
      count: e.count,
      who: e.user_agent,
      detail: e.paths.join('  ') || null,
    })),
    ...audit.map((a) => ({ at: a.created_at, type: a.action, ip: a.ip, count: 1, who: a.actor_email, detail: a.target })),
  ].sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
}
