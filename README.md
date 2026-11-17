# Project Nidos

Company website for SIA Project Nidos (projectnidos.eu), Latvian and English,
with an admin panel for enquiries, site texts and visitor analytics.

Next.js 16 · next-intl · Supabase (Postgres + Auth, Zurich) · Railway (EU).
Decisions: [`docs/adr/`](docs/adr).

## Run it

```sh
npm ci
cp .env.example .env.local   # fill in the Supabase project and a salt
npm run dev                  # http://localhost:3000, admin at /admin
```

Without Supabase variables the public site still runs on its built-in texts;
the contact form and admin panel need the database.

| Command | What it does |
|---|---|
| `npm run typecheck` | route types + `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `npm test` | unit tests + SQL tests on PGlite (real Postgres, no Docker) |
| `npm run build && npm run test:e2e` | browser tests against the production build |

CI runs all of these on every pull request ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Where things are

- `src/app/[locale]/` the public site: home page, privacy policy, 404.
- `src/app/admin/` the admin panel: `/admin` enquiries, `/admin/analitika`, `/admin/teksti`.
- `src/app/api/t` analytics ingest, `src/app/api/health` health check (`?deep=1` checks the database).
- `messages/{lv,en}.json` default texts. Keys listed in `src/lib/texts.ts` can be overridden from the admin panel.
- `src/content/Privacy{Lv,En}.tsx` the privacy policy. Keep the two languages in step.
- `src/proxy.ts` per-request Content-Security-Policy nonce, request IDs, locale routing, admin session refresh.
- `supabase/migrations/` the schema, row-level security, analytics function, retention job.

## Database

The project is `kohjvondmfvnbokchmkp` (Zurich, the former Dailcraft project; see ADR 0001).
For a fresh one, create a project in an EU region, then apply the migrations:

```sh
supabase link --project-ref <ref>
supabase db push
```

Every schema change is a new file in `supabase/migrations/`; never edit an
applied one. Destructive changes go expand → migrate → contract.

### Create the admin login

1. Supabase dashboard → Authentication → Sign In / Providers: turn **off** "Allow new users to sign up".
2. Authentication → Users → Add user: email + a strong password, "Auto confirm".
3. SQL editor:
   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
   where email = 'owner@example.com';
   ```

Only users with that role get into `/admin`; the database enforces the same rule.

## Deploy (Railway)

Service settings: region **EU West**, start command `npm start` (reads `PORT`),
health check path `/api/health`. Variables: everything in `.env.example`.
`SITE_URL` must be the public https address.

Preview deploys: enable Railway PR environments on the project. Give every
preview `NOINDEX=1` and its own `SITE_URL`.

## Before go-live

- [ ] Owner reviews all texts in both languages (they are drafts) and the privacy policy.
- [x] Privacy policy sections 4–5 name the real regions: Railway Netherlands, Supabase Switzerland (Zurich).
- [ ] Hero video licence: confirm the clip (`285225_small.mp4`) may be used commercially.
- [ ] Search Console: re-submit the sitemap; old `.html` addresses redirect automatically.

## Later (deferred for now)

- Supabase: point-in-time recovery (Pro plan) and one tested restore.
- Supabase: MFA (TOTP) for the admin account.
- Uptime monitor on `https://projectnidos.eu/api/health?deep=1`, and Sentry for errors.
- Email notification for new enquiries (needs an email provider).
