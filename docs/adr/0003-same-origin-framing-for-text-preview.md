# 0003: Same-origin framing for the admin text preview

Date: 2026-11-17. Status: accepted.

## Context
The owner wants to see text edits on the real homepage while typing, before saving
(design: `docs/superpowers/specs/2026-11-17-admin-live-text-preview-design.md`).
The site sent `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'` everywhere, so
nothing, our own admin included, could show it in a frame.

## Decision
- **Public pages:** `X-Frame-Options: SAMEORIGIN`, CSP `frame-ancestors 'self'`. Only a
  page on our own origin can frame them; clickjacking from any other site stays blocked
  (OWASP ASVS 14.4.7).
- **Admin pages (`/admin/*`):** unchanged, `DENY` / `'none'`. Nothing frames the panel.
- The frame and the admin talk only by `postMessage`, checked on both ends: same origin,
  expected window, known text key, length limit. Text is set as plain text, never HTML.
  Inside a frame the site sends no analytics and skips the load splash.

## Consequences
- A future same-origin page could frame the public site. There is no user-generated
  content or third-party script on our origin, so that is not an attack path today; if
  either arrives, revisit this.
- The preview is the real site, so it can't drift from the design; an admin can send a
  real enquiry from it like from any page.
