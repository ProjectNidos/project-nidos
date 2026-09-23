# Site editor, part 1a (Foundation engine): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve Home, Services, Pricing, the four legal pages and the 404 page from
blocks stored in Postgres. Home, Services and Pricing must render the same HTML as
today's files. An admin setting switches this on and off, and today's files are the
fallback.

**Architecture:**
- Each block is a plain-JS module (`blocks/<type>/index.js`) with field definitions,
  limits and a `render(props, ctx)` that returns HTML.
- A layout renderer (`server/cms/layout.js`) wraps a page's blocks in the page frame:
  head, intro, nav, footer and scripts.
- An Express middleware serves published versions from an in-memory cache. It falls
  through to today's pipeline on any miss or error.
- Parity is proved by comparing normalised `<body>` HTML against today's files, then by
  screenshots.

**Tech Stack:**
- Node 20 in production (Dockerfile `node:20-slim`), 22 locally.
- Express 4, Prisma (Postgres), cheerio 1.2 (already a dependency).
- Node's built-in test runner.
- playwright-core from the local npx cache, for the screenshot run.

**Spec:** `docs/superpowers/specs/2026-09-23-cms-foundation-design.md`. Read it first,
including §13 "Amendments from planning". This plan implements its sections 3, 4, 5, 7,
8, 9, 10 and 11.

Section 6 (moving every block's styles into its own `style.css` and splitting
`landing.js`) is **plan 1b**, a separate plan that must land before part 2 ships.
Until then:
- blocks render today's class names;
- pages load today's stylesheets;
- every block is limited to the layout whose stylesheet it was written for (the
  `layouts` key, Task 5).

## Global Constraints

- **No new runtime dependencies.**
- **Schema changes via `prisma db push` only.** Never `prisma migrate`: production was
  built with `db push`.
- **No local process ever connects to the production database.**
  - Production writes happen on Railway at start-up, behind the flags `RUN_DB_PUSH=1`
    and `RUN_CMS_IMPORT=1`, the way `scripts/deploy-schema.js` already works.
  - Local work uses the development database, through `scripts/lib/dev-db.js`
    (Task 3). That helper refuses to run if the env chain swapped the database.
  - Never use `npm run db:push` here: it goes through `scripts/with-env.js`, which may
    point at production.
- **No credentials in the transcript.** The owner pastes the development database
  address into `.env.cms-dev` themselves. Never print it, `cat` it or log it. Print
  hostnames only.
- **Page addresses stay as they are today:**
  - `/`
  - `/nidos/digitalization.html`
  - `/nidos/pricing.html`
  - `/nidos/privacy.html`, `/nidos/terms.html`, `/nidos/cookie-policy.html`,
    `/nidos/gdpr.html`

  The 404 page is stored at the reserved path `/404`, which is never served with
  status 200.
- **Asset URLs** emitted by the layout equal today's. `pages.css` becomes `v=8` in
  Task 9.

  | Asset | URL |
  |---|---|
  | base | `/base.css?v=5` |
  | shared | `/shared.css?v=2` |
  | landing | `/landing.css?v=28` |
  | pages | `/pages.css?v=7` (`v=8` after Task 9) |
  | visuals | `/visuals.css?v=1` |
  | landing script | `/landing.js?v=10` |
  | diagram player | `/practice-visuals.js?v=1` |
  | orbital scene | `/orbital-hero.js?v=2` |
  | topology field | `/topology-bg.js?v=1` |

- **Escaping.** Every text prop is escaped at render with `esc` from
  `scripts/lib/render.js`. Rich text is cleaned by `server/cms/richtext.js` on import
  and again at render.
- **The switch.** `cms.servePages` defaults to `false`. Nothing changes for visitors
  until an admin turns it on.
- **Commit messages.** Conventional Commits, ending with
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Style.** Match the surrounding code: CommonJS, 4-space indent in `server.js` and
  `scripts/`, 2-space in `server/lib`. Comments explain *why*, in the voice of the
  existing ones.

## Review Focus

1. **A published page whose blocks include a type that no longer exists.** Expected:
   that page falls through to today's file, and the log names the page and the type.
   Pinned in Task 13: `unknown block type falls through and is logged`.
2. **Rich text holding `<script>`, `onerror=`, `javascript:` links, `<style>` or HTML
   comments.** Expected: all stripped on import and at render; the text survives.
   Pinned in Task 4.
3. **`?__cms=1` sent by someone who is not a signed-in admin, on the live site.**
   Expected: ignored; the visitor gets whatever the switch says. Pinned in Task 13:
   `preview flag is ignored without preview rights` and
   `canPreview: no valid cookie in production is no`.
4. **A request for `/index.html` or `/404`.** Expected: `/index.html` serves the
   database home page. `/404` is never served with status 200; it only renders
   through the catch-all, with status 404. Pinned in Task 13.
5. **A `SiteContent` override saved in the admin today** (for example
   `hero.titleLead`). Expected: the import carries it into the database page. Pinned
   in Task 10 (`applyOverrides`) and Task 12 (the import reads overridden HTML for
   pricing and legal pages).

---

## File map

| File | Responsibility |
|---|---|
| `package.json` | `test`, `dev:cms`, `db:push:cms-dev`, `cms:import:dev`, `cms:parity` scripts |
| `test/helpers/html.js` | `normalizeHtml`, `bodyOf`, `sectionOf` |
| `nidos/pricing.html`, `site/digitalization.template.html` | Task 2 markup alignment |
| `scripts/lib/dev-db.js`, `scripts/dev-cms.js`, `scripts/db-push-dev.js` | guarded access to the development database |
| `prisma/schema.prisma` | `Site`, `Page`, `PageVersion`, `SiteSetting` |
| `server/cms/richtext.js` | `sanitize(html, profile)` |
| `server/cms/fields.js` | `validateProps(fields, props)` |
| `server/cms/validate.js` | `validatePage(layout, blocks)` |
| `blocks/index.js` | registry: `getBlock(type)`, `BLOCK_TYPES` |
| `blocks/<type>/index.js` | one module per block (16) |
| `scripts/lib/cms-convert.js` | pure converters from today's content to blocks |
| `server/cms/assets.js` | stylesheet and script lists per page |
| `server/cms/layout.js` | `renderPage`, `resolveNavHref` |
| `server/cms/store.js` | `createStore(prisma)` |
| `scripts/cms-import.js` | writes the site, pages and first versions |
| `scripts/deploy-schema.js` | gains the `RUN_CMS_IMPORT=1` step |
| `server/cms/preview.js` | `createCanPreview(prisma)`: development, or a signed-in admin |
| `server/cms/middleware.js` | `createCmsMiddleware(deps)` |
| `server/lib/settings.js`, `server/routes/admin/settings.js`, `admin.html`, `admin.js` | the `cms.servePages` switch |
| `server.js` | wiring, static guard for `/blocks/` and `/test/`, the 404 |
| `pages.css` | the LEGAL section (Task 9) |
| `scripts/cms-parity.js` | files vs database: HTML, screenshots, behaviour |
| `docs/superpowers/runbooks/cms-release.md` | production release steps |

---

### Task 1: Test runner and HTML normaliser

**Files:**
- Modify: `package.json`
- Create: `test/helpers/html.js`, `test/helpers/html.test.js`

**Interfaces:**
- Produces:
  - `normalizeHtml(html, pagePath = '/') → string`. It:
    - returns the `<body>` inner HTML;
    - removes HTML comments and `data-cms` attributes;
    - resolves relative `href`/`src` against `pagePath`, keeping query and hash;
    - sorts attributes and class tokens;
    - collapses whitespace.
  - `bodyOf(html) → string`
  - `sectionOf(html, selector) → string`: the outer HTML of the first match. It throws
    if nothing matches.

- [ ] **Step 1: Add the script.** In `package.json` `scripts`, add
  `"test": "node --test test/**/*.test.js"`. npm runs scripts with `sh`, which expands
  `**` one level deep. That matches the layout used here (`test/<area>/<name>.test.js`)
  and works on Node 20 and 22 alike.

- [ ] **Step 2: Write the failing test** `test/helpers/html.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHtml, bodyOf, sectionOf } = require('./html');

test('drops comments and data-cms, collapses whitespace', () => {
  const a = '<body><!-- x --><h1 data-cms="t">Hi</h1>\n   <p>a   b</p></body>';
  assert.equal(normalizeHtml(a), '<h1>Hi</h1><p>a b</p>');
});

test('sorts attributes and class tokens', () => {
  const a = '<body><a href="/" class="hit-44 back-link">x</a></body>';
  const b = '<body><a class="back-link hit-44" href="/">x</a></body>';
  assert.equal(normalizeHtml(a), normalizeHtml(b));
});

test('resolves relative urls against the page path', () => {
  const a = '<body><script src="../topology-bg.js?v=1"></script></body>';
  assert.equal(normalizeHtml(a, '/nidos/x.html'), '<script src="/topology-bg.js?v=1"></script>');
});

test('leaves fragments, mailto and absolute urls alone', () => {
  const a = '<body><a href="#c">1</a><a href="mailto:a@b.c">2</a><a href="https://x.y/z">3</a></body>';
  assert.equal(normalizeHtml(a), '<a href="#c">1</a><a href="mailto:a@b.c">2</a><a href="https://x.y/z">3</a>');
});

test('bodyOf and sectionOf', () => {
  const doc = '<html><body><section id="a"><p>1</p></section><section id="b">2</section></body></html>';
  assert.equal(normalizeHtml(`<body>${sectionOf(doc, '#b')}</body>`), '<section id="b">2</section>');
  assert.match(bodyOf(doc), /<section id="a">/);
  assert.throws(() => sectionOf(doc, '#nope'), /no element matches #nope/);
});
```

- [ ] **Step 3: Run** `npm test`. Expected: FAIL, `Cannot find module './html'`.

- [ ] **Step 4: Implement** `test/helpers/html.js`:

```js
const cheerio = require('cheerio');

// Addresses the normaliser leaves as they are: fragments, mail, phone, data and
// anything with a scheme.
const ABSOLUTE = /^(https?:|mailto:|tel:|#|data:)/i;

function normalizeHtml(html, pagePath = '/') {
  const $ = cheerio.load(html);
  $('*').contents().filter((_, n) => n.type === 'comment').remove();
  $('[data-cms]').removeAttr('data-cms');
  $('[href],[src]').each((_, el) => {
    for (const attr of ['href', 'src']) {
      const v = $(el).attr(attr);
      if (!v || ABSOLUTE.test(v)) continue;
      const u = new URL(v, 'https://site.invalid' + pagePath);
      $(el).attr(attr, u.pathname + u.search + u.hash);
    }
  });
  $('*').each((_, el) => {
    if (el.attribs.class) el.attribs.class = el.attribs.class.split(/\s+/).filter(Boolean).sort().join(' ');
    el.attribs = Object.fromEntries(Object.keys(el.attribs).sort().map((k) => [k, el.attribs[k]]));
  });
  return $('body').html().replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}

function bodyOf(html) {
  return cheerio.load(html)('body').html();
}

function sectionOf(html, selector) {
  const $ = cheerio.load(html);
  const el = $(selector).first();
  if (!el.length) throw new Error(`no element matches ${selector}`);
  return $.html(el);
}

module.exports = { normalizeHtml, bodyOf, sectionOf };
```

- [ ] **Step 5: Run** `npm test`. Expected: 5 pass.

- [ ] **Step 6: Commit.**

```bash
git add package.json test/helpers
git commit -m "test(cms): node test runner and an HTML normaliser for parity checks"
```

---

### Task 2: Align the two subpages' shared markup (the only visible change)

Services and Pricing draw a page intro and a numbered process with different markup. A
block has one markup, so this makes the static pages agree first. Parity later is then
exact.

**Changes and their visible effect:**
- **Pricing page intro:** the back link gains `hit-44`. It becomes a larger touch
  target, with no visual change.
- **Pricing steps:** the numbers `1 2 3 4` become `01 02 03 04`, as on Services.
- **Services process section:** the class `process` becomes `pricing-section`. Its
  heading takes the pricing sections' measure, so the line breaks may change.

**Files:**
- Modify: `nidos/pricing.html`, `site/digitalization.template.html`, possibly
  `pages.css`
- Rebuild: `nidos/digitalization.html`

- [ ] **Step 1: Take before screenshots** of `/nidos/pricing.html` and
  `/nidos/digitalization.html` at 390 and 1440 px, full page.
  - Browser: playwright-core at
    `/Users/test/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core`.
  - Server:
    `DATABASE_URL=postgresql://dummy:dummy@127.0.0.1:1/dummy JWT_SECRET=x PORT=4031 NODE_ENV=development node server.js`.
  - Before `goto`, set sessionStorage `pn_gate_unlocked=1` with `addInitScript`.
  - Save to `tmp/align/`.
- [ ] **Step 2: Edit** `nidos/pricing.html`:
  - Replace `<a href="/" class="back-link">Back to homepage</a>` with
    `<a class="back-link hit-44" href="/">Back to homepage</a>`.
  - In `#model`, change the four `<p class="step-num">N</p>` to `01`, `02`, `03`, `04`.
- [ ] **Step 3: Edit** `site/digitalization.template.html`. Replace
  `<section id="{{ids.process}}" class="process">` with
  `<section id="{{ids.process}}" class="pricing-section">`.
- [ ] **Step 4: Rebuild and check.** Run `npm run build:pages && npm run check:pages`.
  Expected: every file "matches the template".
- [ ] **Step 5: Take after screenshots** and compare them. Expected:
  - Pricing: only the step numbers differ.
  - Services: only the process heading's line breaks differ, if anything.

  Any other difference means a style rule depended on `.process`. Find it with
  `grep -n '\.process' pages.css`, then fold it into `.pricing-section` or delete it.
- [ ] **Step 6: Commit.**

```bash
git add nidos/pricing.html site/digitalization.template.html nidos/digitalization.html pages.css
git commit -m "refactor(pages): one markup for the page intro and the steps on services and pricing"
```

---

### Task 3: Development database, its guard, and the four tables

**Needs the owner's OK before Step 1.** It adds an environment to their Railway
project, which costs a few dollars a month.

**Files:**
- Create: `scripts/lib/dev-db.js`, `scripts/dev-cms.js`, `scripts/db-push-dev.js`
- Modify: `prisma/schema.prisma`, `package.json`, `.gitignore`, `.dockerignore`

**Interfaces:**
- Produces:
  - `useDevDatabase() → { host }`. It:
    - reads `DATABASE_URL` from `.env.cms-dev`;
    - sets it;
    - loads `scripts/env.js`, the same chain `server.js` uses;
    - forces `NODE_ENV=development`;
    - exits 1 if the chain replaced the database.
  - Scripts: `npm run dev:cms`, `npm run db:push:cms-dev`.

- [ ] **Step 1: Create the environment.** With the owner's OK:
  1. In the Railway project `ProjectNidos.eu`, create an **empty** environment named
     `development`. Never use "duplicate", which would copy production's variables.
     Use the `railway-agent` MCP tool. The Railway CLI is not installed on this machine.
  2. Deploy the Postgres template into that environment only (`deploy-template` with
     its environment id).
  3. Confirm with `list-services` that production still has exactly the services it
     had.
- [ ] **Step 2: Ask the owner to fill in the file.** First add `.env.cms-dev` to
  `.gitignore` and `.dockerignore`. The `.env` prefix already stops it being served
  (`BLOCKED_PATTERNS` in `server.js`). Then ask the owner to:
  1. open Railway → `development` → Postgres → Variables;
  2. copy `DATABASE_PUBLIC_URL`;
  3. create `.env.cms-dev` in the repo root with one line: `DATABASE_URL=<that value>`.
- [ ] **Step 3: Write** `scripts/lib/dev-db.js`:

```js
/*
 * Points this process at the development database and proves it stayed there.
 *
 * server.js loads .env and then .env.local on top (scripts/env.js), and either
 * could carry a DATABASE_URL. Setting ours first and trusting it is not enough,
 * so this loads the same chain the server loads and then compares: if the
 * database is not the one in .env.cms-dev any more, it stops before anything
 * connects. Only the host is ever printed.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', '.env.cms-dev');

function useDevDatabase() {
    if (!fs.existsSync(FILE)) {
        console.error('✗ .env.cms-dev is missing. See Task 3 of the CMS foundation plan.');
        process.exit(1);
    }
    const line = fs.readFileSync(FILE, 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='));
    if (!line) {
        console.error('✗ .env.cms-dev has no DATABASE_URL= line.');
        process.exit(1);
    }
    const url = line.slice('DATABASE_URL='.length).trim();
    process.env.DATABASE_URL = url;
    require('../env');
    process.env.NODE_ENV = 'development';

    const want = new URL(url).host;
    const got = new URL(process.env.DATABASE_URL).host;
    if (got !== want) {
        console.error(`✗ the env files replaced the development database (${want}) with ${got}. Stopping.`);
        process.exit(1);
    }
    console.log(`· development database: ${want}`);
    return { host: want };
}

module.exports = { useDevDatabase };
```

- [ ] **Step 4: Write** `scripts/dev-cms.js` and `scripts/db-push-dev.js`:

```js
#!/usr/bin/env node
// The local server on the development database. See scripts/lib/dev-db.js.
require('./lib/dev-db').useDevDatabase();
process.env.PORT = process.env.PORT || '4031';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'dev-only-secret';
require('../server.js');
```

```js
#!/usr/bin/env node
// `prisma db push` against the development database only. Not `npm run db:push`,
// which goes through scripts/with-env.js and whatever it points at.
const { execFileSync } = require('child_process');
require('./lib/dev-db').useDevDatabase();
execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'], { stdio: 'inherit', env: process.env });
```

  Add to `package.json` `scripts`:

```json
"dev:cms": "node scripts/dev-cms.js",
"db:push:cms-dev": "node scripts/db-push-dev.js",
```

- [ ] **Step 5: Add the models** to `prisma/schema.prisma`, after `model SiteContent`.
  They are the spec's §4 models plus one column the legal pages need, `noindex`
  (spec §13):

```prisma
/// One website. Only "projectnidos" exists in part 1; the table is here so the
/// same engine can later serve a client's site.
model Site {
  id        Int           @id @default(autoincrement())
  key       String        @unique
  name      String
  domain    String?
  createdAt DateTime      @default(now())
  pages     Page[]
  settings  SiteSetting[]
}

/// A page and its address. The content lives in PageVersion; publishedVersionId
/// points at the one visitors see. A plain column rather than a relation, so
/// Page and PageVersion do not reference each other in a cycle.
model Page {
  id                 Int           @id @default(autoincrement())
  siteId             Int
  site               Site          @relation(fields: [siteId], references: [id], onDelete: Cascade)
  path               String        // "/", "/nidos/pricing.html", "/404"
  title              String        // the name in the admin list
  layout             String        // "home" | "standard"
  seoTitle           String
  seoDescription     String
  noindex            Boolean       @default(false)
  publishedVersionId Int?          @unique
  deletedAt          DateTime?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt
  versions           PageVersion[]

  @@unique([siteId, path])
}

/// Every saved state of a page's blocks. Never updated in place: publishing
/// writes a new row and moves Page.publishedVersionId.
model PageVersion {
  id          Int      @id @default(autoincrement())
  pageId      Int
  page        Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)
  kind        String   // "draft" | "published"
  blocks      Json     // [{ id, type, props }]
  note        String?
  createdById Int?     // User; null for the import
  createdAt   DateTime @default(now())

  @@index([pageId, createdAt])
}

/// Site-wide values the layout needs: "nav", "footer", "labels".
model SiteSetting {
  id        Int      @id @default(autoincrement())
  siteId    Int
  site      Site     @relation(fields: [siteId], references: [id], onDelete: Cascade)
  key       String
  value     Json
  updatedAt DateTime @updatedAt
  updatedBy String?

  @@unique([siteId, key])
}
```

- [ ] **Step 6: Push to the development database.** Run
  `npm run db:push:cms-dev && npx prisma generate`. Expected output includes
  `· development database: <host>` and "Your database is now in sync". If the guard
  stops, **stop and report**. Do not work around it.
- [ ] **Step 7: Check that the server starts** with `npm run dev:cms`. Expected:
  `· development database: <host>` and the usual listen line. Stop it.
- [ ] **Step 8: Commit.**

```bash
git add prisma/schema.prisma scripts/lib/dev-db.js scripts/dev-cms.js scripts/db-push-dev.js package.json .gitignore .dockerignore
git commit -m "feat(cms): site, page, version and site setting tables, and a guarded dev database"
```

---

### Task 4: Rich text sanitiser

**Files:**
- Create: `server/cms/richtext.js`
- Test: `test/cms/richtext.test.js`

**Interfaces:**
- Produces: `sanitize(html, profile: 'inline' | 'full') → string`.
  - `inline` allows `strong em b i br a span.key`.
  - `full` adds `p ul ol li h2 h3 h4 table thead tbody tr th td`. The legal pages use
    all of these, including the cookie table.
  - Links keep only `href`, and only when it starts with `https:`, `http:`, `mailto:`,
    `/` or `#`.
  - Other tags are unwrapped and their text kept.
  - `script style iframe object embed noscript template` are removed with their
    content, and so are comments.

- [ ] **Step 1: Write the failing test** `test/cms/richtext.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitize } = require('../../server/cms/richtext');

test('keeps the inline tags the site uses', () => {
  const s = '<strong>Project Nidos</strong> and <span class="key">systems</span><br>x';
  assert.equal(sanitize(s, 'inline'), s);
});
test('strips script, style, comments and event handlers, keeps text', () => {
  assert.equal(sanitize('a<script>alert(1)</script>b<style>*{}</style><!-- c -->', 'inline'), 'ab');
  assert.equal(sanitize('<strong onclick="x()">hi</strong>', 'inline'), '<strong>hi</strong>');
  assert.equal(sanitize('<img src=x onerror=alert(1)>ok', 'inline'), 'ok');
});
test('rejects javascript links but keeps their text', () => {
  assert.equal(sanitize('<a href="javascript:alert(1)">go</a>', 'inline'), '<a>go</a>');
  assert.equal(sanitize('<a href=" JavaScript:alert(1)">go</a>', 'inline'), '<a>go</a>');
  assert.equal(sanitize('<a href="/nidos/pricing.html" target="_blank">p</a>', 'inline'),
    '<a href="/nidos/pricing.html">p</a>');
});
test('span keeps only class="key"', () => {
  assert.equal(sanitize('<span class="evil key" style="x">a</span>', 'inline'), '<span class="key">a</span>');
  assert.equal(sanitize('<span style="x">a</span>', 'inline'), 'a');
});
test('full profile allows block structure and tables, inline does not', () => {
  const s = '<h2>T</h2><p>a</p><ul><li>b</li></ul><table><tbody><tr><td>c</td></tr></tbody></table>';
  assert.equal(sanitize(s, 'full'), s);
  assert.equal(sanitize(s, 'inline'), 'Tabc');
});
test('null and undefined become empty', () => {
  assert.equal(sanitize(undefined, 'inline'), '');
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL, `Cannot find module`.
- [ ] **Step 3: Implement** `server/cms/richtext.js`:

```js
/*
 * The allow-list for text that carries markup. Everything else a block draws is
 * escaped; this is the one place HTML typed into the editor reaches the page, so
 * it runs on import, on save and again at render.
 */
const cheerio = require('cheerio');

const INLINE = new Set(['strong', 'em', 'b', 'i', 'br', 'a', 'span']);
const FULL = new Set([...INLINE, 'p', 'ul', 'ol', 'li', 'h2', 'h3', 'h4',
  'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template']);
const SAFE_HREF = /^(https?:|mailto:|\/|#)/i;

function sanitize(html, profile) {
  const allowed = profile === 'full' ? FULL : INLINE;
  const $ = cheerio.load(`<div id="__r">${html == null ? '' : String(html)}</div>`, null, false);
  const root = $('#__r')[0];

  // Children before parents, so unwrapping a node never skips one inside it.
  const walk = (node) => {
    $(node).contents().each((_, child) => walk(child));
    if (node === root) return;
    if (node.type === 'comment' || node.type === 'directive' || node.type === 'cdata') { $(node).remove(); return; }
    if (node.type !== 'tag' && node.type !== 'script' && node.type !== 'style') return;
    const tag = node.name.toLowerCase();
    if (DROP.has(tag)) { $(node).remove(); return; }
    if (!allowed.has(tag)) { $(node).replaceWith($(node).contents()); return; }
    const attrs = node.attribs || {};
    const keep = {};
    if (tag === 'a' && attrs.href && SAFE_HREF.test(attrs.href.trim())) keep.href = attrs.href.trim();
    if (tag === 'span') {
      if (!(attrs.class || '').split(/\s+/).includes('key')) { $(node).replaceWith($(node).contents()); return; }
      keep.class = 'key';
    }
    node.attribs = keep;
  };
  walk(root);
  return $(root).html();
}

module.exports = { sanitize };
```

- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.**

```bash
git add server/cms/richtext.js test/cms/richtext.test.js
git commit -m "feat(cms): rich text allow-list sanitiser"
```

---

### Task 5: Field limits, page validation, block registry, static guard

**Files:**
- Create: `server/cms/fields.js`, `server/cms/validate.js`, `blocks/index.js`
- Modify: `server.js` (the `BLOCKED_PREFIXES` list)
- Test: `test/cms/fields.test.js`, `test/cms/validate.test.js`

**Interfaces:**

- **Field definitions:**
  - `{ type: 'text' | 'longtext', label, max, required? }`
  - `{ type: 'richtext', label, max, profile: 'inline' | 'full', required? }`. `max`
    counts text, not markup.
  - `{ type: 'select', label, options: string[], required? }`
  - `{ type: 'link', label, required? }`: a string starting with `/`, `#`, `http://`,
    `https://` or `mailto:`.
  - `{ type: 'anchor', label, required? }`: matches `^[a-z][a-z0-9-]{0,40}$`.
  - `{ type: 'list', label, of: { …fields } | 'string', min, max, itemMax? }`.
    `'string'` means plain text items, each up to `itemMax` (default 90).
  - `{ type: 'group', label, of: { …fields }, required? }`: a nested object.
- **Block definition**, as `blocks/<type>/index.js` exports it:

  ```
  {
    type, label,
    layouts: ('home' | 'standard')[],
    maxPerPage?,
    fields,
    anchor(props) → string | null,
    assets(props) → ('shared' | 'visuals' | 'diagrams' | 'orbit')[],
    render(props, ctx) → string,
  }
  ```

- **Render `ctx`**, built in Task 11:
  `{ page: { path, layout }, esc, rich: sanitize, anchors: Set<string> }`.
- **Produces:**
  - `validateProps(fields, props, prefix = '') → Array<{ path, message }>`
  - `validatePage(layout, blocks, getBlock?) → Array<{ path, message }>`
  - `getBlock(type)`, `BLOCK_TYPES`

- [ ] **Step 1: Write the failing test** `test/cms/fields.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProps } = require('../../server/cms/fields');

const F = {
  title: { type: 'text', label: 'Title', max: 10, required: true },
  body: { type: 'richtext', label: 'Body', max: 50, profile: 'inline' },
  kind: { type: 'select', label: 'Kind', options: ['a', 'b'] },
  link: { type: 'link', label: 'Link' },
  anchor: { type: 'anchor', label: 'Anchor' },
  items: { type: 'list', label: 'Items', min: 1, max: 2, of: { t: { type: 'text', label: 'T', max: 3, required: true } } },
  tags: { type: 'list', label: 'Tags', min: 0, max: 3, itemMax: 4, of: 'string' },
  btn: { type: 'group', label: 'Button', required: true, of: { label: { type: 'text', label: 'L', max: 5, required: true } } },
};
const ok = { title: 'Hi', body: 'x', kind: 'a', link: '/p', anchor: 'about', items: [{ t: 'abc' }], tags: ['ab'], btn: { label: 'Go' } };

test('valid props pass', () => assert.deepEqual(validateProps(F, ok), []));
test('required and max', () => {
  const e = validateProps(F, { ...ok, title: '', items: [{ t: 'abcd' }] });
  assert.deepEqual(e.map((x) => x.path), ['title', 'items[0].t']);
});
test('select, link, anchor', () => {
  const e = validateProps(F, { ...ok, kind: 'z', link: 'javascript:x', anchor: 'Bad Anchor' });
  assert.deepEqual(e.map((x) => x.path), ['kind', 'link', 'anchor']);
});
test('list bounds, string lists, groups', () => {
  assert.deepEqual(validateProps(F, { ...ok, items: [] }).map((x) => x.path), ['items']);
  assert.deepEqual(validateProps(F, { ...ok, tags: ['ab', 'toolong', 3] }).map((x) => x.path), ['tags[1]', 'tags[2]']);
  assert.deepEqual(validateProps(F, { ...ok, btn: { label: '' } }).map((x) => x.path), ['btn.label']);
  assert.deepEqual(validateProps(F, { ...ok, btn: null }).map((x) => x.path), ['btn']);
});
test('rich text length is measured on text, not markup', () => {
  assert.deepEqual(validateProps(F, { ...ok, body: '<strong>' + 'a'.repeat(50) + '</strong>' }), []);
  assert.deepEqual(validateProps(F, { ...ok, body: 'a'.repeat(51) }).map((x) => x.path), ['body']);
});
test('unknown props are rejected', () => {
  assert.deepEqual(validateProps(F, { ...ok, extra: 1 }).map((x) => x.path), ['extra']);
});
```

- [ ] **Step 2: Implement** `server/cms/fields.js`:

```js
/*
 * Field limits for block props. The limits are the design: a headline that
 * fits in 40 characters is one the layout was drawn for, so the editor refuses
 * a longer one rather than letting the page break.
 */
const cheerio = require('cheerio');

const LINK = /^(\/|#|https?:\/\/|mailto:)/;
const ANCHOR = /^[a-z][a-z0-9-]{0,40}$/;
const textLength = (html) => cheerio.load(`<div>${html}</div>`, null, false).root().text().length;

function validateProps(fields, props, prefix = '') {
  const errors = [];
  const at = (k) => (prefix ? `${prefix}.${k}` : k);
  const push = (path, message) => errors.push({ path, message });
  const p = props && typeof props === 'object' ? props : {};

  for (const key of Object.keys(p)) if (!fields[key]) push(at(key), 'Not a field of this block.');

  for (const [key, f] of Object.entries(fields)) {
    const v = p[key];
    const path = at(key);
    if (v === undefined || v === null || v === '') {
      if (f.required) push(path, `${f.label} is required.`);
      continue;
    }
    switch (f.type) {
      case 'text':
      case 'longtext':
        if (typeof v !== 'string') push(path, `${f.label} must be text.`);
        else if (v.length > f.max) push(path, `${f.label} is ${v.length} characters; the limit is ${f.max}.`);
        break;
      case 'richtext':
        if (typeof v !== 'string') push(path, `${f.label} must be text.`);
        else if (textLength(v) > f.max) push(path, `${f.label} is longer than ${f.max} characters.`);
        break;
      case 'select':
        if (!f.options.includes(v)) push(path, `${f.label} must be one of: ${f.options.join(', ')}.`);
        break;
      case 'link':
        if (typeof v !== 'string' || !LINK.test(v)) push(path, `${f.label} must start with /, #, https:// or mailto:.`);
        break;
      case 'anchor':
        if (typeof v !== 'string' || !ANCHOR.test(v)) push(path, `${f.label} must be lowercase letters, digits and dashes.`);
        break;
      case 'list': {
        if (!Array.isArray(v)) { push(path, `${f.label} must be a list.`); break; }
        const min = f.min || 0;
        if (v.length < min || v.length > f.max) {
          push(path, `${f.label} needs between ${min} and ${f.max} items; it has ${v.length}.`);
          break;
        }
        if (f.of === 'string') {
          const itemMax = f.itemMax || 90;
          v.forEach((item, i) => {
            if (typeof item !== 'string' || !item.length || item.length > itemMax) {
              push(`${path}[${i}]`, `Each item is text of 1 to ${itemMax} characters.`);
            }
          });
        } else {
          v.forEach((item, i) => errors.push(...validateProps(f.of, item, `${path}[${i}]`)));
        }
        break;
      }
      case 'group':
        errors.push(...validateProps(f.of, v, path));
        break;
      default:
        push(path, `Unknown field type ${f.type}.`);
    }
  }
  return errors;
}

module.exports = { validateProps };
```

- [ ] **Step 3: Write the failing test** `test/cms/validate.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePage } = require('../../server/cms/validate');

const reg = {
  hero: { type: 'hero', label: 'Hero', layouts: ['home'], maxPerPage: 1, fields: { t: { type: 'text', label: 'T', max: 5, required: true } } },
  text: { type: 'text', label: 'Text', layouts: ['home', 'standard'], fields: {} },
};
const get = (t) => reg[t];

test('accepts a valid page', () => {
  assert.deepEqual(validatePage('home', [{ id: 'a', type: 'hero', props: { t: 'x' } }], get), []);
});
test('unknown type and wrong layout', () => {
  const e = validatePage('standard', [
    { id: 'a', type: 'nope', props: {} },
    { id: 'b', type: 'hero', props: { t: 'x' } },
  ], get);
  assert.deepEqual(e.map((x) => x.path), ['blocks[0]', 'blocks[1]']);
});
test('max per page, then the block\'s own field errors', () => {
  const e = validatePage('home', [
    { id: 'a', type: 'hero', props: { t: 'x' } },
    { id: 'b', type: 'hero', props: { t: 'toolong' } },
  ], get);
  assert.deepEqual(e.map((x) => x.path), ['blocks[1]', 'blocks[1].t']);
});
test('block ids must be unique', () => {
  const e = validatePage('home', [{ id: 'a', type: 'text', props: {} }, { id: 'a', type: 'text', props: {} }], get);
  assert.deepEqual(e.map((x) => x.path), ['blocks[1].id']);
});
test('a page is a list', () => {
  assert.deepEqual(validatePage('home', null, get).map((x) => x.path), ['blocks']);
});
```

- [ ] **Step 4: Implement** `server/cms/validate.js`:

```js
const { validateProps } = require('./fields');

function validatePage(layout, blocks, getBlock = require('../../blocks').getBlock) {
  if (!Array.isArray(blocks)) return [{ path: 'blocks', message: 'A page is a list of blocks.' }];
  const errors = [];
  const ids = new Set();
  const counts = {};
  blocks.forEach((b, i) => {
    const path = `blocks[${i}]`;
    if (!b || typeof b.id !== 'string' || !b.id || ids.has(b.id)) {
      errors.push({ path: `${path}.id`, message: 'Every block needs a unique id.' });
    } else {
      ids.add(b.id);
    }
    const def = b && getBlock(b.type);
    if (!def) { errors.push({ path, message: `Unknown block type "${b && b.type}".` }); return; }
    if (!def.layouts.includes(layout)) {
      errors.push({ path, message: `${def.label} cannot be used on a "${layout}" page yet.` });
      return;
    }
    counts[b.type] = (counts[b.type] || 0) + 1;
    if (def.maxPerPage && counts[b.type] > def.maxPerPage) {
      errors.push({ path, message: `Only ${def.maxPerPage} ${def.label} per page.` });
    }
    errors.push(...validateProps(def.fields, b.props, path));
  });
  return errors;
}

module.exports = { validatePage };
```

- [ ] **Step 5: Create the registry** `blocks/index.js`. It starts empty; Tasks 6–9
  add to `TYPES`.

```js
/*
 * Every block the site can draw. A block is a folder with an index.js; see the
 * contract in docs/superpowers/specs/2026-09-23-cms-foundation-design.md §5.
 */
const TYPES = [];

const registry = new Map(TYPES.map((t) => [t, require(`./${t}`)]));

module.exports = {
  getBlock: (type) => registry.get(type),
  BLOCK_TYPES: TYPES,
};
```

- [ ] **Step 6: Keep the new folders off the public site.** `express.static` serves the
  repo root, and `.js` is on its allow-list. In `server.js`, extend
  `BLOCKED_PREFIXES`:

```js
const BLOCKED_PREFIXES = ['/server/', '/node_modules/', '/prisma/', '/scripts/', '/.git/', '/blocks/', '/test/'];
```

- [ ] **Step 7: Run** `npm test`. Expected: all pass. Then start the dummy-database
  server from Task 2 Step 1 and run
  `curl -s -o /dev/null -w '%{http_code}\n' localhost:4031/blocks/index.js`.
  Expected: `404`.
- [ ] **Step 8: Commit.**

```bash
git add server/cms/fields.js server/cms/validate.js blocks/index.js server.js test/cms
git commit -m "feat(cms): field limits, page validation and the block registry"
```

---

### Task 6: Home blocks: hero, text, practice-cards, reasons, contact-form

**Files:**
- Create: `blocks/hero/index.js`, `blocks/text/index.js`,
  `blocks/practice-cards/index.js`, `blocks/reasons/index.js`,
  `blocks/contact-form/index.js`
- Modify: `blocks/index.js`
- Test: `test/blocks/home.test.js`

**Interfaces:**
- Consumes:
  - `esc` (`scripts/lib/render.js`);
  - `VISUALS` (`scripts/lib/practice-visuals.js`: `{ key: { draw(), length } }`);
  - `whyGlyph`, `WHY_GLYPHS` (`scripts/lib/why-glyphs.js`);
  - `sanitize` (Task 4).
- Produces these types and props:
  - `hero`:
    - `{ titleLead, titleAccent, lede, primary: { label, href }, secondary: { label, href } }`
  - `text`:
    - `{ anchor?, heading, subheading?, body }`
  - `practice-cards`:
    - `{ anchor?, heading, sideLink: { label, href }, cards: [{ title, summary, link: { label, href }, diagram }] }`
  - `reasons`:
    - `{ anchor?, heading, items: [{ icon, claim, support }] }` (exactly 3)
  - `contact-form`:
    - `{ anchor?, heading, lede, infoHeading, infoBody, emailLabel, email, labels: { name, email, interest, message }, options: [{ value, text }], submit }`

The markup below is copied from `site/landing.template.html` and the block builders in
`scripts/build-landing.js`. **The file is the truth:** if a test shows a difference,
change the block, never the normaliser.

- [ ] **Step 1: Write the failing test** `test/blocks/home.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { normalizeHtml, sectionOf } = require('../helpers/html');
const { getBlock } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');
const c = require('../../site/content.en.json');

const file = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const ctx = { page: { path: '/', layout: 'home' }, esc, rich: sanitize, anchors: new Set() };
const same = (type, props, selector) =>
  assert.equal(normalizeHtml(`<body>${getBlock(type).render(props, ctx)}</body>`),
               normalizeHtml(`<body>${sectionOf(file, selector)}</body>`));

test('hero', () => same('hero', {
  titleLead: c.hero.titleLead, titleAccent: c.hero.titleAccent, lede: c.hero.subtitleHTML,
  primary: { label: c.hero.cta, href: '#contact' },
  secondary: { label: c.hero.ctaSecondary, href: c.hero.ctaSecondaryHref },
}, 'section.hero'));

test('text (about)', () => same('text', {
  anchor: 'about', heading: c.about.heading, subheading: c.about.subheading, body: c.about.bodyHTML,
}, 'section#about'));

test('practice-cards', () => same('practice-cards', {
  anchor: 'practices', heading: c.practices.heading,
  sideLink: { label: c.practices.pricingLabel, href: c.practices.pricingHref },
  cards: c.practices.items.map((p) => ({ title: p.title, summary: p.summary, link: { label: p.linkText, href: p.href }, diagram: p.key })),
}, 'section#practices'));

test('reasons', () => same('reasons', { heading: c.why.heading, items: c.why.items }, 'section.why'));

test('contact-form', () => same('contact-form', {
  anchor: 'contact', heading: c.contact.heading, lede: c.contact.lede, infoHeading: c.contact.infoHeading,
  infoBody: c.contact.infoBody, emailLabel: c.contact.emailLabel, email: c.contact.email,
  labels: c.contact.labels, options: c.contact.options.map(({ value, text }) => ({ value, text })), submit: c.contact.submit,
}, 'section#contact'));

test('reasons with no anchor has no id', () => {
  assert.doesNotMatch(getBlock('reasons').render({ heading: 'h', items: c.why.items }, ctx), /<section id=/);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL, since `getBlock('hero')` is
  undefined.
- [ ] **Step 3: Implement the five blocks.**

`blocks/hero/index.js`:

```js
const button = { type: 'group', required: true, of: {
  label: { type: 'text', label: 'Label', max: 28, required: true },
  href: { type: 'link', label: 'Link', required: true },
} };

module.exports = {
  type: 'hero',
  label: 'Hero',
  layouts: ['home'],
  maxPerPage: 1,
  fields: {
    titleLead: { type: 'text', label: 'Headline, line 1', max: 40, required: true },
    titleAccent: { type: 'text', label: 'Headline, line 2', max: 40, required: true },
    lede: { type: 'richtext', label: 'Lede', max: 320, profile: 'inline', required: true },
    primary: { ...button, label: 'Primary button' },
    secondary: { ...button, label: 'Secondary button' },
  },
  anchor: () => null,
  assets: () => ['orbit'],
  render(p, { esc, rich }) {
    return `<section class="hero">
<canvas class="hero-orbit" aria-hidden="true"></canvas>
<div class="wrap">
<h1 class="hero-title"><span>${esc(p.titleLead)}</span><br><span>${esc(p.titleAccent)}</span></h1>
<div class="hero-foot">
<div class="hero-actions">
<a href="${esc(p.primary.href)}" class="btn-primary">${esc(p.primary.label)}</a>
<a href="${esc(p.secondary.href)}" class="btn-quiet">${esc(p.secondary.label)}</a>
</div>
<p class="hero-lede">${rich(p.lede, 'inline')}</p>
</div>
</div>
</section>`;
  },
};
```

`blocks/text/index.js`. It covers the About section. The portrait is not carried over,
because image upload is out of scope (spec §12).

```js
module.exports = {
  type: 'text',
  label: 'Text',
  layouts: ['home'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    subheading: { type: 'text', label: 'Subheading', max: 100 },
    body: { type: 'richtext', label: 'Body', max: 1200, profile: 'inline', required: true },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const sub = p.subheading ? `\n<h3 class="about-sub">${esc(p.subheading)}</h3>` : '';
    return `<section${id} class="about">
<div class="wrap about-grid">
<div class="about-prose">
<h2 class="section-title">${esc(p.heading)}</h2>${sub}
<p>${rich(p.body, 'inline')}</p>
</div>
</div>
</section>`;
  },
};
```

`blocks/practice-cards/index.js`:

```js
const { VISUALS } = require('../../scripts/lib/practice-visuals');

const DIAGRAMS = [...Object.keys(VISUALS), 'none'];
const hasDiagram = (c) => c.diagram !== 'none' && VISUALS[c.diagram];

module.exports = {
  type: 'practice-cards',
  label: 'Practice cards',
  layouts: ['home'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    sideLink: { type: 'group', label: 'Side link', required: true, of: {
      label: { type: 'text', label: 'Label', max: 28, required: true },
      href: { type: 'link', label: 'Link', required: true },
    } },
    cards: { type: 'list', label: 'Cards', min: 1, max: 9, of: {
      title: { type: 'text', label: 'Title', max: 48, required: true },
      summary: { type: 'text', label: 'Summary', max: 140, required: true },
      link: { type: 'group', label: 'Link', required: true, of: {
        label: { type: 'text', label: 'Label', max: 24, required: true },
        href: { type: 'link', label: 'Link', required: true },
      } },
      diagram: { type: 'select', label: 'Diagram', options: DIAGRAMS, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: (p) => (p.cards.some(hasDiagram) ? ['visuals', 'diagrams'] : []),
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const cards = p.cards.map((c) => {
      const v = hasDiagram(c);
      const visual = v ? `<div class="card-visual" aria-hidden="true" data-length="${v.length}">${v.draw()}</div>\n` : '';
      return `<li class="card">
${visual}<h3>${esc(c.title)}</h3>
<p class="card-body">${esc(c.summary)}</p>
<a class="card-link" href="${esc(c.link.href)}">${esc(c.link.label)}</a>
</li>`;
    }).join('\n');
    return `<section${id} class="practices">
<div class="wrap">
<div class="practices-head">
<h2 class="section-title">${esc(p.heading)}</h2>
<a class="pricing-link hit-44" href="${esc(p.sideLink.href)}">${esc(p.sideLink.label)}</a>
</div>
</div>
<div class="wrap">
<ul class="index">
${cards}
</ul>
</div>
</section>`;
  },
};
```

`blocks/reasons/index.js`. It is allowed on both layouts, because `shared.css` carries
its styles on both pages today.

```js
const { whyGlyph, WHY_GLYPHS } = require('../../scripts/lib/why-glyphs');

module.exports = {
  type: 'reasons',
  label: 'Three reasons',
  layouts: ['home', 'standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    items: { type: 'list', label: 'Reasons', min: 3, max: 3, of: {
      icon: { type: 'select', label: 'Icon', options: Object.keys(WHY_GLYPHS), required: true },
      claim: { type: 'text', label: 'Claim', max: 48, required: true },
      support: { type: 'text', label: 'Support', max: 80, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => ['shared'],
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const items = p.items.map((w) => `<div class="why-item">
<span class="why-icon">${whyGlyph(w.icon)}</span>
<p class="why-claim"><span>${esc(w.claim)}</span></p>
<p class="why-support">${esc(w.support)}</p>
</div>`).join('\n');
    return `<section${id} class="why">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<div class="why-list">
${items}
</div>
</div>
</section>`;
  },
};
```

`blocks/contact-form/index.js`:
- Option values must be keys of the `leads.interestMap` setting, or the CRM files the
  lead as "general". The import checks this (Task 12), and the part 2 editor will offer
  them as a choice.
- `landing.js` finds the form by these exact ids and classes, so they are fixed here,
  not fields.

```js
module.exports = {
  type: 'contact-form',
  label: 'Contact form',
  layouts: ['home'],
  maxPerPage: 1,
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 60, required: true },
    lede: { type: 'text', label: 'Lede', max: 160, required: true },
    infoHeading: { type: 'text', label: 'Side heading', max: 40, required: true },
    infoBody: { type: 'longtext', label: 'Side text', max: 300, required: true },
    emailLabel: { type: 'text', label: 'Email label', max: 48, required: true },
    email: { type: 'text', label: 'Email address', max: 80, required: true },
    labels: { type: 'group', label: 'Field labels', required: true, of: {
      name: { type: 'text', label: 'Name', max: 32, required: true },
      email: { type: 'text', label: 'Email', max: 32, required: true },
      interest: { type: 'text', label: 'Interest', max: 40, required: true },
      message: { type: 'text', label: 'Message', max: 32, required: true },
    } },
    options: { type: 'list', label: 'Interest options', min: 1, max: 10, of: {
      value: { type: 'anchor', label: 'CRM lead category', required: true },
      text: { type: 'text', label: 'Text', max: 40, required: true },
    } },
    submit: { type: 'text', label: 'Button label', max: 28, required: true },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const L = p.labels;
    const options = p.options.map((o) => `<option value="${esc(o.value)}">${esc(o.text)}</option>`).join('\n');
    return `<section${id} class="contact">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<p class="contact-lede">${esc(p.lede)}</p>
<div class="contact-block">
<div class="contact-info">
<p class="label">${esc(p.infoHeading)}</p>
<p class="contact-body">${esc(p.infoBody)}</p>
<p class="label">${esc(p.emailLabel)}</p>
<a class="contact-email hit-44" href="mailto:${esc(p.email)}">${esc(p.email)}</a>
</div>
<form class="contact-form" action="/api/webhooks/form-lead" method="POST" novalidate>
<div class="form-row">
<div class="field">
<div class="field-box">
<label for="name">${esc(L.name)}</label>
<input type="text" id="name" name="name" autocomplete="name" required aria-describedby="name-err">
</div>
<span class="field-err" id="name-err"></span>
</div>
<div class="field">
<div class="field-box">
<label for="email">${esc(L.email)}</label>
<input type="email" id="email" name="email" autocomplete="email" required aria-describedby="email-err">
</div>
<span class="field-err" id="email-err"></span>
</div>
</div>
<div class="field field-select">
<div class="field-box">
<label for="interest">${esc(L.interest)}</label>
<select id="interest" name="interest">
${options}
</select>
</div>
</div>
<div class="field">
<div class="field-box">
<label for="message">${esc(L.message)}</label>
<textarea id="message" name="message" rows="5" required aria-describedby="message-err"></textarea>
</div>
<span class="field-err" id="message-err"></span>
</div>
<p class="form-status" role="status" aria-live="polite"></p>
<button type="submit" class="btn-primary">${esc(p.submit)}</button>
</form>
</div>
</div>
</section>`;
  },
};
```

- [ ] **Step 4: Register them.** In `blocks/index.js`:

```js
const TYPES = ['hero', 'text', 'practice-cards', 'reasons', 'contact-form'];
```

- [ ] **Step 5: Run** `npm test`. Expected: all home block tests pass. On a failure,
  print both normalised strings with `console.log` and fix the block.
- [ ] **Step 6: Commit.**

```bash
git add blocks test/blocks
git commit -m "feat(cms): home blocks - hero, text, practice cards, reasons, contact form"
```

---

### Task 7: Services blocks: page-intro, service-catalogue, steps, contact-info

**Files:**
- Create: `blocks/page-intro/index.js`, `blocks/service-catalogue/index.js`,
  `blocks/steps/index.js`, `blocks/contact-info/index.js`
- Modify: `blocks/index.js`
- Test: `test/blocks/services.test.js`

**Interfaces:**
- Produces these types and props:
  - `page-intro`:
    - `{ back?: { label, href }, titleLead, titleAccent?, lede? }`
    - `lede` is rich inline.
  - `service-catalogue`:
    - `{ anchor?, heading, tocLabel, tocAria, practices: [{ anchor, title, tocText, outcome, diagram, body, problemLabel, problemText, scopeHeading, scope: string[], pkgHeading, pkgName, pkgBody, pkgNote?, priceLead, price, priceNote? }] }`
    - Numbers (`01`…) come from the order.
  - `steps`:
    - `{ anchor?, heading, lede?, items: [{ title, body, price? }] }`
    - Numbers come from the order.
  - `contact-info`:
    - `{ anchor?, heading, subheading, body, emailLabel, email, cta: { label, href }, links: [{ label, href }] }`

The markup comes from `site/digitalization.template.html` and
`scripts/build-digitalization.js`, after Task 2.

- [ ] **Step 1: Write the failing test** `test/blocks/services.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { normalizeHtml, sectionOf } = require('../helpers/html');
const { getBlock } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');
const d = require('../../site/digi.en.json');

const P = '/nidos/digitalization.html';
const file = fs.readFileSync(path.join(__dirname, '../..', P), 'utf8');
const ctx = { page: { path: P, layout: 'standard' }, esc, rich: sanitize, anchors: new Set() };
const same = (type, props, selector) =>
  assert.equal(normalizeHtml(`<body>${getBlock(type).render(props, ctx)}</body>`, P),
               normalizeHtml(`<body>${sectionOf(file, selector)}</body>`, P));

test('page-intro', () => same('page-intro', {
  back: { label: d.hero.back, href: d.hero.backHref }, titleLead: d.hero.titleLead,
  titleAccent: d.hero.titleAccent, lede: d.hero.ledeHTML,
}, 'section.page-hero'));

test('service-catalogue', () => same('service-catalogue', {
  anchor: d.ids.practices, heading: d.practices.heading, tocLabel: d.a11y.tocHeading, tocAria: d.a11y.toc,
  practices: d.practices.items.map((p) => ({
    anchor: p.id, title: p.title, tocText: d.toc.items.find((t) => t.href === `#${p.id}`).text,
    outcome: p.outcome, diagram: p.key, body: p.body, problemLabel: p.problemLabel, problemText: p.problemText,
    scopeHeading: p.scopeHeading, scope: p.scope, pkgHeading: p.pkgHeading, pkgName: p.pkgName,
    pkgBody: p.pkgBody, pkgNote: p.pkgNote, priceLead: p.priceLead, price: p.price, priceNote: p.priceNote,
  })),
}, `section#${d.ids.practices}`));

test('steps', () => same('steps', {
  anchor: d.ids.process, heading: d.process.heading,
  items: d.process.steps.map(({ title, body, price }) => (price ? { title, body, price } : { title, body })),
}, `section#${d.ids.process}`));

test('contact-info', () => same('contact-info', {
  anchor: d.ids.contact, heading: d.contact.heading, subheading: d.contact.subheading, body: d.contact.bodyHTML,
  emailLabel: d.contact.emailLabel, email: d.contact.email,
  cta: { label: d.contact.cta.text, href: d.contact.cta.href },
  links: d.contact.links.map((l) => ({ label: l.text, href: l.href })),
}, `section#${d.ids.contact}`));

test('page-intro without back link or accent', () => {
  const html = getBlock('page-intro').render({ titleLead: 'Privacy Policy' }, ctx);
  assert.doesNotMatch(html, /back-link|<br>|page-lede/);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**

`blocks/page-intro/index.js`:

```js
module.exports = {
  type: 'page-intro',
  label: 'Page intro',
  layouts: ['standard'],
  maxPerPage: 1,
  fields: {
    back: { type: 'group', label: 'Back link', of: {
      label: { type: 'text', label: 'Label', max: 32, required: true },
      href: { type: 'link', label: 'Link', required: true },
    } },
    titleLead: { type: 'text', label: 'Title, line 1', max: 60, required: true },
    titleAccent: { type: 'text', label: 'Title, line 2', max: 60 },
    lede: { type: 'richtext', label: 'Lede', max: 360, profile: 'inline' },
  },
  anchor: () => null,
  assets: () => [],
  render(p, { esc, rich }) {
    const back = p.back ? `<a class="back-link hit-44" href="${esc(p.back.href)}">${esc(p.back.label)}</a>\n` : '';
    const title = esc(p.titleLead) + (p.titleAccent ? `<br>${esc(p.titleAccent)}` : '');
    const lede = p.lede ? `\n<div class="page-lede">\n<p>${rich(p.lede, 'inline')}</p>\n</div>` : '';
    return `<section class="page-hero">
<div class="wrap">
${back}<h1 class="page-title">${title}</h1>${lede}
</div>
</section>`;
  },
};
```

`blocks/service-catalogue/index.js`:

```js
const { VISUALS } = require('../../scripts/lib/practice-visuals');

const DIAGRAMS = [...Object.keys(VISUALS), 'none'];
const two = (i) => String(i + 1).padStart(2, '0');
const hasDiagram = (x) => x.diagram !== 'none' && VISUALS[x.diagram];

module.exports = {
  type: 'service-catalogue',
  label: 'Service catalogue',
  layouts: ['standard'],
  maxPerPage: 1,
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    tocLabel: { type: 'text', label: '"On this page" label', max: 40, required: true },
    tocAria: { type: 'text', label: 'Index name for screen readers', max: 40, required: true },
    practices: { type: 'list', label: 'Practices', min: 1, max: 9, of: {
      anchor: { type: 'anchor', label: 'Anchor', required: true },
      title: { type: 'text', label: 'Title', max: 60, required: true },
      tocText: { type: 'text', label: 'Name in the index', max: 60, required: true },
      outcome: { type: 'text', label: 'Outcome', max: 120, required: true },
      diagram: { type: 'select', label: 'Diagram', options: DIAGRAMS, required: true },
      body: { type: 'longtext', label: 'Description', max: 400, required: true },
      problemLabel: { type: 'text', label: 'Problem label', max: 24, required: true },
      problemText: { type: 'text', label: 'Client problem', max: 200, required: true },
      scopeHeading: { type: 'text', label: 'Scope heading', max: 40, required: true },
      scope: { type: 'list', label: 'Scope', min: 1, max: 14, itemMax: 90, of: 'string' },
      pkgHeading: { type: 'text', label: 'Package heading', max: 40, required: true },
      pkgName: { type: 'text', label: 'Package name', max: 48, required: true },
      pkgBody: { type: 'longtext', label: 'Package text', max: 400, required: true },
      pkgNote: { type: 'text', label: 'Package note', max: 200 },
      priceLead: { type: 'text', label: 'Price lead', max: 12, required: true },
      price: { type: 'text', label: 'Price', max: 24, required: true },
      priceNote: { type: 'text', label: 'Price note', max: 160 },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: (p) => (p.practices.some(hasDiagram) ? ['visuals', 'diagrams'] : []),
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const toc = p.practices.map((x, i) =>
      `<li><a href="#${esc(x.anchor)}"><span class="toc-num">${two(i)}</span>${esc(x.tocText)}</a></li>`).join('\n');
    const items = p.practices.map((x, i) => {
      const v = hasDiagram(x);
      const visual = v ? `\n<div class="card-visual practice-visual" aria-hidden="true" data-length="${v.length}">${v.draw()}</div>` : '';
      const pkgNote = x.pkgNote ? `\n<p class="pkg-note">${esc(x.pkgNote)}</p>` : '';
      const priceNote = x.priceNote ? `\n<p class="price-note">${esc(x.priceNote)}</p>` : '';
      return `<article class="practice" id="${esc(x.anchor)}">
<div class="practice-id">
<p class="practice-num">${two(i)}</p>
<h2>${esc(x.title)}</h2>
<p class="practice-outcome">${esc(x.outcome)}</p>${visual}
</div>
<div class="practice-detail">
<p class="practice-body">${esc(x.body)}</p>
<p class="practice-problem"><span class="label">${esc(x.problemLabel)}</span>${esc(x.problemText)}</p>
<h3 class="sub">${esc(x.scopeHeading)}</h3>
<ul class="scope-list">
${x.scope.map((s) => `<li>${esc(s)}</li>`).join('\n')}
</ul>
<h3 class="sub">${esc(x.pkgHeading)}</h3>
<p class="pkg-name">${esc(x.pkgName)}</p>
<p class="pkg-body">${esc(x.pkgBody)}</p>${pkgNote}
<p class="practice-price">${esc(x.priceLead)} <span>${esc(x.price)}</span></p>${priceNote}
</div>
</article>`;
    }).join('\n');
    return `<section${id} class="practices">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<nav class="toc" aria-label="${esc(p.tocAria)}">
<p class="label">${esc(p.tocLabel)}</p>
<ol>
${toc}
</ol>
</nav>
</div>
<div class="wrap">
<div class="lattice practice-list">
${items}
</div>
</div>
</section>`;
  },
};
```

`blocks/steps/index.js`. After Task 2, Services and Pricing share this markup.

```js
const two = (i) => String(i + 1).padStart(2, '0');

module.exports = {
  type: 'steps',
  label: 'Steps',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    lede: { type: 'richtext', label: 'Lede', max: 400, profile: 'inline' },
    items: { type: 'list', label: 'Steps', min: 2, max: 6, of: {
      title: { type: 'text', label: 'Title', max: 32, required: true },
      body: { type: 'text', label: 'Text', max: 120, required: true },
      price: { type: 'text', label: 'Price', max: 32 },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const lede = p.lede ? `\n<p class="section-lede">${rich(p.lede, 'inline')}</p>` : '';
    const items = p.items.map((s, i) => `<li class="step">
<p class="step-num">${two(i)}</p>
<h3 class="step-title">${esc(s.title)}</h3>
<p class="step-body">${esc(s.body)}</p>${s.price ? `\n<p class="step-price">${esc(s.price)}</p>` : ''}
</li>`).join('\n');
    return `<section${id} class="pricing-section">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>${lede}
<ol class="steps">
${items}
</ol>
</div>
</section>`;
  },
};
```

`blocks/contact-info/index.js`:

```js
module.exports = {
  type: 'contact-info',
  label: 'Contact info',
  layouts: ['standard'],
  maxPerPage: 1,
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 60, required: true },
    subheading: { type: 'text', label: 'Subheading', max: 60, required: true },
    body: { type: 'richtext', label: 'Text', max: 300, profile: 'inline', required: true },
    emailLabel: { type: 'text', label: 'Email label', max: 48, required: true },
    email: { type: 'text', label: 'Email address', max: 80, required: true },
    cta: { type: 'group', label: 'Button', required: true, of: {
      label: { type: 'text', label: 'Label', max: 40, required: true },
      href: { type: 'link', label: 'Link', required: true },
    } },
    links: { type: 'list', label: 'Links', min: 0, max: 3, of: {
      label: { type: 'text', label: 'Label', max: 32, required: true },
      href: { type: 'link', label: 'Link', required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const links = (p.links || []).map((l) => `\n<a class="quiet-link hit-44" href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
    return `<section${id} class="contact">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<div class="lattice contact-block">
<div>
<h3 class="contact-sub">${esc(p.subheading)}</h3>
<p class="contact-body">${rich(p.body, 'inline')}</p>
</div>
<div>
<p class="label">${esc(p.emailLabel)}</p>
<a class="contact-email hit-44" href="mailto:${esc(p.email)}">${esc(p.email)}</a>
<div class="contact-actions">
<a href="${esc(p.cta.href)}" class="btn-primary">${esc(p.cta.label)}</a>${links}
</div>
</div>
</div>
</div>
</section>`;
  },
};
```

- [ ] **Step 4: Register them.** Add
  `'page-intro', 'service-catalogue', 'steps', 'contact-info'` to `TYPES`.
- [ ] **Step 5: Run** `npm test`. Expected: all pass.
- [ ] **Step 6: Commit.**

```bash
git add blocks test/blocks
git commit -m "feat(cms): services blocks - page intro, service catalogue, steps, contact info"
```

---

### Task 8: Pricing blocks and the pricing converter

**Files:**
- Create: `blocks/pricing-table/index.js`, `blocks/packages/index.js`,
  `blocks/rates/index.js`, `blocks/subscriptions/index.js`,
  `blocks/not-included/index.js`, `scripts/lib/cms-convert.js`
- Modify: `blocks/index.js`
- Test: `test/blocks/pricing.test.js`

**Interfaces:**
- Produces these types and props:
  - `pricing-table`:
    - `{ anchor?, heading, columns: { practice, from, range }, rows: [{ practice, href?, from, range }] }`
  - `packages`:
    - `{ anchor?, heading, cells: [{ forPractice, name, body, note?, price, unit }] }`
  - `rates`:
    - `{ anchor?, heading, lede?, rows: [{ role, rate }] }`
  - `subscriptions`:
    - `{ anchor?, heading, lede?, plans: [{ name, amount, unit, body }] }`
  - `not-included`:
    - `{ anchor?, heading, items: string[], note?, primary?: { label, href }, secondary?: { label, href } }`
- Produces from `scripts/lib/cms-convert.js`:
  - `withIds(blocks) → blocks`: each block gets `id` = `<type>-<index>`.
  - `pageMeta(html) → { seoTitle, seoDescription, noindex }`
  - `convertPricing(html) → { page, blocks }`. `page` is
    `{ layout: 'standard', title: 'Pricing', seoTitle, seoDescription, noindex }`.

- [ ] **Step 1: Write the failing test** `test/blocks/pricing.test.js`. The props come
  from the converter parsing the file, so this proves the converter and the blocks
  together:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { normalizeHtml, sectionOf } = require('../helpers/html');
const { getBlock } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');
const { validatePage } = require('../../server/cms/validate');
const { convertPricing } = require('../../scripts/lib/cms-convert');

const P = '/nidos/pricing.html';
const file = fs.readFileSync(path.join(__dirname, '../..', P), 'utf8');
const ctx = { page: { path: P, layout: 'standard' }, esc, rich: sanitize, anchors: new Set() };
const { page, blocks } = convertPricing(file);

test('the converted page is valid', () => {
  assert.deepEqual(validatePage(page.layout, blocks), []);
  assert.deepEqual(blocks.map((b) => b.type),
    ['page-intro', 'pricing-table', 'packages', 'steps', 'rates', 'subscriptions', 'not-included']);
  assert.equal(page.seoTitle, 'Pricing — CRM, automation, integrations and AI | Project Nidos');
  assert.equal(page.noindex, false);
});

for (const b of blocks) {
  const sel = b.type === 'page-intro' ? 'section.page-hero' : `section#${b.props.anchor}`;
  test(`${b.type} matches ${sel}`, () => {
    assert.equal(normalizeHtml(`<body>${getBlock(b.type).render(b.props, ctx)}</body>`, P),
                 normalizeHtml(`<body>${sectionOf(file, sel)}</body>`, P));
  });
}
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL (`Cannot find module .../cms-convert`).
- [ ] **Step 3: Implement the five blocks.** The markup is copied from the matching
  sections of `nidos/pricing.html`.

`blocks/pricing-table/index.js`:

```js
module.exports = {
  type: 'pricing-table',
  label: 'Pricing table',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    columns: { type: 'group', label: 'Column labels', required: true, of: {
      practice: { type: 'text', label: 'Practice', max: 24, required: true },
      from: { type: 'text', label: 'From', max: 24, required: true },
      range: { type: 'text', label: 'Range', max: 24, required: true },
    } },
    rows: { type: 'list', label: 'Rows', min: 1, max: 12, of: {
      practice: { type: 'text', label: 'Practice', max: 60, required: true },
      href: { type: 'link', label: 'Link' },
      from: { type: 'text', label: 'From', max: 24, required: true },
      range: { type: 'text', label: 'Range', max: 32, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const C = p.columns;
    // The range label repeats inside each row for the phone layout, where the
    // head row is hidden and each row stacks.
    const rows = p.rows.map((r) => `<div class="price-row">
<h3>${r.href ? `<a href="${esc(r.href)}">${esc(r.practice)}</a>` : esc(r.practice)}</h3>
<p class="amount">${esc(r.from)}</p>
<p class="price-range"><span class="label-inline">${esc(C.range)} </span>${esc(r.range)}</p>
</div>`).join('\n');
    return `<section${id} class="pricing-section">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<div class="lattice price-table">
<div class="price-row price-row--head" aria-hidden="true">
<p>${esc(C.practice)}</p>
<p>${esc(C.from)}</p>
<p>${esc(C.range)}</p>
</div>
${rows}
</div>
</div>
</section>`;
  },
};
```

`blocks/packages/index.js`:

```js
module.exports = {
  type: 'packages',
  label: 'Packages',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    cells: { type: 'list', label: 'Packages', min: 1, max: 9, of: {
      forPractice: { type: 'text', label: 'For which practice', max: 60, required: true },
      name: { type: 'text', label: 'Name', max: 48, required: true },
      body: { type: 'longtext', label: 'Text', max: 360, required: true },
      note: { type: 'text', label: 'Note', max: 200 },
      price: { type: 'text', label: 'Price', max: 24, required: true },
      unit: { type: 'text', label: 'Unit', max: 24, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const cells = p.cells.map((c) => `<div class="pkg">
<p class="pkg-for">${esc(c.forPractice)}</p>
<h3>${esc(c.name)}</h3>
<p>${esc(c.body)}</p>${c.note ? `\n<p class="pkg-note">${esc(c.note)}</p>` : ''}
<p class="amount">${esc(c.price)}<span class="amount-unit">${esc(c.unit)}</span></p>
</div>`).join('\n');
    return `<section${id} class="pricing-section">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<div class="lattice pkg-grid">
${cells}
</div>
</div>
</section>`;
  },
};
```

`blocks/rates/index.js`:

```js
module.exports = {
  type: 'rates',
  label: 'Hourly rates',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    lede: { type: 'richtext', label: 'Lede', max: 300, profile: 'inline' },
    rows: { type: 'list', label: 'Rates', min: 1, max: 8, of: {
      role: { type: 'text', label: 'Role', max: 48, required: true },
      rate: { type: 'text', label: 'Rate', max: 32, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const lede = p.lede ? `\n<p class="section-lede">${rich(p.lede, 'inline')}</p>` : '';
    const rows = p.rows.map((r) => `<div class="rate-row">
<p class="role">${esc(r.role)}</p>
<p class="rate">${esc(r.rate)}</p>
</div>`).join('\n');
    return `<section${id} class="pricing-section">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>${lede}
<div class="lattice rate-table">
${rows}
</div>
</div>
</section>`;
  },
};
```

`blocks/subscriptions/index.js`:

```js
module.exports = {
  type: 'subscriptions',
  label: 'Subscriptions',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    lede: { type: 'richtext', label: 'Lede', max: 300, profile: 'inline' },
    plans: { type: 'list', label: 'Plans', min: 1, max: 4, of: {
      name: { type: 'text', label: 'Name', max: 40, required: true },
      amount: { type: 'text', label: 'Amount', max: 32, required: true },
      unit: { type: 'text', label: 'Unit', max: 24, required: true },
      body: { type: 'text', label: 'Text', max: 200, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const lede = p.lede ? `\n<p class="section-lede">${rich(p.lede, 'inline')}</p>` : '';
    const plans = p.plans.map((x) => `<div class="plan">
<h3>${esc(x.name)}</h3>
<p class="amount">${esc(x.amount)}<span class="amount-unit">${esc(x.unit)}</span></p>
<p>${esc(x.body)}</p>
</div>`).join('\n');
    return `<section${id} class="pricing-section">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>${lede}
<div class="lattice plan-grid">
${plans}
</div>
</div>
</section>`;
  },
};
```

`blocks/not-included/index.js`:

```js
const button = (b, cls, esc) => (b ? `\n<a href="${esc(b.href)}" class="${cls}">${esc(b.label)}</a>` : '');
const buttonField = (label) => ({ type: 'group', label, of: {
  label: { type: 'text', label: 'Label', max: 28, required: true },
  href: { type: 'link', label: 'Link', required: true },
} });

module.exports = {
  type: 'not-included',
  label: 'Not included',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    items: { type: 'list', label: 'Items', min: 1, max: 12, itemMax: 200, of: 'string' },
    note: { type: 'longtext', label: 'Note', max: 400 },
    primary: buttonField('Primary button'),
    secondary: buttonField('Secondary button'),
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const note = p.note ? `\n<p class="price-note">${esc(p.note)}</p>` : '';
    const buttons = p.primary || p.secondary
      ? `\n<div class="cta-row">${button(p.primary, 'btn-primary', esc)}${button(p.secondary, 'btn-quiet', esc)}\n</div>`
      : '';
    return `<section${id} class="pricing-section">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<div class="lattice terms-pane">
<div>
<ul class="scope-list">
${p.items.map((t) => `<li>${esc(t)}</li>`).join('\n')}
</ul>${note}
</div>
</div>${buttons}
</div>
</section>`;
  },
};
```

- [ ] **Step 4: Create** `scripts/lib/cms-convert.js` with the shared helpers and
  `convertPricing`. Tasks 9 and 10 add to this file.

```js
/*
 * Today's content, as blocks. Pure functions: no database, no filesystem. The
 * import (scripts/cms-import.js) feeds them the files and the saved overrides,
 * and the tests feed them the committed files, which is how the tests prove
 * that a converted page draws exactly what the file draws.
 */
const cheerio = require('cheerio');
const { sanitize } = require('../../server/cms/richtext');

const withIds = (blocks) => blocks.map((b, i) => ({ id: `${b.type}-${i}`, ...b }));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
// Drop keys whose value is undefined or null, so optional fields are absent
// rather than present-and-empty.
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

function pageMeta(html) {
  const $ = cheerio.load(html);
  return {
    seoTitle: squash($('title').text()),
    seoDescription: squash($('meta[name="description"]').attr('content')),
    noindex: /noindex/i.test($('meta[name="robots"]').attr('content') || ''),
  };
}

function convertPricing(html) {
  const $ = cheerio.load(html);
  const text = (el) => squash($(el).text());
  const inner = (el) => squash($(el).html());
  const btn = (a) => (a && a.length ? { label: text(a), href: a.attr('href') } : undefined);
  const sec = (id) => $(`section#${id}`);
  const lede = (s) => {
    const p = s.find('.section-lede').first();
    return p.length ? sanitize(inner(p), 'inline') : undefined;
  };
  const amountSplit = (el) => {
    const a = $(el).clone();
    const unit = text(a.find('.amount-unit'));
    a.find('.amount-unit').remove();
    return { price: text(a), unit };
  };

  const hero = $('section.page-hero');
  const [titleLead, titleAccent] = (hero.find('.page-title').html() || '')
    .split(/<br\s*\/?>/i).map((s) => squash(cheerio.load(`<i>${s}</i>`, null, false).root().text()));

  const cat = sec('catalogue');
  const head = cat.find('.price-row--head p').map((_, p) => text(p)).get();
  const pk = sec('packages');
  const md = sec('model');
  const rt = sec('rates');
  const sb = sec('subscriptions');
  const tm = sec('terms');
  const cta = tm.find('.cta-row a');

  const blocks = [
    { type: 'page-intro', props: compact({
      back: btn(hero.find('.back-link')), titleLead, titleAccent,
      lede: sanitize(inner(hero.find('.page-lede p')), 'inline') || undefined,
    }) },
    { type: 'pricing-table', props: {
      anchor: 'catalogue', heading: text(cat.find('.section-title')),
      columns: { practice: head[0], from: head[1], range: head[2] },
      rows: cat.find('.price-row').not('.price-row--head').map((_, r) => {
        const a = $(r).find('h3 a');
        const range = $(r).find('.price-range').clone();
        range.find('.label-inline').remove();
        return compact({ practice: text($(r).find('h3')), href: a.length ? a.attr('href') : undefined,
          from: text($(r).find('.amount')), range: text(range) });
      }).get(),
    } },
    { type: 'packages', props: {
      anchor: 'packages', heading: text(pk.find('.section-title')),
      cells: pk.find('.pkg').map((_, c) => {
        const note = $(c).find('.pkg-note');
        return compact({
          forPractice: text($(c).find('.pkg-for')), name: text($(c).find('h3')),
          body: text($(c).children('p').not('[class]').first()),
          note: note.length ? text(note) : undefined,
          ...amountSplit($(c).find('.amount')),
        });
      }).get(),
    } },
    { type: 'steps', props: compact({
      anchor: 'model', heading: text(md.find('.section-title')), lede: lede(md),
      items: md.find('li.step').map((_, s) => {
        const price = $(s).find('.step-price');
        return compact({ title: text($(s).find('.step-title')), body: text($(s).find('.step-body')),
          price: price.length ? text(price) : undefined });
      }).get(),
    }) },
    { type: 'rates', props: compact({
      anchor: 'rates', heading: text(rt.find('.section-title')), lede: lede(rt),
      rows: rt.find('.rate-row').map((_, r) => ({ role: text($(r).find('.role')), rate: text($(r).find('.rate')) })).get(),
    }) },
    { type: 'subscriptions', props: compact({
      anchor: 'subscriptions', heading: text(sb.find('.section-title')), lede: lede(sb),
      plans: sb.find('.plan').map((_, x) => {
        const { price, unit } = amountSplit($(x).find('.amount'));
        return { name: text($(x).find('h3')), amount: price, unit, body: text($(x).children('p').not('[class]').first()) };
      }).get(),
    }) },
    { type: 'not-included', props: compact({
      anchor: 'terms', heading: text(tm.find('.section-title')),
      items: tm.find('.scope-list li').map((_, li) => text(li)).get(),
      note: tm.find('.price-note').length ? text(tm.find('.price-note')) : undefined,
      primary: btn(cta.filter('.btn-primary')), secondary: btn(cta.filter('.btn-quiet')),
    }) },
  ];

  return { page: { layout: 'standard', title: 'Pricing', ...pageMeta(html) }, blocks: withIds(blocks) };
}

module.exports = { withIds, pageMeta, convertPricing };
```

- [ ] **Step 5: Register the five blocks.** Add
  `'pricing-table', 'packages', 'rates', 'subscriptions', 'not-included'` to `TYPES`.
- [ ] **Step 6: Run** `npm test`. Expected: the validity test and all seven section
  tests pass.
- [ ] **Step 7: Commit.**

```bash
git add blocks scripts/lib/cms-convert.js test/blocks
git commit -m "feat(cms): pricing blocks and the pricing page converter"
```

---

### Task 9: Legal and 404: rich-text, button-row, converters, styles

These pages **deliberately change look** (spec §7), from the old legacy style to the
site's current one. Their check is by text, not markup.

**Files:**
- Create: `blocks/rich-text/index.js`, `blocks/button-row/index.js`
- Modify: `blocks/index.js`, `scripts/lib/cms-convert.js`, `pages.css`,
  `site/digitalization.template.html`, `nidos/pricing.html`, `nidos/digitalization.html`
- Test: `test/blocks/legal.test.js`

**Interfaces:**
- Produces:
  - `rich-text` props: `{ anchor?, body }`. `body` is rich text with the `full`
    profile, up to 30,000 characters. The longest legal page today is 6,500.
  - `button-row` props: `{ primary?: { label, href }, secondary?: { label, href } }`
  - `convertLegal(html) → { page, blocks }`:
    - blocks are `page-intro` (back link, the title, the "Last updated" line as lede)
      and `rich-text`;
    - the source's `h3` becomes `h2` and `h4` becomes `h3`, because the page intro now
      holds the only `h1`.
  - `convert404() → { page, blocks }`: `page-intro` and `button-row`, with
    `noindex: true`.

- [ ] **Step 1: Write the failing test** `test/blocks/legal.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { getBlock } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');
const { validatePage } = require('../../server/cms/validate');
const { convertLegal, convert404 } = require('../../scripts/lib/cms-convert');

const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
const words = (html) => cheerio.load(`<div>${html}</div>`).root().text().replace(/\s+/g, ' ').trim();
const ctx = { page: { path: '/nidos/privacy.html', layout: 'standard' }, esc, rich: sanitize, anchors: new Set() };

for (const f of ['privacy', 'terms', 'cookie-policy', 'gdpr']) {
  test(`${f}: valid, same text, headings shifted, still noindex`, () => {
    const html = read(`nidos/${f}.html`);
    const { page, blocks } = convertLegal(html);
    assert.deepEqual(validatePage(page.layout, blocks), []);
    assert.equal(page.noindex, true);
    const body = blocks.find((b) => b.type === 'rich-text').props.body;
    const source = cheerio.load(html)('main .container').first().children('div').first().html();
    assert.equal(words(body), words(source));
    assert.doesNotMatch(body, /style=|<h1|<h4/);
    assert.equal(page.title, cheerio.load(html)('main h1').first().text().trim());
  });
}

test('the cookie table survives', () => {
  const { blocks } = convertLegal(read('nidos/cookie-policy.html'));
  assert.match(blocks[1].props.body, /<table>.*<td>/s);
});

test('404 page', () => {
  const { page, blocks } = convert404();
  assert.deepEqual(validatePage(page.layout, blocks), []);
  assert.equal(page.noindex, true);
});

test('rich-text and button-row render', () => {
  const rt = getBlock('rich-text').render({ body: '<h2>A</h2><p>b<script>x</script></p>' }, ctx);
  assert.match(rt, /<section class="legal">/);
  assert.match(rt, /<h2>A<\/h2><p>b<\/p>/);
  const br = getBlock('button-row').render({ primary: { label: 'Home', href: '/' } }, ctx);
  assert.match(br, /class="btn-primary">Home</);
  assert.doesNotMatch(br, /btn-quiet/);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement the blocks.**

`blocks/rich-text/index.js`:

```js
module.exports = {
  type: 'rich-text',
  label: 'Rich text',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    body: { type: 'richtext', label: 'Text', max: 30000, profile: 'full', required: true },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    return `<section${id} class="legal">
<div class="wrap">
<div class="legal-body">${rich(p.body, 'full')}</div>
</div>
</section>`;
  },
};
```

`blocks/button-row/index.js`:

```js
const button = (b, cls, esc) => (b ? `\n<a href="${esc(b.href)}" class="${cls}">${esc(b.label)}</a>` : '');
const buttonField = (label) => ({ type: 'group', label, of: {
  label: { type: 'text', label: 'Label', max: 28, required: true },
  href: { type: 'link', label: 'Link', required: true },
} });

module.exports = {
  type: 'button-row',
  label: 'Button row',
  layouts: ['standard'],
  fields: { primary: buttonField('Primary button'), secondary: buttonField('Secondary button') },
  anchor: () => null,
  assets: () => [],
  render(p, { esc }) {
    return `<section class="button-row">
<div class="wrap cta-row">${button(p.primary, 'btn-primary', esc)}${button(p.secondary, 'btn-quiet', esc)}
</div>
</section>`;
  },
};
```

- [ ] **Step 4: Add the converters** to `scripts/lib/cms-convert.js`, above
  `module.exports`:

```js
// The legal pages: an overline, the h1, a "Last updated" line and one div of
// copy, all inside main .container with inline styles. The copy keeps its
// words and structure and loses the styles; its h3/h4 move up a level because
// the page intro now owns the page's only h1.
function convertLegal(html) {
  const $ = cheerio.load(html);
  const box = $('main .container').first();
  const title = squash(box.find('h1').first().text());
  const updated = box.children('p').filter((_, p) => /^last updated/i.test(squash($(p).text()))).first();
  const copy = box.children('div').first().clone();
  copy.find('h3').each((_, h) => { h.name = 'h2'; });
  copy.find('h4').each((_, h) => { h.name = 'h3'; });
  return {
    page: { layout: 'standard', title, ...pageMeta(html) },
    blocks: withIds([
      { type: 'page-intro', props: compact({
        back: { label: 'Back to homepage', href: '/' }, titleLead: title,
        lede: updated.length ? squash(updated.text()) : undefined,
      }) },
      { type: 'rich-text', props: { body: sanitize(copy.html(), 'full') } },
    ]),
  };
}

// The old 404 is a terminal animation typing the missing path. It becomes a
// plain page in the site's look; its two ways out are kept.
function convert404() {
  return {
    page: { layout: 'standard', title: 'Page not found', seoTitle: '404 — Project Nidos',
      seoDescription: 'This page does not exist or has moved.', noindex: true },
    blocks: withIds([
      { type: 'page-intro', props: { titleLead: 'Page not found.', lede: 'This page does not exist or has moved.' } },
      { type: 'button-row', props: { primary: { label: 'Back to home', href: '/' }, secondary: { label: 'Contact', href: '/#contact' } } },
    ]),
  };
}
```

  Change the export line to
  `module.exports = { withIds, pageMeta, convertPricing, convertLegal, convert404 };`.

- [ ] **Step 5: Add the legal styles.** First list the tokens `base.css` defines:
  `grep -o -- '--[a-z0-9-]*:' base.css | sort -u`. Append this to `pages.css`,
  replacing any token that list lacks with the nearest one that exists:

```css
/* ===== LEGAL - long-form text pages (privacy, terms, cookies, GDPR) =====
   Read at the site's measure over the field, in the ink ramp. The headings are
   the document's own structure (h2 sections, h3 sub-sections), so they are set
   plainly; the table is the cookie list. */
.legal { padding-block-start: 0; }
.legal-body { max-width: 72ch; color: var(--ink-2); line-height: 1.65; }
.legal-body h2 { margin-top: var(--s7); font-size: var(--fs-claim); font-weight: 500; color: var(--ink); letter-spacing: -0.01em; }
.legal-body h3 { margin-top: var(--s5); font-size: var(--fs-body); font-weight: 500; color: var(--ink); }
.legal-body p, .legal-body ul, .legal-body ol, .legal-body table { margin-top: var(--s3); }
.legal-body ul, .legal-body ol { padding-left: var(--s5); }
.legal-body li + li { margin-top: var(--s2); }
.legal-body a { color: var(--ink); border-bottom: 1px solid var(--hairline-strong); text-decoration: none; }
.legal-body a:hover { border-bottom-color: var(--ink); }
.legal-body table { width: 100%; border-collapse: collapse; font-size: var(--fs-small); }
.legal-body th, .legal-body td { text-align: left; vertical-align: top; padding: var(--s2) var(--s3) var(--s2) 0; border-bottom: 1px solid var(--hairline); }
.legal-body th { color: var(--ink); font-weight: 500; }
@media (max-width: 640px) { .legal-body table { display: block; overflow-x: auto; } }
.button-row { padding-block-start: 0; }
```

- [ ] **Step 6: Bump `pages.css` to `v=8`** in `site/digitalization.template.html` and
  `nidos/pricing.html`. Then run `npm run build:pages && npm run check:pages`.
- [ ] **Step 7: Register** `'rich-text', 'button-row'` in `TYPES`. Run `npm test`.
  Expected: all pass.
- [ ] **Step 8: Commit.**

```bash
git add blocks scripts/lib/cms-convert.js pages.css site/digitalization.template.html nidos/pricing.html nidos/digitalization.html test/blocks
git commit -m "feat(cms): rich text and button row blocks, legal and 404 converters, legal styles"
```

---

### Task 10: Home and Services converters, site settings, saved overrides

**Files:**
- Modify: `scripts/lib/cms-convert.js`
- Test: `test/cms/convert.test.js`

**Interfaces:**
- Produces:
  - `convertHome(content) → { page, blocks }`: `hero, text, practice-cards, reasons,
    contact-form`, with props mapped as in the Task 6 test.
  - `convertServices(digi) → { page, blocks }`: `page-intro, service-catalogue,
    steps, reasons, contact-info`, with props mapped as in the Task 7 test. The
    reasons props are `{ anchor: digi.ids.why, heading, items }`.
  - `siteSettingsFrom(content) → { nav, footer, labels }`:
    - `nav`: `{ logo, links: [{ text, href, anchor? }] }`
    - `footer`: `{ taglineHTML, cols: [{ heading, links: [{ text, href }] }], legal,
      arcade: { text, aria } }`
    - `labels`: `{ skip, introSkip }`
  - `applyOverrides(content, overrides: Array<{ key, value }>) → content`. It returns
    a deep copy with each saved `data-cms` value applied, and throws on a key it
    cannot place.
- Nav links as stored. Each resolves per page by the Task 11 rule:

  | text | href | anchor |
  |---|---|---|
  | Services | `/nidos/digitalization.html` | `practices` |
  | Pricing | `/nidos/pricing.html` | (none) |
  | About | `/#about` | `about` |
  | Contact | `/#contact` | `contact` |

- [ ] **Step 1: Write the failing test** `test/cms/convert.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePage } = require('../../server/cms/validate');
const conv = require('../../scripts/lib/cms-convert');
const content = require('../../site/content.en.json');
const digi = require('../../site/digi.en.json');

test('home and services convert to valid pages', () => {
  for (const { page, blocks } of [conv.convertHome(content), conv.convertServices(digi)]) {
    assert.deepEqual(validatePage(page.layout, blocks), [], page.title);
  }
  assert.deepEqual(conv.convertHome(content).blocks.map((b) => b.type),
    ['hero', 'text', 'practice-cards', 'reasons', 'contact-form']);
  assert.deepEqual(conv.convertServices(digi).blocks.map((b) => b.type),
    ['page-intro', 'service-catalogue', 'steps', 'reasons', 'contact-info']);
});

test('applyOverrides sets nested, practice and form-option keys, leaves input alone', () => {
  const optionKey = content.contact.options[0].cms;
  const out = conv.applyOverrides(content, [
    { key: 'hero.titleLead', value: 'Edited.' },
    { key: 'practice.crm.title', value: 'CRM, edited' },
    { key: optionKey, value: 'Option, edited' },
  ]);
  assert.equal(out.hero.titleLead, 'Edited.');
  assert.equal(out.practices.items.find((p) => p.key === 'crm').title, 'CRM, edited');
  assert.equal(out.contact.options[0].text, 'Option, edited');
  assert.notEqual(content.hero.titleLead, 'Edited.');
});

test('applyOverrides refuses a key it cannot place', () => {
  assert.throws(() => conv.applyOverrides(content, [{ key: 'hero.nope', value: 'x' }]), /hero\.nope/);
  assert.throws(() => conv.applyOverrides(content, [{ key: 'practice.zzz.title', value: 'x' }]), /zzz/);
});

test('site settings: nav anchors, footer, labels', () => {
  const s = conv.siteSettingsFrom(content);
  assert.deepEqual(s.nav.links.map((l) => [l.href, l.anchor]),
    [['/nidos/digitalization.html', 'practices'], ['/nidos/pricing.html', undefined], ['/#about', 'about'], ['/#contact', 'contact']]);
  assert.equal(s.footer.arcade.text, content.footer.arcade);
  assert.equal(s.labels.introSkip, content.intro.skip);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add these to `scripts/lib/cms-convert.js`:

```js
function convertHome(c) {
  return {
    page: { layout: 'home', title: 'Home', seoTitle: c.meta.title, seoDescription: c.meta.description, noindex: false },
    blocks: withIds([
      { type: 'hero', props: {
        titleLead: c.hero.titleLead, titleAccent: c.hero.titleAccent, lede: sanitize(c.hero.subtitleHTML, 'inline'),
        primary: { label: c.hero.cta, href: '#contact' },
        secondary: { label: c.hero.ctaSecondary, href: c.hero.ctaSecondaryHref },
      } },
      { type: 'text', props: compact({
        anchor: 'about', heading: c.about.heading, subheading: c.about.subheading || undefined,
        body: sanitize(c.about.bodyHTML, 'inline'),
      }) },
      { type: 'practice-cards', props: {
        anchor: 'practices', heading: c.practices.heading,
        sideLink: { label: c.practices.pricingLabel, href: c.practices.pricingHref },
        cards: c.practices.items.map((p) => ({
          title: p.title, summary: p.summary, link: { label: p.linkText, href: p.href }, diagram: p.key,
        })),
      } },
      { type: 'reasons', props: { heading: c.why.heading, items: c.why.items.map(({ icon, claim, support }) => ({ icon, claim, support })) } },
      { type: 'contact-form', props: {
        anchor: 'contact', heading: c.contact.heading, lede: c.contact.lede,
        infoHeading: c.contact.infoHeading, infoBody: c.contact.infoBody,
        emailLabel: c.contact.emailLabel, email: c.contact.email, labels: { ...c.contact.labels },
        options: c.contact.options.map(({ value, text }) => ({ value, text })), submit: c.contact.submit,
      } },
    ]),
  };
}

function convertServices(d) {
  const tocText = (id) => {
    const t = d.toc.items.find((x) => x.href === `#${id}`);
    if (!t) throw new Error(`services: no table-of-contents entry for #${id}`);
    return t.text;
  };
  return {
    page: { layout: 'standard', title: 'Services', seoTitle: d.meta.title, seoDescription: d.meta.description, noindex: false },
    blocks: withIds([
      { type: 'page-intro', props: {
        back: { label: d.hero.back, href: d.hero.backHref }, titleLead: d.hero.titleLead,
        titleAccent: d.hero.titleAccent, lede: sanitize(d.hero.ledeHTML, 'inline'),
      } },
      { type: 'service-catalogue', props: {
        anchor: d.ids.practices, heading: d.practices.heading, tocLabel: d.a11y.tocHeading, tocAria: d.a11y.toc,
        practices: d.practices.items.map((p) => compact({
          anchor: p.id, title: p.title, tocText: tocText(p.id), outcome: p.outcome, diagram: p.key,
          body: p.body, problemLabel: p.problemLabel, problemText: p.problemText,
          scopeHeading: p.scopeHeading, scope: [...p.scope], pkgHeading: p.pkgHeading, pkgName: p.pkgName,
          pkgBody: p.pkgBody, pkgNote: p.pkgNote || undefined, priceLead: p.priceLead, price: p.price,
          priceNote: p.priceNote || undefined,
        })),
      } },
      { type: 'steps', props: {
        anchor: d.ids.process, heading: d.process.heading,
        items: d.process.steps.map((s) => compact({ title: s.title, body: s.body, price: s.price || undefined })),
      } },
      { type: 'reasons', props: { anchor: d.ids.why, heading: d.why.heading, items: d.why.items.map(({ icon, claim, support }) => ({ icon, claim, support })) } },
      { type: 'contact-info', props: {
        anchor: d.ids.contact, heading: d.contact.heading, subheading: d.contact.subheading,
        body: sanitize(d.contact.bodyHTML, 'inline'), emailLabel: d.contact.emailLabel, email: d.contact.email,
        cta: { label: d.contact.cta.text, href: d.contact.cta.href },
        links: d.contact.links.map((l) => ({ label: l.text, href: l.href })),
      } },
    ]),
  };
}

// The home nav's links are same-page fragments. Stored, each one gets the page
// it belongs to, plus the anchor it jumps to when that anchor is on the page
// being drawn (see resolveNavHref in server/cms/layout.js).
const NAV_TARGETS = {
  '#practices': { href: '/nidos/digitalization.html', anchor: 'practices' },
  '/nidos/pricing.html': { href: '/nidos/pricing.html' },
  '#about': { href: '/#about', anchor: 'about' },
  '#contact': { href: '/#contact', anchor: 'contact' },
};

function siteSettingsFrom(c) {
  return {
    nav: {
      logo: c.nav.logo,
      links: c.nav.links.map((l) => {
        const target = NAV_TARGETS[l.href];
        if (!target) throw new Error(`nav: no target for ${l.href}`);
        return { text: l.text, ...target };
      }),
    },
    footer: {
      taglineHTML: sanitize(c.footer.taglineHTML, 'inline'),
      cols: c.footer.cols.map((col) => ({ heading: col.heading, links: col.links.map(({ text, href }) => ({ text, href })) })),
      legal: c.footer.legal,
      arcade: { text: c.footer.arcade, aria: c.footer.arcadeAria },
    },
    labels: { skip: c.a11y.skip, introSkip: c.intro.skip },
  };
}

// Saved "Site content" edits are keyed by data-cms name. Three shapes:
//   practice.<key>.<field>  -> the practice item with that key
//   form.<name>             -> the contact option carrying that cms name
//   anything else           -> a dot-path into the content file
// A key that cannot be placed stops the import: silently dropping an edit the
// owner made is the one outcome worse than not importing.
function applyOverrides(content, overrides) {
  const out = structuredClone(content);
  for (const { key, value } of overrides) {
    let m;
    if ((m = key.match(/^practice\.([a-z-]+)\.([a-zA-Z]+)$/))) {
      const item = out.practices.items.find((p) => p.key === m[1]);
      if (!item || typeof item[m[2]] !== 'string') throw new Error(`override ${key}: no such practice field`);
      item[m[2]] = value;
    } else if (key.startsWith('form.')) {
      const opt = out.contact && out.contact.options.find((o) => o.cms === key);
      if (!opt) throw new Error(`override ${key}: no contact option carries it`);
      opt.text = value;
    } else {
      const parts = key.split('.');
      let o = out;
      for (const part of parts.slice(0, -1)) {
        if (!o[part] || typeof o[part] !== 'object') throw new Error(`override ${key}: no such field`);
        o = o[part];
      }
      if (typeof o[parts.at(-1)] !== 'string') throw new Error(`override ${key}: no such field`);
      o[parts.at(-1)] = value;
    }
  }
  return out;
}
```

  Final export line:
  `module.exports = { withIds, pageMeta, convertPricing, convertLegal, convert404, convertHome, convertServices, siteSettingsFrom, applyOverrides };`

- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit.**

```bash
git add scripts/lib/cms-convert.js test/cms/convert.test.js
git commit -m "feat(cms): home and services converters, site settings and saved overrides"
```

---

### Task 11: Assets and the page layout renderer

**Files:**
- Create: `server/cms/assets.js`, `server/cms/layout.js`
- Test: `test/cms/layout.test.js`

**Interfaces:**
- `assets.js`:
  - `STYLES`, `SCRIPTS`: key → URL.
  - `stylesFor(layout, blocks) → string[]`: base, shared (if used), landing or pages,
    visuals (if used).
  - `scriptsFor(layout, blocks) → string[]`:
    - home: landing, diagrams?, orbit?, field;
    - standard: field, diagrams?.
- `layout.js`:
  - `renderPage({ page, blocks, site }) → string`. It throws on an unknown block type;
    the middleware catches this and falls back to the file.
    - `page`: `{ path, layout, seoTitle, seoDescription, noindex }`
    - `site`: the `{ nav, footer, labels }` from Task 10.
  - `resolveNavHref(link, page, anchors) → { href, current }`:
    - if `link.anchor` is one of this page's anchors, the link is `#anchor`;
    - on the home page, a `/#x` link becomes `#x`;
    - otherwise `href` as stored;
    - `current` is true when `href === page.path`.
- Head changes from today, all accepted by the spec (§13):
  - one `og:type` of `website` everywhere;
  - `og:title`/`og:description` from the SEO fields;
  - no `keywords`, `author` or Twitter title and description tags;
  - `history.scrollRestoration` only on home;
  - `robots` is `noindex` when `page.noindex`;
  - no canonical tag on `/404`.

- [ ] **Step 1: Write the failing test** `test/cms/layout.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { normalizeHtml } = require('../helpers/html');
const { renderPage, resolveNavHref } = require('../../server/cms/layout');
const conv = require('../../scripts/lib/cms-convert');

const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
const site = conv.siteSettingsFrom(require('../../site/content.en.json'));
const PAGES = [
  ['index.html', '/', () => conv.convertHome(require('../../site/content.en.json'))],
  ['nidos/digitalization.html', '/nidos/digitalization.html', () => conv.convertServices(require('../../site/digi.en.json'))],
  ['nidos/pricing.html', '/nidos/pricing.html', () => conv.convertPricing(read('nidos/pricing.html'))],
];
const sheets = (html, p) => cheerio.load(html)('link[rel="stylesheet"]').map((_, l) => {
  const u = new URL(l.attribs.href, 'https://site.invalid' + p);
  return u.pathname + u.search;
}).get();

for (const [file, pagePath, convert] of PAGES) {
  const { page, blocks } = convert();
  const html = renderPage({ page: { ...page, path: pagePath }, blocks, site });
  test(`${file}: body is unchanged`, () => {
    assert.equal(normalizeHtml(html, pagePath), normalizeHtml(read(file), pagePath));
  });
  test(`${file}: same stylesheets, same title and description`, () => {
    assert.deepEqual(sheets(html, pagePath), sheets(read(file), pagePath));
    const a = cheerio.load(html);
    const b = cheerio.load(read(file));
    assert.equal(a('title').text(), b('title').text().trim());
    assert.equal(a('meta[name="description"]').attr('content'), b('meta[name="description"]').attr('content'));
  });
}

test('nav: anchors on the page win, home fragments collapse on home', () => {
  const services = { text: 'Services', href: '/nidos/digitalization.html', anchor: 'practices' };
  const about = { text: 'About', href: '/#about', anchor: 'about' };
  assert.deepEqual(resolveNavHref(services, { path: '/' }, new Set(['practices'])), { href: '#practices', current: false });
  assert.deepEqual(resolveNavHref(services, { path: '/nidos/digitalization.html' }, new Set(['services'])), { href: '/nidos/digitalization.html', current: true });
  assert.deepEqual(resolveNavHref(about, { path: '/nidos/pricing.html' }, new Set()), { href: '/#about', current: false });
});

test('unknown block type throws, naming it', () => {
  assert.throws(() => renderPage({ page: { path: '/x', layout: 'standard', seoTitle: 't', seoDescription: 'd' },
    blocks: [{ id: 'a', type: 'gone', props: {} }], site }), /unknown block type "gone"/);
});

test('noindex pages say so and carry no canonical on /404', () => {
  const { page, blocks } = conv.convert404();
  const html = renderPage({ page: { ...page, path: '/404' }, blocks, site });
  assert.match(html, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(html, /rel="canonical"/);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `server/cms/assets.js`:

```js
/*
 * What a page loads, from what its blocks use. Today's stylesheets, unchanged:
 * the home layout draws with landing.css and the standard layout with
 * pages.css, which is why a block is tied to the layouts it was written for
 * until the styles are untangled (plan 1b).
 */
const { getBlock } = require('../../blocks');

const STYLES = {
  base: '/base.css?v=5',
  shared: '/shared.css?v=2',
  landing: '/landing.css?v=28',
  pages: '/pages.css?v=8',
  visuals: '/visuals.css?v=1',
};
const SCRIPTS = {
  landing: '/landing.js?v=10',
  diagrams: '/practice-visuals.js?v=1',
  orbit: '/orbital-hero.js?v=2',
  field: '/topology-bg.js?v=1',
};

function used(blocks) {
  const keys = new Set();
  for (const b of blocks) {
    const def = getBlock(b.type);
    if (def) def.assets(b.props).forEach((k) => keys.add(k));
  }
  return keys;
}

function stylesFor(layout, blocks) {
  const u = used(blocks);
  return [
    STYLES.base,
    ...(u.has('shared') ? [STYLES.shared] : []),
    layout === 'home' ? STYLES.landing : STYLES.pages,
    ...(u.has('visuals') ? [STYLES.visuals] : []),
  ];
}

function scriptsFor(layout, blocks) {
  const u = used(blocks);
  if (layout === 'home') {
    return [
      SCRIPTS.landing,
      ...(u.has('diagrams') ? [SCRIPTS.diagrams] : []),
      ...(u.has('orbit') ? [SCRIPTS.orbit] : []),
      SCRIPTS.field,
    ];
  }
  return [SCRIPTS.field, ...(u.has('diagrams') ? [SCRIPTS.diagrams] : [])];
}

module.exports = { STYLES, SCRIPTS, stylesFor, scriptsFor };
```

- [ ] **Step 4: Implement** `server/cms/layout.js`. The two inline scripts are copied
  from `site/landing.template.html` and `site/digitalization.template.html`. They must
  stay in step with those files until plan 1b retires the templates.

```js
/*
 * The page frame around a page's blocks: head, intro (home only), nav, the
 * topology field, footer and scripts. Mirrors site/landing.template.html (the
 * "home" layout) and site/digitalization.template.html (the "standard"
 * layout); test/cms/layout.test.js holds it to those files.
 */
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('./richtext');
const { getBlock } = require('../../blocks');
const { stylesFor, scriptsFor } = require('./assets');

const SITE_URL = 'https://www.projectnidos.eu';
const OG_IMAGE = 'https://www.projectnidos.eu/logo-latest.png';

// Verbatim from site/landing.template.html.
const INTRO_SCRIPT = `<script>
            /* Source picked here, during parse, so the fetch still starts as early as a
               src attribute would. A phone gets a 341 KB encode instead of 1.2 MB, and a
               metered or 2G connection gets no video at all - play() then rejects and the
               splash falls through to the logo. A visitor who has asked for reduced
               motion gets no video and no splash at all; see landing.js. */
            (function () {
                var v = document.currentScript.previousElementSibling;
                var c = navigator.connection || {};
                try { if (sessionStorage.getItem('pn_intro_seen') === '1') return; } catch (e) {}
                if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
                /* Deep link from a practice page - the splash is skipped in
                   landing.js, so do not spend 1.2 MB fetching a video for it. */
                if (location.hash || /[?&]for=/.test(location.search)) return;
                if (c.saveData === true || /(^|-)2g$/.test(c.effectiveType || '')) return;
                v.src = window.innerWidth <= 820 ? '/intro-video-mobile.mp4?v=2' : '/intro-video.mp4?v=2';
            })();
        </script>`;

// Verbatim from site/digitalization.template.html.
const HAIRLINE_SCRIPT = `<script>
        /* Nav hairline once the page has scrolled - a sentinel, as on the
           landing, so nothing runs on the scroll thread. */
        (() => {
            const nav = document.getElementById('mainNav');
            if (!nav || !('IntersectionObserver' in window)) return;
            const sentinel = document.createElement('div');
            sentinel.setAttribute('aria-hidden', 'true');
            sentinel.style.cssText = 'position:absolute;top:40px;left:0;width:1px;height:1px;pointer-events:none;';
            document.body.prepend(sentinel);
            new IntersectionObserver(([e]) => nav.classList.toggle('scrolled', !e.isIntersecting)).observe(sentinel);
        })();
    </script>`;

const NOSCRIPT_HOME = `<noscript><style>
        .intro-screen { display: none !important; }
        html.intro-lock, html.intro-lock body { overflow: visible !important; }
        html.intro-lock main { visibility: visible !important; }
        .nav { opacity: 1 !important; }
    </style></noscript>`;

function resolveNavHref(link, page, anchors) {
  if (link.anchor && anchors.has(link.anchor)) return { href: `#${link.anchor}`, current: false };
  if (page.path === '/' && link.href.startsWith('/#')) return { href: link.href.slice(1), current: false };
  return { href: link.href, current: link.href === page.path };
}

function renderPage({ page, blocks, site }) {
  const defs = blocks.map((b) => {
    const def = getBlock(b.type);
    if (!def) throw new Error(`unknown block type "${b.type}"`);
    return def;
  });
  const anchors = new Set(blocks.map((b, i) => defs[i].anchor(b.props)).filter(Boolean));
  const ctx = { page, esc, rich: sanitize, anchors };
  const body = blocks.map((b, i) => defs[i].render(b.props, ctx)).join('\n');

  const home = page.layout === 'home';
  const nav = site.nav.links.map((l) => {
    const r = resolveNavHref(l, page, anchors);
    return `<a href="${esc(r.href)}"${r.current ? ' aria-current="page"' : ''}>${esc(l.text)}</a>`;
  }).join('\n');
  const cols = site.footer.cols.map((c) => `<div class="footer-col">
<h3>${esc(c.heading)}</h3>
${c.links.map((l) => `<a href="${esc(l.href)}">${esc(l.text)}</a>`).join('\n')}
</div>`).join('\n');
  const arcade = home
    ? `\n<button type="button" class="egg-arcade" aria-label="${esc(site.footer.arcade.aria)}">${esc(site.footer.arcade.text)}</button>`
    : '';
  const intro = home ? `<div class="intro-screen">
<video class="intro-video" muted playsinline preload="auto" aria-hidden="true"></video>
${INTRO_SCRIPT}
<p class="intro-logo">Project Nidos</p>
<button class="intro-skip hit-44" type="button">${esc(site.labels.introSkip)}</button>
</div>\n` : '';

  const canonical = page.path === '/404' ? null : SITE_URL + page.path;
  const styles = stylesFor(page.layout, blocks).map((h) => `<link rel="stylesheet" href="${h}">`).join('\n');
  const scripts = [
    ...(home ? [] : [HAIRLINE_SCRIPT]),
    ...scriptsFor(page.layout, blocks).map((s) => `<script src="${s}"></script>`),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en"${home ? ' class="intro-lock"' : ''}>
<head>
<script src="/gate.js?v=1"></script>
${home ? "<script>history.scrollRestoration = 'manual';</script>\n" : ''}<meta charset="UTF-8">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(page.seoTitle)}</title>
<meta name="description" content="${esc(page.seoDescription)}">
<meta name="robots" content="${page.noindex ? 'noindex' : 'index, follow'}">
${canonical ? `<link rel="canonical" href="${canonical}">\n` : ''}<meta property="og:type" content="website">
${canonical ? `<meta property="og:url" content="${canonical}">\n` : ''}<meta property="og:title" content="${esc(page.seoTitle)}">
<meta property="og:description" content="${esc(page.seoDescription)}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="twitter:card" content="summary_large_image">
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/archivo-lat.woff2" crossorigin>
${styles}
${home ? NOSCRIPT_HOME + '\n' : ''}</head>
<body>
<a class="skip-link" href="#main">${esc(site.labels.skip)}</a>
${intro}<nav class="${home ? 'nav' : 'nav nav--row'}" id="mainNav">
<div class="nav-inner">
<a href="/" class="nav-logo">${esc(site.nav.logo)}</a>
<div class="nav-links">
${nav}
</div>
</div>
</nav>
<main id="main">
<canvas id="topology-bg" aria-hidden="true"></canvas>
${body}
<footer${home ? '' : ' class="footer-lattice"'}>
<div class="footer-inner">
<div class="footer-brand">
<a href="/" class="nav-logo">${esc(site.nav.logo)}</a>
<p>${sanitize(site.footer.taglineHTML, 'inline')}</p>
</div>
<div class="footer-nav">
${cols}
</div>
</div>
<div class="footer-bottom">
<p>${esc(site.footer.legal)}</p>${arcade}
</div>
</footer>
</main>
${scripts}
</body>
</html>`;
}

module.exports = { renderPage, resolveNavHref };
```

- [ ] **Step 5: Run** `npm test`. Expected: all pass. Fix any body difference in
  `layout.js` or the block, never in the normaliser. The three body tests are the
  proof the spec asks for.
- [ ] **Step 6: Commit.**

```bash
git add server/cms/assets.js server/cms/layout.js test/cms/layout.test.js
git commit -m "feat(cms): page layout renderer with per-layout assets"
```

---

### Task 12: Store and import

**Files:**
- Create: `server/cms/store.js`, `scripts/cms-import.js`
- Modify: `scripts/deploy-schema.js`, `package.json`
- Test: `test/cms/store.test.js` (runs only when `CMS_DEV_DB=1`)

**Interfaces:**
- `createStore(prisma)` returns:
  - `listPublishedPaths(siteKey) → Promise<string[]>`
  - `getPublished(siteKey, path) → Promise<{ page, blocks, versionId } | null>`
  - `getPublishedVersionId(siteKey, path) → Promise<number | null>`
  - `getSiteSettings(siteKey) → Promise<{ nav, footer, labels }>`
- `scripts/cms-import.js`:
  - exports `runImport({ prisma, replace = false, log = console }) → Promise<{ created: string[], skipped: string[] }>`
  - CLI `node scripts/cms-import.js --dev [--replace]` targets the development
    database through `useDevDatabase()`.
  - CLI `node scripts/cms-import.js --on-deploy` runs only inside Railway, where
    `RAILWAY_ENVIRONMENT_NAME` is set.
  - With neither flag, it prints usage and exits 1.

- [ ] **Step 1: Implement** `server/cms/store.js`:

```js
/*
 * Read access to published pages. Part 2 adds the writes (drafts, publish,
 * restore); the middleware only ever needs these four.
 */
function createStore(prisma) {
  const site = (key) => prisma.site.findUnique({ where: { key } });

  return {
    async listPublishedPaths(siteKey) {
      const s = await site(siteKey);
      if (!s) return [];
      const rows = await prisma.page.findMany({
        where: { siteId: s.id, deletedAt: null, publishedVersionId: { not: null } },
        select: { path: true },
      });
      return rows.map((r) => r.path);
    },

    async getPublished(siteKey, path) {
      const s = await site(siteKey);
      if (!s) return null;
      const page = await prisma.page.findUnique({ where: { siteId_path: { siteId: s.id, path } } });
      if (!page || page.deletedAt || !page.publishedVersionId) return null;
      const version = await prisma.pageVersion.findUnique({ where: { id: page.publishedVersionId } });
      return version ? { page, blocks: version.blocks, versionId: version.id } : null;
    },

    async getPublishedVersionId(siteKey, path) {
      const s = await site(siteKey);
      if (!s) return null;
      const page = await prisma.page.findUnique({
        where: { siteId_path: { siteId: s.id, path } },
        select: { publishedVersionId: true, deletedAt: true },
      });
      return page && !page.deletedAt ? page.publishedVersionId : null;
    },

    async getSiteSettings(siteKey) {
      const s = await site(siteKey);
      const rows = s ? await prisma.siteSetting.findMany({ where: { siteId: s.id } }) : [];
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },
  };
}

module.exports = { createStore };
```

- [ ] **Step 2: Implement** `scripts/cms-import.js`:

```js
#!/usr/bin/env node
/*
 * Moves today's pages into the page tables, once.
 *
 *   node scripts/cms-import.js --dev [--replace]   the development database
 *   node scripts/cms-import.js --on-deploy         inside Railway only; see
 *                                                  scripts/deploy-schema.js
 *
 * Home and Services come from their content files, Pricing and the legal pages
 * from their HTML, and every edit saved in the admin's "Site content" tab is
 * applied on top: to the content file for Home and Services, and through
 * server/lib/content.js's own renderer for the HTML pages. Everything is
 * validated before anything is written; one bad block and nothing is.
 * Existing pages are left alone unless --replace is given.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SITE = { key: 'projectnidos', name: 'Project Nidos', domain: 'www.projectnidos.eu' };
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));

async function buildPages(prisma) {
    const conv = require('./lib/cms-convert');
    const content = require('../server/lib/content');
    const overrides = async (page) => (await prisma.siteContent.findMany({ where: { page } }))
        .map(({ key, value }) => ({ key, value }));

    const home = conv.applyOverrides(readJson('site/content.en.json'), await overrides('index.html'));
    const digi = conv.applyOverrides(readJson('site/digi.en.json'), await overrides('nidos/digitalization.html'));
    // content.render(page) is the live site's own renderer: the file plus its
    // saved overrides, exactly as a visitor gets it today.
    const html = (page) => content.render(page);

    const pages = [
        ['/', conv.convertHome(home)],
        ['/nidos/digitalization.html', conv.convertServices(digi)],
        ['/nidos/pricing.html', conv.convertPricing(await html('nidos/pricing.html'))],
        ['/nidos/privacy.html', conv.convertLegal(await html('nidos/privacy.html'))],
        ['/nidos/terms.html', conv.convertLegal(await html('nidos/terms.html'))],
        ['/nidos/cookie-policy.html', conv.convertLegal(await html('nidos/cookie-policy.html'))],
        ['/nidos/gdpr.html', conv.convertLegal(await html('nidos/gdpr.html'))],
        ['/404', conv.convert404()],
    ];
    return { pages, settings: conv.siteSettingsFrom(home) };
}

async function runImport({ prisma, replace = false, log = console }) {
    const { validatePage } = require('../server/cms/validate');
    const settings = require('../server/lib/settings');
    const { pages, settings: siteSettings } = await buildPages(prisma);

    const problems = [];
    for (const [p, { page, blocks }] of pages) {
        for (const e of validatePage(page.layout, blocks)) problems.push(`${p} ${e.path}: ${e.message}`);
    }
    const interestMap = (await settings.get('leads.interestMap')) || {};
    for (const [p, { blocks }] of pages) {
        for (const b of blocks.filter((x) => x.type === 'contact-form')) {
            for (const o of b.props.options) {
                if (!Object.prototype.hasOwnProperty.call(interestMap, o.value)) {
                    problems.push(`${p} contact option "${o.value}" is not a CRM lead category (Settings → Contact form categories)`);
                }
            }
        }
    }
    if (problems.length) {
        problems.forEach((x) => log.error('  ✗ ' + x));
        throw new Error(`import refused: ${problems.length} problem(s), nothing written`);
    }

    const created = [];
    const skipped = [];
    // One transaction, so a failure part-way leaves nothing behind. The long
    // timeout is for the public connection a local run uses.
    await prisma.$transaction(async (tx) => {
        const site = await tx.site.upsert({ where: { key: SITE.key }, update: {}, create: SITE });
        for (const [key, value] of Object.entries(siteSettings)) {
            const exists = await tx.siteSetting.findUnique({ where: { siteId_key: { siteId: site.id, key } } });
            if (exists && !replace) continue;
            await tx.siteSetting.upsert({
                where: { siteId_key: { siteId: site.id, key } },
                update: { value, updatedBy: 'import' },
                create: { siteId: site.id, key, value, updatedBy: 'import' },
            });
        }
        for (const [p, { page, blocks }] of pages) {
            const existing = await tx.page.findUnique({ where: { siteId_path: { siteId: site.id, path: p } } });
            if (existing && !replace) { skipped.push(p); continue; }
            const data = {
                title: page.title, layout: page.layout, seoTitle: page.seoTitle,
                seoDescription: page.seoDescription, noindex: page.noindex, deletedAt: null,
            };
            const row = existing
                ? await tx.page.update({ where: { id: existing.id }, data })
                : await tx.page.create({ data: { siteId: site.id, path: p, ...data } });
            const version = await tx.pageVersion.create({
                data: { pageId: row.id, kind: 'published', blocks, note: 'Imported from site files' },
            });
            await tx.page.update({ where: { id: row.id }, data: { publishedVersionId: version.id } });
            created.push(p);
        }
    }, { timeout: 60000 });

    if (created.length) {
        await require('../server/lib/audit').record(null, {
            action: 'cms.import',
            entityType: 'Site',
            summary: `Imported ${created.length} page(s): ${created.join(', ')}${replace ? ' (replace)' : ''}`,
        });
    }
    log.log(`✓ ${created.length} page(s) written${skipped.length ? `, ${skipped.length} already existed and were left alone` : ''}.`);
    return { created, skipped };
}

module.exports = { runImport };

if (require.main === module) {
    const args = process.argv.slice(2);
    if (args.includes('--dev')) {
        require('./lib/dev-db').useDevDatabase();
    } else if (args.includes('--on-deploy')) {
        if (!process.env.RAILWAY_ENVIRONMENT_NAME) {
            console.error('✗ --on-deploy runs inside Railway only.');
            process.exit(1);
        }
        require('./env');
    } else {
        console.error('usage: node scripts/cms-import.js --dev [--replace]   (production: RUN_CMS_IMPORT=1 on deploy)');
        process.exit(1);
    }
    const prisma = require('../server/prisma');
    runImport({ prisma, replace: args.includes('--replace') })
        .then(() => prisma.$disconnect())
        .catch(async (err) => {
            console.error('✗ ' + err.message);
            await prisma.$disconnect();
            process.exit(1);
        });
}
```

- [ ] **Step 3: Add the deploy step** to `scripts/deploy-schema.js`.
  1. Move the existing push code into a function. The existing code runs from the
     `DATABASE_URL` check to the end of the `try/catch`, so the first `if` becomes the
     caller. The new tail of the file:

```js
function pushSchema() {
  // ... the existing body, unchanged: the DATABASE_URL check, the host line,
  // and the try/catch around `prisma db push` ...
}

if (process.env.RUN_DB_PUSH === '1') pushSchema();
else console.log('· RUN_DB_PUSH is not set — skipping the schema push.');

/* The page import (scripts/cms-import.js) runs here for the same reason the
   push does: inside Railway the database is reachable and no credential leaves
   the platform. It never overwrites (no --replace), so a second run with the
   flag still set only reports that the pages exist. Unlike the push, a refused
   import does not stop the app: the switch is off until someone reads the log,
   and the files keep serving. */
if (process.env.RUN_CMS_IMPORT === '1') {
  try {
    execFileSync('node', ['scripts/cms-import.js', '--on-deploy'], { stdio: 'inherit' });
    console.log('✓ page import finished. Unset RUN_CMS_IMPORT now.');
  } catch (err) {
    console.error('✗ page import failed — see above. The site keeps serving its files.');
  }
} else {
  console.log('· RUN_CMS_IMPORT is not set — skipping the page import.');
}
```

  2. Update the header comment to describe `RUN_CMS_IMPORT` alongside `RUN_DB_PUSH`.
  3. Check with `node scripts/deploy-schema.js`, with neither flag set. Expected: both
     "skipping" lines, exit code 0.

- [ ] **Step 4: Add the script** `"cms:import:dev": "node scripts/cms-import.js --dev"`
  to `package.json`.
- [ ] **Step 5: Import into the development database.** Run `npm run cms:import:dev`.
  The dev database has no `Setting` rows, so `leads.interestMap` comes from
  `DEFAULTS`. Expected: `· development database: <host>`, then
  `✓ 8 page(s) written.` Run it again. Expected:
  `✓ 0 page(s) written, 8 already existed and were left alone.`
- [ ] **Step 6: Write the gated integration test** `test/cms/store.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('store reads the imported pages', { skip: process.env.CMS_DEV_DB !== '1' && 'set CMS_DEV_DB=1 to run against the dev database' }, async () => {
  require('../../scripts/lib/dev-db').useDevDatabase();
  const prisma = require('../../server/prisma');
  const store = require('../../server/cms/store').createStore(prisma);
  try {
    const paths = await store.listPublishedPaths('projectnidos');
    assert.equal(paths.length, 8);
    const home = await store.getPublished('projectnidos', '/');
    assert.deepEqual(home.blocks.map((b) => b.type), ['hero', 'text', 'practice-cards', 'reasons', 'contact-form']);
    assert.equal(await store.getPublishedVersionId('projectnidos', '/'), home.versionId);
    assert.equal((await store.getSiteSettings('projectnidos')).nav.links.length, 4);
  } finally {
    await prisma.$disconnect();
  }
});
```

  Run `CMS_DEV_DB=1 node --test test/cms/store.test.js`. Expected: pass. Plain
  `npm test` skips it.
- [ ] **Step 7: Commit.**

```bash
git add server/cms/store.js scripts/cms-import.js scripts/deploy-schema.js package.json test/cms/store.test.js
git commit -m "feat(cms): page store and the one-time import, runnable on deploy"
```

---

### Task 13: Middleware, admin preview, the switch, and wiring

**Files:**
- Create: `server/cms/middleware.js`, `server/cms/preview.js`
- Modify: `server/lib/settings.js`, `server/routes/admin/settings.js`, `admin.html`,
  `admin.js`, `server.js`
- Test: `test/cms/middleware.test.js`

**Interfaces:**
- `createCmsMiddleware({ store, settings, renderPage, canPreview, log = console, now = Date.now })`
  returns `{ middleware, renderNotFound(req, res) → Promise<boolean>, clear() }`.
  - Handles GET and HEAD only.
  - `/index.html` is treated as `/`.
  - `/404` is never served by `middleware`.
  - A path is served only if it is in the published-paths list, refreshed every 5 s.
    Other requests (APIs, assets, CRM pages) never touch the page tables.
  - The cache is `path → { html, versionId, checkedAt }`. Within 5 s of a check it is
    reused as is. After that, one cheap version lookup either keeps it or rebuilds it.
  - `?__cms=1` / `?__cms=0` force database or file, but only when
    `await canPreview(req)` is true. Such responses carry `Cache-Control: no-store`.
- `createCanPreview(prisma, env = process.env) → (req) → Promise<boolean>`: true in
  development, or when the request carries a valid session cookie for an active admin.
- `settings` DEFAULTS gains `'cms.servePages': false`.

- [ ] **Step 1: Write the failing test** `test/cms/middleware.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCmsMiddleware } = require('../../server/cms/middleware');

function harness({ on = true, paths = ['/', '/404'], render = () => '<p>db</p>', preview = false } = {}) {
  let t = 0;
  let ver = 1;
  const logs = [];
  const calls = { getPublished: 0 };
  const store = {
    listPublishedPaths: async () => paths,
    getPublished: async (site, p) => {
      calls.getPublished += 1;
      return paths.includes(p) ? { page: { path: p, layout: 'home' }, blocks: [], versionId: ver } : null;
    },
    getPublishedVersionId: async () => ver,
    getSiteSettings: async () => ({}),
  };
  const state = { on };
  const settings = { get: async (k) => (k === 'cms.servePages' ? state.on : undefined) };
  const cms = createCmsMiddleware({
    store, settings, renderPage: render, canPreview: async () => preview,
    log: { error: (...a) => logs.push(a.join(' ')) }, now: () => t,
  });
  const call = (path, query = {}) => new Promise((resolve) => {
    const res = {
      headers: {}, statusCode: 200,
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      send(b) { resolve({ sent: b, status: this.statusCode, headers: this.headers }); },
    };
    cms.middleware({ method: 'GET', path, query }, res, () => resolve({ next: true }));
  });
  return { cms, call, logs, calls, state, tick: (ms) => { t += ms; }, publish: () => { ver += 1; } };
}

test('serves a published page when the switch is on', async () => {
  assert.equal((await harness().call('/')).sent, '<p>db</p>');
});

test('falls through when off, unpublished, or not a page', async () => {
  assert.equal((await harness({ on: false }).call('/')).next, true);
  assert.equal((await harness().call('/nidos/pricing.html')).next, true);
  const h = harness();
  assert.equal((await h.call('/api/leads')).next, true);
  assert.equal(h.calls.getPublished, 0);
});

test('unknown block type falls through and is logged', async () => {
  const h = harness({ render: () => { throw new Error('unknown block type "gone"'); } });
  assert.equal((await h.call('/')).next, true);
  assert.match(h.logs.join('\n'), /\/ .*unknown block type "gone"/);
});

test('index.html aliases the home page; /404 is never served directly', async () => {
  const h = harness();
  assert.equal((await h.call('/index.html')).sent, '<p>db</p>');
  assert.equal((await h.call('/404')).next, true);
});

test('cache is reused, then rebuilt after a publish', async () => {
  let n = 0;
  const h = harness({ render: () => `<p>${++n}</p>` });
  assert.equal((await h.call('/')).sent, '<p>1</p>');
  assert.equal((await h.call('/')).sent, '<p>1</p>');
  h.tick(6000);
  assert.equal((await h.call('/')).sent, '<p>1</p>');
  h.publish();
  h.tick(6000);
  assert.equal((await h.call('/')).sent, '<p>2</p>');
});

test('switch off bypasses a warm cache', async () => {
  const h = harness();
  assert.equal((await h.call('/')).sent, '<p>db</p>');
  h.state.on = false;
  assert.equal((await h.call('/')).next, true);
});

test('preview flag is ignored without preview rights', async () => {
  assert.equal((await harness({ on: false }).call('/', { __cms: '1' })).next, true);
  assert.equal((await harness({ on: true }).call('/', { __cms: '0' })).sent, '<p>db</p>');
});

test('preview flag works with preview rights, uncached by browsers', async () => {
  const r = await harness({ on: false, preview: true }).call('/', { __cms: '1' });
  assert.equal(r.sent, '<p>db</p>');
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal((await harness({ on: true, preview: true }).call('/', { __cms: '0' })).next, true);
});

test('renderNotFound renders /404 with status 404, or reports it could not', async () => {
  const h = harness();
  const out = await new Promise((resolve) => {
    const res = { setHeader() {}, status(c) { this.statusCode = c; return this; }, send(b) { resolve({ b, s: this.statusCode }); } };
    h.cms.renderNotFound({ path: '/nope', query: {} }, res);
  });
  assert.deepEqual(out, { b: '<p>db</p>', s: 404 });
  assert.equal(await harness({ on: false }).cms.renderNotFound({ path: '/nope', query: {} }, {}), false);
});

test('canPreview: no valid cookie in production is no', async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
  const { createCanPreview } = require('../../server/cms/preview');
  const prisma = { user: { findUnique: async () => ({ role: 'admin', isActive: true }) } };
  const can = createCanPreview(prisma, { NODE_ENV: 'production' });
  assert.equal(await can({ cookies: {}, headers: {} }), false);
  assert.equal(await can({ cookies: { token: 'not-a-jwt' }, headers: {} }), false);
  assert.equal(await createCanPreview(prisma, { NODE_ENV: 'development' })({ cookies: {}, headers: {} }), true);
});
```

- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement** `server/cms/middleware.js`:

```js
/*
 * Serves published pages from the page tables, in front of today's pipeline.
 *
 * Anything it cannot do - the switch is off, the path is not a published page,
 * the database is down, a block no longer exists - ends in next(), and the
 * request carries on to the "Site content" middleware and the files on disk
 * exactly as it did before this existed. Turning the switch off is therefore
 * the whole rollback.
 */
const SITE = 'projectnidos';
const RECHECK_MS = 5000;

function createCmsMiddleware({ store, settings, renderPage, canPreview, log = console, now = Date.now }) {
  const cache = new Map();
  let paths = { set: new Set(), checkedAt: -Infinity };

  async function publishedPaths() {
    if (now() - paths.checkedAt > RECHECK_MS) {
      paths = { set: new Set(await store.listPublishedPaths(SITE)), checkedAt: now() };
    }
    return paths.set;
  }

  async function build(path) {
    const hit = cache.get(path);
    if (hit && now() - hit.checkedAt <= RECHECK_MS) return hit.html;
    if (hit && (await store.getPublishedVersionId(SITE, path)) === hit.versionId) {
      hit.checkedAt = now();
      return hit.html;
    }
    const found = await store.getPublished(SITE, path);
    if (!found) { cache.delete(path); return null; }
    const site = await store.getSiteSettings(SITE);
    const html = renderPage({ page: { ...found.page, path }, blocks: found.blocks, site });
    cache.set(path, { html, versionId: found.versionId, checkedAt: now() });
    return html;
  }

  // Resolves true once the response is sent, false when the caller should
  // carry on as if this did not exist.
  async function serve(req, res, path, status) {
    try {
      const flag = req.query && req.query.__cms;
      const forced = (flag === '1' || flag === '0') && (await canPreview(req)) ? flag : null;
      if (forced === '0') return false;
      if (!forced && !(await settings.get('cms.servePages'))) return false;
      if (!(await publishedPaths()).has(path)) return false;
      const html = await build(path);
      if (html == null) return false;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', forced ? 'no-store' : 'no-cache');
      res.status(status).send(html);
      return true;
    } catch (err) {
      log.error(`cms: ${path} fell back to the file:`, err.message);
      return false;
    }
  }

  function middleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path === '/404') return next();
    const path = req.path === '/index.html' ? '/' : req.path;
    serve(req, res, path, 200).then((done) => { if (!done) next(); });
  }

  return {
    middleware,
    renderNotFound: (req, res) => serve(req, res, '/404', 404),
    clear: () => { cache.clear(); paths = { set: new Set(), checkedAt: -Infinity }; },
  };
}

module.exports = { createCmsMiddleware };
```

- [ ] **Step 4: Implement** `server/cms/preview.js`:

```js
/*
 * Who may add ?__cms=1 (show the database page) or ?__cms=0 (show the file)
 * to a public URL: anyone on a development server, and on the live site only
 * a signed-in, active admin. The session cookie is httpOnly and sent with a
 * normal page load, so an admin can check a page in their own browser before
 * the switch goes on for everyone.
 *
 * The auth module is required on first use rather than at load: it refuses to
 * load without JWT_SECRET, and the development path never needs it.
 */
const jwt = require('jsonwebtoken');

function createCanPreview(prisma, env = process.env) {
  return async function canPreview(req) {
    if (env.NODE_ENV === 'development') return true;
    const { SECRET_KEY, readToken } = require('../middleware/auth');
    const token = readToken(req);
    if (!token) return false;
    try {
      const { id } = jwt.verify(token, SECRET_KEY);
      const user = await prisma.user.findUnique({ where: { id }, select: { role: true, isActive: true } });
      return Boolean(user && user.isActive !== false && user.role === 'admin');
    } catch {
      return false;
    }
  };
}

module.exports = { createCanPreview };
```

- [ ] **Step 5: Run** `npm test`. Expected: all pass.
- [ ] **Step 6: Add the switch.**
  1. `server/lib/settings.js`: in `DEFAULTS`, after `'gate.password'`, add:

```js
  // Serve public pages from the page tables (server/cms). Off: the files on disk.
  'cms.servePages': false,
```

  2. `server/routes/admin/settings.js`: in `check()`, add the key to the existing
     boolean rule:

```js
        case 'gate.enabled':
        case 'cms.servePages':
            return typeof value === 'boolean' ? null : 'Must be true or false.';
```

     After the `await audit.record(req, {…});` call in the PUT handler, add
     `if (req.app.locals.cms) req.app.locals.cms.clear();`.
  3. `admin.html`: insert this before the "Site password gate" `.setting`, inside the
     same `.crm-card`:

```html
                <div class="setting">
                    <div class="setting-head">
                        <div>
                            <div class="setting-title">Serve pages from the page editor</div>
                            <div class="setting-help">
                                On: public pages are built from the pages stored in the database.
                                Off: the site serves its files, as before. Turning it off is instant.
                            </div>
                        </div>
                        <label class="switch">
                            <input type="checkbox" id="cms-serve">
                            <span class="switch-track"></span>
                        </label>
                    </div>
                </div>
```

  4. `admin.js`:
     - In `loadSettings()`, after the `gate-enabled` line, add
       `document.getElementById('cms-serve').checked = Boolean(settingsValues['cms.servePages']);`.
     - In the save handler's `values` object, add
       `'cms.servePages': document.getElementById('cms-serve').checked,`.

- [ ] **Step 7: Wire it into `server.js`.**
  1. Just above `app.use(siteContent.middleware);`, add the block below. If `server.js`
     already has the Prisma client in scope under another name, use that instead of
     the new `require`.

```js
/* Pages from the page tables (server/cms), when the "Serve pages from the page
   editor" setting is on. In front of the Site content middleware and the files,
   and falls through to both whenever it has nothing to serve. */
const prisma = require('./server/prisma');
const { createStore } = require('./server/cms/store');
const { createCmsMiddleware } = require('./server/cms/middleware');
const { createCanPreview } = require('./server/cms/preview');
const { renderPage } = require('./server/cms/layout');
const cms = createCmsMiddleware({
    store: createStore(prisma), settings, renderPage, canPreview: createCanPreview(prisma),
});
app.locals.cms = cms;
app.use(cms.middleware);
```

  2. In the `app.get('*', …)` catch-all, replace its last line
     `res.status(404).sendFile(path.join(__dirname, '404.html'));` with:

```js
  cms.renderNotFound(req, res).then((done) => {
    if (!done) res.status(404).sendFile(path.join(__dirname, '404.html'));
  });
```

- [ ] **Step 8: Check against the development database.** Run `npm test`. Then run
  `npm run dev:cms` in the background and check:
  1. Switch off, file served:
     `curl -s localhost:4031/ | grep -c 'GENERATED FILE'` returns `1`.
  2. Development preview:
     `curl -s 'localhost:4031/?__cms=1' | grep -c 'GENERATED FILE'` returns `0`, and
     `curl -s 'localhost:4031/?__cms=1' | grep -c 'class="hero-orbit"'` returns `1`.
  3. The 404 from the database:
     `curl -s -o /dev/null -w '%{http_code}' 'localhost:4031/no-such-page?__cms=1'`
     returns `404`.

  Then stop the server.
- [ ] **Step 9: Commit.**

```bash
git add server/cms server/lib/settings.js server/routes/admin/settings.js admin.html admin.js server.js test/cms/middleware.test.js
git commit -m "feat(cms): serve published pages behind an admin switch, with admin preview"
```

---

### Task 14: Parity run: HTML, screenshots, behaviour

**Files:**
- Create: `scripts/cms-parity.js`
- Modify: `package.json` (`"cms:parity": "node scripts/cms-parity.js"`), `.gitignore`

The script compares `?__cms=0` (the file) with `?__cms=1` (the database) on a running
server. It defaults to `http://127.0.0.1:4031`, or the address in `CMS_PARITY_BASE`.

- [ ] **Step 1: Write** `scripts/cms-parity.js`:

```js
#!/usr/bin/env node
/*
 * Files vs database, page by page, on a running development server
 * (npm run dev:cms). Exit 1 on any failure; writes screenshots and diff
 * images to tmp/parity/. See the spec, §7 "Proof nothing changed".
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const cheerio = require('cheerio');
const { normalizeHtml } = require('../test/helpers/html');

const BASE = process.env.CMS_PARITY_BASE || 'http://127.0.0.1:4031';
const PW = process.env.PW || '/Users/test/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const OUT = path.join(__dirname, '..', 'tmp', 'parity');
const SAME_LOOK = ['/', '/nidos/digitalization.html', '/nidos/pricing.html'];
const LEGAL = ['/nidos/privacy.html', '/nidos/terms.html', '/nidos/cookie-policy.html', '/nidos/gdpr.html'];
const WIDTHS = [390, 768, 1024, 1440, 1920];
const rows = [];
const check = (page, name, ok, detail = '') => rows.push({ page, name, ok, detail });
const words = (s) => s.replace(/\s+/g, ' ').trim();
const slug = (p) => p.replace(/\W+/g, '_');

const get = async (p, flag) => {
    const r = await fetch(`${BASE}${p}?__cms=${flag}`);
    return { status: r.status, html: await r.text() };
};

// Share of pixels that differ by more than 8/255; writes a diff image.
function pixelDiff(a, b, out) {
    const py = [
        'import sys',
        'from PIL import Image, ImageChops',
        "a, b = Image.open(sys.argv[1]).convert('RGB'), Image.open(sys.argv[2]).convert('RGB')",
        'if a.size != b.size:',
        "    print('size', a.size, b.size); sys.exit(0)",
        "d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 8 else 0)",
        'd.save(sys.argv[3])',
        'print(sum(1 for v in d.getdata() if v) / (a.size[0] * a.size[1]))',
    ].join('\n');
    return execFileSync('python3', ['-c', py, a, b, out]).toString().trim();
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });

    for (const p of SAME_LOOK) {
        const [file, db] = [await get(p, 0), await get(p, 1)];
        const [a, b] = [normalizeHtml(file.html, p), normalizeHtml(db.html, p)];
        const at = [...a].findIndex((ch, i) => ch !== b[i]);
        check(p, 'body html', a === b, a === b ? '' : `at ${at}: file «${a.slice(at, at + 150)}» db «${b.slice(at, at + 150)}»`);
        const ratio = db.html.length / file.html.length;
        check(p, 'size within 5%', Math.abs(1 - ratio) <= 0.05, `${(ratio * 100).toFixed(1)}%`);
    }

    for (const p of LEGAL) {
        const [file, db] = [await get(p, 0), await get(p, 1)];
        const src = words(cheerio.load(file.html)('main .container').first().children('div').first().text());
        const out = words(cheerio.load(db.html)('.legal-body').text());
        check(p, 'same words', src === out);
        check(p, 'status 200', db.status === 200, String(db.status));
    }
    const nf = await fetch(`${BASE}/no-such-page?__cms=1`);
    const nfHtml = await nf.text();
    check('/404', 'status 404 from the database', nf.status === 404 && nfHtml.includes('Page not found.'), String(nf.status));

    const pw = require(PW);
    for (const engine of ['chromium', 'webkit']) {
        let browser;
        try { browser = await pw[engine].launch(); } catch (e) { check(engine, 'launch', false, e.message); continue; }
        for (const p of SAME_LOOK) {
            for (const w of WIDTHS) {
                const shots = [];
                const seen = [];
                for (const flag of [0, 1]) {
                    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
                    await ctx.addInitScript(() => {
                        try { sessionStorage.setItem('pn_gate_unlocked', '1'); sessionStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
                    });
                    const page = await ctx.newPage();
                    const errors = [];
                    page.on('pageerror', (e) => errors.push(String(e)));
                    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
                    await page.goto(`${BASE}${p}?__cms=${flag}`, { waitUntil: 'load' });
                    await page.waitForTimeout(1500);
                    const shot = path.join(OUT, `${engine}-${w}-${slug(p)}-${flag}.png`);
                    await page.screenshot({ path: shot, fullPage: true });
                    shots.push(shot);
                    let invalid = null;
                    if (p === '/') {
                        await page.click('.contact-form button[type="submit"]');
                        invalid = await page.locator('.contact-form .is-invalid').count();
                    }
                    seen.push({ errors, invalid, orbit: await page.locator('.hero-orbit.is-drawn').count() });
                    await ctx.close();
                }
                const where = `${p} ${engine} ${w}`;
                const d = pixelDiff(shots[0], shots[1], path.join(OUT, `${engine}-${w}-${slug(p)}-diff.png`));
                check(where, 'pixels', !d.startsWith('size') && Number(d) <= 0.001, d);
                check(where, 'no console errors', seen.every((x) => !x.errors.length), JSON.stringify(seen.map((x) => x.errors)));
                check(where, 'same behaviour', seen[0].invalid === seen[1].invalid && seen[0].orbit === seen[1].orbit,
                    JSON.stringify(seen.map(({ invalid, orbit }) => ({ invalid, orbit }))));
                if (p === '/') check(where, 'form flags 3 empty fields', seen[1].invalid === 3, String(seen[1].invalid));
            }
        }
        await browser.close();
    }

    const failed = rows.filter((r) => !r.ok);
    for (const r of rows) console.log(`${r.ok ? '✓' : '✗'} ${r.page.padEnd(40)} ${r.name}${r.ok ? '' : '  ' + r.detail}`);
    console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
    process.exit(failed.length ? 1 : 0);
})();
```

  Add `tmp/` to `.gitignore` if it is not there already.

- [ ] **Step 2: Run it.** Start `npm run dev:cms` in the background, then run
  `npm run cms:parity`. Expected: every row ✓.
  - For a pixel failure, open the `-diff.png` and both screenshots.
  - If this cache has no WebKit, rerun with
    `PW=/Users/test/.npm/_npx/705bc6b22212b352/node_modules/playwright-core`.
  - Fix the block or the layout, rerun `npm test`, then rerun parity.
- [ ] **Step 3: Commit.**

```bash
git add scripts/cms-parity.js package.json .gitignore
git commit -m "test(cms): parity run - html, screenshots and behaviour, files vs database"
```

---

### Task 15: Release runbook

**Files:**
- Create: `docs/superpowers/runbooks/cms-release.md`

- [ ] **Step 1: Write the runbook** with these steps. Each step names who approves it.
  1. **Merge.** Merge `cms/foundation` to `main` (**owner approves**). Railway deploys
     it. The switch is off, so visitors see no change. Check that `/`, a legal page and
     a missing page return what they did before.
  2. **Tables.** Set `RUN_DB_PUSH=1` on the production service and redeploy
     (**owner approves**). The log must show `✓ schema is up to date`. Then unset
     `RUN_DB_PUSH`.
  3. **Import.** Set `RUN_CMS_IMPORT=1` and redeploy (**owner approves**). The log
     must show `✓ 8 page(s) written.` Then unset `RUN_CMS_IMPORT`.
     - If the log shows `✗ … is not a CRM lead category`, fix that category in
       Settings, or the option, and repeat.
  4. **Preview.** Signed in as an admin, open each of the eight pages on the live site
     with `?__cms=1` next to `?__cms=0`. They should look the same, except the legal
     pages and the 404, which change look.
  5. **Switch on.** In Admin → Settings, turn on "Serve pages from the page editor"
     (**owner approves**).
  6. **Live check.** Signed out, in a private window:
     - every page returns 200;
     - no console errors;
     - the orbit, diagrams and field are running;
     - the empty contact form flags its three fields;
     - `/no-such-page` returns 404 in the new look.
  7. **Rollback.** Turn the switch off. The next request is served from the files.
- [ ] **Step 2: Commit.**

```bash
git add docs/superpowers/runbooks/cms-release.md
git commit -m "docs(cms): release runbook for the foundation"
```

---

## Self-review

- **Spec coverage:**

  | Spec section | Where |
  |---|---|
  | §3 architecture | Tasks 11, 13 |
  | §4 data model | Task 3, with `noindex` added (§13) |
  | §5 blocks | Tasks 5–9, including the §13 amendments: one Service catalogue, buttons on Not included, anchors |
  | §6 styles | plan 1b; held in place by `layouts` |
  | §7 moving pages | Tasks 2, 8–12, 14 |
  | §8 development and release | Tasks 3, 12 (deploy-time import), 15 |
  | §9 testing | Tasks 1, 4–14 |
  | §10 failure handling | Task 13 tests |
  | §11 security | Tasks 4, 5 (static guard), 13 (admin-only preview), plus the existing admin-only settings route |

- **Names checked across tasks:**
  - `sanitize`, `validateProps`, `validatePage`, `getBlock`
  - `assets(props)`, `anchor(props)`
  - `withIds`, `pageMeta`, `convertPricing`, `convertLegal`, `convert404`,
    `convertHome`, `convertServices`, `siteSettingsFrom`, `applyOverrides`
  - `renderPage`, `resolveNavHref`
  - `createStore`, `listPublishedPaths`, `getPublished`, `getPublishedVersionId`,
    `getSiteSettings`
  - `runImport`, `createCmsMiddleware`, `createCanPreview`, `useDevDatabase`
- **Deliberately not here:**
  - editing, drafts, publish and restore (part 2);
  - nav, footer and SEO editing, sitemap and redirects (part 3);
  - removing the build scripts and the "Site content" tab (after part 2).
