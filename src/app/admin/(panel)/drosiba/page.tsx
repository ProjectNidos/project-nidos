import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { sessionClient } from '@/lib/supabase';
import { LABELS, SECURITY_KINDS, SPIKE, mergeLog, summarize, type AuditRow, type SecurityRow } from '@/lib/securityLog';

// ponytail: the summary is computed from at most this many rows; the page says so when it hits the cap.
// Move the sums into SQL (like admin_analytics) if floods ever make that common.
const EVENT_LIMIT = 2000;
const AUDIT_LIMIT = 500;
const SHOWN = 300;

const tz = { timeZone: 'Europe/Riga' } as const;
const dayFmt = new Intl.DateTimeFormat('lv-LV', { ...tz, weekday: 'long', day: 'numeric', month: 'long' });
const timeFmt = new Intl.DateTimeFormat('lv-LV', { ...tz, hour: '2-digit', minute: '2-digit' });
const hourFmt = new Intl.DateTimeFormat('lv-LV', { ...tz, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const label = (type: string) => LABELS[type] ?? type;
const small = 'text-[13px] font-semibold uppercase tracking-[0.08em]';

/** Last 30 days of both logs, read as the admin (RLS). */
async function load() {
  const db = await sessionClient();
  const now = new Date();
  const month = new Date(now.getTime() - 30 * 864e5).toISOString();
  const [ev, au] = await Promise.all([
    db
      .from('security_events')
      .select('kind, ip, count, hour, last_at, paths, user_agent')
      .gte('last_at', month)
      .order('last_at', { ascending: false })
      .limit(EVENT_LIMIT),
    db
      .from('audit_log')
      .select('action, created_at, ip, actor_email, target')
      .gte('created_at', month)
      .order('created_at', { ascending: false })
      .limit(AUDIT_LIMIT),
  ]);
  return { ev, au, now };
}

export default async function SecurityPage({ searchParams }: PageProps<'/admin/drosiba'>) {
  await requireAdmin();
  const sp = await searchParams;
  const veids = typeof sp.veids === 'string' && sp.veids in LABELS ? sp.veids : null;
  const ip = typeof sp.ip === 'string' && sp.ip.length <= 64 ? sp.ip : null;

  const { ev, au, now } = await load();

  if (ev.error || au.error) {
    return (
      <>
        <h1 className="text-[1.75rem] font-light">Drošība</h1>
        <p role="alert" className="mt-8 rounded-[3px] bg-peach px-4 py-3">
          Neizdevās ielādēt drošības žurnālu. Pārlādējiet lapu.
        </p>
      </>
    );
  }

  const events = ev.data as SecurityRow[];
  const audit = au.data as AuditRow[];
  const capped = events.length === EVENT_LIMIT || audit.length === AUDIT_LIMIT;
  const s = summarize(events, audit, now);
  const all = mergeLog(events, audit).filter((e) => (!veids || e.type === veids) && (!ip || e.ip === ip));
  const shown = all.slice(0, SHOWN);
  const days = new Map<string, typeof shown>();
  for (const e of shown) {
    const day = dayFmt.format(new Date(e.at));
    days.set(day, [...(days.get(day) ?? []), e]);
  }
  const filterHref = (o: { veids?: string | null; ip?: string | null }) => {
    const q = new URLSearchParams();
    const v = o.veids === undefined ? veids : o.veids;
    const i = o.ip === undefined ? ip : o.ip;
    if (v) q.set('veids', v);
    if (i) q.set('ip', i);
    return `/admin/drosiba${q.size ? `?${q}` : ''}#zurnals`;
  };

  return (
    <>
      <h1 className="text-[1.75rem] font-light">Drošība</h1>
      <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-ink/70">
        Mēģinājumi pret lapu (bloķētas pieteikšanās, formas pārpludināšana, roboti, neesošu adrešu meklēšana) un visas
        administratora darbības. Te redzami mēģinājumi, nevis apstiprināti uzlaušanas gadījumi.
      </p>

      {s.spikes.length || s.last24.login_rate_limited ? (
        <section aria-label="Brīdinājumi" className="mt-8 grid gap-2">
          {s.last24.login_rate_limited ? (
            <p className="rounded-[3px] bg-peach px-4 py-3 text-[15px]">
              Pēdējās 24 stundās pieteikšanās bloķēta {s.last24.login_rate_limited}× pārāk daudzu mēģinājumu dēļ. Ja tas
              nebijāt jūs, kāds min paroli.{' '}
              <Link href={filterHref({ veids: 'login_rate_limited', ip: null })} className="underline underline-offset-4">
                Skatīt
              </Link>
            </p>
          ) : null}
          {s.spikes.map((x) => (
            <p key={`${x.ip}${x.hour}`} className="rounded-[3px] bg-peach px-4 py-3 text-[15px]">
              {x.count} notikumi vienā stundā ({hourFmt.format(new Date(x.hour))}) no{' '}
              <Link href={filterHref({ ip: x.ip, veids: null })} className="font-mono underline underline-offset-4">
                {x.ip}
              </Link>
              .
            </p>
          ))}
        </section>
      ) : (
        <p className="mt-8 rounded-[4px] bg-cream px-4 py-3 text-[15px]">
          Pēdējās 24 stundās nekas neparasts (brīdinājums parādās no {SPIKE} notikumiem stundā no vienas adreses).
        </p>
      )}

      <section className="mt-10">
        <h2 className="text-[20px] font-medium">Pēdējās 24 stundas</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Pieteikšanās" value={s.logins24.ok} />
          <Stat label={label('login_failed')} value={s.logins24.failed} />
          {SECURITY_KINDS.map((k) => (
            <Stat key={k} label={label(k)} value={s.last24[k]} href={filterHref({ veids: k, ip: null })} />
          ))}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-[20px] font-medium">Skaļākās adreses, 7 dienas</h2>
        {s.topIps.length ? (
          <ol className="mt-4 divide-y divide-ink/10 border-y border-ink/10">
            {s.topIps.map((t) => (
              <li key={t.ip} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5 text-[15px]">
                <Link href={filterHref({ ip: t.ip, veids: null })} className="font-mono underline underline-offset-4">
                  {t.ip}
                </Link>
                <span className="tabular-nums">{t.total}×</span>
                <span className="text-ink/70">{t.kinds.map(label).join(', ')}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-4 text-[15px] text-ink/70">Vēl nav neviena mēģinājuma.</p>
        )}
      </section>

      <section id="zurnals" className="mt-10 scroll-mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[20px] font-medium">Žurnāls, 30 dienas</h2>
          {veids || ip ? (
            <p className="text-[15px]">
              Filtrs: {veids ? label(veids) : null}
              {veids && ip ? ' · ' : null}
              {ip ? <span className="font-mono">{ip}</span> : null}{' '}
              <Link href="/admin/drosiba#zurnals" className="ml-2 underline underline-offset-4">
                notīrīt
              </Link>
            </p>
          ) : null}
        </div>
        {capped || all.length > SHOWN ? (
          <p className="mt-2 text-[14px] text-ink/70">
            Rādīti jaunākie {shown.length} ieraksti{capped ? '; skaitļi augstāk var būt nepilnīgi, jo ierakstu ir ļoti daudz' : ''}.
          </p>
        ) : null}

        {shown.length ? (
          [...days].map(([day, list]) => (
            <div key={day} className="mt-6">
              <h3 className={`${small} text-ink/70`}>{day}</h3>
              <ul className="mt-2 divide-y divide-ink/10 border-y border-ink/10">
                {list.map((e, i) => (
                  <li key={i} className="grid gap-1 py-2.5 text-[15px] md:grid-cols-[4rem_minmax(0,1fr)_minmax(0,14rem)] md:gap-4">
                    <time dateTime={e.at} className="tabular-nums text-ink/70">
                      {timeFmt.format(new Date(e.at))}
                    </time>
                    <div className="min-w-0">
                      <Link href={filterHref({ veids: e.type })} className="hover:underline">
                        {label(e.type)}
                      </Link>
                      {e.count > 1 ? <span className="ml-2 tabular-nums text-ink/70">{e.count}×</span> : null}
                      {e.detail ? <p className="truncate font-mono text-[13px] text-ink/70">{e.detail}</p> : null}
                      {e.who ? <p className="truncate text-[13px] text-ink/60">{e.who}</p> : null}
                    </div>
                    {e.ip ? (
                      <Link href={filterHref({ ip: e.ip })} className="truncate font-mono text-[14px] underline underline-offset-4 md:text-right">
                        {e.ip}
                      </Link>
                    ) : (
                      <span />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <p className="mt-4 text-[15px] text-ink/70">{veids || ip ? 'Šim filtram nav ierakstu.' : 'Žurnāls vēl ir tukšs.'}</p>
        )}
      </section>

      <p className="mt-12 max-w-[70ch] text-[14px] leading-relaxed text-ink/70">
        Mēģinājumi pret lapu tiek dzēsti pēc 30 dienām, administratora darbības pēc 2 gadiem (privātuma politikas 6.
        sadaļa). Viena rinda ir viena adrese, viens veids, viena stunda; atkārtojumi tiek saskaitīti. Brīdinājumi netiek
        sūtīti, tie redzami tikai šeit.
      </p>
    </>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const body = (
    <>
      <dt className="text-[14px] leading-snug text-ink/70">{label}</dt>
      <dd className={`mt-2 text-[2rem] leading-none font-light tabular-nums ${value ? '' : 'text-ink/40'}`}>{value}</dd>
    </>
  );
  return href && value ? (
    <Link href={href} className="block rounded-[4px] border border-ink/15 p-4 hover:border-ink">
      <div>{body}</div>
    </Link>
  ) : (
    <div className="rounded-[4px] border border-ink/15 p-4">{body}</div>
  );
}
