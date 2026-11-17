# 0002: Cookieless first-party analytics and data retention

Date: 2026-11-16. Status: accepted.

## Context
The owner wants to see how visitors move through the site. Third-party
analytics (GA4 and similar) would need a consent banner, sends data outside
the EU, and is blocked by many ad blockers.

## Decision
- The browser sends small events (`page_view`, `service_click`,
  `contact_start`, `contact_submit`) to our own `/api/t`. Nothing is stored on
  the device: no cookies, no localStorage.
  (Separately, the opening splash keeps one sessionStorage marker so it plays
  once per tab; it is not analytics and is named in the privacy policy.)
- Visits are told apart by `sha256(ip | user-agent | UTC date | ANALYTICS_SALT)`,
  truncated. It rotates daily, cannot be reversed to an IP without the secret,
  and the IP is never stored. "Visit" therefore means one visitor on one day.
- Source = `utm_source` if present, else the referrer's host; never the full URL.
- Retention (enforced nightly by `purge_expired()` via pg_cron):
  enquiries 12 months after last contact (won clients 5 years), visit
  statistics 13 months, audit log 2 years. Matches the privacy policy, section 6.

## Consequences
- No cross-day "returning visitor" numbers, by design.
- Bots that execute JavaScript and fake a browser user-agent can be counted.
