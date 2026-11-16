import { requireAdmin } from '@/lib/auth';
import { sessionClient } from '@/lib/supabase';
import { LEAD_STATUSES, STATUS_LABELS } from '@/lib/leads';
import { deleteLead, setLeadStatus } from '../actions';
import ConfirmButton from './ConfirmButton';
import StatusSelect from './StatusSelect';

const SERVICE_LABELS: Record<string, string> = {
  google_shop: 'Google veikals',
  ai: 'MI risinājumi',
  digitalization: 'Digitalizācija',
  support: 'Atbalsts un uzturēšana',
  other: 'Cits',
};

// ponytail: newest 200 only; add paging when there are more.
const LIMIT = 200;

type Lead = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  company: string | null;
  service: string;
  message: string;
  locale: string;
  status: (typeof LEAD_STATUSES)[number];
};

export default async function LeadsPage() {
  await requireAdmin();
  const { data, error } = await (await sessionClient())
    .from('leads')
    .select('id, created_at, name, email, company, service, message, locale, status')
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  const leads = (data ?? []) as Lead[];
  const fresh = leads.filter((l) => l.status === 'new').length;

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-[1.75rem] font-light">Pieteikumi</h1>
        <p className="text-[15px] text-ink/70">
          {leads.length} kopā, {fresh} jauni
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-8 rounded-[3px] bg-peach px-4 py-3">
          Neizdevās ielādēt pieteikumus. Pārlādējiet lapu.
        </p>
      ) : leads.length === 0 ? (
        <p className="mt-8 rounded-[4px] bg-cream px-6 py-8 text-[16px] leading-relaxed">
          Pieteikumu vēl nav. Kad kāds aizpildīs kontaktformu mājaslapā, tas parādīsies šeit.
        </p>
      ) : (
        <ul className="mt-8 grid gap-4">
          {leads.map((l) => (
            <li key={l.id} className={`rounded-[4px] border p-5 ${l.status === 'new' ? 'border-ink' : 'border-ink/15'}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[18px] font-medium">
                    {l.name}
                    {l.company ? <span className="font-normal text-ink/70">, {l.company}</span> : null}
                  </p>
                  <p className="mt-1 text-[15px]">
                    <a href={`mailto:${l.email}`} className="underline underline-offset-4">
                      {l.email}
                    </a>
                  </p>
                  <p className="mt-1 text-[14px] text-ink/70">
                    {SERVICE_LABELS[l.service] ?? l.service}, {l.locale.toUpperCase()},{' '}
                    {new Date(l.created_at).toLocaleString('lv-LV', { timeZone: 'Europe/Riga' })}
                  </p>
                </div>
                <form action={setLeadStatus} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <StatusSelect defaultValue={l.status} options={LEAD_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))} />
                </form>
              </div>
              <p className="mt-4 max-w-[75ch] text-[16px] leading-relaxed whitespace-pre-wrap">{l.message}</p>
              <div className="mt-4 flex gap-4 text-[14px]">
                <a href={`/admin/leads/${l.id}/export`} className="underline underline-offset-4">
                  Eksportēt datus (JSON)
                </a>
                <form action={deleteLead}>
                  <input type="hidden" name="id" value={l.id} />
                  <ConfirmButton message={`Dzēst ${l.name} pieteikumu neatgriezeniski?`}>Dzēst</ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
