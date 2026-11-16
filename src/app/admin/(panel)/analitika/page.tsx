import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { sessionClient } from '@/lib/supabase';

type Count = { label: string | null; count: number };
type Summary = {
  visitors: number;
  pageViews: number;
  funnel: { visited: number; clickedService: number; startedForm: number; sentForm: number };
  daily: { day: string; visitors: number }[];
  sources: Count[];
  devices: Count[];
  services: Count[];
  pages: Count[];
};

const RANGES = [7, 30, 90] as const;
const SERVICE_LABELS: Record<string, string> = {
  google_shop: 'Google veikals',
  ai: 'MI risinājumi',
  digitalization: 'Digitalizācija',
  support: 'Atbalsts un uzturēšana',
};
const DEVICE_LABELS: Record<string, string> = { mobile: 'Telefons', tablet: 'Planšete', desktop: 'Dators' };
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

/** One entry per UTC day in the range, so days without visits show as gaps, not as missing columns. */
function fillDays(daily: { day: string; visitors: number }[], days: number) {
  const byDay = new Map(daily.map((d) => [d.day, d.visitors]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.now() - (days - 1 - i) * 864e5).toISOString().slice(0, 10);
    return { day, visitors: byDay.get(day) ?? 0 };
  });
}

export default async function AnalyticsPage({ searchParams }: PageProps<'/admin/analitika'>) {
  await requireAdmin();
  const raw = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30;
  const { data, error } = await (await sessionClient()).rpc('admin_analytics', { p_days: days });
  const s = data as Summary | null;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-[1.75rem] font-light">Analītika</h1>
        <nav aria-label="Periods" className="flex gap-2 text-[15px]">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/admin/analitika?days=${d}`}
              aria-current={d === days ? 'page' : undefined}
              className={`rounded-[4px] border px-3 py-1.5 ${d === days ? 'border-ink bg-ink text-paper' : 'border-ink/25 hover:border-ink'}`}
            >
              {d} dienas
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-ink/70">
        Skaitīts bez sīkdatnēm. Viens apmeklējums ir viens apmeklētājs vienā dienā; tas pats cilvēks nākamajā dienā
        skaitās no jauna.
      </p>

      {error || !s ? (
        <p role="alert" className="mt-8 rounded-[3px] bg-peach px-4 py-3">
          Neizdevās ielādēt analītiku. Pārlādējiet lapu.
        </p>
      ) : s.visitors === 0 ? (
        <p className="mt-8 rounded-[4px] bg-cream px-6 py-8 text-[16px] leading-relaxed">
          Šajā periodā apmeklējumu vēl nav. Dati parādīsies, tiklīdz mājaslapu kāds atvērs.
        </p>
      ) : (
        <>
          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            <Stat label="Apmeklējumi" value={s.visitors} />
            <Stat label="Lapu skatījumi" value={s.pageViews} />
            <Stat label="Nosūtītas formas" value={s.funnel.sentForm} note={`${pct(s.funnel.sentForm, s.funnel.visited)}% no apmeklējumiem`} />
          </dl>

          <Panel title="Apmeklētāju ceļš" note="Cik apmeklējumu nonāca līdz katram solim.">
            <Bars
              rows={[
                { label: 'Atvēra mājaslapu', count: s.funnel.visited },
                { label: 'Noklikšķināja uz pakalpojuma', count: s.funnel.clickedService },
                { label: 'Sāka aizpildīt formu', count: s.funnel.startedForm },
                { label: 'Nosūtīja formu', count: s.funnel.sentForm },
              ]}
              max={s.funnel.visited}
              showShare
            />
          </Panel>

          <Panel title="Apmeklējumi pa dienām">
            <Daily data={fillDays(s.daily, days)} />
          </Panel>

          <div className="grid gap-x-10 md:grid-cols-2">
            <Panel title="No kurienes atnāca">
              <Bars rows={s.sources.map((r) => ({ label: r.label ?? 'Tieši (adrese, grāmatzīme)', count: r.count }))} />
            </Panel>
            <Panel title="Kurus pakalpojumus klikšķināja">
              <Bars rows={s.services.map((r) => ({ label: SERVICE_LABELS[r.label ?? ''] ?? r.label ?? '—', count: r.count }))} />
            </Panel>
            <Panel title="Ierīces">
              <Bars rows={s.devices.map((r) => ({ label: DEVICE_LABELS[r.label ?? ''] ?? 'Nezināma', count: r.count }))} />
            </Panel>
            <Panel title="Skatītākās lapas">
              <Bars rows={s.pages.map((r) => ({ label: r.label ?? '—', count: r.count }))} />
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="rounded-[4px] border border-ink/15 p-5">
      <dt className="text-[14px] text-ink/70">{label}</dt>
      <dd className="mt-1 text-[2.25rem] leading-none font-light tabular-nums">{value.toLocaleString('lv-LV')}</dd>
      {note ? <dd className="mt-2 text-[14px] text-ink/70">{note}</dd> : null}
    </div>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-[20px] font-medium">{title}</h2>
      {note ? <p className="mt-1 text-[14px] text-ink/70">{note}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Ranked horizontal bars: the label and the number are always written out, the bar only shows proportion. */
function Bars({ rows, max, showShare }: { rows: { label: string; count: number }[]; max?: number; showShare?: boolean }) {
  if (!rows.length) return <p className="text-[15px] text-ink/70">Vēl nav datu.</p>;
  const top = max ?? Math.max(...rows.map((r) => r.count));
  return (
    <table className="w-full border-collapse text-[15px]">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-ink/10">
            <th scope="row" className="w-[45%] py-2.5 pr-4 text-left font-normal">
              {r.label}
            </th>
            <td className="py-2.5" aria-hidden="true">
              <div className="h-2.5 rounded-r-[4px] bg-ink" style={{ width: `${Math.max(pct(r.count, top), r.count ? 1 : 0)}%` }} />
            </td>
            <td className="w-24 py-2.5 pl-4 text-right tabular-nums">
              {r.count.toLocaleString('lv-LV')}
              {showShare ? <span className="ml-1 text-ink/60">({pct(r.count, top)}%)</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Daily visits as thin columns; hover a column for its date and count. */
function Daily({ data }: { data: { day: string; visitors: number }[] }) {
  if (!data.length) return <p className="text-[15px] text-ink/70">Vēl nav datu.</p>;
  const max = Math.max(...data.map((d) => d.visitors), 1);
  const W = 800;
  const H = 160;
  const slot = W / data.length;
  const bar = Math.max(Math.min(slot - 2, 24), 2);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('lv-LV', { day: 'numeric', month: 'short' });

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" role="img" aria-label={`Apmeklējumi pa dienām, augstākais ${max}`}>
        <line x1="0" x2={W} y1={H} y2={H} stroke="currentColor" strokeOpacity="0.2" />
        {data.map((d, i) => {
          const h = d.visitors ? Math.max((d.visitors / max) * (H - 8), 2) : 0;
          return (
            <g key={d.day}>
              <title>{`${fmt(d.day)}: ${d.visitors}`}</title>
              {/* Hit area wider than the mark. */}
              <rect x={i * slot} y="0" width={slot} height={H} fill="transparent" />
              <rect x={i * slot + (slot - bar) / 2} y={H - h} width={bar} height={h} rx="2" className="fill-ink" />
            </g>
          );
        })}
        <text x="0" y={H + 18} className="fill-current text-[12px] opacity-70">
          {fmt(data[0].day)}
        </text>
        <text x={W} y={H + 18} textAnchor="end" className="fill-current text-[12px] opacity-70">
          {fmt(data[data.length - 1].day)}
        </text>
      </svg>
      <figcaption className="sr-only">
        {data.map((d) => `${fmt(d.day)}: ${d.visitors}`).join('; ')}
      </figcaption>
    </figure>
  );
}
