-- Security events: attempts against the site (blocked sign-ins, contact-form floods and
-- spam, unknown addresses, hand-made admin requests). One row per hour × kind × address,
-- counted, so a flood grows a counter, not the table. Shown on /admin/drosiba.
-- IP addresses are personal data: kept 30 days (privacy policy section 6).
-- Design: docs/superpowers/specs/2026-11-17-admin-security-page-design.md

create table public.security_events (
  id bigint generated always as identity primary key,
  hour timestamptz not null,
  kind text not null check (kind in
    ('login_rate_limited', 'contact_rate_limited', 'contact_spam', 'not_found', 'crafted_request')),
  ip text not null check (char_length(ip) <= 64),
  paths text[] not null default '{}' check (cardinality(paths) <= 10),
  user_agent text check (char_length(user_agent) <= 300),
  count integer not null default 1 check (count > 0),
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  unique (hour, kind, ip)
);
create index security_events_last_at_idx on public.security_events (last_at desc);
create index security_events_ip_idx on public.security_events (ip, last_at desc);

alter table public.security_events enable row level security;
revoke all on public.security_events from anon, authenticated;
grant select on public.security_events to authenticated;
create policy security_events_admin_select on public.security_events
  for select to authenticated using (public.is_admin());
-- The server writes through log_security_event() with the service role.
grant select, insert, update on public.security_events to service_role;

-- Security invoker: only the service role holds the table rights it needs, and only it
-- may execute. Inputs are request-controlled, so everything is clipped.
create or replace function public.log_security_event(p_kind text, p_ip text, p_path text, p_ua text)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.security_events as e (hour, kind, ip, paths, user_agent)
  values (
    date_trunc('hour', now()),
    p_kind,
    coalesce(nullif(left(p_ip, 64), ''), 'unknown'),
    case when coalesce(p_path, '') = '' then '{}' else array[left(p_path, 200)] end,
    nullif(left(p_ua, 300), '')
  )
  on conflict (hour, kind, ip) do update set
    count = e.count + 1,
    last_at = now(),
    user_agent = coalesce(excluded.user_agent, e.user_agent),
    paths = case
      when cardinality(excluded.paths) = 0 or cardinality(e.paths) >= 10 or excluded.paths[1] = any(e.paths) then e.paths
      else e.paths || excluded.paths
    end;
$$;
revoke execute on function public.log_security_event(text, text, text, text) from public, anon, authenticated;
grant execute on function public.log_security_event(text, text, text, text) to service_role;

-- Retention: same nightly job, one more line.
create or replace function public.purge_expired() returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.leads where status <> 'won' and updated_at < now() - interval '12 months';
  delete from public.leads where status = 'won' and updated_at < now() - interval '5 years';
  delete from public.site_events where created_at < now() - interval '13 months';
  delete from public.audit_log where created_at < now() - interval '2 years';
  delete from public.security_events where last_at < now() - interval '30 days';
$$;
revoke execute on function public.purge_expired() from public, anon, authenticated;
