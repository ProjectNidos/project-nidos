# 0001: Stack, hosting and admin access

Date: 2026-11-16. Status: accepted.

## Context
projectnidos.eu was a hand-built Express app (static pages, a CMS, a CRM, an
admin panel) on Railway in the US. The owner wants a small bilingual (LV/EN)
company site, an admin panel to read enquiries, edit texts and see visitor
analytics, and nothing carried over except the privacy policy content.

## Decision
- **Next.js 16 (App Router) + next-intl**, the same stack as our other client
  project, so patterns and tests are shared. Latvian at `/`, English at `/en`.
- **Supabase (EU, Frankfurt)** for Postgres and Auth. Never hand-rolled auth.
  Schema lives in `supabase/migrations/` and is tested on PGlite in CI.
- **Railway (EU West region)** hosts the Next.js server. All Supabase calls are
  server-side; the browser only ever talks to our own origin.
- **Admin = Supabase Auth user with `app_metadata.role = 'admin'`.** Only the
  service key can set app_metadata. Checked twice: in every admin page/action
  (`requireAdmin`) and in Postgres RLS (`is_admin()`), so a bug in one layer
  does not expose leads. Sessions end when the browser closes and after 12 hours
  regardless.
- **Single tenant.** The site belongs to one company, so tables carry no
  `tenant_id`; RLS separates "admin" from "everyone else" instead. If the panel
  ever serves several companies, add `tenant_id` with an expand/contract migration.
- **Audit log** (`audit_log`, append-only through RLS/grants) records sign-ins,
  failed sign-ins, sign-outs, lead status changes, exports, deletions and text edits.

## Consequences
- No email notification on a new lead yet; the owner checks the panel.
- SSO/SCIM are not set up; Supabase Auth supports SAML SSO on its Pro plan if a
  second admin from another organisation is ever needed.
- MFA (Supabase TOTP) is not enforced yet: a go-live item in the README.
