# Site editor for projectnidos.eu, part 1: Foundation

Date: 2026-09-23 · Status: draft for review · Branch: `cms/foundation`

## 1. What this is for

**Intent (from the owner's brief).** The owner of projectnidos.eu wants to change their own
website the way WordPress allows: create pages, add, remove, rearrange and edit their
content, without a developer. It must live inside the site's existing admin panel, with
the same login they use for the CRM. It is built for this one site first, but in a way
that lets Project Nidos later offer it on client websites.

**Decisions taken while designing this:**

| Question | Decision |
|---|---|
| Who edits | The site owner, in the existing admin panel. Built so more sites can be added later. |
| First priority | Whole pages built from the site's own blocks. |
| Existing pages | Home, Services and Pricing become editable block pages. |
| Editing style | Drag-and-drop on a live view of the page, using the open-source Puck editor (MIT). |
| Images | Not in scope. Dropped by the owner. |

**Success looks like:** the owner creates or changes a page, previews it and publishes it
themselves, and the result looks like the rest of the site because they can only use the
site's own blocks. Visitors notice nothing except the changed content: pages stay plain,
fast HTML.

## 2. The programme and where this document sits

The work is split into three parts, each shipped and usable on its own:

1. **Foundation (this document).** The blocks, pages stored in the database, the
   server assembling pages from them, and moving the existing pages over so they look
   exactly as they do now. No visible change.
2. **The editor.** A "Pages" section in the admin panel with Puck drag-and-drop
   editing, draft, preview, publish and version history. Its own spec.
3. **Site-wide settings.** Editing the nav and footer, search-engine fields per page,
   a self-updating sitemap, and redirects when a page's address changes. Its own spec.

**Not in part 1:** any editing interface beyond one on/off setting, nav and footer
editing, SEO and sitemap work, images.

## 3. Architecture

A visit to a page, once part 1 is switched on:

1. The request (for example `GET /nidos/pricing.html`) reaches a new page-rendering
   step that runs **before** today's content-override step and static files.
2. If "Serve pages from database" is on and a published page exists at that address,
   the server takes the page's published version, draws each block in order inside the
   page layout (head, nav, footer, background, scripts) and sends plain HTML.
3. Otherwise the request carries on exactly as today: the override step, then the
   file on disk.

Assembled HTML is cached in memory, keyed by site and address. Each cache entry records
the published version it was built from. A cheap version check (at most once every 5
seconds) rebuilds it after a publish, so this also stays correct if the service is ever
scaled past one instance.

**Fallback is the safety net.** Setting off, page missing, database unreachable, or any
block failing to render: the request falls through to today's files and the failure is
logged. A visitor never gets a half-drawn page.

**Multi-site readiness.** Every page and site setting belongs to a `Site`. Part 1 has
one site and resolves every request to it. Resolving by domain comes when a second site
arrives.

## 4. Data model

Four additive tables in the existing Postgres database. Nothing existing changes. Schema
changes go through `prisma db push`, as the rest of this database does.

```prisma
model Site {
  id        Int      @id @default(autoincrement())
  key       String   @unique            // "projectnidos"
  name      String
  domain    String?                     // "www.projectnidos.eu"
  createdAt DateTime @default(now())
  pages     Page[]
  settings  SiteSetting[]
}

model Page {
  id                 Int       @id @default(autoincrement())
  siteId             Int
  site               Site      @relation(fields: [siteId], references: [id])
  path               String    // "/", "/nidos/pricing.html" - the address, unchanged from today
  title              String    // how the page is named in the admin panel
  layout             String    // "home" (intro splash, cookie banner) | "standard"
  seoTitle           String
  seoDescription     String
  publishedVersionId Int?      @unique
  deletedAt          DateTime?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  versions           PageVersion[]
  @@unique([siteId, path])
}

model PageVersion {
  id          Int      @id @default(autoincrement())
  pageId      Int
  page        Page     @relation(fields: [pageId], references: [id])
  kind        String   // "draft" | "published"
  blocks      Json     // [{ id, type, props }] - the page, top to bottom
  note        String?  // "Imported from site files", later the editor's own notes
  createdById Int?     // User; null for the import
  createdAt   DateTime @default(now())
  @@index([pageId, createdAt])
}

model SiteSetting {
  id        Int      @id @default(autoincrement())
  siteId    Int
  site      Site     @relation(fields: [siteId], references: [id])
  key       String   // "nav", "footer" (part 1 stores them, part 3 makes them editable)
  value     Json
  updatedAt DateTime @updatedAt
  updatedBy String?
  @@unique([siteId, key])
}
```

`Page.publishedVersionId` points at a `PageVersion` of kind `published`. Publishing
creates a new version and moves that pointer; nothing is ever overwritten. That is what
the part 2 history and restore are built on. The on/off switch is a row in the existing
`Setting` table, `cms.servePages` (boolean, default `false`), shown in the admin
panel's existing Settings view.

## 5. Blocks

Each block lives in its own folder, `blocks/<name>/`:

- `index.js`: label, the field definitions with their limits, default content, the
  scripts it needs, and `render(props, ctx) → HTML string`. It is plain JavaScript with
  no browser APIs, so the server and the part 2 editor run the **same** code. The editor
  preview is therefore the live page.
- `style.css`: the block's styles, every class prefixed with the block's name.

**Field types:**
- short text and long text, each with a maximum length;
- price;
- choice from a fixed list, such as a diagram or an icon;
- link: a page on this site, or a typed address;
- repeating list, with minimum and maximum items;
- limited rich text: paragraphs, bold, italic, links, lists, plus h2 and h3 for Rich text.

Rich text is cleaned against that allow-list when saved and imported. Everything else is
escaped when drawn, so anything typed as code shows as text and never runs.

**The block set** covers everything on today's pages:

| Block | What it holds (limits in brackets) |
|---|---|
| Hero | two headline lines (40 each), lede (rich, 320), primary and secondary button (label 28, link). One per page. Loads the orbital scene. |
| Page intro | back link, title in one or two lines (60 each), lede (360) |
| Text | heading (80), subheading (100, optional), body (rich, 1,200) |
| Practice cards | heading (80), side link, cards [1–9]: title (48), summary (140), link, diagram (six existing or none) |
| Service catalogue | heading (80), "On this page" label (40), practices [1–9], each: anchor, title (60), name in the index (60), outcome (120), diagram, description (400), client problem (200), scope list [1–14 × 90], package name (48), package text (400), package note (200), price (24), price note (160). The index is built from the practices; both are numbered automatically by order. |
| Three reasons | heading (80), exactly 3 items: icon (from the icon set), claim (48), support (80) |
| Pricing table | heading (80), column labels, rows [1–12]: practice (60), link, from (24), range (32) |
| Packages | heading (80), cells [1–9]: for which practice (60), name (48), text (360), note (200), price (24), unit (24) |
| Steps | heading (80), lede (rich, 400), steps [2–6]: title (32), text (120), price (32, optional). Numbered automatically. |
| Hourly rates | heading (80), lede (300), rows [1–8]: role (48), rate (32) |
| Subscriptions | heading (80), lede (300), plans [1–4]: name (40), amount (32), unit (24), text (200) |
| Not included | heading (80), items [1–12 × 200], note (400), primary and optional secondary button |
| Button row | primary and optional secondary button |
| Contact form | heading (60), lede (160), side texts, email, field labels, submit label (28), options [1–10]: text (40) + CRM lead category (choice from the categories in Settings) |
| Contact info | the services page's closing block: heading, subheading, text, email, button, up to 3 links |
| Rich text | the legal pages' copy: body (rich, 30,000). The title comes from a Page intro above it. |

**Diagrams** are chosen by name from the six existing animations, or none. A new
practice can go without one, or a developer adds a seventh.

**Contact form options** carry a CRM lead category chosen from a list, never free text,
so an edited option cannot silently send leads to the wrong place.

## 6. Styles and scripts

Today `landing.css` and `pages.css` use the same class names for different things:
`.contact-block`, `.practices`, `main` spacing and more. Blocks cannot be mixed across
pages until that is untangled:

- Each block's rules move out of `landing.css`, `pages.css`, `shared.css` and
  `visuals.css` into its `style.css`, renamed under the block's prefix.
- The page frame (nav, footer, topology field, section rhythm) moves into one frame
  stylesheet.
- At start-up the server joins frame and block styles into one file, served with a
  content hash (`/site.css?v=<hash>`) and cached long-term.
- Block pages load `base.css` (fonts, tokens, reset, the shared nav and footer spine) and
  then `site.css`. `base.css` itself does not change, so the pages that are not blocks
  (arcade and other older pages) are unaffected. The CRM and admin do not load it.

Scripts are loaded only where they are used. Each block declares what it needs, and the
layout adds only those, once each:

| Script | Where it loads |
|---|---|
| orbital scene | pages with a Hero |
| diagram player | pages whose blocks have diagrams |
| form checking | pages with the Contact form |
| practices hover pane | pages with Practice cards |
| intro video, cookie banner | the home layout, as today |
| topology field, nav hairline | every page |

`landing.js` is split along those lines.

## 7. Moving the pages over

**Pages moved:**
- **Home, Services, Pricing:** must look exactly as today.
- **Privacy, Terms, Cookies, GDPR, 404:** become Rich text or Page intro pages. These
  **deliberately change look**, from the old style to the site's current one. Their
  check is text-for-text, not pixel-for-pixel. They also become editable, which matters
  because their current wording needs correcting. *(Superseded for the four legal
  pages: see §13. They now move with exact parity; only the 404 changes look.)*

**Import.** A one-time script, `scripts/cms-import.js`, turns today's content into
pages:
- Home comes from `site/content.en.json` and Services from `site/digi.en.json`.
- Pricing's hand-written tables are turned into structured rows.
- The legal pages come from their HTML.
- Any edits saved through the admin's "Site content" tab (`SiteContent` rows) are
  applied on top.
- Nav and footer are stored as `SiteSetting` rows.
- Every page is created with one published version, noted "Imported from site files".
- It validates every block against its limits and refuses to write if anything fails.
- It is safe to re-run: existing pages are left alone unless `--replace` is given.

**The 404 page** has no address of its own. It is stored at the reserved path `/404`,
and the catch-all route renders it with status 404 whenever a request matches no page
and no file.

**Proof nothing changed.** An automated comparison runs the same local server with the
switch off and then on, and for each page checks:
- screenshots at 390, 768, 1024, 1440 and 1920 px wide, in Chromium and WebKit, with
  pixel differences flagged;
- the same visible text, links, headings and meta tags;
- the orbital scene, diagrams and field start, and the contact form validates and posts;
- no console errors.

The comparison has to pass for every page before the switch is turned on anywhere.

**Switching on:**
1. The switch goes on against the development database.
2. The comparison runs.
3. The switch goes on for the live site, with the owner's OK.
4. Every live page is checked in a browser.

Turning the switch off brings back today's files instantly.

**Clean-up is deferred.** The build scripts, content files, generated HTML files and
the "Site content" tab stay until part 2 is live and the owner works in the editor. They
are then removed in a separate change.

## 8. Development and release

- **Development database.** A "development" environment in the Railway project,
  holding only a Postgres database. It is created with the owner's OK, since it changes
  their Railway account. It stores imported pages and a test login, never real leads or
  customer data. The local server reaches it through a git-ignored env file loaded by a
  `dev:cms` script, which refuses to start if the env chain swaps the database. The live
  database is never used while building.
- **Release.**
  1. The branch merges to `main` when the owner says so. Railway deploys it.
  2. The four tables are added to the live database once, using the existing
     `RUN_DB_PUSH=1` start-up step. It is additive only.
  3. The import runs once on the live database, with the owner's OK, through a new
     `RUN_CMS_IMPORT=1` start-up step. Like the schema push, it runs inside Railway, so
     no production credential leaves the platform.
  4. A signed-in admin previews each page on the live site with `?__cms=1`.
  5. Only then is the switch turned on.

## 9. Testing

Uses Node's built-in test runner and the Playwright browsers already cached on this
machine.

- **Blocks:**
  - each renders the same HTML as today's page for the same content;
  - limits reject over-long or missing fields;
  - escaping and the rich-text allow-list hold against script injection.
- **Server:**
  - only admin accounts can change pages or the switch;
  - drafts are never served to visitors;
  - publishing refreshes the cache;
  - every fallback path (switch off, missing page, database down, block error) serves
    today's file.
- **Import:** idempotent. Rejects invalid content with the field and reason.
- **Pages:** the comparison in section 7.
- **Performance:** a cached page takes no longer to serve than the static file does
  today, and HTML size stays within 5% of today's.

## 10. Failure handling

| Failure | What happens |
|---|---|
| A block throws while rendering | The page falls through to today's file. The error is logged with page, block and version. |
| Database unreachable | Same fall-through to today's file (see §13). |
| Invalid content | Rejected at import, and at save in part 2, with the field and the reason. |
| Switch toggled | Cache cleared. Recorded in the activity log. |

## 11. Security

- Page, version and switch endpoints are admin-only, under the existing `/api/admin`
  guard and rate limit.
- Every import, publish and switch change goes into the existing activity log, with the
  before and after state.
- Content is escaped when drawn. Rich text is cleaned to the allow-list when stored.
- Part 1 adds no public-facing input.

## 12. Deferred to later parts

- The Pages list, the Puck editor, preview, publish and restore interface: part 2.
- Editing nav and footer, SEO fields, sitemap, redirects on address change: part 3.
- Resolving the site from the domain: when a second site is added.

## 13. Amendments from planning (23 Sep 2026)

Found while writing the implementation plan
(`docs/superpowers/plans/2026-09-23-cms-foundation.md`), from reading the pages'
actual markup:

- **Two plans for part 1.**
  - Plan 1a is the engine, the import and the switch. Blocks render today's class names
    and pages load today's stylesheets, so parity can be exact.
  - Plan 1b is section 6, the style untangling. It lands before part 2 ships.
  - Until 1b, each block is limited to the layout whose stylesheet it was written for:
    "home" (landing.css) or "standard" (pages.css).
- **One Service catalogue block** replaces "Service detail" and "On this page". The
  index and the practices are one section in today's markup, and splitting them would
  change it.
- **Not included has buttons.** Pricing ends with two buttons inside that section.
- **Section blocks have an optional anchor** (for links such as `#contact`).
- **Nav links carry an anchor.** A link such as "Contact" (`/#contact`, anchor
  `contact`) becomes `#contact` on any page that has that anchor, and stays
  `/#contact` elsewhere. That reproduces today's per-page nav from one stored list.
- **One visible change before the move.** Services, Pricing and the legal pages draw the
  page intro, and Services and Pricing the numbered steps, with slightly different
  markup today. A block has one markup, so the static pages are aligned first:
  - Pricing's step numbers become 01–04, as on Services.
  - The back link on Pricing and the legal pages gains the larger touch target.
  - Services' process section takes the pricing sections' class, which may re-wrap its
    heading.
- **The legal pages move with exact parity.** They were rebuilt in the site's look on
  `main` (9897ae5) before implementation began, so section 7's "deliberately change
  look" no longer applies to them. They are checked like Pricing, markup and pixels:
  - The "Rich text" block becomes **Legal document**: an optional "at a glance" grid,
    then numbered clauses, each with an anchor, a title (80) and a rich body (8,000).
  - **Page intro** gains an optional "Last updated" date and links between the legal
    documents. The current document's link is marked as the current page.
  - The full rich-text profile covers what the clauses use: paragraphs, lists, h3/h4,
    `code`, `address`, and tables. Tables keep `class="legal-table"`, `th scope` and
    `td data-label`, and no other attribute.
- **Legal pages stay out of search.** They are `noindex, follow` today. The Page table
  gains `noindex Boolean @default(false)`, which the import sets from each page's
  robots tag. The 404 page is `noindex` too.
- **The 404 page** is the only page that changes look. It loses its terminal animation
  and becomes a page intro and two buttons in the site's look.
- **Head tags.**
  - Block pages emit one `og:type` (`website`).
  - `og:title` and `og:description` come from the SEO fields.
  - They no longer emit `keywords`, `author`, or Twitter title and description.
  - Home no longer emits `twitter:image`; Twitter falls back to `og:image`, the same
    picture.
  - Standard-layout pages no longer carry `history.scrollRestoration = 'manual'`
    (Pricing and the legal pages have it today; Services does not), so the browser
    restores the scroll position on reload and back. Home keeps it, for its intro.
  - The body, title and description are unchanged.
- **Database unreachable** falls through to today's file rather than a cached copy. The
  file is the same page, and the rule is simpler.
- **Admin preview on the live site.** `?__cms=1` shows the database version and
  `?__cms=0` the file. It works for anyone on a development server, and only for a
  signed-in admin on the live site; everyone else gets whatever the switch says.
