# Project Nidos

Marketing site, CRM and admin panel in one Express app. Node 20, Prisma, Postgres.
**There is no build step for the site** — the HTML, CSS and JS are served as
committed. Railway builds the `Dockerfile` from this repo.

```
npm start                 # production entrypoint
npm run dev               # same, NODE_ENV=development
npm run build:pages       # regenerate index.html + nidos/digitalization.html
npm run check:pages       # verify they match their templates — run before committing
```

---

## Deploy ritual

Four things that will bite if skipped. Every one of them has bitten before.

### 1. Bump `?v=` on every asset you touch

Static assets are served with `Cache-Control: public, max-age=31536000, immutable`
([`server.js`](server.js)). A returning visitor will **never** re-fetch a CSS, JS,
font or image file unless its URL changes.

So editing `base.css`, `landing.css`, `legacy.css`, `landing.js` or `script.js`
without bumping its `?v=` in every page that references it ships a change nobody
sees, on a cache that lasts a year. **Treat a forgotten bump as a failed deploy.**

`base.css` is referenced by every public page and `legacy.css` by most of them.
`grep` before you commit:

```sh
grep -rn 'base\.css?v=' --include='*.html' . | grep -v node_modules
```

All references to one file must carry the same version. Three pages once sat on
`styles.css?v=55` while others were on `57` — same file, three cache keys, so
some pages served a stale copy to returning visitors.

**Locally this does not apply:** with `NODE_ENV=development` the server sends
`no-cache` for these assets instead, so the browser revalidates and an edit
shows up on reload without a bump. That is dev only — `npm start` does not set
`NODE_ENV`, so production always gets the immutable year, and the rule above is
still what governs anything you commit. The dev exception exists because the
alternative is worse: a stylesheet edited without a bump is pinned in the
browser for a year, and the page goes on rendering the old copy while the server
serves the new one, which is a genuinely confusing way to lose an afternoon.

### 2. Run `npm run check:pages` before committing

`index.html` is **generated** from
[`site/landing.template.html`](site/landing.template.html) plus
[`site/content.en.json`](site/content.en.json), and `nidos/digitalization.html`
from [`site/digitalization.template.html`](site/digitalization.template.html)
plus [`site/digi.en.json`](site/digi.en.json). The output is committed; nothing
runs at request time.

Hand-editing either page works right up until the next `npm run build:pages`
silently overwrites it. `check:pages` re-renders and diffs against the
committed files, and exits non-zero if they have drifted.

The build also refuses to write when the content has the wrong shape — six
practices, three reasons, known icons, stable practice anchors, unique form
option values.

The site is English-only. The form option values (`pardosana`, `e-komercija`,
…) are Latvian slugs left from when it was bilingual; the CRM's lead-interest
map is keyed on them, so they stay.

### 3. Restart the local server after editing any page HTML

[`server/lib/content.js`](server/lib/content.js) caches each rendered marketing
page in process and only drops it when a CMS save calls `invalidate()`. **Editing
a file on disk does not invalidate it.** A page requested before your edit keeps
serving the old HTML, so a screenshot or a browser refresh can quietly verify
stale output.

Restart, then confirm against what is actually being served:

```sh
curl -s http://127.0.0.1:4010/ | grep -c 'the thing you changed'
```

### 4. A branch that touches shared assets deploys as one unit

The stylesheet split and font swap changed the link tags of all 16 pages in a
single commit, on purpose. Deploying part of such a branch leaves pages pointing
at a stylesheet that no longer exists. Merge the whole branch, let Railway build
once, then check the live site.

---

## Running locally without touching production

`scripts/env.js` loads `.env`, then `.env.local` over it. If `.env.local` names a
`DATABASE_PUBLIC_URL`, that becomes the `DATABASE_URL` — **the live Railway
database**. An explicitly exported or prefixed `DATABASE_URL` now wins over it,
but that guard is the only thing standing between a local run and production
data, so verify it rather than assume it:

```sh
DATABASE_URL="postgresql://dummy:dummy@127.0.0.1:1/dummy" \
JWT_SECRET="local-only" PORT=4010 node server.js
```

Expect `[env] DATABASE_URL came from the shell; ignoring DATABASE_PUBLIC_URL in
.env.local` in the log, and **no** line reading `connecting via
DATABASE_PUBLIC_URL … this is the LIVE database`. `JWT_SECRET` must be set or the
server exits at startup.

The marketing pages render fine against an unreachable database: content
overrides fail closed and every page serves its committed copy.

**Never POST to `/api/webhooks/form-lead` while pointed at production.** An audit
that believed a dummy URL was in effect created two junk leads in the live CRM.

To see a page past the site gate and the intro splash, set these in the browser
before loading:

```js
sessionStorage.setItem('pn_gate_unlocked', '1');
sessionStorage.setItem('pn_intro_seen', '1');
```

---

## Stylesheets

| File | Loaded by | Contents |
|---|---|---|
| `base.css` | every public page, first | reset, tokens, `@font-face`, type scale, header, footer, buttons |
| `landing.css` | `index.html` | the landing design, including the intro splash |
| `pages.css` | `nidos/digitalization.html` | the practice detail page |
| `legacy.css` | pricing, the legal pages, `404.html` | everything from the previous `styles.css` that `base.css` does not own |

`base.css` styles the header and footer for the whole site. Their markup is
**not** identical across pages — five nav shapes and four footer shapes — but
every variant is additive on one spine, so `base.css` selects on classes
(`.nav`, `.nav-inner`, `.nav-logo`, `.nav-links`, `.footer-inner`,
`.footer-bottom`) and never on `#mainNav`; that id belongs to `landing.js`. The
nav rules are scoped to `.nav` rather than to every `<nav>`, because
`nidos/digitalization.html` carries a second one.

The font is Archivo, subset to Latin + Latin Extended-A, one variable `woff2` in
`assets/fonts/`. It ships in the image via the Dockerfile's `COPY . .`, so no
Dockerfile change is needed when it is replaced — but it does need a `?v=` bump
like anything else.
