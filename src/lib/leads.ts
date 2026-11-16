/** Contact-form validation. Limits mirror the CHECK constraints on public.leads. */

export const SERVICES = ['google_shop', 'ai', 'digitalization', 'support', 'other'] as const;
export type Service = (typeof SERVICES)[number];
export type Locale = 'lv' | 'en';

export const LEAD_STATUSES = ['new', 'contacted', 'won', 'closed'] as const;
export const STATUS_LABELS: Record<(typeof LEAD_STATUSES)[number], string> = {
  new: 'Jauns',
  contacted: 'Sazinājāmies',
  won: 'Klients',
  closed: 'Slēgts',
};

export interface LeadInput {
  name: string;
  email: string;
  company: string | null;
  service: Service;
  message: string;
  locale: Locale;
}

type Field = 'name' | 'email' | 'company' | 'service' | 'message';
export type FieldError = 'required' | 'email' | 'tooLong';
export type LeadErrors = Partial<Record<Field, FieldError>>;

export type LeadResult = { ok: true; lead: LeadInput } | { ok: false; errors: LeadErrors } | { ok: false; spam: true };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLead(f: FormData): LeadResult {
  const s = (k: string) => String(f.get(k) ?? '').trim();
  // Hidden field people never see; bots fill it.
  if (s('website')) return { ok: false, spam: true };

  const name = s('name');
  const email = s('email');
  const company = s('company');
  const service = s('service');
  const message = s('message');
  const errors: LeadErrors = {};

  if (!name) errors.name = 'required';
  else if (name.length > 120) errors.name = 'tooLong';

  if (!email) errors.email = 'required';
  else if (email.length > 254) errors.email = 'tooLong';
  else if (!EMAIL.test(email)) errors.email = 'email';

  if (company.length > 160) errors.company = 'tooLong';

  if (!(SERVICES as readonly string[]).includes(service)) errors.service = 'required';

  if (!message) errors.message = 'required';
  else if (message.length > 4000) errors.message = 'tooLong';

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    lead: {
      name,
      email,
      company: company || null,
      service: service as Service,
      message,
      locale: s('locale') === 'en' ? 'en' : 'lv',
    },
  };
}
