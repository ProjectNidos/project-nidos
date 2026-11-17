# Admin Live Text Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/admin/teksti` shows the real homepage beside the form and updates it on every keystroke, before saving.

**Architecture:** The admin page frames the real site (`/` or `/en`). A small client bridge mounted in the site layout listens for `postMessage` from the same-origin parent and swaps `textContent` on elements marked `data-k="<text key>"`. Saving is unchanged.

**Tech Stack:** Next.js 16, next-intl, React 19, Tailwind, Vitest (node env), Playwright.

**Spec:** `docs/superpowers/specs/2026-11-17-admin-live-text-preview-design.md`

## Global Constraints
- Nothing reaches visitors before "Saglabāt"; `saveTexts` is not changed.
- Framing only by our own origin: CSP `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`.
- Bridge: inert unless framed; accepts only `event.origin === location.origin` and `event.source === window.parent`; only keys in `EDITABLE_KEYS`; sets `textContent`, never HTML.
- Inside the preview: no splash, no `track()` calls.
- Owner typography: admin UI copy Inter, small caps 13px semibold uppercase; palette colours only.
- Admin copy in Latvian.

## Review Focus
1. Messages sent before the framed page has hydrated are lost → `ready` handshake; parent (re)sends all drafts on every `ready` (covered by e2e in Task 2).
2. LV/EN switch or in-preview navigation reloads the frame → unsaved drafts re-applied on the next `ready`.
3. Emptied box → preview shows the default text (the placeholder), not blank.
4. Typed markup (`<b>x</b>`) → appears literally (unit + e2e).
5. A message from another window or origin → ignored (unit).

---

### Task 1: Message protocol and validation

**Files:**
- Create: `src/lib/preview.ts`
- Test: `src/__tests__/preview.test.ts`

**Interfaces:**
- Produces:
  - `PREVIEW_TAG = 'nidos-preview'`
  - `type PreviewMsg = { tag: typeof PREVIEW_TAG; type: 'text'; key: string; value: string } | { tag; type: 'focus'; key: string } | { tag; type: 'ready' }`
  - `parsePreviewMessage(e: { origin: string; source: unknown; data: unknown }, expected: { origin: string; source: unknown }): PreviewMsg | null`. Returns null unless origin and source match `expected`, tag matches, `type` known, `key` in `EDITABLE_KEYS` (for text/focus), `value` a string of at most `MAX_TEXT` chars.

- [ ] **Step 1: Write failing tests** `preview.test.ts`: accepts a valid text msg; null for wrong origin; null for source ≠ expected source; null for unknown key `'meta.title'`; null for value length 2001; null for wrong tag; accepts `'ready'`; a value `'<b>x</b>'` is returned unchanged (rendering as text is the bridge's job).
- [ ] **Step 2:** `npx vitest run src/__tests__/preview.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `src/lib/preview.ts`.
- [ ] **Step 4:** Same command → PASS.

### Task 2: Site side: markers, bridge, framing, splash/analytics off

**Files:**
- Create: `src/components/PreviewBridge.tsx` (`'use client'`, default export, renders null)
- Modify: `src/app/[locale]/layout.tsx` (mount `<PreviewBridge />` next to `<Beacon />`)
- Modify: `src/components/Hero.tsx:41-47` (`data-k` = `hero.title`, `hero.lead`, `hero.cta`)
- Modify: `src/app/[locale]/page.tsx` (`services.heading`, `about.heading`, `about.text`, `contact.heading`, `contact.intro`; pass `copyKeys` to the carousel slides)
- Modify: `src/components/ui/carousel-squeeze.tsx` (`SqueezeSlide.copyKeys?: { title?: string; description?: string }` → `data-k` on the copy spans)
- Modify: `src/components/ServicesCarousel.tsx` (`Item` gets `id`; slides get `copyKeys: { title: \`services.items.${id}.title\`, description: \`services.items.${id}.text\` }`)
- Modify: `src/components/ContactForm.tsx` (`data-k` on service `<option>`s and the success `<p>`; listens for `window` event `nidos-preview-thanks` (`CustomEvent<boolean>`) and shows the success box while true)
- Modify: `src/components/nidos-splash.tsx:13` (`onceScript`: hide when `window.parent!==window`)
- Modify: `src/lib/analytics.ts` (`track`: return when `window.parent !== window`)
- Modify: `src/proxy.ts:23` → `frame-ancestors 'self'`; `next.config.ts` → `X-Frame-Options: SAMEORIGIN`
- Test: `e2e/site.spec.ts`

**Interfaces:**
- Consumes: Task 1 `parsePreviewMessage`, `PREVIEW_TAG`.
- Produces: framed page posts `{tag, type:'ready'}` to parent on mount. On `text`: every `[data-k="<key>"]` gets `textContent = value`. On `focus`: the first visible match scrolls to centre and gets a 2px ink outline (previous outline cleared); if it sits in a `[role=tabpanel]`, click the `[role=tab]` with the same index as its copy block; dispatch `nidos-preview-thanks` with `key === 'contact.success'`.

- [ ] **Step 1: Failing e2e** in `site.spec.ts`: "preview bridge swaps text in a same-origin frame": go to `/`, append an iframe `src="/"`, wait for its `ready` message, post `{tag,type:'text',key:'hero.title',value:'<b>Test</b>'}` → frame's `h1` text is `<b>Test</b>` and contains no `b` element; response headers of `/` contain `X-Frame-Options: SAMEORIGIN` and CSP `frame-ancestors 'self'`.
- [ ] **Step 2:** `npx playwright test -g "preview bridge"` → FAIL.
- [ ] **Step 3:** Implement the files above.
- [ ] **Step 4:** Same command → PASS; full `npx playwright test` green (clean `.next` build).

### Task 3: Admin editor with preview pane

**Files:**
- Create: `src/app/admin/(panel)/teksti/PreviewPane.tsx`
- Modify: `src/app/admin/(panel)/teksti/TextsForm.tsx`, `src/app/admin/(panel)/teksti/page.tsx` (intro copy: preview on the right, visitors see it after saving)

**Interfaces:**
- Consumes: Task 1 protocol; Task 2 bridge behaviour.
- Produces: `PreviewPane({ locale, frameRef, open, onClose })`. Frame src `/` (lv) or `/en`; `title="Lapas priekšskatījums"`. Device toggle "Dators | Telefons": Dators renders the frame 1280px wide scaled to the pane width (ResizeObserver); Telefons 390px wide, unscaled. Below 1024px the pane is a full-screen overlay opened by "Priekšskatīt" with "Atpakaļ"; no device toggle there.
- TextsForm: LV | EN switch at the top shows that locale's fields (the other locale's stay mounted, `hidden`, so one save sends both). `onInput` → post `text` with `value || cell.original`; `onFocus` → post `focus`. On a `ready` message from the frame (validated with `parsePreviewMessage(e, { origin: location.origin, source: frameRef.current?.contentWindow })`), post `text` for every field of the current locale from the form's live values. Layout ≥1024px: two columns (form ~420px, pane sticky `top-0 h-[calc(100vh-…)]`).

- [ ] **Step 1:** Implement (UI only; protocol logic already tested in Task 1).
- [ ] **Step 2:** `npx tsc --noEmit`, `npm run lint`, `npx vitest run` → zero errors, all pass.
- [ ] **Step 3:** Commit via the outside-iCloud clone and push `rebuild/nextjs`; check the Railway deploy succeeds; owner checks `/admin/teksti` on desktop and phone.
