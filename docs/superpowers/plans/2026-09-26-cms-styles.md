# Site editor, part 1b (Styles and scripts per block): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Any block can be placed on either page layout and look and behave there exactly as
it does on its own layout today. Each block owns its styles, and a script loads only on the
pages that use it.

**Architecture:**
- **Blocks mark their root.** Each block's root element carries the class `b-<type>`.
- **Blocks own their styles.** A block's rules live in `blocks/<type>/style.css`, under
  today's class names.
- **Scoping.** At start-up, `server/cms/css.js` puts every selector in a block's sheet
  under `:where(.b-<type>)`.
  - `:where()` adds no specificity, so every rule weighs what it did before.
  - The cascade is decided exactly as it is today.
- **One sheet per layout.** `server/cms/assets.js` joins, for each layout:
  1. the shared vocabulary;
  2. every block;
  3. the diagrams;
  4. the layout's frame.

  The result is served at `/cms/<layout>.css?v=<hash>`, and block pages load `base.css`
  then that sheet.
- **Scripts.** `landing.js` gives the form checking and the pointer pane to
  `contact-form.js` and `pointer-pane.js`, which load with the blocks that need them. The
  orbital scene starts at once on a page with no intro.
- **The files on disk do not change their look.** `index.html` and `nidos/*.html` keep
  today's stylesheets.
- **Proof.** The parity run compares the database pages against those files:
  - body HTML;
  - pixels;
  - every computed style of every element.

**Tech Stack:**
- Node 20 in production (Dockerfile `node:20-slim`), 22 locally.
- Express 4 and cheerio 1.2, both already dependencies.
- Node's built-in test runner.
- playwright-core from the local npx cache, for the parity and sampler runs only.

**Spec:** `docs/superpowers/specs/2026-09-23-cms-foundation-design.md`. Read §5 and §6,
then **§14, "Amendments from planning part 1b"**. §14 is this plan's ruling wherever it
differs from §5 and §6.

**Where:**
- Worktree: `/Users/test/Documents/claude/project-nidos.worktrees/cms`.
- Branch: `cms/styles`, from `origin/main` at `505b717`.
- The worktree already holds `.env.cms-dev` (the development database) and
  `node_modules`.
- Run every command from the worktree root.

## Global Constraints

- **No new dependencies.**
- **No local process ever connects to the production database.**
  - The parity and sampler runs use `npm run dev:cms`. It goes through
    `scripts/lib/dev-db.js`, which points at the development database and refuses
    anything else.
  - Never run `npm run db:push` or `scripts/with-env.js` here.
- **No credentials in the transcript.** Never print, `cat` or log `.env.cms-dev`, any
  `.env*` file or a `DATABASE_URL`. Print hostnames only.
- **Nothing changes for visitors.**
  - The "Serve pages from the page editor" switch stays off.
  - No production write happens.
  - The pages on disk keep loading the same stylesheets.
  - The live site changes in two places only:
    - `index.html` loads the two split-out scripts, with the same behaviour;
    - the `/cms/<layout>.css` route is added.
- **These files are not edited:** `base.css`, `landing.css`, `pages.css`, `shared.css`,
  `visuals.css`. They still style the pages on disk. If a fix seems to need one of them,
  stop and report to the controller.
- **Asset URLs after this plan:**

  | Asset | URL | Loaded by |
  |---|---|---|
  | base | `/base.css?v=6` | every page |
  | home layout sheet | `/cms/home.css?v=<12 hex>` | block pages on the home layout |
  | standard layout sheet | `/cms/standard.css?v=<12 hex>` | block pages on the standard layout |
  | landing, pages, shared, visuals | `?v=30`, `?v=9`, `?v=2`, `?v=1` as today | the pages on disk only |
  | menu button | `/nav-menu.js?v=1` | every page |
  | landing script | `/landing.js?v=13` | home layout |
  | form checking | `/contact-form.js?v=1` | pages with a Contact form |
  | pointer pane | `/pointer-pane.js?v=1` | pages with Practice cards |
  | diagram player | `/practice-visuals.js?v=1` | pages whose blocks show a diagram |
  | orbital scene | `/orbital-hero.js?v=4` | pages with a Hero |
  | topology field | `/topology-bg.js?v=1` | every page |

- **Scoping rules for a block's `style.css`:**
  - Every selector is scoped to the block.
  - `&` is the block's own element. It starts the selector and is followed by the
    element's class (`&.hero`).
  - Never name a `.b-` class, and never start from `html`, `body` or `:root`.
  - Page-level rules belong in `server/cms/styles/`.
- **Browser floor unchanged.** `:where()` needs what `visuals.css`'s `:is()` already needs:
  Safari 14, Chrome 88, Firefox 78.
- **Motion stays subtle.** No motion changes. The orbit change only lets the scene start
  on a page that has no intro to wait for.
- **Tests and commits:**
  - `npm test` passes at every commit.
  - Commit messages follow the repo's style (`feat(cms): …`, `refactor(cms): …`,
    `test(cms): …`) and end with your own `Co-Authored-By:` trailer.
- **Never push, and never merge.** The owner does both.

## Review Focus

These are the failure modes most likely to bite, in order. Each is pinned by a test in
the task named.

1. **Hover and error states.**
   - Risk: a rule that only applies on hover, or to a flagged form, can be lost or
     mis-scoped, and no screenshot at rest would show it.
   - Expected: those states compute the same styles as the file.
   - Pinned: the parity run's state rows. They cover a practice card, a reason, a
     contents link, a price-table link, a legal link and the flagged form. They are
     already on the branch, and Task 6 runs them.
2. **A block on the other layout at phone width.**
   - Expected: it looks as on its own layout, except for the two things the home frame
     does to every block there (anchors land nearer the top, and the hero gets room under
     the overlaid nav).
   - Pinned: the sampler's 390px rows (Task 7), then the owner looks at the 390px
     screenshots.
3. **Two Practice cards grids on one page.**
   - Expected: the pointer pane works in both.
   - Pinned: `pointer-pane.js` serves every grid (Task 5), and the sampler hovers the
     second grid (Task 7).
4. **A page from before a deploy asking for an old sheet.**
   - Expected: it is served today's sheet, and that sheet is not cached for a year under
     the old address.
   - Pinned: the `serveCss` tests (Task 4).
5. **A legacy sheet edited on `main` after the copy.** The landing is still being tuned
   on other branches.
   - Expected: `npm test` fails before this branch merges, and says what to do.
   - Pinned: the drift guard (Task 3), and the rebase step in "After the last task".

---

## Already on the branch

These landed with this plan, before Task 1:

- **Spec §14:** the rulings above.
- **`scripts/cms-parity.js`** now also compares computed styles:
  - every computed property of every element, file against database;
  - at 390, 700, 768, 880, 960, 1024, 1440 and 1920px (one width inside every band the
    sheets break at);
  - in the hover and flagged-form states;
  - with pixels still checked at the five widths used since plan 1a.

  `CMS_PARITY_ENGINES=chromium` or `webkit` runs one browser.

  Run against today's code on 26 Sep 2026, it passed **302/302 rows in each browser**.
  That is the baseline Task 6 must meet again.
- **The runbook** records that baseline.

## Running the development server (Tasks 6 and 7)

Port 4031 may be taken by an old preview server; use 4041, as the runbook does. The
server connects to the development database only, and prints its host, never its address.

1. Start it with the Bash tool's `run_in_background: true`:
   ```bash
   PORT=4041 npm run dev:cms > tmp/dev-cms.log 2>&1
   ```
2. Wait until it answers. This prints `200`, and needs no `sleep`:
   ```bash
   curl -s --retry 40 --retry-connrefused --retry-delay 1 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4041/
   ```
3. Stop it when done. The process is yours; stop nothing else:
   ```bash
   for pid in $(lsof -t -nP -iTCP:4041 -sTCP:LISTEN); do kill $pid; done
   ```

Run each long step in the foreground with a 600000 ms timeout.

---

### Task 1: Read and scope stylesheets

**Files:**
- Create: `server/cms/css.js`
- Test: `test/cms/css.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `parseCss(text) → Array<{ at: string|null, selectors: string[], decls: string[] }>`
  - `scopeCss(text, type) → string`
  - `scopeSelector(selector, type) → string`
  - `stripComments(text) → string`

  All four are exported from `server/cms/css.js`.

- [ ] **Step 1: Write the failing test**

`test/cms/css.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseCss, scopeCss } = require('../../server/cms/css');

test('reads rules, selector lists and one level of @media', () => {
  assert.deepEqual(parseCss(`
    /* a comment, { with braces } */
    .a, .b > .c { color: red; margin: 0 auto }
    @media (max-width: 720px) {
      .field :is(input, select) { outline: none; }
    }
  `), [
    { at: null, selectors: ['.a', '.b > .c'], decls: ['color: red', 'margin: 0 auto'] },
    { at: '@media (max-width: 720px)', selectors: ['.field :is(input, select)'], decls: ['outline: none'] },
  ]);
});

test('scopes every selector to the block, and "&" to its own element', () => {
  assert.equal(scopeCss(`
    &.hero { position: relative; }
    .hero-title, &.hero:hover .x::before { color: red; }
    @media (max-width: 720px) { &.hero { min-height: 0; } .a { b: c; } }
    & { --t: 1; }
  `, 'hero'), [
    ':where(.b-hero).hero { position: relative; }',
    ':where(.b-hero) .hero-title, :where(.b-hero).hero:hover .x::before { color: red; }',
    '@media (max-width: 720px) {',
    ':where(.b-hero).hero { min-height: 0; }',
    ':where(.b-hero) .a { b: c; }',
    '}',
    ':where(.b-hero) { --t: 1; }',
    '',
  ].join('\n'));
});

test('an empty sheet scopes to nothing', () => assert.equal(scopeCss('', 'text'), ''));

test('refuses what it cannot scope safely', () => {
  for (const [css, why] of [
    ['html .x { a: b; }', /reaches outside the block/],
    [':root { --a: 1; }', /reaches outside the block/],
    ['.a & .b { a: b; }', /"&" starts a selector/],
    ['&section { a: b; }', /"&" starts a selector/],
    ['.b-hero .x { a: b; }', /names a block class/],
    ['@keyframes k { from { a: b; } }', /not supported/],
    ['@media (x) { @media (y) { .a { b: c; } } }', /not supported/],
    ['.a { .b { c: d; } }', /nested rules/],
    ['.a { b: c;', /never closed/],
    ['.a { b: c; } }', /outside any rule/],
    ['.a { b: c; } } .d { e: f; }', /cannot read/],
  ]) assert.throws(() => scopeCss(css, 'hero'), why, css);
});

test("reads the site's legacy sheets without complaint", () => {
  for (const f of ['landing.css', 'pages.css', 'shared.css']) {
    assert.ok(parseCss(fs.readFileSync(path.join(__dirname, '../..', f), 'utf8')).length > 20, f);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/cms/css.test.js`

Expected: FAIL with `Cannot find module '../../server/cms/css'`.

- [ ] **Step 3: Write the implementation**

`server/cms/css.js`:

```js
/*
 * The site's own stylesheets read as rules, and a block's rules scoped to the
 * block (plan 1b; spec §14). Not a general CSS parser: it reads plain rules
 * and one level of @media or @supports, which is all the site's sheets use,
 * and throws on anything else rather than guess. It assumes no string in a
 * sheet holds a brace, a semicolon or a comment marker; the site's have none.
 */
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const squash = (s) => s.replace(/\s+/g, ' ').trim();

// Commas inside :is(...) and the like do not separate selectors.
function splitSelectors(prelude) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < prelude.length; i++) {
    if (prelude[i] === '(') depth++;
    else if (prelude[i] === ')') depth--;
    else if (prelude[i] === ',' && depth === 0) {
      out.push(prelude.slice(start, i));
      start = i + 1;
    }
  }
  out.push(prelude.slice(start));
  return out.map(squash).filter(Boolean);
}

// The index of the "}" that closes the "{" at `open`.
function closing(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return i;
  }
  throw new Error('css: a "{" is never closed');
}

// [{ at: '@media (max-width: 720px)' or null, selectors: [...], decls: [...] }]
function parseCss(text, at = null) {
  const src = stripComments(text);
  const rules = [];
  let i = 0;
  for (;;) {
    const open = src.indexOf('{', i);
    const prelude = squash(src.slice(i, open === -1 ? undefined : open));
    if (open === -1) {
      if (prelude) throw new Error(`css: "${prelude.slice(0, 40)}" is outside any rule`);
      return rules;
    }
    if (/[;}]/.test(prelude)) throw new Error(`css: cannot read "${prelude.slice(0, 40)}"`);
    const end = closing(src, open);
    const inner = src.slice(open + 1, end);
    if (prelude.startsWith('@')) {
      if (at || !/^@(media|supports)\b/.test(prelude)) throw new Error(`css: "${prelude}" is not supported here`);
      rules.push(...parseCss(inner, prelude));
    } else {
      if (inner.includes('{')) throw new Error(`css: nested rules in "${prelude}" are not supported`);
      rules.push({ at, selectors: splitSelectors(prelude), decls: inner.split(';').map(squash).filter(Boolean) });
    }
    i = end + 1;
  }
}

/* :where() adds no specificity, so a scoped rule weighs exactly what it
   weighed in the sheet it came from, and the cascade between the blocks,
   base.css and the frames is decided as it was. "&" is the block's own
   element and starts the selector: "&.hero" is the section itself,
   ".hero-title" anything inside it. */
function scopeSelector(selector, type) {
  const where = `blocks/${type}/style.css: "${selector}"`;
  if (/^(html|body|:root)(?![\w-])/.test(selector)) {
    throw new Error(`${where} reaches outside the block; page rules belong in server/cms/styles/`);
  }
  if (/\.b-[a-z]/.test(selector)) throw new Error(`${where} names a block class; write "&" for the block's own element`);
  const scope = `:where(.b-${type})`;
  if (!selector.includes('&')) return `${scope} ${selector}`;
  const rest = selector.slice(1);
  if (selector[0] !== '&' || rest.includes('&') || /^[a-z]/i.test(rest)) {
    throw new Error(`${where}: "&" starts a selector, followed by the element's class`);
  }
  return scope + rest;
}

function scopeCss(text, type) {
  let out = '';
  let open = null;
  for (const r of parseCss(text)) {
    if (r.at !== open) {
      if (open) out += '}\n';
      if (r.at) out += `${r.at} {\n`;
      open = r.at;
    }
    out += `${r.selectors.map((s) => scopeSelector(s, type)).join(', ')} { ${r.decls.map((d) => `${d};`).join(' ')} }\n`;
  }
  return open ? `${out}}\n` : out;
}

module.exports = { parseCss, scopeCss, scopeSelector, stripComments };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/cms/css.test.js`, then `npm test`.

Expected: 5/5 pass in the new file, and the whole suite passes.

- [ ] **Step 5: Commit**

```bash
git add server/cms/css.js test/cms/css.test.js
git commit -m "feat(cms): read the site's stylesheets as rules and scope a block's to the block"
```

---

### Task 2: Every block names its root

**Files:**
- Modify: the render line of each of the 16 `blocks/<type>/index.js` (table below)
- Modify: `test/helpers/html.js`, `test/helpers/html.test.js`
- Create: `test/blocks/roots.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - Every block's rendered root element carries `b-<type>`.
  - `normalizeHtml` ignores `b-*` classes, so every parity comparison against the pages
    on disk (block tests, layout tests, `cms:parity`) stays exact.

- [ ] **Step 1: Write the failing tests**

`test/blocks/roots.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const conv = require('../../scripts/lib/cms-convert');
const { getBlock, BLOCK_TYPES } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');

const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
const PAGES = [
  conv.convertHome(JSON.parse(read('site/content.en.json'))),
  conv.convertServices(JSON.parse(read('site/digi.en.json'))),
  conv.convertPricing(read('nidos/pricing.html')),
  ...['privacy', 'terms', 'cookie-policy', 'gdpr'].map((f) => conv.convertLegal(read(`nidos/${f}.html`))),
  conv.convert404(),
];

// The class the block's style.css is scoped to (server/cms/css.js).
test('every block draws one root element, carrying b-<type>', () => {
  const seen = new Set();
  for (const { page, blocks } of PAGES) {
    for (const b of blocks) {
      const html = getBlock(b.type).render(b.props, { page: { ...page, path: '/x' }, esc, rich: sanitize, anchors: new Set() });
      const roots = cheerio.load(html, null, false).root().children();
      assert.equal(roots.length, 1, `${b.type} draws ${roots.length} root elements`);
      assert.ok(roots.first().hasClass(`b-${b.type}`), `${b.type}: the root lacks b-${b.type}`);
      seen.add(b.type);
    }
  }
  assert.deepEqual([...seen].sort(), [...BLOCK_TYPES].sort(), 'every block type is drawn');
});
```

Append to `test/helpers/html.test.js`:

```js
test('ignores the b-<type> class that marks a block root', () => {
  assert.equal(normalizeHtml('<body><section class="hero b-hero">x</section></body>'),
               normalizeHtml('<body><section class="hero">x</section></body>'));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/blocks/roots.test.js test/helpers/html.test.js`

Expected: FAIL. `roots` reports `hero: the root lacks b-hero`, and the normaliser test fails
on the extra class.

- [ ] **Step 3: Make the normaliser ignore `b-*`**

In `test/helpers/html.js`, replace this line:

```js
    if (el.attribs.class) el.attribs.class = el.attribs.class.split(/\s+/).filter(Boolean).sort().join(' ');
```

with:

```js
    if (el.attribs.class) {
      // b-<type> marks a block's root for its scoped styles (plan 1b). The
      // pages on disk never carry it, so it is not a difference.
      const cls = el.attribs.class.split(/\s+/).filter((c) => c && !/^b-[a-z-]+$/.test(c)).sort().join(' ');
      if (cls) el.attribs.class = cls;
      else delete el.attribs.class;
    }
```

- [ ] **Step 4: Add the class to each block's root**

Each is a one-line edit of the render's opening tag. Nothing else in the block changes.

| File | Line | From | To |
|---|---|---|---|
| `blocks/button-row/index.js` | 15 | `<section class="button-row">` | `<section class="button-row b-button-row">` |
| `blocks/contact-form/index.js` | 39 | `<section${id} class="contact">` | `<section${id} class="contact b-contact-form">` |
| `blocks/contact-info/index.js` | 27 | `<section${id} class="contact">` | `<section${id} class="contact b-contact-info">` |
| `blocks/hero/index.js` | 21 | `<section class="hero">` | `<section class="hero b-hero">` |
| `blocks/legal-document/index.js` | 36 | `<section${id} class="legal-section">` | `<section${id} class="legal-section b-legal-document">` |
| `blocks/not-included/index.js` | 27 | `<section${id} class="pricing-section">` | `<section${id} class="pricing-section b-not-included">` |
| `blocks/packages/index.js` | 27 | `<section${id} class="pricing-section">` | `<section${id} class="pricing-section b-packages">` |
| `blocks/page-intro/index.js` | 46 | `<section class="page-hero">` | `<section class="page-hero b-page-intro">` |
| `blocks/practice-cards/index.js` | 40 | `<section${id} class="practices">` | `<section${id} class="practices b-practice-cards">` |
| `blocks/pricing-table/index.js` | 32 | `<section${id} class="pricing-section">` | `<section${id} class="pricing-section b-pricing-table">` |
| `blocks/rates/index.js` | 23 | `<section${id} class="pricing-section">` | `<section${id} class="pricing-section b-rates">` |
| `blocks/reasons/index.js` | 25 | `<section${id} class="why">` | `<section${id} class="why b-reasons">` |
| `blocks/service-catalogue/index.js` | 71 | `<section${id} class="practices">` | `<section${id} class="practices b-service-catalogue">` |
| `blocks/steps/index.js` | 30 | `<section${id} class="pricing-section">` | `<section${id} class="pricing-section b-steps">` |
| `blocks/subscriptions/index.js` | 26 | `<section${id} class="pricing-section">` | `<section${id} class="pricing-section b-subscriptions">` |
| `blocks/text/index.js` | 21 | `<section${id} class="about">` | `<section${id} class="about b-text">` |

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`

Expected: all pass. That includes the new tests, every block test and the layout tests'
whole-body parity with the pages on disk.

- [ ] **Step 6: Commit**

```bash
git add blocks test/helpers/html.js test/helpers/html.test.js test/blocks/roots.test.js
git commit -m "feat(cms): every block marks its root with b-<type> for its scoped styles"
```

---

### Task 3: Move the rules into the blocks and the frames

**Files:**
- Create:
  - `server/cms/styles/common.css`
  - `server/cms/styles/home.css`
  - `server/cms/styles/standard.css`
- Create one `style.css` for each of these 15 blocks: `hero`, `text`, `practice-cards`,
  `reasons`, `contact-form`, `page-intro`, `service-catalogue`, `steps`, `contact-info`,
  `pricing-table`, `packages`, `rates`, `subscriptions`, `not-included`,
  `legal-document`. Button row has no rules of its own, so it gets no sheet.
- Test: `test/cms/styles.test.js`

**Interfaces:**
- Consumes: `parseCss` and `scopeCss` from Task 1, and the `b-<type>` roots from Task 2.
- Produces the sheets that Task 4 joins:
  - `server/cms/styles/common.css`: unscoped, first in every layout sheet.
  - `server/cms/styles/<layout>.css`: unscoped, last.
  - `blocks/<type>/style.css`: scoped by Task 1's rules.

**How to copy.** A reference such as "landing.css 214–330" means those lines of that file,
copied **verbatim**, comments included, in their order. The line numbers are those of
`origin/main` at `505b717`, which is what this branch holds. The drift guard in Step 1
fails if that is no longer so.

Where a destination takes rules out of a shared `@media` block, the plan writes that
block out in full. Keep each destination in the order given; it is the source order.

Every block sheet's header comment ends with these three lines:

```
 * Scoped when the layout sheets are built (server/cms/css.js): every
 * selector here reaches only inside this block, and "&" is the block's own
 * element.
```

- [ ] **Step 1: Write the failing test**

`test/cms/styles.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { parseCss, scopeCss } = require('../../server/cms/css');
const { getBlock, BLOCK_TYPES } = require('../../blocks');
const conv = require('../../scripts/lib/cms-convert');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');

const ROOT = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));

/* The move from the legacy sheets into server/cms/styles/ and the blocks'
   style.css (plan 1b, Task 3), held rule by rule. Every legacy rule is in a
   new sheet with the same selector and declarations, in the same @media, or
   is listed below with the reason it is not. And nothing is in the new sheets
   that the old did not have, bar the additions listed. */
const LEGACY = ['landing.css', 'pages.css', 'shared.css'];
const BLOCK_SHEETS = BLOCK_TYPES.map((t) => [t, `blocks/${t}/style.css`]).filter(([, f]) => exists(f));
const NEW = ['server/cms/styles/common.css', 'server/cms/styles/home.css', 'server/cms/styles/standard.css',
  ...BLOCK_SHEETS.map(([, f]) => f)];

// [sheet, @media or '', selector]: legacy rules no block page draws.
const NOT_CARRIED = new Set([
  // The portrait: the Text block draws none.
  ...['.portrait', '.portrait-frame', '.portrait-frame img', '.portrait figcaption', '.portrait-id',
    '.portrait-name', '.portrait-role', '.portrait-meta'].map((s) => ['landing.css', '', s]),
  ['landing.css', '@media (max-width: 860px)', '.portrait-frame'],
  // Four anchors by id; the home frame now covers every anchored section.
  ...['#main', '#practices', '#about', '#contact'].map((s) => ['landing.css', '@media (max-width: 720px)', s]),
  // The market note: no block draws it.
  ...['.market-note', '.market-note-heading', '.market-note p', '.market-note a', '.market-note a:hover']
    .map((s) => ['pages.css', '', s]),
].map((r) => r.join(' | ')));

// [sheet, @media or '', selector] -> properties left out. .lattice came later
// in pages.css at the same weight, so it always set the contact block's gap
// and the practices' padding; loading before the blocks, it would not. The
// hero's colour token moves onto the hero (see ADDED).
const TRIMMED = new Map([
  [['landing.css', '', ':root'], ['--ink-over-media']],
  [['pages.css', '', '.contact-block'], ['gap']],
  [['pages.css', '', '.practice'], ['padding-block']],
].map(([place, props]) => [place.join(' | '), props]));

// [sheet, @media or '', selector ("&" dropped), declarations] with no legacy source.
const ADDED = new Set([
  ['blocks/hero/style.css', '', '.hero', '--ink-over-media: #e4e4e7'],
  ...['main[id]', 'section[id]', 'article[id]'].map((s) =>
    ['server/cms/styles/home.css', '@media (max-width: 720px)', s, 'scroll-margin-top: var(--s4)']),
].map((r) => r.join(' | ')));

const entries = (file) => parseCss(read(file)).flatMap((r) => r.selectors.map((s) => ({
  file, at: r.at || '', sel: s.replace(/^&/, ''), decls: r.decls,
})));
const place = (e) => [e.file, e.at, e.sel].join(' | ');
const rule = (e) => [e.at, e.sel, e.decls.join('; ')].join(' | ');
const prop = (d) => d.slice(0, d.indexOf(':')).trim();

test('every legacy rule arrived, word for word, or is listed as not carried', () => {
  const arrived = new Set(NEW.flatMap(entries).map(rule));
  const missing = LEGACY.flatMap(entries).filter((e) => !NOT_CARRIED.has(place(e)))
    .map((e) => rule({ ...e, decls: e.decls.filter((d) => !(TRIMMED.get(place(e)) || []).includes(prop(d))) }))
    .filter((r) => !arrived.has(r));
  assert.deepEqual([...new Set(missing)], []);
});

test('nothing arrived that the legacy sheets did not have, bar the listed additions', () => {
  const had = new Set(LEGACY.flatMap(entries).filter((e) => !NOT_CARRIED.has(place(e)))
    .map((e) => rule({ ...e, decls: e.decls.filter((d) => !(TRIMMED.get(place(e)) || []).includes(prop(d))) })));
  const extra = NEW.flatMap(entries).filter((e) => !ADDED.has(`${place(e)} | ${e.decls.join('; ')}`))
    .map(rule).filter((r) => !had.has(r));
  assert.deepEqual([...new Set(extra)], []);
});

test('every exception above names a real rule', () => {
  const places = new Set(LEGACY.flatMap(entries).map(place));
  for (const k of [...NOT_CARRIED, ...TRIMMED.keys()]) assert.ok(places.has(k), k);
  const added = new Set(NEW.flatMap(entries).map((e) => `${place(e)} | ${e.decls.join('; ')}`));
  for (const k of ADDED) assert.ok(added.has(k), k);
});

test('every block sheet scopes cleanly', () => {
  for (const [t, f] of BLOCK_SHEETS) assert.doesNotThrow(() => scopeCss(read(f), t), f);
});

/* A block's sheet styles only what the block draws, plus the classes its
   script adds. Drawn from every page the import builds. */
const ADDED_BY_SCRIPT = { hero: ['is-drawn'], 'practice-cards': ['index-hl', 'is-on'], 'contact-form': ['is-invalid'] };
const PAGES = [
  ['/', conv.convertHome(JSON.parse(read('site/content.en.json')))],
  ['/nidos/digitalization.html', conv.convertServices(JSON.parse(read('site/digi.en.json')))],
  ['/nidos/pricing.html', conv.convertPricing(read('nidos/pricing.html'))],
  ...['privacy', 'terms', 'cookie-policy', 'gdpr'].map((f) => [`/nidos/${f}.html`, conv.convertLegal(read(`nidos/${f}.html`))]),
  ['/404', conv.convert404()],
];

test("a block's sheet only styles classes the block draws", () => {
  const drawn = {};
  for (const [p, { page, blocks }] of PAGES) {
    for (const b of blocks) {
      const html = getBlock(b.type).render(b.props, { page: { ...page, path: p }, esc, rich: sanitize, anchors: new Set() });
      const set = (drawn[b.type] ||= new Set(ADDED_BY_SCRIPT[b.type] || []));
      cheerio.load(html, null, false)('[class]').each((_, el) => el.attribs.class.split(/\s+/).forEach((c) => set.add(c)));
    }
  }
  for (const [t, f] of BLOCK_SHEETS) {
    const strangers = entries(f).flatMap((e) => [...e.sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))
      .filter((c) => !drawn[t].has(c));
    assert.deepEqual([...new Set(strangers)], [], f);
  }
});

/* The pages on disk still load landing.css, pages.css and shared.css, and the
   blocks were copied from exactly these versions. If one changes, make the
   same change where its rule now lives (the map is in plan 1b, Task 3), run
   npm run cms:parity, then record the new hash here. */
const COPIED_FROM = {
  'landing.css': 'b5c0d70713114402',
  'pages.css': '6619b14873bec317',
  'shared.css': '0f71b47d1a330dd9',
};
test('the legacy sheets are the versions the blocks were copied from', () => {
  for (const [f, hash] of Object.entries(COPIED_FROM)) {
    assert.equal(crypto.createHash('sha256').update(read(f)).digest('hex').slice(0, 16), hash,
      `${f} changed after its rules were copied into the blocks: copy the change too, then update this hash`);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/cms/styles.test.js`

Expected:
- The coverage tests fail with `ENOENT … server/cms/styles/common.css`.
- **The drift guard passes.** If it fails, `main` has moved since this plan was written.
  Stop and report to the controller; the line numbers below would be wrong.

- [ ] **Step 3: Write `server/cms/styles/common.css`**

1. This header:
   ```css
   /*
    * common.css - on every page drawn from blocks, after base.css and before
    * the blocks (server/cms/assets.js joins them). What every layout shares:
    * the topology field behind the page, and the vocabulary several blocks are
    * built from - the lattice, the section lede, prices and their notes, the
    * button row. Unscoped, like base.css's vocabulary, because each of these
    * means the same thing wherever it appears.
    *
    * Copied from landing.css and pages.css (plan 1b), which still style the
    * pages served from disk; test/cms/styles.test.js holds the two in step.
    */
   ```
2. landing.css 18–37: the TOPOLOGY FIELD comment.
3. In place of landing.css 38–42, this rule. The `--ink-over-media` token and its comment
   move to the Hero block.
   ```css
   :root {
       --field-strength: 0.42;
   }
   ```
4. landing.css 44–68.
5. `/* Notes under a price or a package - the Service catalogue and Packages both use them. */`,
   then pages.css 190, then pages.css 199–205.
6. pages.css 326–337: the lattice.
7. pages.css 376–407: the PRICING comment through `.amount-unit`.
8. pages.css 475–481: `.cta-row`.
9. This block (pages.css 499):
   ```css
   @media (max-width: 720px) {
       .cta-row > a { flex: 1 1 100%; }
   }
   ```

- [ ] **Step 4: Write `server/cms/styles/home.css`**

1. This header:
   ```css
   /*
    * home.css - the home layout's frame, last in its sheet so it can fit a
    * block to its surroundings: the offset for the fixed nav, the intro
    * splash, the footer as a lattice, the cookie banner, and the phone nav
    * that lies over the top of the page.
    *
    * Copied from landing.css (plan 1b), which still styles index.html as
    * served from disk; test/cms/styles.test.js holds the two in step.
    */
   ```
2. landing.css 15–16: `main { padding-top: 72px; }` and its comment.
3. landing.css 70–143: INTRO SPLASH.
4. landing.css 584–628: FOOTER.
5. landing.css 630–675: COOKIE CONSENT.
6. This block, which is the frame's part of landing.css 683–729:
   ```css
   @media (max-width: 720px) {
       /* The nav stops being fixed here: it scrolls away with the hero, so no
          anchor offset has to track it. It is one row - the logo, and the menu
          button top right (base.css, the phone menu) - and it lies over the top
          of the hero with no ground of its own, so the orbital scene runs up to
          the top of the screen behind it. The open panel brings its own ground.

          The hero keeps the band above the headline for the orbit rather than
          closing up under a shorter nav: an extra --s10 on top of its usual
          padding holds the headline where it sat under the old two-row nav. */
       main { padding-top: 0; }
       .nav {
           position: absolute;
           background: transparent;
           transition: background-color 250ms var(--ease), opacity 240ms var(--ease);
       }
       /* Open, the logo's row takes the panel's ground, so row and panel read as
          one sheet over the hero rather than a panel hanging under a gap. */
       .nav.nav-open { background: var(--ground); }
       .hero { padding-top: calc(var(--s10) + clamp(var(--s8), 10vh, var(--s10))); }
       /* With the nav scrolled away there is nothing to clear, so anchors land
          just under the top edge: every anchored section, whatever the editor
          names it. landing.css names the four the home page had. */
       main[id],
       section[id],
       article[id] { scroll-margin-top: var(--s4); }

       .footer-inner { grid-template-columns: minmax(0, 1fr); }
       .footer-bottom { flex-direction: column-reverse; align-items: flex-start; }
       .egg-arcade { align-self: flex-end; }
       .cookie-buttons { width: 100%; }
       .cookie-buttons button { flex: 1; }
   }
   ```
7. landing.css 731–739: REDUCED MOTION.

- [ ] **Step 5: Write `server/cms/styles/standard.css`**

1. This header:
   ```css
   /*
    * standard.css - the standard layout's frame, last in its sheet: the offset
    * for the fixed nav, the footer as a lattice, and the phone nav on its own
    * row.
    *
    * Copied from pages.css (plan 1b), which still styles the pages served from
    * disk; test/cms/styles.test.js holds the two in step.
    */
   ```
2. pages.css 15–16.
3. This block (pages.css 291):
   ```css
   @media (max-width: 720px) {
       main { padding-top: 60px; }
   }
   ```
4. pages.css 339–374: the footer lattice.
5. This block (pages.css 487–490 and 498):
   ```css
   @media (max-width: 720px) {
       /* The landing's phone nav: not fixed, the logo and the menu button on one
          row (base.css, the phone menu). */
       .nav--row + main { padding-top: 0; }
       .nav--row { position: static; }
       .footer-lattice .footer-inner { grid-template-columns: minmax(0, 1fr); }
   }
   ```

- [ ] **Step 6: Write the four home-page blocks' sheets (from landing.css and shared.css)**

**`blocks/hero/style.css`**

1. This opening:
   ```css
   /*
    * Hero - the headline, the lede, two buttons, and the orbital scene behind
    * them (orbital-hero.js). Copied from landing.css: HERO, HERO BACKDROP and
    * the phone rules (plan 1b). The extra phone padding under the overlaid nav
    * is the home frame's (server/cms/styles/home.css).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   /* Secondary text over the hero's moving art. See .hero-lede. */
   &.hero { --ink-over-media: #e4e4e7; }
   ```
2. landing.css 145–153, with line 146 `.hero {` written as `&.hero {`.
3. landing.css 155–212.
4. This block (landing.css 708–712):
   ```css
   @media (max-width: 720px) {
       &.hero { min-height: 0; }
       .hero-foot { grid-template-columns: 1fr; }
       .hero-actions { flex-direction: column; }
       .hero-actions > .btn-primary,
       .hero-actions > .btn-quiet { align-self: stretch; }
   }
   ```

**`blocks/text/style.css`**

1. This header:
   ```css
   /*
    * Text - a heading, an optional subheading and prose: the home page's
    * About. Copied from landing.css: ABOUT and the narrow rules (plan 1b). The
    * portrait rules stayed behind. This block draws no portrait, so the prose
    * is the grid's only child and takes the whole row.
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. landing.css 337–361.
3. landing.css 424, written as `&.about .section-title { max-width: 22ch; }`.
4. landing.css 425–444.
5. These two blocks (landing.css 447 and 720):
   ```css
   @media (max-width: 860px) {
       .about-grid { grid-template-columns: minmax(0, 1fr); gap: var(--s7); }
   }

   @media (max-width: 720px) {
       .about-prose { margin-left: 0; }
   }
   ```

**`blocks/practice-cards/style.css`**

1. This header:
   ```css
   /*
    * Practice cards - the six-cell index, and the pointer pane that travels
    * across it (pointer-pane.js). The diagrams in the cells are visuals.css.
    * Copied from landing.css: PRACTICES, THE POINTER PANE and the narrow rules
    * (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. landing.css 214–330.
3. These two blocks (landing.css 679 and 714–718):
   ```css
   @media (max-width: 900px) {
       .index { grid-template-columns: repeat(2, minmax(0, 1fr)); }
   }

   @media (max-width: 720px) {
       /* One column. The lattice becomes a stack of cells divided by the same
          hairline, so the section still reads as one table rather than six
          detached blocks. */
       .index { grid-template-columns: minmax(0, 1fr); }
       .card-link { padding-top: var(--s5); }
   }
   ```

**`blocks/reasons/style.css`**

1. This header:
   ```css
   /*
    * Three reasons - a glyph, a claim and a line of support, in three columns.
    * Copied from shared.css (plan 1b), which index.html and the services page
    * as served from disk still load.
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. shared.css 9–179, with line 12 `.why .section-title {` written as
   `&.why .section-title {`.

**`blocks/contact-form/style.css`**

1. This header:
   ```css
   /*
    * Contact form - the invitation beside the form, in the practices' lattice,
    * checked in the browser by contact-form.js. Copied from landing.css:
    * CONTACT and the narrow rules (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. landing.css 455–582.
3. These two blocks (landing.css 680 and 721–723):
   ```css
   @media (max-width: 900px) {
       .contact-block { grid-template-columns: 1fr; }
   }

   @media (max-width: 720px) {
       .form-row { grid-template-columns: 1fr; }
       .contact-form .btn-primary { align-self: stretch; }
       .contact-block { grid-template-columns: minmax(0, 1fr); }
   }
   ```

- [ ] **Step 7: Write the standard pages' block sheets (from pages.css)**

**`blocks/page-intro/style.css`**

1. This header:
   ```css
   /*
    * Page intro - a back link, the title, a lede; on the legal pages also the
    * date and the links between the documents. Copied from pages.css: PAGE
    * HERO, and the top of LEGAL (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. pages.css 18–20, then line 21 written as
   `&.page-hero { padding-block: clamp(var(--s8), 11vh, var(--s10)) clamp(var(--s7), 6vw, var(--s8)); }`.
3. pages.css 23–59.
4. `/* The legal pages' date, and the links between the four documents. */`, then
   pages.css 524–545.

**`blocks/service-catalogue/style.css`**

1. This header:
   ```css
   /*
    * Service catalogue - the numbered index, then the practices as panes of
    * one lattice, each with its diagram in the column that stays in view. The
    * diagrams themselves are visuals.css. Copied from pages.css: TABLE OF
    * CONTENTS, PRACTICE BLOCKS, SERVICES PAGE and the narrow rules (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. pages.css 80–110: TABLE OF CONTENTS.
3. pages.css 112, then line 113 written as
   `&.practices .section-title { max-width: 26ch; }`.
4. In place of pages.css 115–121:
   ```css
   /* No padding-block: every practice is a pane of .lattice (common.css), and
      the lattice's padding is what applies - it always did, coming later in
      pages.css at the same weight. */
   .practice {
       display: grid;
       grid-template-columns: minmax(0, 0.42fr) minmax(0, 0.58fr);
       gap: clamp(var(--s6), 5vw, var(--s9));
       border-top: 1px solid var(--hairline-strong);
   }
   ```
5. pages.css 122–189. Stop before line 190, `.pkg-note`, which is in `common.css`.
6. pages.css 192–198: `.practice-price`. Line 199's `.price-note` is in `common.css`.
7. These blocks, which are this block's parts of pages.css 266–293, in that order:
   ```css
   @media (max-width: 1000px) {
       .practice-detail .scope-list { columns: 1; }
   }

   @media (max-width: 860px) {
       .practice { grid-template-columns: minmax(0, 1fr); gap: var(--s5); }
       /* Nothing sticky once it is one column — it would pin the title over the
          content it names. */
       .practice-id { position: static; }
       /* The left column's pieces join the block's single column, in order. */
       .practice-id { display: contents; }
       .practice-num { order: 1; margin-bottom: 0; }
       .practice-id h2 { order: 2; }
       .practice-outcome { order: 3; margin-top: var(--s2); }
       .practice-detail { order: 4; }
   }

   @media (max-width: 640px) {
       .toc ol { grid-template-columns: minmax(0, 1fr); }
   }

   @media (max-width: 720px) {
       .practice-id { top: calc(60px + var(--s5)); }
   }
   ```
8. pages.css 502–508: the SERVICES PAGE comment and its first four rules. Line 509 belongs
   to Contact info.
9. pages.css 511–516.

**`blocks/steps/style.css`**

1. This header:
   ```css
   /*
    * Steps - a numbered sequence, four across. Copied from pages.css: PROCESS
    * and the narrow rules (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. pages.css 207–232.
3. These blocks (pages.css 267 and 287):
   ```css
   @media (max-width: 1000px) {
       .steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
   }

   @media (max-width: 640px) {
       .steps { grid-template-columns: minmax(0, 1fr); }
   }
   ```

**`blocks/contact-info/style.css`**

1. This header:
   ```css
   /*
    * Contact info - the services page's close: two panes of the lattice, the
    * invitation and the address, and no form. Copied from pages.css: CONTACT,
    * one rule of SERVICES PAGE and the narrow rule (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. pages.css 234–236, then in place of 237–242:
   ```css
   /* No gap: the block is also .lattice (common.css), whose 1px seams are what
      apply - they always did, coming later in pages.css at the same weight. */
   .contact-block {
       display: grid;
       grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
       margin-top: clamp(var(--s7), 5vw, var(--s8));
   }
   ```
3. pages.css 243–263.
4. This block (pages.css 282):
   ```css
   @media (max-width: 860px) {
       .contact-block { grid-template-columns: minmax(0, 1fr); }
   }
   ```
5. pages.css 509: `.contact-block > div { … }`.

**`blocks/pricing-table/style.css`**

1. This header:
   ```css
   /*
    * Pricing table - one row per practice: its name, where it starts, and the
    * range most projects land in. Copied from pages.css: PRICING and the phone
    * rules (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. pages.css 409–431.
3. This block (pages.css 493–497):
   ```css
   @media (max-width: 720px) {
       /* A three-column row does not fit a phone: the practice on its own line,
          then its two figures, each labelled, since the head row is gone. */
       .price-row--head { display: none; }
       .price-row { grid-template-columns: minmax(0, 1fr); gap: var(--s2); }
       .price-row .label-inline { display: inline; color: var(--ink-3); }
   }
   ```

**`blocks/packages/style.css`**

1. This header:
   ```css
   /*
    * Packages - six cells laid out like the home page's practices, each price
    * pinned to the foot of its cell. Copied from pages.css: PRICING and the
    * narrow rules (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. pages.css 433–449.
3. These blocks (the `.pkg-grid` half of pages.css 484 and 492):
   ```css
   @media (max-width: 1000px) {
       .pkg-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
   }

   @media (max-width: 720px) {
       .pkg-grid { grid-template-columns: minmax(0, 1fr); }
   }
   ```

**`blocks/rates/style.css`**

1. This header:
   ```css
   /*
    * Hourly rates - role and rate, two columns of one table. Copied from
    * pages.css: PRICING (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. pages.css 451–461.

**`blocks/subscriptions/style.css`**

1. This header:
   ```css
   /*
    * Subscriptions - the plans as panes. Copied from pages.css: PRICING and the
    * narrow rules (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. pages.css 463–467.
3. These blocks (the `.plan-grid` half of pages.css 484 and 492):
   ```css
   @media (max-width: 1000px) {
       .plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
   }

   @media (max-width: 720px) {
       .plan-grid { grid-template-columns: minmax(0, 1fr); }
   }
   ```

**`blocks/not-included/style.css`**

1. This header:
   ```css
   /*
    * Not included - the dash list, the caveat, then the buttons, whose row is
    * .cta-row in common.css. Copied from pages.css: PRICING (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. pages.css 469–474.

**`blocks/legal-document/style.css`**

1. This header:
   ```css
   /*
    * Legal document - the at-a-glance grid, then the document as one lattice,
    * a clause per row. Copied from pages.css: LEGAL (plan 1b).
    *
    * Scoped when the layout sheets are built (server/cms/css.js): every
    * selector here reaches only inside this block, and "&" is the block's own
    * element.
    */
   ```
2. pages.css 518–523: the LEGAL comment.
3. pages.css 547, written as `&.legal-section { padding-top: 0; }`.
4. pages.css 549–646.

- [ ] **Step 8: Run the test until it passes**

Run: `node --test test/cms/styles.test.js`

The first two tests print the rules that are missing or extra, as `@media | selector |
declarations`. Fix the copy until all six tests pass. Never change `NOT_CARRIED`,
`TRIMMED` or `ADDED` to make a test pass; those lists are spec §14's rulings. If one
looks wrong, stop and report to the controller. Then run `npm test`; everything passes.

- [ ] **Step 9: Commit**

```bash
git add server/cms/styles blocks/*/style.css test/cms/styles.test.js
git commit -m "feat(cms): each block's styles in its own sheet, the frames and shared vocabulary beside them"
```

---

### Task 4: One stylesheet per layout

**Files:**
- Modify: `server/cms/assets.js` (whole file below)
- Modify: `server/cms/layout.js`, the `stylesFor` call
- Modify: `server.js`, one route
- Modify: `test/cms/layout.test.js`, the stylesheet assertion
- Create: `test/cms/assets.test.js`

**Interfaces:**
- Consumes:
  - `scopeCss` and `stripComments` (Task 1);
  - the sheets (Task 3);
  - `BLOCK_TYPES` from `blocks/index.js`.
- Produces:
  - `CSS`, which is `{ home: { css, hash }, standard: { css, hash } }`. `hash` is 12 hex
    characters.
  - `stylesFor(layout) → ['/base.css?v=6', '/cms/<layout>.css?v=<hash>']`. There is no
    longer a `blocks` parameter.
  - `serveCss(req, res, next)`, for `GET /cms/:layout.css`.
  - `SCRIPTS` and `scriptsFor` are unchanged here. Task 5 changes them.

- [ ] **Step 1: Write the failing test**

`test/cms/assets.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { CSS, stylesFor, serveCss } = require('../../server/cms/assets');

test("a block page loads base.css, then its layout's sheet by content hash", () => {
  assert.deepEqual(stylesFor('home'), ['/base.css?v=6', `/cms/home.css?v=${CSS.home.hash}`]);
  assert.deepEqual(stylesFor('standard'), ['/base.css?v=6', `/cms/standard.css?v=${CSS.standard.hash}`]);
  assert.match(CSS.home.hash, /^[0-9a-f]{12}$/);
  assert.notEqual(CSS.home.hash, CSS.standard.hash);
});

test('each layout sheet: vocabulary, then blocks, then diagrams, then its frame', () => {
  for (const [layout, frameRule] of [['home', '.intro-screen {'], ['standard', '.footer-lattice {']]) {
    const { css } = CSS[layout];
    const at = (s) => {
      const i = css.indexOf(s);
      assert.ok(i >= 0, `${layout}: missing ${s}`);
      return i;
    };
    const order = [at('.lattice {'), at(':where(.b-hero).hero {'), at(':where(.b-contact-info) .contact-block {'),
      at('.v-box {'), at(frameRule)];
    assert.deepEqual(order, [...order].sort((a, b) => a - b), layout);
    assert.ok(!css.includes('/*'), `${layout}: no comments`);
  }
  assert.ok(!CSS.standard.css.includes('.intro-screen {'), 'the intro is the home frame only');
  assert.ok(!CSS.home.css.includes('.footer-lattice {'), 'the footer lattice is the standard frame only');
});

function call(layout, v) {
  const res = {
    headers: {},
    set(k, val) { this.headers[k] = val; return this; },
    type(t) { this.contentType = t; return this; },
    send(b) { this.body = b; return this; },
  };
  let passed = false;
  serveCss({ params: { layout }, query: v === undefined ? {} : { v } }, res, () => { passed = true; });
  return { res, passed };
}

test('the sheet at its own hash is kept for a year', () => {
  const { res } = call('home', CSS.home.hash);
  assert.equal(res.headers['Cache-Control'], 'public, max-age=31536000, immutable');
  assert.equal(res.contentType, 'text/css');
  assert.equal(res.body, CSS.home.css);
});

// Review Focus 4: a page from before a deploy asks for a hash this server
// never built. It gets today's sheet, never pinned under the old address.
test('any other version is served, but not pinned', () => {
  for (const v of ['0123456789ab', undefined]) {
    const { res } = call('standard', v);
    assert.equal(res.headers['Cache-Control'], 'no-cache');
    assert.equal(res.body, CSS.standard.css);
  }
});

test('an unknown layout falls through', () => {
  for (const layout of ['print', 'constructor', '__proto__']) assert.equal(call(layout).passed, true, layout);
});

test('the route answers /cms/<layout>.css', async () => {
  const app = express();
  app.get('/cms/:layout.css', serveCss);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const ok = await fetch(`${base}/cms/home.css?v=${CSS.home.hash}`);
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('content-type'), /^text\/css/);
    assert.equal(await ok.text(), CSS.home.css);
    assert.equal((await fetch(`${base}/cms/print.css`)).status, 404);
  } finally {
    server.close();
  }
});
```

In `test/cms/layout.test.js`:
- add `const { stylesFor } = require('../../server/cms/assets');` below the other requires;
- replace the stylesheet test's title and first assertion:

```js
  test(`${file}: base.css and its layout's sheet, same title and description`, () => {
    assert.deepEqual(sheets(html, pagePath), stylesFor(page.layout));
```

The rest of that test is unchanged: the title and description checks. The block pages no
longer load the files' stylesheets. The parity run holds their look to the files'
instead.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/cms/assets.test.js test/cms/layout.test.js`

Expected: FAIL. `CSS` is undefined, and the layout tests still see the old stylesheet list.

- [ ] **Step 3: Rewrite `server/cms/assets.js`**

```js
/*
 * What a page drawn from blocks loads.
 *
 * Styles: base.css, then one sheet for the page's layout, joined here at
 * start-up (spec §14). In cascade order it holds the shared vocabulary
 * (server/cms/styles/common.css), every block's style.css scoped to that
 * block (server/cms/css.js), the diagrams (visuals.css, as it is), and last
 * the layout's frame (server/cms/styles/<layout>.css), which may fit a block
 * to its surroundings. Every block is in both sheets, used or not, so each
 * layout is one cached file rather than one per page.
 *
 * Scripts: the layout's own, then what the page's blocks ask for.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getBlock, BLOCK_TYPES } = require('../../blocks');
const { scopeCss, stripComments } = require('./css');

const ROOT = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const readIfAny = (f) => (fs.existsSync(path.join(ROOT, f)) ? read(f) : '');

const BASE_CSS = '/base.css?v=6';
const SCRIPTS = {
  menu: '/nav-menu.js?v=1',
  landing: '/landing.js?v=12',
  diagrams: '/practice-visuals.js?v=1',
  orbit: '/orbital-hero.js?v=3',
  field: '/topology-bg.js?v=1',
};

function buildCss(layout) {
  const css = [
    stripComments(read('server/cms/styles/common.css')),
    ...BLOCK_TYPES.map((t) => scopeCss(readIfAny(`blocks/${t}/style.css`), t)),
    stripComments(read('visuals.css')),
    stripComments(read(`server/cms/styles/${layout}.css`)),
  ].join('\n').replace(/\n\s*\n/g, '\n');
  return { css, hash: crypto.createHash('sha256').update(css).digest('hex').slice(0, 12) };
}

// Built once, as the server starts: a sheet that cannot be built stops the
// start, rather than serving pages without their styles.
const CSS = { home: buildCss('home'), standard: buildCss('standard') };

const stylesFor = (layout) => [BASE_CSS, `/cms/${layout}.css?v=${CSS[layout].hash}`];

// GET /cms/:layout.css
function serveCss(req, res, next) {
  const built = Object.hasOwn(CSS, req.params.layout) ? CSS[req.params.layout] : null;
  if (!built) return next();
  // The address carries the sheet's hash, so a matching ?v= can be kept for a
  // year. Any other ?v= - a page from before a deploy - gets today's sheet,
  // never pinned.
  res.set('Cache-Control', req.query.v === built.hash ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.type('text/css').send(built.css);
}

function used(blocks) {
  const keys = new Set();
  for (const b of blocks) {
    const def = getBlock(b.type);
    if (def) def.assets(b.props).forEach((k) => keys.add(k));
  }
  return keys;
}

function scriptsFor(layout, blocks) {
  const u = used(blocks);
  if (layout === 'home') {
    return [
      SCRIPTS.menu,
      SCRIPTS.landing,
      ...(u.has('diagrams') ? [SCRIPTS.diagrams] : []),
      ...(u.has('orbit') ? [SCRIPTS.orbit] : []),
      SCRIPTS.field,
    ];
  }
  return [SCRIPTS.menu, SCRIPTS.field, ...(u.has('diagrams') ? [SCRIPTS.diagrams] : [])];
}

module.exports = { CSS, SCRIPTS, stylesFor, scriptsFor, serveCss };
```

- [ ] **Step 4: Use it**

In `server/cms/layout.js`, change:

```js
  const styles = stylesFor(page.layout, blocks).map((h) => `<link rel="stylesheet" href="${h}">`).join('\n');
```

to:

```js
  const styles = stylesFor(page.layout).map((h) => `<link rel="stylesheet" href="${h}">`).join('\n');
```

Replace its header comment with:

```js
/*
 * The page frame around a page's blocks: head, intro (home only), nav, the
 * topology field, footer and scripts; the styles are the layout's sheet
 * (server/cms/assets.js). The body mirrors site/landing.template.html (the
 * "home" layout) and site/digitalization.template.html (the "standard"
 * layout); test/cms/layout.test.js holds it to those files.
 */
```

In `server.js`, directly after `app.use(cms.middleware);`:

```js

/* The block pages' stylesheets, one per layout, joined at start-up
   (server/cms/assets.js). */
app.get('/cms/:layout.css', require('./server/cms/assets').serveCss);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`

Expected: everything passes, including the new `assets` tests and all body-parity tests.

- [ ] **Step 6: Commit**

```bash
git add server/cms/assets.js server/cms/layout.js server.js test/cms/assets.test.js test/cms/layout.test.js
git commit -m "feat(cms): block pages load one stylesheet per layout, joined and hashed at start-up"
```

---

### Task 5: Scripts load where they are used

**Files:**
- Create: `contact-form.js`, `pointer-pane.js` (repo root, beside `landing.js`)
- Modify:
  - `landing.js`
  - `orbital-hero.js`
  - `site/landing.template.html`
  - `index.html` (rebuilt, never hand-edited)
  - `server/cms/assets.js`
  - `blocks/contact-form/index.js`
  - `blocks/practice-cards/index.js`
  - `blocks/service-catalogue/index.js`
  - `blocks/reasons/index.js`
- Test: `test/cms/assets.test.js`

**Interfaces:**
- Consumes: `SCRIPTS` and `scriptsFor` from Task 4's `server/cms/assets.js`.
- Produces:
  - Script keys `form` and `pane`.
  - Block `assets()` return script keys only:
    - `contact-form` returns `['form']`;
    - `practice-cards` returns `['pane']`, plus `'diagrams'` when a card shows one;
    - `service-catalogue` returns `['diagrams']` or `[]`;
    - `reasons` returns `[]`;
    - `hero` returns `['orbit']`, as before.
  - The `shared` and `visuals` keys are gone, because every block page has all the
    styles.

- [ ] **Step 1: Write the failing tests**

Append to `test/cms/assets.test.js`:

```js
const fs = require('fs');
const path = require('path');
const conv = require('../../scripts/lib/cms-convert');
const { scriptsFor } = require('../../server/cms/assets');

const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
const home = conv.convertHome(JSON.parse(read('site/content.en.json'))).blocks;

test("home: the layout's script, then its blocks', in the page on disk's order", () => {
  assert.deepEqual(scriptsFor('home', home), ['/nav-menu.js?v=1', '/landing.js?v=13', '/contact-form.js?v=1',
    '/pointer-pane.js?v=1', '/practice-visuals.js?v=1', '/orbital-hero.js?v=4', '/topology-bg.js?v=1']);
});

test("a standard page takes a home block's script with the block", () => {
  assert.deepEqual(scriptsFor('standard', home), ['/nav-menu.js?v=1', '/topology-bg.js?v=1',
    '/practice-visuals.js?v=1', '/contact-form.js?v=1', '/pointer-pane.js?v=1', '/orbital-hero.js?v=4']);
});

test('no block, no script', () => {
  assert.deepEqual(scriptsFor('standard', conv.convertPricing(read('nidos/pricing.html')).blocks),
    ['/nav-menu.js?v=1', '/topology-bg.js?v=1']);
  assert.deepEqual(scriptsFor('home', []), ['/nav-menu.js?v=1', '/landing.js?v=13', '/topology-bg.js?v=1']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/cms/assets.test.js`

Expected: the three new tests fail on the missing script URLs.

- [ ] **Step 3: Split `landing.js`**

Create `contact-form.js` with this header, followed by landing.js lines 146–199 verbatim
(the FORM section: its comment and its function):

```js
/*
 * contact-form.js - checks the Contact form's fields in the browser, on every
 * page with one. Moved out of landing.js unchanged (plan 1b), since landing.js
 * loads on the home layout only.
 */

```

Create `pointer-pane.js`. It is landing.js lines 261–322 (THE POINTER PANE), changed
in only two ways:
- it serves every `.index` on the page, not the first;
- the comment now names where the look lives.

```js
/*
 * pointer-pane.js - the pane that travels across a Practice cards grid, on
 * every page with one. Moved out of landing.js (plan 1b), which loads on the
 * home layout only; it now serves every grid on the page, not just the
 * first.
 */

/* ===== THE POINTER PANE =====
   One pane that travels between the six cells instead of six cells that each
   light up alone. Everything about how it looks is in the block's style.css
   (blocks/practice-cards/, and landing.css for the page on disk); this only
   decides which cell it is over.

   Pointer devices only. The cells fold into an accordion at phone width, where
   there is no hover to answer and tapping a card's link would flash the pane
   on the way out.

   Position comes from offsetLeft/offsetTop against .index, which is the cells'
   offsetParent because .index is positioned. Written as a translate plus a
   scale on a 1x1 box, so the only thing that ever animates is a transform. */
(() => {
    if (!window.matchMedia('(hover: hover)').matches) return;

    document.querySelectorAll('.index').forEach((index) => {
        const cards = [...index.querySelectorAll('.card')];
        if (!cards.length) return;

        const pane = document.createElement('div');
        pane.className = 'index-hl';
        pane.setAttribute('aria-hidden', 'true');
        index.append(pane);

        let current = null;

        /* animate=false puts the pane somewhere without travelling there. Used for
           the first cell of a visit - otherwise the pane flies in from the grid's
           top-left corner as it fades up - and after a resize, where every cell has
           moved and sliding to catch up would be a lie about what happened. */
        const place = (card, animate) => {
            current = card;
            if (!animate) pane.style.transition = 'none';
            pane.style.transform =
                'translate(' + card.offsetLeft + 'px, ' + card.offsetTop + 'px) ' +
                'scale(' + card.offsetWidth + ', ' + card.offsetHeight + ')';
            if (!animate) {
                void pane.offsetHeight;      // flush, or the removal never lands
                pane.style.transition = '';
            }
            pane.classList.add('is-on');
        };

        const clear = () => { current = null; pane.classList.remove('is-on'); };

        cards.forEach((card) => {
            const show = () => place(card, pane.classList.contains('is-on'));
            card.addEventListener('pointerenter', show);
            // Tabbing to a card's link lights the same pane a mouse would.
            card.addEventListener('focusin', show);
        });

        index.addEventListener('pointerleave', clear);
        index.addEventListener('focusout', (e) => {
            if (!index.contains(e.relatedTarget)) clear();
        });

        window.addEventListener('resize', () => {
            if (current) place(current, false);
        }, { passive: true });
    });
})();
```

In `landing.js`:
- delete the later range first, so the line numbers hold:
  - lines 260–322: the blank line, then THE POINTER PANE to the end of the file;
  - lines 146–200: FORM, and the blank line after it;
- replace the header, lines 1–17, with:

```js
/*
 * landing.js - the home layout's own behaviour: index.html, and every page
 * the editor draws on the home layout.
 *
 * Replaces script.js on this page. Everything script.js used to do here
 * that the redesign still needs is carried over; everything that drove the
 * deleted decoration is gone with it.
 *
 *   carried over : intro sequence, arcade popup, cookie consent banner
 *   new          : nav hairline sentinel
 *   moved out    : form checking and ?for= preselect (contact-form.js), the
 *                  practices' pointer pane (pointer-pane.js) - they load with
 *                  the blocks that use them, on either layout (plan 1b)
 *   gone         : Lenis, IntersectionObserver scroll reveals, hero-net canvas,
 *                  fw-stage particle tunnel, the pinned practices stepper,
 *                  the stage image swapper, the closing-CTA rise, the
 *                  conviction parallax, the mobile nav drawer
 *
 * No library. No scroll handler that does layout work.
 */
```

The COOKIE CONSENT section's comment still says "landing.css"; leave it. The page on disk
still styles the banner from there.

- [ ] **Step 4: Let the orbit start on a page with no intro**

In `orbital-hero.js`:
- line 2 becomes ` * orbital-hero.js — the Hero block's backdrop, on every page with a Hero.`
- replace line 936 with:

```js
    /* A page with no intro splash (a Hero on a standard page) has nothing to
       wait for; on the home layout, landing.js raises the flag. */
    let introDone = document.documentElement.dataset.introDone === '1'
        || !document.querySelector('.intro-screen');
```

- [ ] **Step 5: Load them**

In `server/cms/assets.js`, the `SCRIPTS` object becomes:

```js
const SCRIPTS = {
  menu: '/nav-menu.js?v=1',
  landing: '/landing.js?v=13',
  form: '/contact-form.js?v=1',
  pane: '/pointer-pane.js?v=1',
  diagrams: '/practice-visuals.js?v=1',
  orbit: '/orbital-hero.js?v=4',
  field: '/topology-bg.js?v=1',
};
```

and `scriptsFor` becomes:

```js
// The home layout's order is the page on disk's (site/landing.template.html);
// a standard page adds its blocks' scripts after its own two.
function scriptsFor(layout, blocks) {
  const u = used(blocks);
  const some = (...keys) => keys.filter((k) => u.has(k)).map((k) => SCRIPTS[k]);
  if (layout === 'home') {
    return [SCRIPTS.menu, SCRIPTS.landing, ...some('form', 'pane', 'diagrams', 'orbit'), SCRIPTS.field];
  }
  return [SCRIPTS.menu, SCRIPTS.field, ...some('diagrams', 'form', 'pane', 'orbit')];
}
```

Change the blocks' `assets`:

| File | From | To |
|---|---|---|
| `blocks/contact-form/index.js` | `assets: () => [],` | `assets: () => ['form'],` |
| `blocks/practice-cards/index.js` | `assets: (p) => (p.cards.some(hasDiagram) ? ['visuals', 'diagrams'] : []),` | `assets: (p) => ['pane', ...(p.cards.some(hasDiagram) ? ['diagrams'] : [])],` |
| `blocks/service-catalogue/index.js` | `assets: (p) => (p.practices.some(hasDiagram) ? ['visuals', 'diagrams'] : []),` | `assets: (p) => (p.practices.some(hasDiagram) ? ['diagrams'] : []),` |
| `blocks/reasons/index.js` | `assets: () => ['shared'],` | `assets: () => [],` |

In `site/landing.template.html`, replace the five script tags at the end of `<body>`
(lines 253–257) with:

```html
    <script src="nav-menu.js?v=1"></script>
    <script src="landing.js?v=13"></script>
    <script src="contact-form.js?v=1"></script>
    <script src="pointer-pane.js?v=1"></script>
    <script src="practice-visuals.js?v=1"></script>
    <script src="orbital-hero.js?v=4"></script>
    <script src="topology-bg.js?v=1"></script>
```

Then rebuild the page on disk: `npm run build:landing`, then `npm run check:pages`.
Expected: both checks report that their page matches its template, and
`git diff index.html` shows only those script tags.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`

Expected: everything passes. That includes the home page's whole-body parity, which now
compares the new script tags on both sides.

- [ ] **Step 7: Commit**

```bash
git add contact-form.js pointer-pane.js landing.js orbital-hero.js site/landing.template.html index.html \
  server/cms/assets.js blocks/contact-form/index.js blocks/practice-cards/index.js \
  blocks/service-catalogue/index.js blocks/reasons/index.js test/cms/assets.test.js
git commit -m "feat(cms): form checking and the pointer pane load with their blocks; the orbit starts where there is no intro"
```

---

### Task 6: Prove the home and standard pages did not change

**Files:**
- Modify: whichever sheets from Task 3 or 4 a failure points at, if any
- Modify: `docs/superpowers/runbooks/cms-release.md`, the parity paragraph

**Interfaces:**
- Consumes: everything above, and `scripts/cms-parity.js` (already on the branch).
- Produces: a parity run of every row passing in both browsers. It must be at least the
  302 per browser that today's code passed.

The development database already holds the eight imported pages. Their blocks are
content, drawn with this branch's code on every request, so nothing needs importing again.

- [ ] **Step 1: Run the parity check in Chromium**

Start the server as in "Running the development server". Then, in the foreground with a
600000 ms timeout:

```bash
CMS_PARITY_BASE=http://127.0.0.1:4041 CMS_PARITY_ENGINES=chromium npm run cms:parity > tmp/parity-chromium.log 2>&1; echo "exit $?"; tail -1 tmp/parity-chromium.log; grep '^✗' tmp/parity-chromium.log | head -20
```

Expected: `exit 0` and `302/302 passed`. The row count does not change with this plan: it
adds no page, width or state.

- [ ] **Step 2: Fix any failure at its source**

A `computed styles` row names the element, the property, the file's value (left) and the
database page's value (right). For each one:
1. Find the legacy rule that sets the file's value.
2. Find where Task 3 put that rule, and whether something later in the joined sheet now
   overrides it. The joined order is common, blocks in `BLOCK_TYPES` order, `visuals.css`,
   frame.
3. Fix the new sheet. `npm test` must stay green. A fix that changes a rule's text needs
   the controller's agreement, because the exception lists are spec rulings.

A `pixels` row with a green `computed styles` row beside it is a rendering race, not a
style difference. Re-run that page once before investigating.

Commit each fix on its own, for example
`fix(cms): <block>'s <rule> keeps its place in the cascade`.

- [ ] **Step 3: Run the parity check in WebKit**

```bash
CMS_PARITY_BASE=http://127.0.0.1:4041 CMS_PARITY_ENGINES=webkit npm run cms:parity > tmp/parity-webkit.log 2>&1; echo "exit $?"; tail -1 tmp/parity-webkit.log; grep '^✗' tmp/parity-webkit.log | head -20
```

Expected: `exit 0`. Fix any failure as in Step 2, then re-run both browsers.

- [ ] **Step 4: Record it and stop the server**

In `docs/superpowers/runbooks/cms-release.md`, under "Every row must pass.", replace the
two sub-bullets ("The last run, on 26 Sep 2026, …" and "That run was before plan 1b's
changes. …") with one:

```
  - The last run, on <date>, after plan 1b, passed <n>/<n> rows in Chromium and <n>/<n> in WebKit.
```

Take `<date>` and the numbers from the two logs.

Stop the server. Then:

```bash
git add docs/superpowers/runbooks/cms-release.md
git commit -m "docs(cms): parity after plan 1b"
```

---

### Task 7: Every block on both layouts

**Files:**
- Create: `scripts/cms-sampler.js`
- Modify: `package.json` (one script)
- Modify: `layouts` in all 16 `blocks/<type>/index.js`
- Test: `test/cms/validate.test.js`

**Interfaces:**
- Consumes:
  - `renderPage` (`server/cms/layout.js`);
  - the converters (`scripts/lib/cms-convert.js`);
  - `BLOCK_TYPES`;
  - the `b-<type>` roots (Task 2);
  - the layout sheets (Task 4);
  - the scripts (Task 5).
- Produces:
  - Every block's `layouts` is `['home', 'standard']`.
  - `npm run cms:sampler`, which writes `tmp/sampler/<engine>-<width>-<layout>.png`.

- [ ] **Step 1: Write the failing test**

Append to `test/cms/validate.test.js`:

```js
test('every real block may sit on either layout (plan 1b)', () => {
  const fs = require('fs');
  const path = require('path');
  const conv = require('../../scripts/lib/cms-convert');
  const { getBlock, BLOCK_TYPES } = require('../../blocks');
  const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
  for (const t of BLOCK_TYPES) assert.deepEqual([...getBlock(t).layouts].sort(), ['home', 'standard'], t);
  assert.deepEqual(validatePage('standard', conv.convertHome(JSON.parse(read('site/content.en.json'))).blocks), []);
  assert.deepEqual(validatePage('home', conv.convertServices(JSON.parse(read('site/digi.en.json'))).blocks), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/cms/validate.test.js`

Expected: FAIL at `hero`, whose layouts are `['home']`.

- [ ] **Step 3: Widen the layouts**

In each `blocks/<type>/index.js` whose `layouts` line is `layouts: ['home'],` or
`layouts: ['standard'],`, make it `layouts: ['home', 'standard'],`. Reasons already has
both. Then run `node --test test/cms/validate.test.js`; it passes.

- [ ] **Step 4: Write the sampler**

`scripts/cms-sampler.js`:

```js
#!/usr/bin/env node
/*
 * Every block on both layouts (spec §14), against a running development
 * server from this branch (npm run dev:cms). The two sampler pages are drawn
 * here, with this branch's code and the imported pages' own content, and
 * handed to the browser at /__sampler/<layout>; everything they load comes
 * from the server, and the database is not read.
 *
 * Checks that nothing breaks when a block leaves the layout it was written
 * for, and that each block looks the same on both layouts. Writes full-page
 * screenshots to tmp/sampler/ for a person to look at. Exit 1 on any failure.
 */
const fs = require('fs');
const path = require('path');
const { renderPage } = require('../server/cms/layout');
const conv = require('./lib/cms-convert');
const { BLOCK_TYPES } = require('../blocks');

const BASE = process.env.CMS_PARITY_BASE || 'http://127.0.0.1:4031';
const PW = process.env.PW || '/Users/test/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const OUT = path.join(__dirname, '..', 'tmp', 'sampler');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const rows = [];
const check = (where, name, ok, detail = '') => rows.push({ where, name, ok, detail });

// The first block of each type on the pages the import builds, in the order
// blocks/index.js lists the types, then a second Practice cards grid - no
// anchor, so no second id - to show the pointer pane serves both.
function samplerBlocks() {
    const pages = [
        conv.convertHome(JSON.parse(read('site/content.en.json'))),
        conv.convertServices(JSON.parse(read('site/digi.en.json'))),
        conv.convertPricing(read('nidos/pricing.html')),
        conv.convertLegal(read('nidos/privacy.html')),
        conv.convert404(),
    ];
    const first = new Map();
    for (const { blocks } of pages) for (const b of blocks) if (!first.has(b.type)) first.set(b.type, b);
    const missing = BLOCK_TYPES.filter((t) => !first.has(t));
    if (missing.length) throw new Error(`no sample of ${missing.join(', ')}`);
    const cards = first.get('practice-cards');
    return [...BLOCK_TYPES.map((t) => first.get(t)),
        { ...cards, id: 'second-grid', props: { ...cards.props, anchor: undefined } }];
}

const site = conv.siteSettingsFrom(JSON.parse(read('site/content.en.json')));
const blocks = samplerBlocks();
const html = (layout) => renderPage({
    page: { path: `/__sampler/${layout}`, layout, seoTitle: `Every block, ${layout} layout`, seoDescription: 'Sampler.', noindex: true },
    blocks,
    site,
});

// Runs in the page: every computed property of every element of each block,
// as the parity run takes them, sent whole - a dozen of these, not the parity
// run's hundreds.
function blockStyles() {
    return [...document.querySelectorAll('main > section')].map((section) =>
        [section, ...section.querySelectorAll('*')].map((el) => {
            const props = [];
            for (const pseudo of ['', '::before', '::after']) {
                const cs = getComputedStyle(el, pseudo || null);
                if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
                for (let k = 0; k < cs.length; k++) {
                    if (!cs[k].startsWith('--')) props.push(`${pseudo}${cs[k]}: ${cs.getPropertyValue(cs[k])}`);
                }
            }
            const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).join('.');
            return { el: `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`, props };
        }));
}

// On a phone the home frame lets anchors land nearer the top (its nav has
// scrolled away) and gives the hero room under the nav that lies over it,
// which also makes the hero - and the orbit's canvas that fills it - taller.
// All of that is the frame's doing, not the block's.
const frameOwned = (w, inHero, prop) => w <= 720 && (/^scroll-margin-(top|block-start)$/.test(prop)
    || (inHero && /^(padding-top|padding-block-start|height|block-size)$/.test(prop)));

function blockDiff(w, home, standard) {
    const out = [];
    home.forEach((els, i) => {
        if (standard[i].length !== els.length) {
            out.push(`${els[0].el}: ${els.length} elements on home, ${standard[i].length} on standard`);
            return;
        }
        const inHero = els[0].el.split('.').includes('b-hero');
        els.forEach((e, j) => {
            const theirs = new Map(standard[i][j].props.map((p) => [p.slice(0, p.indexOf(': ')), p]));
            for (const p of e.props) {
                const name = p.slice(0, p.indexOf(': '));
                if (theirs.get(name) !== p && !frameOwned(w, inHero, name) && out.length < 8) {
                    out.push(`${e.el} ${p} ≠ ${theirs.get(name) || '(not set)'}`);
                }
            }
        });
    });
    return out;
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const pw = require(PW);
    for (const engine of ['chromium', 'webkit']) {
        const browser = await pw[engine].launch();
        for (const w of [390, 1024, 1440]) {
            const styles = {};
            for (const layout of ['home', 'standard']) {
                const where = `${layout} ${engine} ${w}`;
                const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
                await ctx.addInitScript(() => {
                    try { sessionStorage.setItem('pn_gate_unlocked', '1'); sessionStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
                });
                const page = await ctx.newPage();
                const errors = [];
                page.on('pageerror', (e) => errors.push(String(e)));
                page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
                const url = `${BASE}/__sampler/${layout}`;
                await page.route(url, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html(layout) }));
                await page.goto(url, { waitUntil: 'load' });
                await page.waitForTimeout(1500);
                const flat = await page.$$eval('main > section', (s) =>
                    s.filter((x) => !x.getBoundingClientRect().height).map((x) => x.className));
                check(where, 'every block has a box', !flat.length, flat.join(', '));
                check(where, 'the orbit draws', (await page.locator('.hero-orbit.is-drawn').count()) === 1);
                styles[layout] = await page.evaluate(blockStyles);
                if (w !== 1024) await page.screenshot({ path: path.join(OUT, `${engine}-${w}-${layout}.png`), fullPage: true });
                if (w === 1440) {
                    const grid = page.locator('.b-practice-cards').nth(1);
                    await grid.locator('.card').first().hover();
                    await page.waitForTimeout(300);
                    check(where, 'the pointer pane lights the second grid', (await grid.locator('.index-hl.is-on').count()) === 1);
                }
                await page.click('.contact-form button[type="submit"]');
                await page.waitForTimeout(300);
                check(where, 'the form flags 3 empty fields', (await page.locator('.contact-form .is-invalid').count()) === 3);
                check(where, 'no console errors', !errors.length, errors.join(' | '));
                await ctx.close();
            }
            const diff = blockDiff(w, styles.home, styles.standard);
            check(`both layouts ${engine} ${w}`, 'each block looks the same on both', !diff.length, diff.join(' | '));
        }
        await browser.close();
    }
    const failed = rows.filter((r) => !r.ok);
    for (const r of rows) console.log(`${r.ok ? '✓' : '✗'} ${r.where.padEnd(28)} ${r.name}${r.ok ? '' : '  ' + r.detail}`);
    console.log(`\n${rows.length - failed.length}/${rows.length} passed; screenshots in tmp/sampler/`);
    process.exit(failed.length ? 1 : 0);
})();
```

In `package.json`, after the `"cms:parity"` line, add:

```json
    "cms:sampler": "node scripts/cms-sampler.js",
```

- [ ] **Step 5: Run the sampler**

Start the server as in "Running the development server". Then, in the foreground with a
600000 ms timeout:

```bash
CMS_PARITY_BASE=http://127.0.0.1:4041 npm run cms:sampler > tmp/sampler.log 2>&1; echo "exit $?"; tail -1 tmp/sampler.log; grep '^✗' tmp/sampler.log | head -20
```

Expected: `exit 0` and `58/58 passed`, with 8 PNG files in `tmp/sampler/`. That is 2 browsers
× 3 widths × 2 layouts × 4 checks, the pane check at 1440, and one both-layouts row per
browser and width.

Fix failures as follows:
- **Console errors, a missing orbit, the pane or the form** point at Task 5's scripts or
  `scriptsFor`.
- **"each block looks the same on both" failing for anything `frameOwned` does not
  name** means a frame rule reaches into a block. Stop and report the diff to the
  controller; do not add exceptions.

Stop the server when done.

- [ ] **Step 6: Run the whole suite and commit**

Run: `npm test`. Everything passes.

```bash
git add scripts/cms-sampler.js package.json blocks/*/index.js test/cms/validate.test.js
git commit -m "feat(cms): every block may sit on either layout, shown by a sampler of both"
```

Report to the controller where the screenshots are:
- `tmp/sampler/chromium-1440-home.png`, `chromium-1440-standard.png`,
  `chromium-390-home.png`, `chromium-390-standard.png`;
- the same four for WebKit.

The controller shows them to the owner.

---

## After the last task

1. **Whole-branch review.** Spec §14 against the diff, with the Review Focus above.
2. **Rebase and re-run.**
   ```bash
   git fetch origin && git rebase origin/main
   ```
   Then run `npm test`.
   - If the drift guard fails, `main` changed a legacy sheet: copy the change into the
     block or frame sheet that now holds that rule, then update the hash.
   - If `main` changed `landing.js`'s FORM or POINTER PANE sections, or the landing
     template's script tags, carry the change into `contact-form.js`, `pointer-pane.js`
     or the new tags.
   - Then run parity again in both browsers.
3. **The owner looks at the sampler screenshots,** above all the 390px ones: the hero,
   the contact form and the practice cards on a standard page. Anything they want changed
   is a follow-up, not a blocker for this branch.
4. **Push and PR only on the owner's word.** Pushing and merging to `main` is theirs to
   do, as with part 1a.
5. **Part 2, the Puck editor, needs its own design first.** It was brainstormed only in
   outline in the foundation spec.
