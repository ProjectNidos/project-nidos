# Site editor, part 2: editing the site's content in the admin

Design agreed with the owner on 27 Sep 2026. It builds on parts 1a and 1b
(`2026-09-23-cms-foundation-design.md`). This document replaces that spec's description of
part 2: drag-and-drop in the Puck editor.

## 1. What this is for

**Intent (from the owner).** The owner wants to edit the site's content from the admin
panel: every text, price and list on every page. Each page keeps its layout. They want to
see a change before visitors do, and to be able to go back.

**Decisions taken while designing this:**

| Question | Decision |
|---|---|
| What can be edited | Every text, price and list on every page. The layout, the order of sections and the set of pages stay as they are. |
| When a change goes live | Save a draft, preview it, then publish. Earlier versions are kept and can be restored. |
| What else can be edited | Each page's search-engine title and description, and the menu and footer shared by every page. |
| How | Forms in a new **Pages** section of the admin, generated from the fields each block already declares. This was chosen over extending today's Site content tab, and over a drag-and-drop editor now. |
| Images | Out of scope, as in part 1. |

**Success looks like this:**
- The owner changes a price on the pricing page, previews it, and publishes it. Visitors see the new price at once.
- Pages the owner has not edited stay exactly as they are.
- Nothing typed in a form can break a page's layout, run code, or send a visitor to an unsafe link.

## 2. Where this sits

- **Part 1a** (blocks, page tables, the page renderer, import and the admin switch) and
  **part 1b** (styles and scripts per block) are merged. The switch is off, and the page
  tables have not yet been created in production.
- **This part** is the editor. It becomes useful once the pages are served from the
  database, which is the release in §6.
- **Drag-and-drop** (rearranging sections, adding pages) is not needed now. It could come
  later on the same data, because both approaches edit the same blocks.
- **Part 3 shrinks.** It keeps the self-updating sitemap and the redirects for changed
  addresses. Neither is needed until pages can be created or moved. Menu, footer and
  search-engine texts move into this part.

## 3. What the owner sees

A new **Pages** item in the admin menu.

### 3.1 The pages list

- The first entry is **Menu & footer**.
- Below it come the eight pages, named as in the admin: Home, Services, Pricing, Privacy
  Policy, Terms of Service, Cookie Policy, GDPR, Page not found. Each shows its address.
- Each page shows one of two states:
  - **Unpublished changes**, when it has a saved draft;
  - otherwise, **Published** with the date and the person who published it, or
    "Imported" for a version the import created.

### 3.2 Editing a page

**The top of the page** shows the page's name and address, and four buttons: **Save
draft**, **Preview**, **Publish** and **History**. When a draft exists, there is also
**Discard changes**.

**Search engines.** The title is limited to 70 characters. The description is limited to
200, with a note that Google usually shows about 155.

**Sections.** Each section of the page appears in page order as a card. The card is
named after its block, followed by the section's heading if it has one, for example
"Pricing table — What each practice costs". Each field is drawn according to its type:

| Field type | Shown as |
|---|---|
| text | a one-line box with a counter, e.g. "23 / 40". It cannot go over the limit. |
| longtext | a multi-line box with a counter. |
| richtext (inline) | a formatting box with bold, italic and link. |
| richtext (full) | the same, plus bullet and numbered lists, subheadings, and table text with "add row" and "remove row". |
| select | a dropdown, for example a practice's diagram or a reason's icon. |
| link | an address box, with the rule shown: it must start with `/`, `#`, `https://` or `mailto:`. |
| date | a date picker. |
| list | its items, each with move up, move down and remove, and an **Add** button. Add and remove are disabled at the list's maximum and minimum. |
| group | a titled group of its fields. |
| anchor | not shown. Anchors connect menu links to sections, so the stored value is kept as it is. |

**Special field: CRM categories.** The contact form's option categories are stored as
anchor-type values, but they are not anchors. They are shown as a dropdown of the CRM
categories set in Settings (`leads.interestMap`), and are never free text.

**New list items and anchors.** A new list item that needs an anchor (a practice in the
service catalogue, a clause in a legal document) gets one made from its title: lowercase,
with dashes, and unique on the page. Existing items keep theirs, including when they are
moved.

**Pasting** keeps only the formatting a box allows: bold, italic, links, lists and
subheadings. Fonts, colours and anything else are dropped.

### 3.3 The buttons

- **Save draft** stores the page as it is in the form. Only admins can see the draft.
- **Preview** opens the page's real address in a new tab, showing the draft and any draft
  menu or footer. It looks exactly as visitors would see it.
- **Publish** makes the draft the live page. The live page never changes any other way.
- **History** lists every published version, newest first, with its date and publisher.
  **Restore** copies a version into the draft; the owner previews it and publishes it as
  usual.
- **Discard changes** deletes the draft. The page returns to its published version.

### 3.4 Menu & footer

Menu & footer use the same draft, preview and publish, and a change reaches every page at
once. The owner can edit:

| Area | What can be edited |
|---|---|
| Menu | the site name in the menu, and each link's words and address |
| Footer | the tagline (bold, italic, link), each column's heading and its links' words and addresses, the legal line, and the arcade button's text and its screen-reader label |
| Other labels | the "skip to content" link, the menu button's screen-reader label, and the intro's skip button |

A menu link can jump to a section of the current page instead of loading another page
(Services goes to the practices on the home page). That shortcut is kept while the
link's address is unchanged. When the address changes, the shortcut follows it: an
address ending in `#section` jumps to that section, and any other address has none.

Menu & footer have no History view. The Activity log records each published change with
its old and new values.

### 3.5 What is not editable

- adding, removing or reordering sections;
- new pages;
- page addresses and layouts;
- images;
- anchors;
- whether a page is hidden from search engines.

### 3.6 The old Site content tab

Once the switch is on, the Site content tab is hidden and Pages replaces it. Its saved
edits stay in the database.

## 4. How it works

### 4.1 Data

The part 1a tables are used as they are, plus one column.

- **Drafts.**
  - A page has at most one working draft: a `PageVersion` of kind `draft`.
  - Each save replaces it with a new row, so the draft's id changes on every save. The
    conflict check in §4.3 relies on that.
  - `createdById` is the admin who saved.
- **Publishing** runs in one transaction:
  1. create a `PageVersion` of kind `published`, holding the draft's blocks and search
     texts;
  2. point `Page.publishedVersionId` at it;
  3. copy the search texts into `Page.seoTitle` and `Page.seoDescription`;
  4. delete the draft.

  A published version is never changed.
- **New column.** `PageVersion.meta Json?` holds `{ seoTitle, seoDescription }` for that
  version. The imported versions have none; for them, the page's own columns stand in.
  The column is added with `prisma db push`, like the part 1a tables.
- **Restore** replaces the draft (or creates one) with a copy of the chosen version's
  blocks and search texts.
- **Menu & footer.**
  - The live values are the `SiteSetting` rows the import writes: `nav`, `footer` and
    `labels`.
  - A draft is one more row, `draft`, holding `{ nav, footer, labels }`.
  - Publishing copies it into the three live rows and deletes it.

### 4.2 Server

All routes sit under `/api/admin`, behind its existing admin-only guard.

| Route | What it does |
|---|---|
| `GET /pages` | Lists the pages: id, name, address, layout, when and by whom last published, whether a draft exists. |
| `GET /pages/:id` | Returns the page: its draft if there is one, otherwise its published version. That is the version id, the search texts and the blocks. |
| `PUT /pages/:id/draft` | Takes `{ baseVersionId, meta, blocks }`. Checks it and saves it as the new draft. Answers `200` with the new draft's id, `409` on a conflict, or `422` with `{ errors: [{ path, message }] }`. |
| `DELETE /pages/:id/draft` | Discards the draft. |
| `POST /pages/:id/publish` | Takes `{ baseVersionId }`. Publishes the current draft, which must be the one the admin loaded. |
| `GET /pages/:id/versions` | Lists the published versions. |
| `POST /pages/:id/versions/:versionId/restore` | Copies that version into the draft. |
| `GET /blocks` | Returns what the forms are built from: each block type's label and field definitions, the menu and footer field definitions, and the CRM category names. |
| `GET /site` | Returns the live menu and footer, and the draft if there is one. |
| `PUT /site/draft`, `DELETE /site/draft`, `POST /site/publish` | Save, discard and publish the menu and footer draft, with the same conflict rule as pages. |

The menu and footer fields are declared in a new `server/cms/site-fields.js`. It uses the
same field types and the same validator as the blocks.

### 4.3 Checks on every save

- **The page's structure cannot change.** It must keep the same blocks, with the same
  ids and types, in the same order. Items inside lists may be added, removed and moved.
- **Anchors.** Every anchor on a block, and on a list item that still exists, keeps its
  value. A new item's anchor is generated as described in §3.2, and must be unique on the
  page.
- **CRM categories.** Each contact form option's category must be one of the categories
  in Settings.
- **The blocks** pass the same validation as the import (`validatePage`): types, required
  fields, limits, list sizes and link formats.
- **The search texts** keep within 70 and 200 characters, and are required.
- **Rich text** is cleaned by the existing allow-list (`server/cms/richtext.js`) before it
  is stored. It is cleaned again when drawn, as today.
- **A value that is not a set of fields,** where one is expected, is refused. This is the
  part 1a rule: props must be objects.
- **Conflicts.** The client sends the id of the version it loaded. If the page's current
  draft, or its published version when there is no draft, has a different id, the save or
  publish is refused with `409`.

### 4.4 Preview

The page middleware already accepts `?__cms=1` and `?__cms=0` from a signed-in admin.
This part adds `?__cms=draft`:
- it draws the page's draft, or its published version if there is no draft;
- it uses the draft menu and footer if one exists;
- it is never cached, and is sent with `Cache-Control: no-store`;
- it works with the switch off, so the owner can check pages before switching on.

Anyone who is not an admin gets the normal page, as with `?__cms=1`.

### 4.5 The admin's front end

- **One new file,** `admin-pages.js`, loaded by `admin.html`. It is plain JavaScript,
  like the rest of the admin, with no new libraries.
- **One generic form builder** draws any block, and the menu and footer, from the field
  definitions in `GET /blocks`.
  - Each rich-text field declares its profile (`inline` or `full`), matching how its
    block draws it, so the box offers exactly the formatting that will survive.
  - The contact form's category field is marked as drawing its choices from the CRM
    categories.
- **The formatting box** uses the browser's built-in editing (`contenteditable`) with a
  small toolbar. On paste it keeps only the allowed formatting. The server's cleaning is
  the one that counts.
- **Leaving with unsaved changes** asks first. That covers the admin's own navigation and
  closing the tab.
- **A server error** (`422`) is shown on the field its `path` names, and the page scrolls
  to the first one.

### 4.6 Records and caching

- **Activity log.** Every save, discard, publish and restore is written to it with the
  page, the version and the admin. For menu and footer, the entry also holds the old and
  new values.
- **Caching.**
  - A published page reaches visitors within the page cache's existing 5-second version
    check.
  - Publishing the menu and footer clears the page cache (`cms.clear()`), because every
    cached page contains the menu and footer.

## 5. Errors and safety

| Situation | What happens |
|---|---|
| Invalid values | Refused by the form where it can, always by the server. The field is named, and nothing is saved until the whole page is valid. |
| A save or publish that fails (connection, server) | The form keeps everything typed and says it was not saved. |
| Another tab or admin saved in between | `409`, with a request to reload. Nothing is overwritten silently. |
| Database unreachable | The editor says so. Visitors get the pages from the files, as the part 1a fallback already does. |
| A non-admin, or no login | The API refuses, and preview shows the normal page. |

**Attack surface.**
- Text is escaped when drawn.
- Rich text passes the allow-list.
- Links are limited to `/`, `#`, `https://` and `mailto:`.
- The login cookie is httpOnly and `sameSite: strict`, which keeps other sites from
  posting to these routes as the admin.

## 6. Release

The runbook (`docs/superpowers/runbooks/cms-release.md`) is updated for this part. With
the switch still off:

1. **Merge.** Visitors notice nothing.
2. **`RUN_DB_PUSH=1`** creates the part 1a tables and the new column.
3. **`RUN_CMS_IMPORT=1`** copies the eight pages and the saved Site content edits into the
   database, once. From here on, Site content edits no longer reach these pages.
4. **Check.** The owner opens Pages and previews each page.
5. **Switch on.** Visitors get the database pages. They look the same, as the parity run
   has proven, except the page-not-found page, which takes the site's look. Site content
   is hidden.

**Rollback** is still one switch. Turning it off serves the files again: the content as
it was before the import. The editor's versions stay, so switching back on restores them.

## 7. Testing

**Server tests** (`node --test`, database stubbed as in `test/routes/webhooks.test.js`)
cover:
- save, discard, publish, history and restore;
- the structure rule and the validation errors with their paths;
- conflicts, and the search-text limits;
- menu and footer save and publish, including the page cache being cleared;
- `?__cms=draft` for an admin and for anyone else;
- non-admins being refused.

**Browser tests** run against the development server and database, in Chromium and
WebKit:
- open each of the eight pages in the editor, change one text in every section, and
  save;
- the preview shows the changes;
- publish, and the database page shows them;
- add, remove and move list items;
- an over-long text and a missing required text are refused, with the field named;
- a menu and footer change appears on every page;
- restore brings back an earlier version.

**Round trip.** For every page, opening it in the editor and saving without changes
stores exactly the blocks and search texts that were there. Publishing that draws the
same HTML. The editor can never alter content by accident.

**Parity.** `npm run cms:parity` passes as before (302/302 per browser) with the editor
in place. That proves the pages nobody edited are unchanged.

## 8. Not in this part

- rearranging, adding or removing sections, and new pages (drag-and-drop);
- images;
- the sitemap and the redirects for changed addresses (part 3);
- scheduled publishing;
- live presence or locking between admins, beyond the conflict check.
