-- Project Nidos: leads, editable site texts, cookieless analytics, audit log.
-- Single-company site: there are no tenants, so no tenant_id (docs/adr/0001).
-- Admin = a Supabase Auth user whose app_metadata.role is 'admin'. Only the
-- service role can set app_metadata, so a user cannot grant it to themselves.

create or replace function public.is_admin() returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- ── Leads (contact form enquiries) ───────────────────────────────────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Last contact. Status changes move it; retention counts from it.
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254 and email like '%_@_%'),
  company text check (char_length(company) <= 160),
  service text not null check (service in ('google_shop', 'ai', 'digitalization', 'support', 'other')),
  message text not null check (char_length(message) between 1 and 4000),
  locale text not null check (locale in ('lv', 'en')),
  status text not null default 'new' check (status in ('new', 'contacted', 'won', 'closed'))
);
create index leads_created_at_idx on public.leads (created_at desc);

create or replace function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;
create trigger leads_touch_updated_at before update on public.leads
  for each row execute function public.touch_updated_at();

-- ── Site texts (admin overrides of the bundled defaults in messages/*.json) ──
create table public.site_texts (
  key text not null check (key ~ '^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$'),
  locale text not null check (locale in ('lv', 'en')),
  -- { } < > would be read as message placeholders/tags by next-intl.
  value text not null check (char_length(value) between 1 and 2000 and value !~ '[{}<>]'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  primary key (key, locale)
);

-- ── Analytics: cookieless, first-party ───────────────────────────────────────
-- `visitor` is sha256(ip|user-agent|UTC day|secret salt), truncated: it counts
-- today's visitors without storing an IP or anything on the visitor's device.
create table public.site_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (name in ('page_view', 'service_click', 'contact_start', 'contact_submit')),
  visitor text not null check (char_length(visitor) = 32),
  path text check (char_length(path) <= 300),
  locale text check (locale in ('lv', 'en')),
  detail text check (char_length(detail) <= 60),
  source text check (char_length(source) <= 120),
  campaign text check (char_length(campaign) <= 120),
  device text check (device in ('mobile', 'tablet', 'desktop'))
);
create index site_events_created_at_idx on public.site_events (created_at);

-- ── Audit log: append-only record of security-relevant admin actions ────────
create table public.audit_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid, -- no FK: the record outlives a deleted user
  actor_email text,
  action text not null check (char_length(action) <= 60),
  target text check (char_length(target) <= 200),
  ip text,
  user_agent text check (char_length(user_agent) <= 400),
  meta jsonb not null default '{}'
);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- ── Access ───────────────────────────────────────────────────────────────────
-- Public writes (contact form, analytics beacon, audit) go through the server
-- with the service role, after validation and rate limiting. The API roles get
-- only what the admin panel and the public site read.
alter table public.leads enable row level security;
alter table public.site_texts enable row level security;
alter table public.site_events enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.leads, public.site_texts, public.site_events, public.audit_log from anon, authenticated;

grant select, delete on public.leads to authenticated;
grant update (status) on public.leads to authenticated; -- what the visitor sent stays as sent
create policy leads_admin_select on public.leads for select to authenticated using (public.is_admin());
create policy leads_admin_update on public.leads for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy leads_admin_delete on public.leads for delete to authenticated using (public.is_admin());

grant select on public.site_texts to anon, authenticated;
grant insert, update, delete on public.site_texts to authenticated;
create policy site_texts_read on public.site_texts for select to anon, authenticated using (true);
create policy site_texts_admin_insert on public.site_texts for insert to authenticated with check (public.is_admin());
create policy site_texts_admin_update on public.site_texts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy site_texts_admin_delete on public.site_texts for delete to authenticated using (public.is_admin());

grant select on public.site_events to authenticated;
create policy site_events_admin_select on public.site_events for select to authenticated using (public.is_admin());

grant select on public.audit_log to authenticated;
create policy audit_log_admin_select on public.audit_log for select to authenticated using (public.is_admin());

-- ── Analytics summary for the admin panel ────────────────────────────────────
-- security invoker: RLS on site_events applies, so a non-admin gets zeros.
-- One "visit" = one visitor on one UTC day.
create or replace function public.admin_analytics(p_days int default 30) returns jsonb
language sql stable
security invoker
set search_path = ''
as $$
  with ev as (
    select * from public.site_events
    where created_at >= now() - make_interval(days => least(greatest(p_days, 1), 400))
  ),
  visits as (
    select
      visitor,
      date_trunc('day', created_at) as day,
      bool_or(name = 'page_view') as viewed,
      bool_or(name = 'service_click') as clicked,
      bool_or(name = 'contact_start') as started,
      bool_or(name = 'contact_submit') as sent,
      (array_agg(source order by created_at) filter (where name = 'page_view'))[1] as source,
      (array_agg(device order by created_at))[1] as device
    from ev
    group by visitor, date_trunc('day', created_at)
  ),
  counted as (
    select 'sources' as kind, source as label, count(*) as n from visits where viewed group by source
    union all
    select 'devices', device, count(*) from visits group by device
    union all
    select 'services', detail, count(*) from ev where name = 'service_click' group by detail
    union all
    select 'pages', path, count(*) from ev where name = 'page_view' group by path
  ),
  ranked as (
    select kind, label, n, row_number() over (partition by kind order by n desc, label) as rn from counted
  )
  select jsonb_build_object(
    'days', p_days,
    'visitors', (select count(*) from visits),
    'pageViews', (select count(*) from ev where name = 'page_view'),
    'funnel', jsonb_build_object(
      'visited', (select count(*) from visits where viewed),
      'clickedService', (select count(*) from visits where clicked),
      'startedForm', (select count(*) from visits where started),
      'sentForm', (select count(*) from visits where sent)
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(day, 'YYYY-MM-DD'), 'visitors', n) order by day)
      from (select day, count(*) as n from visits group by day) d
    ), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by rn) from ranked where kind = 'sources' and rn <= 10), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by rn) from ranked where kind = 'devices'), '[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by rn) from ranked where kind = 'services'), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'count', n) order by rn) from ranked where kind = 'pages' and rn <= 10), '[]'::jsonb)
  )
$$;
revoke execute on function public.admin_analytics(int) from public, anon;
grant execute on function public.admin_analytics(int) to authenticated;

-- ── Retention (privacy policy section 6, docs/adr/0002) ──────────────────────
create or replace function public.purge_expired() returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.leads where status <> 'won' and updated_at < now() - interval '12 months';
  delete from public.leads where status = 'won' and updated_at < now() - interval '5 years';
  delete from public.site_events where created_at < now() - interval '13 months';
  delete from public.audit_log where created_at < now() - interval '2 years';
$$;
revoke execute on function public.purge_expired() from public, anon, authenticated;

-- Supabase has pg_cron; the PGlite test database does not.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'purge-expired',
      '17 3 * * *',
      $job$
        select public.purge_expired();
        delete from cron.job_run_details where end_time < now() - interval '30 days';
      $job$
    );
  end if;
end
$$;
