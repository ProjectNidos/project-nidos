# Project Nidos — landing page redesign, Phase 1 design plan

Status: approved. Step 0 (foundation) in progress; landing build follows.
Scope: `index.html` (LV, served at `/`) and `index-en.html` (EN). `index-lv.html` becomes a 301 to `/`.
Step 0 additionally touches the link tags and fonts of all 16 pages — see §11.

---

## 0. The idea in one paragraph

The page currently decorates. It has four blurred glow blobs, two animated particle canvases, gradient text in the H1 and eleven blur filters — and it hides its own product, the six priced practices, behind a scroll-pinned stepper that shows one at a time. The redesign spends nothing on decoration and everything on one thing: **a practices index where all six offers and all six prices are visible at once, aligned in a single price column, so a buyer can compare them without moving.** Everything else on the page gets quieter to pay for it.

---

## 1. Tokens

### 1.1 Colour — existing palette, roles reassigned

No new hues. `#050505` stays as the ground. One value changes for contrast, one is deleted.

| Token | Value | Role | On `#050505` |
|---|---|---|---|
| `--ground` | `#050505` | Page background, and text on orange | — |
| `--ground-alt` | `#0a0a0a` | The contact band only | — |
| `--ink` | `#f4f4f5` | Headings, practice titles, prices, form input text | **18.54:1** |
| `--ink-2` | `#a1a1aa` | Body prose, the H1's second line, bullets | **7.95:1** |
| `--ink-3` | `#7a7a84` | Labels, footer legal, form hints | **4.80:1** |
| `--accent` | `#ff5f1f` | Primary button fill, focus ring, hover underline. Nothing else. | 6.71:1 |
| `--accent-hover` | `#ff8554` | Primary button hover fill only | — |
| `--rule` | `rgba(255,255,255,0.14)` | General hairlines | 1.38:1 (decorative) |
| `--rule-strong` | `rgba(255,255,255,0.22)` | The practices index rules | 1.85:1 (decorative) |

**Changed:** `--text-muted` `#71717a` → `--ink-3` `#7a7a84`. The current value is **4.22:1**, below AA for body text, and it is used 13 times. `#7a7a84` measures **4.80:1** on `#050505` and **4.66:1** on `#0a0a0a`, and stays inside the zinc ramp (R=G, B+10).

**Deleted:** `#ff9e00`, which existed only as the middle stop of the H1 gradient. The gradient goes; the amber goes with it.

**Deleted tokens:** `--bg-card`, `--bg-card-hover` (no cards), `--bg-header` (no translucent nav), `--primary-glow` (no glows), `--grid-line`, `--border-hover`, `--radius-sm/md/lg/xl/pill` (see 1.4).

**Orange has exactly one job.** Primary button fill, its hover, and the focus ring. Prices are `--ink`, headings are `--ink`. This is the discipline that stops near-black-plus-orange reading as a template: the accent appears three or four times on the whole page, not thirty.

**On hairlines:** at 1.38:1 and 1.85:1 the rules are below the 3:1 non-text threshold. They are decorative separators — every boundary they mark is also carried by whitespace and by the grid alignment, so no information depends on seeing them. Raising them further would turn a quiet index into a wireframe.

### 1.2 Type — Archivo, one family, one file

**Archivo** (Omnibus-Type, OFL). Self-hosted, subset to Latin + Latin Extended-A, variable weight axis 400–700.

- **One file, 31.5 KB woff2.** 329 glyphs. Latvian coverage verified by glyph lookup and by rendering: `Āā Čč Ēē Ģģ Īī Ķķ Ļļ Ņņ Šš Ūū Žž` all present and correctly drawn (comma-below on ģ ķ ļ ņ, not cedilla).
- **Why Archivo over the alternatives I tested.** I subset and rendered Archivo, Libre Franklin and Instrument Sans at display and body sizes on the real Latvian copy. Libre Franklin has the most character but runs wide — "Noliktavas un Grāmatvedības Integrācija" costs noticeably more line on every practice row. Instrument Sans is the most neutral and reads as a current default. Archivo is economical enough for long Latvian compounds, has real presence at 84px, and carries tabular figures for the price column.
- **Width axis rejected.** Archivo has a `wdth` axis, and a slightly expanded display cut was tempting. Keeping it costs **73.8 KB instead of 31.5 KB** — 42 KB for a refinement no reader could name. Declined. Distinctiveness comes from scale contrast and structure instead.
- **Tabular figures** (`font-variant-numeric: tabular-nums`) on the price column only. This is the one place a type feature encodes something real: six prices in a column that must align to be compared.
- Banned families avoided: no Inter, Roboto, Poppins, Montserrat, Space Grotesk, Outfit, no Playfair pairing. No second family — a display serif here would read as agency-template pairing.

**Fallback, metrically matched** (measured from the font, not guessed): Archivo `unitsPerEm` 1000, hhea ascent 878, descent −210, lineGap 0, avg lowercase advance 52.0% of em vs Arial's ~50.9%.

```css
@font-face {              /* real face */
  font-family: 'Archivo'; src: url('/assets/fonts/archivo-lat.woff2') format('woff2');
  font-weight: 400 700; font-display: swap;
  unicode-range: U+0000-00FF, U+0100-017F, U+2013-2014, U+2018-201E, U+2026, U+20AC, U+2212;
}
@font-face {              /* size-matched fallback — prevents reflow on swap */
  font-family: 'Archivo Fallback'; src: local('Arial');
  ascent-override: 87.8%; descent-override: 21.0%; line-gap-override: 0%; size-adjust: 102%;
}
--font: 'Archivo', 'Archivo Fallback', Arial, sans-serif;
```

### 1.3 Type scale

Base 16px. Body 17px, inside the 16–18 band. Fluid via `clamp()`; endpoint values are what actually renders at 390 and 1440.

| Role | `clamp()` | @390 | @1440 | Weight | Line-height | Tracking |
|---|---|---|---|---|---|---|
| Display (H1) | `clamp(2.75rem, 7.4vw, 5.25rem)` | 44px | 84px | 500 | 0.98 | −0.028em |
| Section H2 | `clamp(2rem, 4.4vw, 3.25rem)` | 32px | 52px | 500 | 1.02 | −0.022em |
| Practice title (H3) | `clamp(1.375rem, 2.1vw, 1.875rem)` | 22px | 30px | 500 | 1.12 | −0.012em |
| Conviction claim | `clamp(1.25rem, 1.9vw, 1.625rem)` | 20px | 26px | 500 | 1.2 | −0.01em |
| Lead / problem→result | `clamp(1.125rem, 1.4vw, 1.3125rem)` | 18px | 21px | 400 | 1.45 | 0 |
| Body | `1.0625rem` | 17px | 17px | 400 | 1.55 | 0 |
| Price | `1.0625rem` | 17px | 17px | 500 | 1.3 | 0 (tnum) |
| Bullets, meta, footer | `0.9375rem` | 15px | 15px | 400 | 1.5 | 0 |
| Label | `0.875rem` | 14px | 14px | 500 | 1.35 | +0.01em |
| Form input | `1.0625rem` | 17px | 17px | 400 | 1.4 | 0 |

Form inputs are 17px so iOS does not zoom on focus. **No tracked-out uppercase anywhere** — labels are sentence case at +0.01em, which is a nudge, not a device. Measure capped at 62ch for prose, 48ch for the problem→result line inside a practice row.

### 1.4 Spacing, grid, radius, shadow

- **Spacing scale** (4/8 based): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128px as `--s1`…`--s10`.
- **Section rhythm:** `padding-block: clamp(64px, 9vw, 128px)`. One rule, one place, no per-section overrides. Content max-width 1360px; page side padding `clamp(20px, 4vw, 56px)`.
- **Grid:** 12 columns at ≥1024px, gutter `clamp(16px, 3vw, 48px)`. Single column below 768px.
- **Radius: `0`. Everywhere. No exceptions.** Not "one small value" — zero is a decision, one arbitrary radius is a habit. Rectangular fields and rules read as precise, which is what a fixed-scope implementer should look like. This replaces five declared radius tokens.
- **Shadow: none. Zero shadow styles on the page.** See 4.3 for why the existing hard-offset button shadow is killed rather than kept.

### 1.5 Rules — the discipline that keeps this off the broadsheet template

Radius 0 + zero shadows + hairline rules + near-black + one accent is itself a recognisable cluster. The palette is fixed, so the defence is **rationing the rules**:

| Section | Rules? | Separated by |
|---|---|---|
| Practices index | **Yes** — one above every row, one below the last | The rules *are* the structure: they bound six comparable entries and align the price column |
| Nav | One hairline, and only once scrolled past the hero | Marks a real state change |
| Footer | One above the footer, one above the legal line | Marks the end of content and the start of fine print |
| **About** | **No** | Space and the column offset |
| **Why** | **No** | Space and type scale |
| **Contact** | **No** | The `#0a0a0a` band, which is the only device it needs |
| Form fields | One per field, bottom only | A field boundary is real; four sides would be a box |

If a section can be separated by space, it is separated by space. A rule has to be carrying information or it does not get drawn.

---

## 2. Sections

Seven blocks, each with its own skeleton. No two share a layout.

### 2.1 Nav — a rule, not a bar

No backdrop blur, no translucency, no scroll-shrink. A hairline appears under the nav once the page has scrolled past the hero, driven by a 1px sentinel and an IntersectionObserver (no scroll handler).

```
@1440
┌────────────────────────────────────────────────────────────────────────┐
│ Project Nidos        Pakalpojumi   Cenas   Par mums   Kontakti   LV EN │
└────────────────────────────────────────────────────────────────────────┘
   ^ 15px, --ink                          ^ 15px --ink-2, --ink on hover

@390   — no hamburger, no JS drawer
┌──────────────────────────────┐
│ Project Nidos    Kontakti LV │
└──────────────────────────────┘
```

At ≤720px the nav carries the logo, one link (Kontakti) and the language switch. The full link set lives in the footer, and the page is a short linear document with anchors — a JS drawer would be 2 KB and a focus trap to reach four links that are already on screen within one scroll.

### 2.2 Hero — one statement

Both H1 lines are `--ink`. `hero.titleAccent` is the second line of the same sentence in the same colour — no tonal step, no accent treatment. **Nothing replaces the deleted gradient**: the line break is the only device, and the headline is one statement rather than a claim plus a decorated qualifier. This is the quieter option and it removes a device rather than substituting one.

```
@1440
┌────────────────────────────────────────────────────────────────────────┐
│                                                                        │
│                                                                        │
│  Uzņēmumu digitalizācija.                                84px/0.98     │
│  No idejas līdz sistēmai.                                --ink, same   │
│                                                                        │
│                                                                        │
│  ┌──────────────────┐    Project Nidos palīdz uzņēmumiem pāriet no     │
│  │  Pieteikt sarunu │    izklājlapām uz sistēmām, kas darbina biznesu  │
│  └──────────────────┘    — CRM, automatizācija, integrācijas un AI     │
│    orange fill            no problēmas līdz izmērāmam rezultātam, ar   │
│    #050505 text           fiksētu apjomu un cenu.          21px, 62ch  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
   CTA and lede sit on a shared baseline. No scroll cue, no down arrow.

@390
┌──────────────────────────────┐
│                              │
│  Uzņēmumu                    │  44px/0.98
│  digitalizācija.             │
│  No idejas līdz              │  --ink, same
│  sistēmai.                   │
│                              │
│  Project Nidos palīdz        │  18px
│  uzņēmumiem pāriet no        │
│  izklājlapām uz sistēmām…    │
│                              │
│  ┌────────────────────────┐  │  full-width, 48px tall
│  │   Pieteikt sarunu      │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

Removed here: both `.glow` blobs, the `.hero-net` particle canvas, the `↓ Pakalpojumi` scroll cue, and the secondary "Skatīt pakalpojumus →" link (the nav already goes there).

### 2.3 Practices — the index. **This is the bold element.**

All six visible. Full opacity, all of them, always. No pinning, no stepper, no images, no `01/06` counter, no numbering.

**Why no index numbers.** The obvious move is `01`–`06` down the left edge. I am not doing it: the six practices are a catalogue, not a sequence — their order is arbitrary, so a number would encode nothing. The heading already says "Sešas". Numbering would restate the count and add a device that reads as generated. The structure is carried by the rules, the aligned price column, and the type scale.

**Rows, not a `<table>`.** Each entry is a title, a problem→result sentence, four scope bullets, a price and a link. That is a catalogue entry, not a matrix of comparable cells — a real `<table>` would misdescribe it to a screen reader and fight the responsive stack. Markup is a `<ul>` of `<li>`; CSS Grid gives the price its own column so prices align in a true column, which is the part the buyer needs.

```
@1440
┌────────────────────────────────────────────────────────────────────────┐
│ Mūsu pakalpojumi                                          14px --ink-3 │
│ Sešas prakses. Viens ieviešanas partneris.                52px         │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│ CRM Ieviešana                  · Pārdošanas procesa      no EUR 3 000  │
│ 30px --ink                       audits un platformas    17px tnum ink │
│                                  izvēle                                │
│ Klientu dati un pārdošanas     · Pipeline, lauki un      Eiropas       │
│ darbs ir izkaisīti pa dažādām    lietotāju tiesības      tirgum,       │
│ vietām. Rezultāts — viena      · E-pasta, kalendāra un   bez PVN       │
│ CRM sistēma un caurskatāms       formu integrācijas      14px --ink-3  │
│ pārdošanas process.            · Datu imports, apmācība,               │
│ 21px --ink-2, 48ch               dokumentācija           Uzzināt vairāk│
│                                  15px --ink-3            15px, hover:  │
│                                                          orange rule   │
├────────────────────────────────────────────────────────────────────────┤
│ Pārdošanas Procesu Automatizācija        …               no EUR 3 000  │
├────────────────────────────────────────────────────────────────────────┤
│ Klientu Apkalpošanas Automatizācija      …               no EUR 3 000  │
├────────────────────────────────────────────────────────────────────────┤
│ Noliktavas un Grāmatvedības Integrācija  …               no EUR 3 000  │
├────────────────────────────────────────────────────────────────────────┤
│ AI Konkrētam Procesam                    …               no EUR 3 000  │
├────────────────────────────────────────────────────────────────────────┤
│ E-komercijas un Maksājumu Integrācija    …               no EUR 3 000  │
└────────────────────────────────────────────────────────────────────────┘
  grid-template-columns: minmax(0,1.15fr) minmax(0,0.85fr) 200px
  rules: --rule-strong, above every row and below the last

@390   — one column; price sits directly under the title, before the prose,
         so it is never more than a thumb-flick from the name it belongs to.
┌──────────────────────────────┐
│ Mūsu pakalpojumi             │
│ Sešas prakses.               │  32px
│ Viens ieviešanas partneris.  │
├──────────────────────────────┤
│ CRM Ieviešana                │  22px
│ no EUR 3 000                 │  17px tnum
│ Eiropas tirgum, bez PVN      │  14px --ink-3
│                              │
│ Klientu dati un pārdošanas   │  18px --ink-2
│ darbs ir izkaisīti…          │
│                              │
│ · Pārdošanas procesa audits  │  15px --ink-3
│ · Pipeline, lauki un…        │
│ · E-pasta, kalendāra un…     │
│ · Datu imports, apmācība…    │
│                              │
│ Uzzināt vairāk               │  15px, 44px tap target
├──────────────────────────────┤
│ … ×5 more                    │
└──────────────────────────────┘
```

Estimated desktop height ≈ 6 × 170px + header ≈ 1 150px — a shade over one viewport, scannable in one movement. Against the current design, which spends roughly three viewport-heights of pinned scroll to show the same six.

### 2.4 About — prose, offset

Different skeleton from everything else: a wide heading, then a single column of prose set at 62ch and **indented to the 5th column**, so the section reads as a page of text rather than a layout. No image.

```
@1440
┌────────────────────────────────────────────────────────────────────────┐
│ Par mums                                                  14px --ink-3 │
│ No pirmās sarunas līdz strādājošai sistēmai.              52px         │
│                                                                        │
│                        ┌─────────────────────────────────────────────┐ │
│                        │ Ieviešam digitalizāciju, kas strādā.  26px  │ │
│                        │                                             │ │
│                        │ Mēs neaizejam pēc prezentācijas. Mēs        │ │
│                        │ paliekam, līdz sistēma strādā — CRM ievieš  │ │
│                        │ kārtību pārdošanā, ERP savieno procesus,    │ │
│                        │ un atskaites ģenerējas automātiski. Mūsu    │ │
│                        │ komandu vada sistēmarhitekti ar pieredzi    │ │
│                        │ lielos ieviešanas projektos.  17px, 62ch    │ │
│                        └─────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
  offset: grid-column 5 / -1

@390   — offset collapses, prose runs full width
┌──────────────────────────────┐
│ Par mums                     │
│ No pirmās sarunas līdz       │  32px
│ strādājošai sistēmai.        │
│                              │
│ Ieviešam digitalizāciju,     │  20px
│ kas strādā.                  │
│                              │
│ Mēs neaizejam pēc            │  17px
│ prezentācijas…               │
└──────────────────────────────┘
```

The "Project Nidos" card-label above the sub-heading is removed — it labels a block on a page that is entirely about Project Nidos.

### 2.5 Why — three statements, run-in, no rules

Deliberately the **least structured** block on the page, because it sits directly after the most structured one. No rules, no columns, no cards, no numbers: three claims stacked with air, each with its support line running in beneath it in `--ink-2`.

```
@1440
┌────────────────────────────────────────────────────────────────────────┐
│ Kāpēc mēs                                                 14px --ink-3 │
│ Trīs iemesli, kāpēc uzņēmumi izvēlas mūs.                 52px         │
│                                                                        │
│     Viens partneris visam ciklam                          26px --ink   │
│     No idejas līdz uzturēšanai                            17px --ink-2 │
│                                          ← 48px space                  │
│     Programmatūra, nevis PowerPoint                                    │
│     Mēs piegādājam strādājošas sistēmas                                │
│                                                                        │
│     Projektu var līdzfinansēt                                          │
│     Zinām, kuras ES digitalizācijas programmas ir aktuālas             │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
  a single column at grid-column 3 / 10 — narrower than the page,
  so the block reads as a held breath between two wide sections.

@390   — same, full width, 32px between statements
```

### 2.6 Contact — the only tonal band

The one section on `--ground-alt` `#0a0a0a`. That single value shift is the whole device; it needs no heading rule, no border, no card. **No rules in this section.**

**Three pieces of invitation copy now live here** and must not stack as three equal invitations. The hierarchy, largest to smallest:

1. **`contact.heading` — "Sākam sarunu."** at 52px. It leads. It is the section heading and it has to.
2. **The relocated `.closing-cta` line** — "Nezināt, ar ko sākt? Sāciet ar bezmaksas 20 minūšu sarunu." — at 21px (lead size), directly under the heading, spanning the left column. This is the offer, and it sits second because it is the strongest *content* but not the section's name.
3. **`contact.infoBody` — "Pastāstiet, kāds ir jūsu digitalizācijas mērķis, un mēs piedāvāsim risinājumu."** demoted to 17px body, staying exactly where it already is structurally (inside `.contact-info`, under `contact.infoHeading`). At that size and position it reads as an instruction for the form rather than a third invitation.

Nothing is deleted and no word changes. `contact.overline` renders as a plain sentence-case label, not a tracked eyebrow.

```
@1440
┌────────────────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░  #0a0a0a  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ Kontakti                                    14px --ink-3, sentence case│
│ Sākam sarunu.                               52px --ink   [1] LEADS     │
│                                                                        │
│ Nezināt, ar ko sākt? Sāciet ar bezmaksas 20 minūšu sarunu.             │
│ 21px --ink-2, relocated verbatim from .closing-cta        [2]          │
│                                                                        │
│  Kontaktinformācija  14px      ┌───────────────────────────────────┐   │
│  --ink-3   (infoHeading)       │ Vārds, uzvārds   │ E-pasts        │   │
│                                │ ────────────────── ──────────────  │   │
│  Pastāstiet, kāds ir jūsu      │                                   │   │
│  digitalizācijas mērķis, un    │ Mani interesē                     │   │
│  mēs piedāvāsim risinājumu.    │ ─────────────────────────────── ▾ │   │
│  17px --ink-2  (infoBody) [3]  │                                   │   │
│                                │ Ziņojums                          │   │
│  Digitalizācija &              │ ───────────────────────────────   │   │
│  Konsultācijas   14px --ink-3  │                                   │   │
│  support@projectnidos.eu       │ ┌─────────────────┐               │   │
│  21px --ink, --ink underline   │ │ Nosūtīt ziņojumu│  orange fill  │   │
│  on hover (never orange)       │ └─────────────────┘  #050505 text │   │
│                                └───────────────────────────────────┘   │
│                                  inputs: bottom rule only, radius 0,   │
│                                  17px text, 48px tall, no box fill     │
└────────────────────────────────────────────────────────────────────────┘

@390   — same order, single column: heading → relocated offer → info block
         (infoHeading, infoBody, email) → form, fields full width
┌──────────────────────────────┐
│ Kontakti                     │
│ Sākam sarunu.                │  32px      [1]
│                              │
│ Nezināt, ar ko sākt? Sāciet  │  18px      [2]
│ ar bezmaksas 20 minūšu       │
│ sarunu.                      │
│                              │
│ Kontaktinformācija           │  14px
│ Pastāstiet, kāds ir jūsu     │  17px      [3]
│ digitalizācijas mērķis…      │
│ support@projectnidos.eu      │  21px
│                              │
│ Vārds, uzvārds               │
│ ──────────────────────────   │
│ …                            │
│ ┌──────────────────────────┐ │
│ │    Nosūtīt ziņojumu      │ │  orange fill, 48px
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

Fields are underlined, not boxed: one rule per field instead of four, and it keeps the form from reading as a card kit. Error messages appear under the field they belong to, in `--accent`, announced through a single `aria-live="polite"` region.

### 2.7 Footer — quiet, and the arcade placed on purpose

```
@1440
┌────────────────────────────────────────────────────────────────────────┐
│ ────────────────────────────────────────────────────────────────────── │
│ Project Nidos            Pakalpojumi            Juridiski              │
│ Ieviešanas partneris     Visas sešas prakses    Privātuma politika     │
│ uzņēmumiem.              Cenas                  Lietošanas noteikumi   │
│ Sešas prakses.                                  Sīkdatņu politika      │
│ Fiksēts apjoms.                                 VDAR                   │
│                                                                        │
│                                                      Iemet monētu  ←── │
│ ────────────────────────────────────────────────────────────────────── │
│ © 2026 Project Nidos. Visas tiesības aizsargātas. SIA Project Nidos,   │
│ reģ. nr. 40203751563, PVN LV40203751563, Rīga, Paula Lejiņa iela 4-42, │
│ LV-1029.                                     15px --ink-3, verbatim    │
└────────────────────────────────────────────────────────────────────────┘
```

The arcade button gets **its own row**, right-aligned, above the legal rule — out of the registration line where it currently sits by accident. Text button, `--ink-3`, orange underline on hover, keeps its `aria-label`. It is the one human fingerprint on the page and it earns the deliberate placement.

---

## 3. The handoff — first 800 ms

The constraint is: arrive out of the black frame with no flash of colour, no layout shift, no pop-in, and skipping must land where watching lands.

**The structural change that makes this true:** the hero no longer animates in at all. Today `<main>` carries `.intro-active` (a transform and opacity) which is removed at handoff, so the page *moves* as the splash clears. In the redesign the hero is laid out and painted at full opacity underneath the splash from first paint. The splash simply dissolves to reveal a finished page. Nothing to pop in, nothing to shift.

Video black is `#000`, the page ground is `#050505` — a 5/255 step, imperceptible, and no colour is ever between them.

```
t=0      finishIntro()
         · sessionStorage pn_intro_seen = 1
         · .intro-screen  opacity 1 → 0   360ms cubic-bezier(.4,0,.2,1)
         · <html> loses .intro-lock       (scroll unlocked)
         · window.scrollTo(0, 0)
         · hero: already painted, full opacity, final position — no transition

t=200ms  nav opacity 0 → 1, 240ms
         The single orchestrated beat. One element, once, in response to nothing.

t=360ms  .intro-screen → display:none, removed from the a11y tree

t=440ms  settled. Nothing else on the page animates until a user acts.
```

Removed from `finishIntro`: the Lenis restart and `setTimeout(initScrollAnimations, 800)` — both go with the libraries they drove, per the allowed-edit list.

**Reduced motion** (`prefers-reduced-motion: reduce`): no video is fetched and no splash is shown. `pn_intro_seen` is set, the intro screen is never mounted, the nav is visible at first paint. Identical end state, reached at t=0.

**Return visit in-session** (`pn_intro_seen` already set): unchanged from today — no video fetch, no dissolve, straight to the finished page.

**No-JS:** the `<noscript>` block hides `.intro-screen` and unlocks scroll, as it does today. With the `.intro-active` transform gone, the noscript block gets shorter, not longer.

Three intro edits are needed, all on the allowed list: the reduced-motion branch, a poster frame (`poster="/assets/intro-poster.webp"`, a single black frame, ~1 KB, so the splash never shows a transparent gap before the first video frame), and demoting `<h1 class="intro-logo">` to `<p class="intro-logo">` so the page has one H1. Everything else in the intro — source picking, the 2.5s stall timeout, the `ended`/`error`/`stalled` handlers, the remaining-duration backup timer, the skip button — is untouched.

---

## 4. Decisions you asked me to make

### 4.1 CTAs — one primary, used twice

Primary action: **hero** and **contact**. Everything else is a navigational link (nav items, "Uzzināt vairāk" per practice, footer links). That is two primary buttons on the page, down from four CTAs today.

This means the `.closing-cta` block — "Nezināt, ar ko sākt? / Sāciet ar bezmaksas 20 minūšu sarunu →", currently floating between About and Contact — has no home. **Its copy is good and I do not want to lose it**, so:

> **COPY CHANGE — Option B approved.**
>
> The exact existing words move into the contact section as its lede, dropping only the `→`:
> `Nezināt, ar ko sākt? Sāciet ar bezmaksas 20 minūšu sarunu.`
>
> It does **not** replace `contact.infoBody`. Nothing is deleted — all three pieces of invitation copy stay, ranked by size as set out in §2.6. Hero primary stays `Pieteikt sarunu` → `#contact`, so CMS key `hero.cta` is untouched.
>
> This is the only copy change on the page. Every other Latvian string, price and practice name is verbatim.

### 4.2 Practices index — rows

Settled in 2.3: a `<ul>` of rows with a CSS Grid price column, not a `<table>`. Justified there.

### 4.3 The hard-offset shadow button — killed

The current `.btn-primary` is transparent with a `#f4f4f5` border and `box-shadow: 5px 5px 0 rgba(255,255,255,.16)`. It is the most confident element on the page today, and I still want it gone.

With orange reserved for the primary action, the primary button becomes a **solid `#ff5f1f` fill with `#050505` text — 6.71:1**. (White on orange is 2.77:1 and fails; the near-black text is not a style choice, it is the only accessible option.) Adding a hard offset shadow to the single loudest element on the page is one device too many on the one thing that needs none.

Killing it leaves the page with **zero shadows**, which beats "one shadow, one purpose".

Two button styles, both radius 0:
- **Primary:** `#ff5f1f` fill, `#050505` text, 500 weight. Hover `#ff8554`. Used twice.
- **Quiet:** transparent, 1px `--rule-strong` border, `--ink` text. Used for the language switch, the `.nav .btn-primary` login link on the `/nidos/` pages, and the form's secondary state.
- **Focus (both, and every link):** 2px `#ff5f1f` outline, 2px offset. Visible, on-brand, never `outline: none`.

**The one-orange rule.** The primary button is the only orange in any viewport. Consequently:
- **Link hover is `--ink`, never orange** — the contact email, "Uzzināt vairāk", nav links, footer links and the arcade button all underline in `--ink` on hover.
- **`.nav .btn-primary` ("Pieslēgties" on the four `/nidos/` pages) renders as the quiet style, not the orange fill.** A login link cannot be the loudest element on a CRM page, and an orange fill there would break the one-orange rule on every one of those pages.
- **Focus rings stay orange.** I am reading the rule as applying to decorative and hover states, not to the focus indicator: focus is transient, only one element can hold it, and a visible focus style is an accessibility requirement the brief states outright. If you want focus in `--ink` instead, say so and it is a one-line change.

**Fallback if Phase 3 shows it shouting:** orange 1px stroke with `#f4f4f5` text — stroke 6.71:1, text 18.54:1. Not a colour change.

### 4.4 CMS — 18 new keys

Added while the practices markup is rewritten, page-scoped, on both LV and EN. Overrides are text-only, so the price amount is keyed on its own `<span>`:

```
practice.crm.title          practice.crm.body          practice.crm.price
practice.sales.title        practice.sales.body        practice.sales.price
practice.support.title      practice.support.body      practice.support.price
practice.integrations.title practice.integrations.body practice.integrations.price
practice.ai.title           practice.ai.body           practice.ai.price
practice.commerce.title     practice.commerce.body     practice.commerce.price
```

`.price` wraps the amount alone (`EUR 3 000`), so "no" and "Eiropas tirgum, bez PVN" stay as markup around it. Bullets stay unkeyed, as instructed. All 13 existing keys survive unchanged on both pages.

---

## 5. LV / EN drift strategy — option (a), the generator

**Recommendation: (a) one template + two content files + a dev-time generator.**

(b) detects drift after it has happened; (a) makes it structurally impossible. The deciding factor is the CMS: every `data-cms` key must exist on both pages or the admin panel silently offers a field that edits nothing on one language. A generator guarantees key parity by construction. A diff script can only report the breach afterwards.

```
site/
  landing.template.html      markup + {{slots}}, the single source of structure
  content.lv.json            every string, keyed
  content.en.json            same key set, English
scripts/
  build-landing.js           writes index.html + index-en.html
```

- `npm run build:landing` regenerates both files. Output is **committed**; nothing runs at request time; Docker ships plain HTML exactly as today.
- No templating engine, no bundler. `cheerio` is already a dependency if I need DOM-level work; otherwise it is string substitution in ~80 lines.
- **Three assertions, and the build fails on any of them:** (1) `content.lv.json` and `content.en.json` have identical key sets; (2) every `{{slot}}` in the template is present in both content files; (3) every `data-cms` attribute in the rendered output appears in both rendered pages.
- `build-landing.js --check` re-renders and diffs against the committed files, exiting non-zero if they differ — so a hand-edit of `index.html` is caught. Ready for CI whenever you want it; not wired to anything in Phase 2.
- Each generated file opens with a comment banner: generated, do not hand-edit, run the script.

**Risk I am not hiding:** generated files that are also committed can be edited by hand and silently overwritten on the next build. The `--check` mode and the banner are the mitigation; a pre-commit hook would be the real fix and is out of scope here.

**index-lv.html cleanup**, per your approval: 301 `/index-lv.html` → `/` in [server.js:207-214](server.js#L207-L214), delete it from `MANAGED_PAGES` in [server/lib/content.js:30-48](server/lib/content.js#L30-L48), and delete the file. It is **not** in `sitemap.xml` (checked — only `index-en.html` and the `nidos/*` pages are). Afterwards both remaining pages carry `hreflang` lv → `/`, en → `/index-en.html`, x-default → `/`, and `/` keeps its self-canonical.

---

## 6. JS inventory

| | Component | Size | Why |
|---|---|---|---|
| **GOES** | `vendor/lenis.min.js` | 14 KB | Smooth-scroll library; competed with the pinned stepper that is also going |
| **GOES** | Lenis init block | ~0.6 KB | — |
| **GOES** | `initScrollAnimations` + IntersectionObserver reveals | ~0.7 KB | Fade-and-slide-up on nine selectors, with an incidental stagger |
| **GOES** | `.hero-net` canvas + rAF loop | ~2.5 KB | Decorative particle field |
| **GOES** | `.fw-stage-net` particle tunnel | ~3 KB | Decorative particle field |
| **GOES** | Practices pinned stepper ([script.js:917-979](script.js#L917-L979)) | ~2.5 KB | The thing that hides the product |
| **GOES** | `.fw-stage` image swapper | ~1 KB | Images leave the landing page |
| **STAYS** | Intro sequence | ~2.5 KB | Modified only per the allowed-edit list |
| **STAYS** | Language switcher | ~0.8 KB | Must keep working both ways |
| **STAYS** | `?for=` form pre-select | ~0.3 KB | The practice detail pages link in this way |
| **STAYS** | Arcade easter egg | ~0.5 KB | Kept, relocated |
| **STAYS** | **Cookie consent banner** | ~1.5 KB | **Consent notice — must carry into `landing.js`.** See correction below |
| **STAYS** | `gate.js` | server-served | Untouched; your decision, outside this project |
| **N/A on landing** | **Mobile nav drawer** (`.nav-toggle` / `.nav-open`) | ~0.8 KB | Injected by `script.js` on the 14 legacy pages; `base.css` keeps styling it for them. `landing.js` does not inject one — see §2.1 |

> **Two corrections to the Phase 0 audit.** Both elements are built by `script.js` at runtime rather than written into the HTML, so grepping the markup missed them.
>
> 1. **There is a cookie consent banner** ([script.js:109-117](script.js#L109-L117), `#cookie-banner`). Phase 0 said there was none. It renders on every page that loads `script.js`, and its "Apstiprināt" button is a solid orange fill — a second orange in the viewport. It is a consent notice, so it is not mine to drop: it carries into `landing.js`, and its accept button takes the primary style while the reject button takes the quiet one, which keeps the one-orange rule by making the banner's accept button *the* orange when the banner is up.
> 2. **There is a mobile nav drawer.** Phase 0 said "no hamburger in markup" — true of the HTML, but `script.js` injects the button and wires `.nav-open` ([script.js:7-25](script.js#L7-L25)). Removing its CSS in step 0 broke the mobile menu on 14 pages and left an unstyled stub in the desktop nav; caught in the after-screenshots and restored in `base.css`.
| **NEW** | Form validation + `aria-live` | ~1.5 KB | Real error messages; native POST preserved |
| **NEW** | Nav hairline via 1px sentinel + IntersectionObserver | ~0.3 KB | Replaces a scroll listener |

**Delivery change:** `script.js` is 60 KB and shared with 9 other pages, so I cannot trim it to 15 KB without touching them. The landing pages get a new **`landing.js` (≤15 KB)** and stop loading `script.js` entirely. `script.js` stays exactly as it is for the `nidos/*` pages — nothing there breaks.

Same pattern for CSS: a new **`landing.css` (≤25 KB)**; the landing pages stop loading the 60 KB shared `styles.css`. See §9 for the consequence.

---

## 7. CSP diff

From [server.js:36-52](server.js#L36-L52). **Only the safe half can land in Phase 2.**

```diff
  scriptSrc:  ["'self'", "'unsafe-inline'",
-              "https://cdnjs.cloudflare.com", "https://unpkg.com"],
+             ],
  styleSrc:   ["'self'", "'unsafe-inline'",
-              "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
+              "https://fonts.googleapis.com"],
  fontSrc:    ["'self'",
-              "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
+              "https://fonts.gstatic.com"],
```

**cdnjs and unpkg go now** — I grepped all 16 HTML pages and **nothing references either**. They have been dead allowances.

**`fonts.googleapis.com` and `fonts.gstatic.com` must stay** until the other 14 pages move off Google Fonts. All 16 pages currently load Inter + Outfit from Google. See §9.

---

## 8. Byte budgets

| Item | Budget | Projected | Status |
|---|---|---|---|
| `landing.css`, unminified | ≤ 25 KB | ~20 KB | Replaces 60 KB `styles.css` on this page |
| `landing.js`, unminified | ≤ 15 KB | ~7 KB | Replaces 60 KB `script.js` + 14 KB Lenis |
| Fonts | ≤ 3 files, ≤ 100 KB | **1 file, 31.5 KB** | Measured, subset, verified |
| Intro poster | — | ~1 KB | New; black frame |
| Removed from the page | — | **−131.2 KB** | `styles.css` 58.7 + `script.js` 58.6 + `lenis` 13.9, none of them loaded any more |
| Removed requests | — | −2 origins | Google Fonts CSS + its font files + lenis |

**Code and fonts:** ~59.5 KB in (`landing.css` 20 + `landing.js` 7 + Archivo 31.5 + poster 1) against 131.2 KB out, so roughly **−72 KB** — plus whatever Inter + Outfit weigh across 9 weights from Google, which I have not measured and am not going to claim a number for.

**Images:** the six service `.webp` files the page references total **372 KB** (73.0 + 47.6 + 63.4 + 59.3 + 89.1 + 39.5). They leave the landing page. They are lazy-loaded today, so this is not all LCP-critical weight, but it is 372 KB and six requests that a visitor who scrolls currently pays for. Files are not deleted; unreferenced assets get listed in Phase 3.

Net for a visitor who reads the whole page: roughly **−444 KB** and 9 fewer requests, before counting the video.

**Deploy discipline (Phase 2):** every touched asset gets its `?v=` bumped. New files (`landing.css`, `landing.js`, `archivo-lat.woff2`) start at `?v=1`. A forgotten bump is a failed deploy — `Cache-Control: immutable, max-age=31536000` at [server.js:190-196](server.js#L190-L196) means returning visitors would be stranded on the old copy.

**Dockerfile:** verified. `COPY . .` runs after `prisma generate` and `.dockerignore` excludes only `node_modules`, `.git`, `.env*`, `dist`, `build`, `.DS_Store` — so a committed `assets/fonts/*.woff2` ships in the image with no Dockerfile change. No action needed.

---

## 9. Pages that will be inconsistent afterwards — and one decision

After Phase 2 the landing pages use Archivo, radius 0, no glows, no shadows. **All 14 other pages keep Inter + Outfit** and their current styling. The two most visible are the ones the practices index links straight into: [nidos/pricing.html](nidos/pricing.html) and [nidos/digitalizacija.html](nidos/digitalizacija.html) — a visitor clicking "Uzzināt vairāk" lands on a page in a different typeface.

Also inconsistent: `nidos/index.html`, `about`, `contact`, `platform`, `privacy`, `terms`, `gdpr`, `cookie-policy`, `404`, `nidos/404`, `nidos/pricing-en.html`, `nidos/digitalization.html`.

Shared header/footer: the landing nav and footer are restyled by `landing.css`; the other pages' nav and footer keep `styles.css`. They will not match.

> **DECISION — global font swap approved.** A two-typeface site is worse than touching 14 pages.
>
> All 16 pages move to Archivo in step 0: `@font-face` in `base.css`, both font tokens repointed, Google Fonts `<link>` and `preconnect` tags deleted from all 16 files, and `fonts.googleapis.com` / `fonts.gstatic.com` out of the CSP. The header and footer are restyled everywhere by `base.css` so the nav does not change appearance between the landing and the pages it links into. **The old pages keep their design otherwise** — their body content is untouched.
>
> Watch item, carried into step 0's before/after screenshots: [nidos/pricing.html](nidos/pricing.html) and [nidos/digitalizacija.html](nidos/digitalizacija.html) carry 113 and 237 lines of inline `<style>` that may be tuned to Inter's metrics. Long Latvian headings are where reflow will show.
>
> Also handled in step 0: the pages reference `styles.css` at **three different `?v=` values (55, 56, 57)** for one shared file. Every page gets bumped in the same commit, or returning visitors get a stale stylesheet on the pages left behind.

---

## 10. Self-critique — "would I produce this for any B2B agency page?"

| Section | Verdict | What I changed |
|---|---|---|
| **Nav** | First pass: logo left, links right, hairline on scroll — **yes, that is every page.** | Kept the layout (it is genuinely the right answer) but removed the devices that made it template-y: no backdrop blur, no translucency, no shrink-on-scroll, no pill CTA in the nav. At mobile, no hamburger — the four links live in the footer instead of behind a JS drawer. The restraint is the differentiator, not the arrangement. |
| **Hero** | First pass had an eyebrow label, a `↓ Pakalpojumi` scroll cue and two CTAs — **yes, generic.** | Eyebrow deleted. Scroll cue deleted. Secondary CTA deleted. The two-line H1 with a tonal step between claim and qualifier replaces the gradient, and the CTA sits on a shared baseline with the lede instead of stacked above it. One statement, one action. |
| **Practices** | A six-card grid would be **exactly** the generic answer, and a pinned stepper is what is there now. | Neither. A ruled index with one aligned price column. The honest test: can a buyer compare six prices without moving? Today, no. Here, yes. I also cut the `01`–`06` numbering I had drafted, because the order encodes nothing and the heading already says "Sešas" — numbering would have been the clearest generated-page tell on the page. |
| **About** | First pass: heading left, prose right, two even columns — **yes, any agency page.** | Prose indented to column 5 of 12 and capped at 62ch, so the block reads as a page of text, not a two-up. Removed the "Project Nidos" card-label above the sub-heading — it labels a block on a page that is entirely about Project Nidos. No image, as instructed. |
| **Why** | Three icon-in-circle cards is the canonical version and is explicitly banned; three ruled rows would have been my lazy substitute — and would have echoed the practices index directly above it. | Made it the least structured block on the page: no rules, no columns, no numbers. Three claims with their support lines running in beneath, set narrower than the page. It reads as a held breath between two wide sections, which is a rhythm decision, not a component. |
| **Contact** | Two columns, info left, form right — **yes, universal.** | Kept the arrangement (the form needs the width) and spent the difference on the band: this is the only section on `#0a0a0a`, and that single value shift does all the separating — no heading rule, no card, no border. Fields are underlined rather than boxed: one rule per field instead of four. |
| **Footer** | Brand + two link columns + legal line — **yes, and I am keeping it.** | A footer that tries to be distinctive is a footer doing the wrong job. The one deliberate move is pulling the arcade button out of the legal registration line, where it currently sits by accident, onto its own right-aligned row. |
| **Motion** | Fade-up-on-scroll everywhere is the default and is banned. | One orchestrated moment: the nav fading in 200 ms after the splash dissolves. Everything else responds to a user action — hover underlines, focus rings, button states. Nothing animates on scroll. The hero does not animate at all, which is what makes the handoff shift-free. |

**Anti-template rules checked against this plan:** no identical rounded cards (radius is 0 and there are no cards); no icon-in-circle trio; no bento; no gradient text, washes, glassmorphism, glows or blurred blobs (all four `.glow` divs and both particle canvases deleted); no scroll fade-ups, hover-lift, parallax or counters; no tracked-out ALL-CAPS eyebrows (labels are sentence case at +0.01em); no `→` appended to links (all seven `.link-arrow` arrows deleted); no emoji, no icon grid; no Tailwind/shadcn defaults, no Inter/Roboto/Poppins/Montserrat/Space Grotesk/Outfit, no Playfair pairing; no centred-everything; no gradient pills; radius is a single value (0) and there is one — zero — shadow style; no carousel (all six practices visible); no stock imagery (the six AI-render `.webp` files leave the page); and every element listed above that existed only to fill space is gone.

**Open, and blocking nothing:** §4.1 (which CTA copy option), §9 (landing-only or global font swap). Both can be answered when you approve the rest.

---

## 11. Step 0 — the foundation commit

### 11.1 Header / footer markup check — result: NOT identical

Checked by parsing all 16 pages and comparing tag+class signatures, text and hrefs stripped.

**NAV — 5 variants.** Variant 1 (the landing) is the reference.

| # | Shape vs variant 1 | Pages |
|---|---|---|
| 1 | **reference** — `nav#mainNav` → `.nav-logo` + `.nav-links` (4×`a`) + `.lang-switcher-container` | `index.html`, `index-en.html` |
| 2 | no `<nav>` at all | `404.html`, `nidos/404.html` |
| 3 | **+** `a.btn-primary` ("Pieslēgties" → `/login.html`), **−** lang switcher, 6 links | `nidos/index`, `about`, `contact`, `platform` |
| 4 | **−** lang switcher, 3 links | `nidos/pricing`, `nidos/pricing-en` |
| 5 | **−** `.nav-links` entirely (logo only) | `nidos/digitalizacija`, `digitalization`, `privacy`, `terms`, `gdpr`, `cookie-policy` |

**FOOTER — 4 variants.**

| # | Shape vs variant 1 | Pages |
|---|---|---|
| 1 | **reference** — `.footer-inner` + `.footer-bottom` + `button.egg-arcade` | `index.html`, `index-en.html` |
| 2 | no `<footer>` at all | `404.html`, `nidos/404.html` |
| 3 | **−** arcade button | `nidos/index`, `about`, `contact`, `platform`, `privacy`, `terms`, `gdpr`, `cookie-policy` |
| 4 | **−** arcade button, **+** `div.footer-wordmark` | `nidos/pricing`, `pricing-en`, `digitalizacija`, `digitalization` |

**Other findings:** `id="mainNav"` exists on only 6 of 14 navs. `nidos/digitalizacija.html` and `nidos/digitalization.html` carry a **second `<nav>`** — the `01`–`06` practice jump list.

**Resolution: option A — additive forks on one spine. No page's nav or footer markup is edited.** The variation is additive in every case, so `base.css` styles the shared spine and adds a short block per fork.

Binding rules for those selectors:
- **Select on the class spine only** — `.nav`, `.nav-inner`, `.nav-logo`, `.nav-links`, `.footer-inner`, `.footer-bottom`. **Never `#mainNav`.** Only `landing.js` may use the id.
- **Scope the spine to the header nav**, not to every `<nav>`. The `01`–`06` jump nav on the two digitalizacija pages must not be captured — it keeps its `legacy.css` styling untouched, and those pages' bodies are not touched at all. They are old design throughout and get their own redesign later.
- `.nav .btn-primary` renders as the **quiet** button style, per §4.3.
- Variant 1 is the visual reference; every other variant must look like variant 1 minus the element it lacks.

### 11.2 The split

`styles.css` (60 KB, shared by all 16 pages) becomes:

| File | Contents | Budget |
|---|---|---|
| **`base.css`** | Reset, tokens, `@font-face`, type scale, header, footer, buttons, focus styles — rebuilt clean | counts toward the 25 KB |
| **`legacy.css`** | Everything else from today's `styles.css`, for the 14 old pages. Not rewritten, only relieved of what `base.css` now owns | unbudgeted |
| **`landing.css`** | The landing design only | `base + landing ≤ 25 KB` |

### 11.3 Load order per page

| Pages | Loads |
|---|---|
| `index.html`, `index-en.html` — **after the landing build** | `base.css` → `landing.css` |
| `index.html`, `index-en.html` — **during step 0 only** | `base.css` → `legacy.css` |
| The 12 pages with a nav/footer | `base.css` → `legacy.css` |
| `404.html`, `nidos/404.html` | `base.css` → `legacy.css` |

`base.css` always loads first; nothing in `legacy.css` or `landing.css` may need to out-specify it for header/footer spacing. During step 0 the landing still loads `legacy.css`, because its old markup is still in place — the switch to `landing.css` happens in the landing build, not here. **Step 0 is visually neutral apart from the typeface and the restyled header/footer.**

**404 pages confirmed clean:** both load only `styles.css` + Google Fonts. No nav, no footer, no `script.js`. They get `base.css` + `legacy.css` and the font swap, and nothing else on them changes.

### 11.4 Step 0 — the 16 pages and what happens to each

Every page in one commit: Google Fonts `<link>` + `preconnect` removed, `styles.css` → `base.css` + `legacy.css`, `?v=` bumped to a single shared value.

| # | Page | Nav | Footer | Also |
|---|---|---|---|---|
| 1 | `index.html` | v1 | v1 | — |
| 2 | `index-en.html` | v1 | v1 | — |
| 3 | `404.html` | — | — | — |
| 4 | `nidos/404.html` | — | — | — |
| 5 | `nidos/index.html` | v3 | v3 | footer h4 → "Pakalpojumi" |
| 6 | `nidos/about.html` | v3 | v3 | footer h4 → "Pakalpojumi" |
| 7 | `nidos/contact.html` | v3 | v3 | footer h4 → "Pakalpojumi" |
| 8 | `nidos/platform.html` | v3 | v3 | footer h4 → "Pakalpojumi" |
| 9 | `nidos/privacy.html` | v5 | v3 | footer h4 → "Pakalpojumi" |
| 10 | `nidos/terms.html` | v5 | v3 | footer h4 → "Pakalpojumi" |
| 11 | `nidos/gdpr.html` | v5 | v3 | footer h4 → "Pakalpojumi" |
| 12 | `nidos/cookie-policy.html` | v5 | v3 | footer h4 → "Pakalpojumi" |
| 13 | `nidos/pricing.html` | v4 | v4 | already "Pakalpojumi" |
| 14 | `nidos/pricing-en.html` | v4 | v4 | EN — stays "Services" |
| 15 | `nidos/digitalizacija.html` | v5 + jump nav | v4 | already "Pakalpojumi"; body untouched |
| 16 | `nidos/digitalization.html` | v5 + jump nav | v4 | EN — stays "Services"; body untouched |

**Footer heading fix:** eight LV pages say "Prakses"; they become "Pakalpojumi" to match the nav label and the landing. **Verified: this `<h4>` carries no `data-cms` key on any page** — there are no footer CMS keys at all — so it is a plain file edit with no key to report. The four EN pages keep "Services".

**Also in this commit:** CSP loses `cdnjs`, `unpkg` (dead allowances, nothing references them) and both Google Fonts origins. `assets/fonts/archivo-lat.woff2` is added — `COPY . .` in the Dockerfile ships it with no Dockerfile change.

**Verification:** all 16 pages screenshotted at 390 and 1280 before and after, with reflow breakage listed. Long Latvian headings on `nidos/pricing.html` and `nidos/digitalizacija.html` are the expected trouble spots.

---

*Phase 1 plan complete. Step 0 begins here.*
