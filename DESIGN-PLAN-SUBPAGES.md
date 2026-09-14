# Project Nidos — subpage pass, design plan

Branch: `redesign/subpages`, forked from `redesign/landing`.
Status: plan only. No page markup changed yet beyond the three shared fixes already committed
(zoom, glow blobs, section labels).

---

## 1. Architecture

### 1.1 The three stylesheets, after this pass

| File | Loaded by | Owns |
|---|---|---|
| `base.css` | all pages, first | reset, tokens, `@font-face`, type scale, header, footer, buttons, **plus the shared page vocabulary below** |
| `pages.css` | every redesigned subpage | page hero, practice detail, table of contents, process steps, pricing table, package cards, legal documents |
| `landing.css` | `index.html`, `index-en.html` | intro splash, landing hero, the six-cell index, why, contact form |
| `legacy.css` | whatever has not been redesigned yet | shrinks page by page, **deleted when the last one leaves** |

One `pages.css`, not a file per page. `digitalizacija` and `pricing` speak the landing's catalogue
vocabulary — practice, deliverables, price — so they share the rules that express it.

### 1.2 Moving out of `landing.css` into `base.css`

These are already written and already used by the landing; the subpages need the same ones, so they
move rather than get copied. Nothing is duplicated between the two sheets.

```
.wrap                     container, max-width, page padding
.label                    the quiet section label
.section-title            h2 scale, weight, tracking, measure
section { padding-block } the section rhythm
.card-scope / li::before  the dash list — 63 of these on digitalizacija alone
.card-link                quiet inline link with the hover rule
touch-target ::after      the 44px overlay helper
```

`base.css` gets a version bump when they land, on all pages.

### 1.3 What leaves each page

`digitalizacija.html` and `digitalization.html` carry **237 lines of inline `<style>`** each;
`pricing.html` and `pricing-en.html` carry **113**. All of it goes into `pages.css`, and the four
pages stop loading `legacy.css`. The four legal pages follow in the same commit — they need almost
nothing beyond the shared type rules.

That leaves `legacy.css` serving only `nidos/index.html`, `platform.html`, `about.html`,
`contact.html` and the two 404s. It is deleted when the EU-regulation product gets its own pass.

### 1.4 Motion

Scroll reveals are out, on the same rule as the landing. `.svc-row` currently carries `.reveal`, and
the six practice blocks do not exist until scrolled — which is why a static capture of this page
shows 9,900px of black with content at the top and bottom only.

That is an SEO and accessibility problem before it is a design one: the six practices are the page's
entire substance, and a crawler, a reader-mode parser, or anyone with JS off gets a page that appears
to have nothing in it. Content renders at full opacity on first paint; motion only answers a click,
a hover or a focus.

---

## 2. `digitalizacija.html` — the pattern page

### 2.1 What is actually on it

Audited, not assumed. Per practice, six times over:

| Piece | Example (CRM) |
|---|---|
| number | `01` |
| title (`h2`) | CRM ieviešana |
| outcome | Viena CRM sistēma un caurskatāma pārdošanas plūsma. |
| description | Project Nidos palīdz uzņēmumiem izvēlēties, konfigurēt un ieviest… |
| client problem | labelled block, "Klienta problēma" |
| scope | `h3` "Pakalpojuma apjoms" + **11 dash-list items** |
| starter package | `h3` "Ieteicamā sākuma pakotne" + name, description, licence note |
| price | `EUR 3 000` + "Tipiski projekti EUR 3 000–60 000 · bez PVN, licencēm un trešo pušu izmaksām" |

Plus a hero with a jump list, `#process` (four steps), `#kapec` (prose), `#kontakti` (links only —
**no form on this page**), and the footer.

**LV and EN are structurally identical**: 6 practice rows, 6 scope blocks, 6 package blocks, 63
dash-list items, 7 nav links, 4 process steps on each. The generator will have nothing to reconcile.

### 2.2 Heading hierarchy

Today: `h1` → `h2` (section) → `h2` (practice) → `h3` at 0.62rem uppercase tracked 0.14em. The `h3`s
are headings dressed as micro-labels, which is both the banned eyebrow and a lie to a screen reader
about what they are.

**They stay `h3` and get styled as labels** — sentence case, `--fs-label`, `--ink-3`. Demoting them
to `<p>` would fix the look and break the outline; "Pakalpojuma apjoms" genuinely does head a block
of content, so it should stay a heading and stop shouting. Result: `h1` → `h2` per practice → `h3`
per sub-block, sequential and honest.

### 2.3 The numbers, and the table of contents — keep both

On the landing I cut `01`–`06` because all six practices were visible at once, so a number restated
what the eye already had.

**Here the opposite is true.** The page is roughly 9,900px. A reader lands on `#ai` from a card on
the landing and has no idea whether that is the second practice or the last, or how much page is
left. The number encodes position in a long linear document, which is real information — the same
reason a long report numbers its sections and a short letter does not.

So: numbers stay on the practice blocks, and the jump list stays as a table of contents, **sentence
case, no orange, no arrows**. Its numbers match the ones on the blocks, which is what makes it a
wayfinding aid rather than decoration — you scan for `03` in the list and look for `03` on the page.

### 2.4 The missing CTA

Each practice currently ends at its price. There is no way to act on it without scrolling to the
bottom and losing which practice you were reading.

Every practice gets a primary CTA into the landing's contact form with the interest preselected:

| Anchor | CTA target (LV) | CTA target (EN) |
|---|---|---|
| `#crm` | `/?for=crm#contact` | `/index-en.html?for=crm#contact` |
| `#sales` | `/?for=pardosana#contact` | `/index-en.html?for=pardosana#contact` |
| `#support` | `/?for=klientu-apkalposana#contact` | `…?for=klientu-apkalposana#contact` |
| `#integrations` | `/?for=integracijas#contact` | `…?for=integracijas#contact` |
| `#ai` | `/?for=ai#contact` | `…?for=ai#contact` |
| `#commerce` | `/?for=e-komercija#contact` | `…?for=e-komercija#contact` |

The values are the landing form's existing `option` values, and `landing.js` already reads
`?for=` and preselects. Query before hash, or `window.location.search` is empty.

**One orange per viewport** still holds: a practice block is roughly a screen tall, so its CTA is the
only orange on screen while you are reading it. Prices become `--ink`, not orange.

### 2.5 Wireframes

```
@1440 — hero
┌────────────────────────────────────────────────────────────────────────┐
│ Project Nidos                          Pakalpojumi  Cenas  Kontakti    │
├────────────────────────────────────────────────────────────────────────┤
│  Atpakaļ uz sākumlapu                                    15px --ink-3  │
│                                                                        │
│  Uzņēmumu digitalizācija.                                    84px      │
│  Sešas prakses, viens partneris.              (no gradient, one ink)   │
│                                                                        │
│  ──────────────────────────────────────────────────────────────────    │
│  Šajā lapā                                                14px --ink-3 │
│  01 CRM ieviešana              04 Noliktavas vai grāmatvedības…        │
│  02 Pārdošanas procesu autom.  05 AI risinājums konkrētam procesam     │
│  03 Klientu apkalpošanas…      06 E-komercijas un maksājumu…           │
│     ^ two columns, sentence case, numbers in --ink-3, titles --ink-2   │
│     ^ hover: title -> --ink with a hairline under it                   │
└────────────────────────────────────────────────────────────────────────┘

@1440 — one practice block, ×6, each with id
┌────────────────────────────────────────────────────────────────────────┐
│ ────────────────────────────────────────────────────────────────────── │
│ 01                     Project Nidos palīdz uzņēmumiem izvēlēties,     │
│ 14px --ink-3           konfigurēt un ieviest CRM sistēmu, kas apvieno  │
│                        klientu datus, saziņu un pārdošanas darbu.      │
│ CRM ieviešana                                       17px --ink-2, 68ch │
│ 44px --ink  (h2)                                                       │
│                        Klienta problēma              14px --ink-3      │
│ Viena CRM sistēma un   Klientu dati un pārdošanas darbs ir izkaisīti…  │
│ caurskatāma            17px --ink-2                                    │
│ pārdošanas plūsma.                                                     │
│ 21px --ink  (outcome)  Pakalpojuma apjoms       14px --ink-3  (h3)     │
│                        – esošā pārdošanas procesa audits               │
│ ┌───────────────────┐  – CRM platformas izvēle                         │
│ │ Pieteikt sarunu   │  – klientu un uzņēmumu datu struktūra            │
│ └───────────────────┘  – … 11 items, 15px --ink-3, two columns         │
│  orange, ?for=crm                                                      │
│                        Ieteicamā sākuma pakotne 14px --ink-3  (h3)     │
│ sticky until the row   CRM Start                17px --ink             │
│ scrolls past           Līdz pieciem lietotājiem, viena pārdošanas…     │
│                        Licences nav iekļautas.  14px --ink-3           │
│                                                                        │
│                        EUR 3 000                17px --ink, tnum       │
│                        Tipiski projekti EUR 3 000–60 000 · bez PVN…    │
│                        14px --ink-3                                    │
└────────────────────────────────────────────────────────────────────────┘
  grid: minmax(0, 0.42fr) minmax(0, 0.58fr)
  left column sticky at top: 120px so the practice you are reading stays
  named while you move through eleven scope items
  one hairline above each block, none below the last

@390 — same block, stacked, nothing sticky
┌──────────────────────────────┐
│ ───────────────────────────  │
│ 01                           │
│ CRM ieviešana          32px  │
│ Viena CRM sistēma un   18px  │
│ caurskatāma pārdošanas plūsma│
│                              │
│ Project Nidos palīdz…  17px  │
│                              │
│ Klienta problēma       14px  │
│ Klientu dati un…       17px  │
│                              │
│ Pakalpojuma apjoms     14px  │
│ – esošā pārdošanas…    15px  │
│ – … one column               │
│                              │
│ Ieteicamā sākuma pakotne     │
│ CRM Start                    │
│ Līdz pieciem lietotājiem…    │
│ Licences nav iekļautas.      │
│                              │
│ EUR 3 000              17px  │
│ Tipiski projekti…      14px  │
│                              │
│ ┌──────────────────────────┐ │
│ │    Pieteikt sarunu       │ │  full width, 48px
│ └──────────────────────────┘ │
└──────────────────────────────┘
  CTA moves to the end on mobile: you read, then you act

@1440 — process, why, contact
┌────────────────────────────────────────────────────────────────────────┐
│ Kā mēs strādājam                                                       │
│ Izpēte. Ieviešana. Uzturēšana. Mērogošana.              52px           │
│                                                                        │
│  01 Izpēte        02 Ieviešana      03 Uzturēšana    04 Mērogošana     │
│  ────────────     ────────────      ────────────     ────────────      │
│  17px --ink-2 under each, four columns, one hairline above each        │
│  (a real sequence — these ARE steps, unlike the six practices)         │
├────────────────────────────────────────────────────────────────────────┤
│ Kāpēc Project Nidos                                                    │
│ No pirmās sarunas līdz strādājošai sistēmai.            52px           │
│                    prose at 62ch, offset right, no rules               │
├────────────────────────────────────────────────────────────────────────┤
│ ░░░░░░░░░░░░░░░░░░░░  #0a0a0a  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ Kontakti                                                               │
│ Sākam sarunu par digitalizāciju.                        52px           │
│ Pastāstiet, kur sāp                                     21px --ink-2   │
│                                                                        │
│ support@projectnidos.eu     ┌────────────────────┐                     │
│ 21px --ink                  │  Pieteikt sarunu   │  orange, -> /#contact│
│                             └────────────────────┘                     │
│ Visas prakses   Cenas       15px, quiet links                          │
└────────────────────────────────────────────────────────────────────────┘
  This section has no form and is not getting one — the landing owns the
  form, and two forms posting the same webhook is a maintenance trap.
```

### 2.6 LV / EN

Same machinery as the landing, which is already proven:

```
site/digitalizacija.template.html
site/digi.lv.json   site/digi.en.json
scripts/build-digitalizacija.js      (+ --check, wired into npm)
```

The same structural assertions: identical key sets, six practices, matching practice keys, matching
scope-bullet counts per practice, matching `data-cms` keys on both rendered pages. The two pages are
already structurally identical, so the first build should be a straight translation of what is there.

`build:pages` and `check:pages` run both generators; `check:pages` goes in the deploy ritual beside
`check:landing`.

**CMS keys:** both pages currently expose only `meta.title` and `meta.description`. The practice
titles, outcomes, descriptions and prices are not editable. I am **not** adding keys here in this
pass — it would be another 40+, and the client has not asked to edit this page. Flagged as a
decision, not taken.

---

## 3. `pricing.html` / `pricing-en.html`

**The table stays.** It is the best thing on the site: six practices, a "sākot no" column and a
"tipiskais diapazons" column, aligned and comparable. It is what the landing index used to be.

Changes:

1. **Per-practice anchors** — `id="crm"` … `id="commerce"` on the six table rows, matching the
   digitalizacija anchors exactly. This is what unblocks the landing's `Skatīt cenas` becoming
   row-level, as agreed: each card links to its own price row rather than to the top of a list.
2. **One orange.** Today every price in the table is orange, every package amount is orange, and the
   hourly rates are orange — roughly 20 oranges per screen. Prices become `--ink` with tabular
   figures; orange is left for the single "Pieteikt 20 minūšu sarunu" button at the foot.
3. **Package cards** lose their 0.62rem uppercase tracked labels and their 4px radius, and join the
   hairline-lattice treatment the landing index uses.
4. Inline `<style>` moves to `pages.css`; the page stops loading `legacy.css`.

```
@1440 — the catalogue table, essentially unchanged in structure
┌────────────────────────────────────────────────────────────────────────┐
│ Prakse                          Sākot no        Tipiskais diapazons    │
│ ────────────────────────────────────────────────────────────────────── │
│ CRM ieviešana            #crm   no EUR 3 000    EUR 3 000–60 000       │
│ Pārdošanas procesu…      #sales no EUR 4 000    EUR 4 000–70 000       │
│ …                                                                      │
│  headers: 14px --ink-3 sentence case (a table header, not an eyebrow)  │
│  prices: 17px --ink, tabular figures, right-aligned                    │
└────────────────────────────────────────────────────────────────────────┘

@390 — the table becomes a stack; each row keeps its anchor
┌──────────────────────────────┐
│ CRM ieviešana                │
│ no EUR 3 000                 │
│ EUR 3 000–60 000   14px      │
│ ───────────────────────────  │
└──────────────────────────────┘
```

---

## 4. The four legal pages

Typographic pass only, **current wording untouched**. `privacy`, `terms`, `gdpr`, `cookie-policy` are
plain documents and should read like documents: one column at 68ch, a clear `h2`/`h3` scale, list
spacing that survives long Latvian sentences, and the inline `style="color:var(--primary-color)"`
attributes on links replaced with a rule.

```
@1440
┌────────────────────────────────────────────────────────────────────────┐
│  Juridiski                                              14px --ink-3   │
│  Privātuma politika                                     52px           │
│  Spēkā no 2026. gada …                                  15px --ink-3   │
│                                                                        │
│      1. Kas mēs esam                                    26px           │
│      Project Nidos ir …                                 17px, 68ch     │
│      ────────────────────────────────────────────                      │
│      2. Kādus datus mēs apstrādājam                                    │
│      …                                                                 │
│  ^ single column, indented to column 3 of 12, no sidebar, no cards     │
└────────────────────────────────────────────────────────────────────────┘
```

The privacy and cookie wording correction (fonts no longer loading from Google) lands **as its own
commit after client sign-off** — this pass does not wait on it and does not touch those paragraphs.

---

## 5. Out of scope

`nidos/index.html`, `platform.html`, `about.html`, `contact.html` — the EU Nature Restoration
product. Hygiene only, already done. The emoji iconography (📡 📊 🔍 📄 🔐 🔄) **stays**: it is the
client's copy, not a style choice of ours to overrule. It goes in the client follow-up note instead.

The two 404 pages keep their current minimal treatment.

---

## 6. Verification

Per page, the same floor the landing had to clear:

- 320 → 1920, no horizontal overflow at any width
- one `h1`, sequential headings, anchors landing clear of the fixed nav
- every touch target ≥ 44px, form inputs ≥ 16px
- **content present in a static capture and with JS disabled** — the specific regression this pass exists to fix
- `prefers-reduced-motion` respected
- Lighthouse on the two heaviest pages, mobile and desktop
- before/after screenshots at 390 and 1280 for all 14, reflow breakage listed
- `check:landing` and `check:pages` both green

## 7. Commit shape

Page-scoped, so the rebase onto `main` after `redesign/landing` merges stays clean:

```
1  refactor(css): move the shared page vocabulary into base.css
2  feat(digitalizacija): rebuild from one template, two content files
3  feat(pricing): per-practice anchors, one orange, table kept
4  feat(landing): Skatīt cenas becomes row-level      <- depends on 3
5  style(legal): typographic pass on the four policy pages
6  chore(css): retire legacy.css from the redesigned pages
```

Commit 4 touches the landing, so it is the one to watch in the rebase.

---

## 8. Self-critique

| Decision | Would I do this for any B2B page? | Resolution |
|---|---|---|
| **Numbers on practices** | I removed them on the landing for good reasons, so keeping them here looks like inconsistency. | It is not. On the landing all six were on screen at once, so a number restated what the eye had. Here the page is 9,900px and a reader arrives mid-document from a card — the number says where they are. Same content, different job, because the context differs. If the built page turns out shorter than about three viewports, the numbers lose their argument and should go. |
| **Table of contents** | A jump list at the top of a long page is utterly standard. | Kept, precisely because it is standard — it is wayfinding, not decoration. What changes is the surface: sentence case, no orange, no arrows, two columns so it reads as an index rather than a menu. |
| **Sticky left column** | Sticky side panels are an agency staple. | Kept for one specific reason: the scope list runs to eleven items, and without it you can be four screens into a list with no idea which practice it belongs to. It sticks only within its own row and releases at the next. If the built page shows the scope lists are shorter than a viewport, it is unnecessary and comes out. |
| **Per-practice CTA** | Six CTAs on one page reads as pushy. | They are six *different* actions — each preselects a different interest in the form. The alternative is one CTA at the foot of a 9,900px page, which asks the reader to remember which practice they wanted. That is the pushier design, it just looks calmer. |
| **Practice detail layout** | Two columns, heading left, content right — generic. | Kept, because the content genuinely has two registers: identity (number, title, outcome) and detail (problem, scope, package, price). What stops it reading as a template is that the left column is *short* and stays put while a long right column moves. |
| **Pricing table** | A comparison table is the obvious answer. | And it is the right one. Not redesigning it is the decision; it earns its structure. Only the colour discipline changes. |
| **Legal pages** | A single measured column is what every policy page does. | Correct, and anything else would be worse. The only real decision is the measure and the heading scale. |

**Anti-template check:** no cards with soft shadows, no gradient text (the hero's goes), no
glassmorphism, no glow blobs (already gone), no scroll reveals, no tracked-caps eyebrows (already
gone site-wide), no arrows appended to links, no emoji added, radius 0, one shadow style (none),
orange reserved for one action per viewport, and every rule on the page bounds something real — the
practice blocks, the table rows, the process steps.

---

*Plan ends here. Nothing built yet — awaiting go.*
