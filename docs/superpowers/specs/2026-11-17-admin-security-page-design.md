# Admin security page — design (small project)

**Intent.** The owner asked for an admin log page "like meijar.tech has, where we see all
the breaches, all the security things". One place showing attacks and admin activity.

**Reference.** meijar.tech `/admin/security`: spike warnings, last-24-hours counts, top
source IPs (7 days), event log grouped by day with a type/IP filter, 30-day retention,
Telegram alert on spikes.

**Goals.** See attempts against the site and every security-relevant admin action, in
Latvian, on desktop and phone. Bounded storage under a bot flood.
**Non-goals.** Alerts (Telegram/email) — deferred with the other notifications; blocking
IPs; detecting an actual breach (the page shows attempts, not compromise).
**Anti-goals.** A flood filling the database; IPs kept longer than needed; a page that
says "quiet" because the query silently capped out.

## Approaches
- **A. New `security_events` table, one row per hour × kind × IP, counted (picked).**
  Same idea as meijar's rollup. Rows grow with distinct attackers, not with requests.
- B. Write attack events into `audit_log`. Dropped: one row per request (floods), and its
  2-year retention is wrong for IP-only bot traffic.
- C. Read Railway's request logs. Dropped: not queryable from the app, no structure.

## What is recorded (new)
| kind | where | meaning |
|---|---|---|
| `login_rate_limited` | admin sign-in | too many tries, blocked |
| `contact_rate_limited` | contact form | flood blocked |
| `contact_spam` | contact form | honeypot filled (bot) |
| `not_found` | unknown addresses | scanners probing `/wp-admin`, `/.env`… (also typos) |
| `crafted_request` | admin actions | malformed id/status: a hand-made request |

Stored: hour bucket, kind, IP (Railway's rightmost X-Forwarded-For), up to 10 sample
paths, last user agent, count, first/last seen. Written by the server with the service
role through `log_security_event()` (execute only for `service_role`), after the response
(`after()`), never blocking or breaking the request. Admins read via RLS (`is_admin()`).
Deleted after **30 days** by the existing nightly cleanup. Privacy policy (LV/EN) names it.

Already recorded in `audit_log` and shown too: sign-in, failed sign-in, sign-out, enquiry
status/export/delete, text saves, admin role grants.

## Page `/admin/drosiba` ("Drošība")
- Spike warnings (peach): any IP with ≥ 20 events in one hour in the last 24 h, and any
  blocked sign-in in the last 24 h.
- Last 24 hours: count per kind + failed / successful sign-ins.
- Top IPs, 7 days: IP, total, kinds.
- Log: security events and audit entries merged, newest first, grouped by day (Riga time),
  filter by kind and IP via the address (`?veids=&ip=`); says when a filter is active and
  when the list is cut at its limit.
- Footer: what is kept and for how long.

## Checks
- DB (PGlite): upsert increments, paths capped at 10, anon/plain user can't read or call,
  admin reads, cleanup removes > 30 days.
- Unit: the summary (24 h counts, top IPs, spikes) from rows.
- Browser: `/admin/drosiba` needs a sign-in.
