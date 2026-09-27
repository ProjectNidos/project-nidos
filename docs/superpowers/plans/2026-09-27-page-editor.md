# Site editor, part 2 (Content editing in the admin): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A **Pages** section in the admin where the owner edits every text, price and list
on every page, the search-engine texts, and the menu and footer. Changes go through a draft,
a preview and a publish, with history and restore.

**Architecture:**
- **Server rules.** A pure rules module (`server/cms/editor-rules.js`) decides what a save
  may change: the content, never the shape.
- **Data access.** An editor module (`server/cms/editor.js`) reads and writes drafts and
  versions in the part 1a tables, plus one new column.
- **Routes.** One route file (`server/routes/admin/editor.js`) exposes the editor under
  `/api/admin`.
- **Preview.** The page middleware draws drafts for `?__cms=draft`.
- **Front end.** `admin-pages.js` builds every form from the field definitions the blocks
  already declare. It is plain JavaScript, with no new libraries.

**Tech Stack:** Node 20, Express 4, Prisma (Postgres), cheerio, node:test, vanilla JavaScript
in the admin, and playwright-core from the npx cache for the browser check.

**Spec:** `docs/superpowers/specs/2026-09-27-page-editor-design.md`. The part 1a/1b
background is in `docs/superpowers/specs/2026-09-23-cms-foundation-design.md`.

**Where:**
- Worktree: `/Users/test/Documents/claude/project-nidos.worktrees/cms`.
- Branch: `cms/editor`, from `main` at `f79590a`.
- The development database (`.env.cms-dev`) holds the eight imported pages.
- Development server: `PORT=4041 npm run dev:cms`.

## Global Constraints

- **Databases.** No local process connects to the production database.
  - Schema changes go through `prisma db push`: locally only via
    `npm run db:push:cms-dev`, in production via `RUN_DB_PUSH=1`.
  - Never run `npm run db:push` or `scripts/with-env.js`.
- **Secrets.** Never print `.env*` files, `DATABASE_URL`s or passwords. The browser check
  creates its own throwaway admin in the development database, with a random password it
  never prints.
- **Visitors.** Nothing changes for visitors until the owner switches on. Merging must not
  alter any page on disk, and must not alter any database page nobody edited.
- **No new dependencies.** The formatting box uses `contenteditable` with the browser's
  editing commands.
- **Limits:**
  - search title: 70 characters;
  - search description: 200 characters, with the note "Google usually shows about 155";
  - block fields: the limits in each block's `fields`.
- **Anchors and structure.** Anchors, and the order, types and ids of blocks, never change
  through the editor. New list items get generated anchors.
- **Tests and commits.**
  - `npm test` passes at every commit.
  - Commit messages use `feat(cms): …`, `fix(cms): …`, `test(cms): …` or `docs(cms): …`,
    and end with a `Co-Authored-By:` trailer.
  - Never push or merge; the owner does.

## Review Focus

1. **Round trip.** Opening and saving any page without edits must store identical blocks
   and search texts. Pinned by the Task 1 rules test (all eight pages) and the Task 5
   check through the real routes.
2. **A crafted request trying to reshape a page:** reordered blocks, a renamed anchor, a
   category that isn't one of the CRM categories, or `<script>` in rich text. Each must be
   refused or cleaned. Pinned by the Task 1 tests.
3. **Two tabs.** A stale save or publish returns `409` and never overwrites. Pinned by the
   Task 2 test.
4. **Preview leaking.** `?__cms=draft` from someone who isn't an admin must show the
   normal page. Pinned by the Task 3 test.
5. **Menu edits breaking section links.** A changed menu address takes the anchor rule of
   spec §3.4. Pinned by the Task 1 test.

---

### Task 1: The rules (pure) and the new column

**Files:**
- Modify:
  - `prisma/schema.prisma`: `PageVersion.meta Json?`
  - `blocks/contact-form/index.js`: the option `value` field gains `choices: 'crm'`
- Create:
  - `server/cms/editor-rules.js`
  - `server/cms/site-fields.js`
  - `test/cms/editor-rules.test.js`

**Interfaces:**
- `checkDraft({ layout, before, blocks, meta, categories })` returns either
  `{ blocks, meta, errors: [] }` or `{ errors: [{ path, message }] }`.
  - `before` is the current version's blocks.
  - `categories` is the list of keys of the `leads.interestMap` setting.
- `checkSite({ live, settings })` returns either `{ settings, errors: [] }` or
  `{ errors }`. It validates against `SITE_FIELDS`, cleans the tagline, and sets menu
  anchors by the rule of spec §3.4.
- `SITE_FIELDS` is the menu and footer field definitions, in block field format.
- `META_FIELDS` is `{ seoTitle: {type:'text',label:'Search title',max:70,required:true}, seoDescription: {type:'longtext',label:'Search description',max:200,required:true} }`.

- [ ] **Step 1: The test**

`test/cms/editor-rules.test.js` builds the eight pages with the converters, as
`test/cms/layout.test.js` does. It asserts:
- **Unchanged pages.** For every page, `checkDraft` with the unchanged blocks and the
  page's own search texts returns no errors, and the blocks and search texts are
  `deepEqual` to the input.
- **A valid edit.** A changed Pricing heading within its limit is stored.
- **An over-long heading** gives the error path `blocks[1].heading`.
- **Two swapped blocks** give the structure error, with path `blocks`.
- **A changed block `anchor`** gives an error at `blocks[i].anchor`.
- **New and renamed items in the Services catalogue:**
  - a new practice with an empty anchor gets `makeAnchor(title)`, unique on the page;
  - a renamed existing practice anchor is refused.
- **CRM categories.** A contact option category outside the categories is refused; one
  inside them is accepted.
- **Rich text.** A Text body containing `<script>alert(1)</script><strong>x</strong>` is
  stored as `<strong>x</strong>`.
- **Search texts.** A missing search title and a 201-character description give errors
  at `meta.seoTitle` and `meta.seoDescription`.
- **Menu and footer:**
  - `checkSite` with today's settings returns them unchanged;
  - changing the Contact link's address to `/nidos/pricing.html` drops its anchor;
  - changing it to `/#about` gives anchor `about`;
  - an unchanged Services link keeps anchor `practices`.

- [ ] **Step 2: Run it.** It fails: `Cannot find module '../../server/cms/editor-rules'`.

- [ ] **Step 3: The rules**

```js
// server/cms/editor-rules.js
/*
 * What the page editor may change, checked on every save (spec §4.3): a page's
 * content, never its shape. Pure: the caller passes the page as it stands and as
 * submitted, and gets back what to store, or the errors.
 */
const { validatePage } = require('./validate');
const { validateProps } = require('./fields');
const { sanitize } = require('./richtext');
const { getBlock } = require('../../blocks');
const { SITE_FIELDS } = require('./site-fields');

const META_FIELDS = {
  seoTitle: { type: 'text', label: 'Search title', max: 70, required: true },
  seoDescription: { type: 'longtext', label: 'Search description', max: 200, required: true },
};
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isAnchor = (f) => f.type === 'anchor' && !f.choices;
const eachItem = (f, v, fn) => { if (f.type === 'list' && f.of !== 'string' && Array.isArray(v)) v.forEach((it, i) => isObj(it) && fn(it, i)); };

// A new item's anchor: its title in lowercase letters, digits and dashes,
// starting with a letter and unique on the page.
function makeAnchor(title, taken) {
  const base = String(title || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 32).replace(/-+$/, '');
  const stem = /^[a-z]/.test(base) ? base : `item${base ? `-${base}` : ''}`.slice(0, 32);
  let anchor = stem;
  for (let n = 2; taken.has(anchor); n += 1) anchor = `${stem}-${n}`;
  taken.add(anchor);
  return anchor;
}

function anchorsIn(fields, props, out) {
  for (const [k, f] of Object.entries(fields)) {
    const v = props[k];
    if (isAnchor(f) && typeof v === 'string' && v) out.add(v);
    else if (f.type === 'group' && isObj(v)) anchorsIn(f.of, v, out);
    else eachItem(f, v, (it) => anchorsIn(f.of, it, out));
  }
  return out;
}

// Anchors on a block or group stay as they were. In a list, an item keeps the
// anchor it had; a new item (empty anchor) gets one from its title.
function checkAnchors(fields, props, prev, path, taken, errors) {
  for (const [k, f] of Object.entries(fields)) {
    const at = `${path}.${k}`;
    const v = props[k];
    const was = isObj(prev) ? prev[k] : undefined;
    if (isAnchor(f)) {
      if ((v || '') !== (was || '')) errors.push({ path: at, message: 'Anchors cannot be changed in the editor.' });
    } else if (f.type === 'group' && isObj(v)) {
      checkAnchors(f.of, v, was, at, taken, errors);
    } else if (f.type === 'list' && f.of !== 'string') {
      const key = Object.keys(f.of).find((n) => isAnchor(f.of[n]));
      if (!key) continue;
      const had = new Set((Array.isArray(was) ? was : []).map((it) => isObj(it) && it[key]).filter(Boolean));
      const seen = new Set();
      eachItem(f, v, (item, i) => {
        if (!item[key]) item[key] = makeAnchor(item.title, taken);
        else if (!had.has(item[key]) || seen.has(item[key])) {
          errors.push({ path: `${at}[${i}].${key}`, message: 'Anchors cannot be changed in the editor.' });
        }
        seen.add(item[key]);
      });
    }
  }
}

function checkChoices(fields, props, path, categories, errors) {
  for (const [k, f] of Object.entries(fields)) {
    const at = `${path}.${k}`;
    const v = props[k];
    if (f.choices === 'crm') {
      if (v && !categories.includes(v)) errors.push({ path: at, message: `${f.label} must be one of the CRM categories in Settings.` });
    } else if (f.type === 'group' && isObj(v)) checkChoices(f.of, v, at, categories, errors);
    else eachItem(f, v, (it, i) => checkChoices(f.of, it, `${at}[${i}]`, categories, errors));
  }
}

function cleanRich(fields, props) {
  for (const [k, f] of Object.entries(fields)) {
    const v = props[k];
    if (f.type === 'richtext' && typeof v === 'string') props[k] = sanitize(v, f.profile);
    else if (f.type === 'group' && isObj(v)) cleanRich(f.of, v);
    else eachItem(f, v, (it) => cleanRich(f.of, it));
  }
}

function checkDraft({ layout, before, blocks, meta, categories }) {
  const shape = (list) => list.map((b) => `${isObj(b) ? b.id : ''}:${isObj(b) ? b.type : ''}`).join('|');
  if (!Array.isArray(blocks) || shape(blocks) !== shape(before)) {
    return { errors: [{ path: 'blocks', message: 'Sections cannot be added, removed or reordered in the editor.' }] };
  }
  const next = JSON.parse(JSON.stringify(blocks));
  const errors = [];
  const taken = new Set();
  before.forEach((b) => anchorsIn(getBlock(b.type).fields, b.props, taken));
  next.forEach((b) => isObj(b.props) && anchorsIn(getBlock(b.type).fields, b.props, taken));
  next.forEach((b, i) => {
    if (!isObj(b.props)) return; // validatePage says so
    const { fields } = getBlock(b.type);
    checkAnchors(fields, b.props, before[i].props, `blocks[${i}]`, taken, errors);
    checkChoices(fields, b.props, `blocks[${i}]`, categories, errors);
    cleanRich(fields, b.props);
  });
  const m = isObj(meta) ? { seoTitle: meta.seoTitle, seoDescription: meta.seoDescription } : {};
  errors.push(...validateProps(META_FIELDS, m, 'meta'), ...validatePage(layout, next));
  return errors.length ? { errors } : { blocks: next, meta: m, errors };
}

// Menu links jump to a section of the page they are on when the page has it
// (spec §3.4): a link keeps its anchor while its address is unchanged, and an
// address ending in #section takes that section.
function checkSite({ live, settings }) {
  if (!isObj(settings)) return { errors: [{ path: 'settings', message: 'Menu and footer are a set of fields.' }] };
  const next = JSON.parse(JSON.stringify(settings));
  const errors = validateProps(SITE_FIELDS, next, 'settings');
  if (errors.length) return { errors };
  const was = new Map(live.nav.links.map((l) => [l.href, l.anchor]));
  next.nav.links = next.nav.links.map(({ text, href }) => {
    const anchor = was.has(href) ? was.get(href) : (href.match(/#([a-z][a-z0-9-]{0,40})$/) || [])[1];
    return anchor ? { text, href, anchor } : { text, href };
  });
  next.footer.taglineHTML = sanitize(next.footer.taglineHTML, 'inline');
  return { settings: next, errors };
}

module.exports = { checkDraft, checkSite, makeAnchor, META_FIELDS };
```

`server/cms/site-fields.js` declares the fields below. Every limit must be at least as
large as the value stored today; the "unchanged" test in Step 1 proves that.

- **`nav`** (group):
  - `logo`: text, max 40;
  - `links`: list, 1–8 items, each `{ text: text 24, href: link }`.
- **`footer`** (group):
  - `taglineHTML`: richtext, inline profile, max 300;
  - `cols`: list, 1–4 items, each `{ heading: text 32, links: list 1–8 of { text: text 40, href: link } }`;
  - `legal`: longtext, max 300;
  - `arcade`: group `{ text: text 40, aria: text 80 }`.
- **`labels`** (group): `{ skip: text 40, menu: text 40, introSkip: text 24 }`.
- Every field is required.

`nav.links[].anchor` is not a field. The form never sends it, and `checkSite` sets it.
`checkSite` validates `{ nav, footer, labels }` with anchors stripped: the test passes
today's settings through `({ text, href })`.

Add `meta Json?` after `blocks` in `model PageVersion`, commented "`{ seoTitle,
seoDescription }` of this version; null on imported versions". Add `choices: 'crm'` to
`options.of.value` in `blocks/contact-form/index.js`.

- [ ] **Step 4: Run the test, then the suite.** All pass.

- [ ] **Step 5: Push the column to the development database.** Run
  `npm run db:push:cms-dev`. Expected: "Your database is now in sync".

- [ ] **Step 6: Commit.**
  `feat(cms): the editor's rules - content changes, never a page's shape`

---

### Task 2: Reading and writing drafts, and the routes

**Files:**
- Create:
  - `server/cms/editor.js`
  - `server/routes/admin/editor.js`
  - `test/cms/editor-routes.test.js`
- Modify:
  - `server/routes/admin/index.js`: `router.use(require('./editor')({ … }))`

**Interfaces:**
- `createEditor(prisma)` returns these methods. Every write takes `userId`.
  - `listPages()`
  - `openPage(id)`
  - `saveDraft(id, { baseVersionId, meta, blocks }, userId, categories)`
  - `discardDraft(id)`
  - `publish(id, { baseVersionId }, userId)`
  - `versions(id)`
  - `restore(id, versionId, userId)`
  - `openSite()`
  - `saveSiteDraft({ base, settings })`
  - `discardSiteDraft()`
  - `publishSite({ base })`
- `EditorError(status, message, errors?)`: status `404`, `409` or `422`.
- `editorRoutes({ editor, getCategories })` returns an Express router with the routes in
  spec §4.2.
  - Publishing the site calls `req.app.locals.cms.clear()`.
  - Publishing a page also calls it, so the change shows at once rather than within 5 s.
  - Every write calls `audit.record(req, …)`.

**Behaviour, following spec §4.1 exactly:**
- **One working draft per page.** A save deletes the old draft row and creates a new one
  in a transaction, so the draft's id changes on every save.
- **The conflict token** is the current draft's id, or the published version's id when
  there is no draft.
- **Publishing:**
  1. create a `published` version with the draft's `blocks` and `meta`;
  2. point `publishedVersionId` at it;
  3. copy the search texts to the page's columns;
  4. delete the draft.
- **`openPage`** returns `{ page: {id,title,path,layout}, versionId, kind, meta, blocks }`.
  When the version's `meta` is null, it uses the page's columns.
- **`listPages`** returns `{ id, title, path, hasDraft, publishedAt, publishedBy }`.
  `publishedBy` is the user's name or email, or `"Imported"` when `createdById` is null.
- **Menu and footer:**
  - the draft row is `SiteSetting` key `draft`;
  - the token is `draft:<id>` when a draft exists, otherwise `live:<latest updatedAt of
    nav/footer/labels>`;
  - `publishSite` upserts the three live rows and deletes the draft.

- [ ] **Step 1: The route test.** It uses a fake editor and checks that the routes return:
  - `422` with `{ errors }`, `409` and `404` from `EditorError`;
  - `200` with the new `versionId` on a good save;
  - a call to `cms.clear()` on site publish.
- [ ] **Step 2: Run it.** It fails: the router does not exist.
- [ ] **Step 3: Write `server/cms/editor.js` and the router.** A database failure answers
  `500 { error: 'The page editor could not reach the database.' }`.
- [ ] **Step 4: Run the suite.** It passes.
- [ ] **Step 5: Commit.** `feat(cms): drafts, publishing, history and restore, under /api/admin`

---

### Task 3: Preview of drafts

**Files:**
- Modify:
  - `server/cms/store.js`: `getDraft(siteKey, path)` and
    `getSiteSettings(siteKey, { draft })`
  - `server/cms/middleware.js`: accepts `?__cms=draft`
  - `test/cms/middleware.test.js`

**Behaviour:**
- **`getDraft`** returns the page's draft, or its published version when there is no
  draft, as `{ page, blocks }`. The version's `meta` is applied over the page's search
  columns.
- **`getSiteSettings(key, { draft: true })`** overlays the `draft` row's
  `{ nav, footer, labels }` on the live rows.
- **In the middleware:**
  - `forced` accepts `'draft'` on the same `canPreview` check as `'1'`;
  - a draft build is never cached;
  - `Cache-Control` is `no-store`.

- [ ] **Step 1: Add the tests.** Using the middleware test's existing fakes, check that:
  - `?__cms=draft` from an admin draws the draft (a draft heading appears);
  - from anyone else, the request falls through (`next`);
  - with the switch off, an admin still gets the draft.
- [ ] **Step 2: Run them.** They fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** They pass.
- [ ] **Step 5: Commit.** `feat(cms): an admin previews drafts with ?__cms=draft`

---

### Task 4: The Pages section in the admin

**Files:**
- Create: `admin-pages.js`
- Modify:
  - `admin.html`: the nav item "Pages" after "Site content", `<div id="view-pages"
    class="crm-view"></div>`, and `<script src="admin-pages.js?v=1">` before `admin.js`.
    Bump `admin.js?v=4` and `admin.css?v=3`.
  - `admin.js`:
    - `views.pages = () => window.adminPages.load()`;
    - `showView` refuses to leave when `window.adminPages.canLeave()` is false;
    - at boot, hide `[data-view="content"]` when `/api/admin/settings` says
      `values['cms.servePages']` is true.
  - `admin.css`: the editor's styles.

**Behaviour, following spec §3:**
- **The list view.**
  - The first row is Menu & footer.
  - Then the pages from `GET /api/admin/pages`: name, address, and either "Unpublished
    changes" or "Published <date> by <name>".
- **The editor view.** It has the toolbar (Save draft, Preview, Publish, History, and
  Discard changes when a draft exists), the Search engines group, then one card per
  block.
  - A card's title is the block's `label`, plus ` — <heading>` when the block has one.
  - Fields come from `GET /api/admin/blocks`, drawn by one builder,
    `field(def, value, path, set)`. Every input carries `data-path` (for example
    `blocks[2].items[1].claim`) so that `422` errors land on it.
- **How each field type is drawn:**

  | Type | Drawn as |
  |---|---|
  | text | `<input maxlength>` with an `n / max` counter |
  | longtext | `<textarea maxlength>` with a counter |
  | select | `<select>` |
  | `choices: 'crm'` | `<select>` of the categories |
  | link | `<input>`, with the rule as a hint |
  | date | `<input type=date>` |
  | group | `<fieldset>` |
  | list | its items, each with ↑ ↓ ✕, and **Add**. Add and remove are disabled at max and min. A new item is empty, and a new list-of-strings item is `''`. |
  | anchor without `choices` | not drawn; its value is carried through untouched |
  | richtext | the formatting box, described below |

- **The formatting box.** A `contenteditable` area and a toolbar.
  - **Inline profile:** bold, italic, link. Link prompts for an address that must match
    the link rule; an empty answer removes the link.
  - **Full profile:** adds bullet list, numbered list, subheading (h3), and add row /
    remove row when the cursor is in a table.
  - **Pasting** inserts the clipboard's HTML through a client-side cleaner. It mirrors
    `server/cms/richtext.js`'s allow-list for the box's profile, and falls back to plain
    text.
  - **The field's value changes only on an `input` event,** so a box nobody touched sends
    back exactly what it received. That is what makes the round trip exact.
- **Save draft** → `PUT …/draft`:
  - on `200`, update the token and clear the dirty flag, then flash "Draft saved";
  - on `409`, flash "This page was changed elsewhere — reload to see the latest.";
  - on `422`, mark each field, show the message under it, and scroll to the first.
- **Preview** saves first if the page is dirty, then opens `path + '?__cms=draft'` in a new
  tab. For Menu & footer it opens `/?__cms=draft`.
- **Publish** saves first if dirty, confirms, and posts. On success it flashes
  "Published — live now" and reloads the view.
- **History** lists the versions with their date and publisher, a "Live" badge, and
  Restore. Restore posts, then reloads the view, which now holds the restored draft.
- **Discard** confirms, deletes, and reloads.
- **Leaving with unsaved changes:**
  - `beforeunload` warns when dirty;
  - `canLeave()` returns `confirm('Leave without saving your changes?')` when dirty.
- **Menu & footer** is the same editor over `SITE_FIELDS`, with the token in place of the
  version id.

- [ ] **Step 1:** Build it, then check it by hand on the development server. Sign in with
  the check's throwaway admin from Task 5, or the owner's account on the development
  database if one exists.
- [ ] **Step 2: Run `npm test`.** It passes. There are no unit tests for DOM code; Task 5
  covers it.
- [ ] **Step 3: Commit.**
  `feat(cms): the Pages section - every page's content, search texts, menu and footer`

---

### Task 5: The browser check, parity, and the runbook

**Files:**
- Create: `scripts/cms-editor-check.js`
- Modify:
  - `package.json`: `"cms:editor-check": "node scripts/cms-editor-check.js"`
  - `docs/superpowers/runbooks/cms-release.md`: part 2's release steps, as in spec §6

**The check** runs against a development server (base `http://127.0.0.1:4041`):
1. **Sign in.**
   - `useDevDatabase()`; upsert the user `editor-check@example.invalid` as an active
     admin, with a bcrypt hash of a random password made in the script.
   - `POST /api/auth/login` with those credentials, and copy the `token` cookie into the
     browser contexts. Nothing is printed.
2. **Round trip through the routes.** For every page:
   - `GET /pages/:id`;
   - `PUT` the draft unchanged;
   - `GET` again, and `deepEqual` the blocks and search texts;
   - `DELETE` the draft.

   Menu & footer get the same.
3. **Edit, preview, publish and restore, in Chromium and WebKit:**
   - open Admin → Pages → Pricing;
   - set the first text field of every card to a marked value within its limit;
   - Save draft; Preview shows every marked value;
   - Publish; `/nidos/pricing.html?__cms=1` shows them;
   - History → Restore the previous version → Publish, and the page's body matches the
     file again (`normalizeHtml`).
4. **Lists** (Chromium): on Services, add a scope item to the first practice, move it up,
   remove it, and save. The draft's list matches each step. Then discard.
5. **Errors:**
   - a heading over its limit, typed through the API, gets `422` naming its path;
   - in the UI, an emptied required field is highlighted after Save.
6. **Menu & footer:** change the footer's legal line, save, preview `/?__cms=draft` (the
   footer shows it), publish, and every one of the eight pages shows it. Then put it back
   and publish.
7. **Conflict:** a save with an old token gets `409`.
8. **Clean up:** delete the throwaway admin.

- [ ] **Step 1: Write the check.** Run `npm run db:push:cms-dev`, start the server on
  4041, then run `npm run cms:editor-check`. Expected: every row passes.
- [ ] **Step 2: Run parity.** `CMS_PARITY_BASE=http://127.0.0.1:4041
  CMS_PARITY_ENGINES=chromium npm run cms:parity`, then the same with webkit. Expected:
  302/302 each, because the check leaves the pages as they were.
- [ ] **Step 3: Update the runbook** for part 2's release, spec §6: tables and column,
  import, check in Pages, switch on, Site content hidden, rollback.
- [ ] **Step 4: Commit.**
  `test(cms): the editor checked end to end; the runbook covers its release`

---

## After the last task

- **One whole-branch review** on the most capable model, then one round of fixes.
- **The PR**, on the owner's word.
- **After the merge:** the owner's release steps (runbook Steps 2–5), with a live check
  after each.
