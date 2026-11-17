# Admin texts: live preview — design (small change)

**Intent.** When the owner edits site texts in `/admin/teksti`, they see the change on the real website while typing, before saving (WordPress Customizer style). Today they only see it on the live site after "Saglabāt".

**Goals.** Real site, not a lookalike; updates on every keystroke; shows where the text sits; works on desktop and phone.
**Non-goals.** Editing anything beyond the 17 existing texts; images, layout, new sections; drafts saved to the database.
**Anti-goals.** Anything reaching visitors before "Saglabāt". A preview that drifts from the real design. Weakening clickjacking protection against other sites. Preview views counted as visits in analytics.

## Approaches
- **A. Side preview (picked by the user).** Form left, the real homepage right in a frame, texts swapped in place as you type. Uses the site's own components, so it can't drift.
- B. Click-to-edit on the page (WordPress block editor). Rejected by the user: bigger build; hidden texts (closed service panels, thank-you message) and phone typing need extra work.
- C. Re-render the page on the server on each keystroke. Dropped: page reloads, video restarts, and it's slow.
- D. Mock preview cards inside the admin. Dropped: a second copy of the design that drifts.

## Design
- **Layout, desktop (≥1024 px):** narrow scrolling form on the left, preview sticky on the right. The form gets an **LV | EN** switch at the top that shows that language's boxes (the other language's boxes stay in the form, hidden, so one "Saglabāt" still saves both). The preview follows the switch.
- **Device toggle (my call):** "Dators | Telefons" above the preview. Dators = the page at true desktop width scaled down to fit; Telefons = 390 px wide. Text wraps differently in each, which is what the owner is checking.
- **Phone:** form full width; a "Priekšskatīt" button opens the preview full screen with "Atpakaļ".
- **Live update:** each keystroke sends `{key, value}` to the preview; an empty box sends the default text (as the placeholder shows). Focusing a box scrolls the preview to that text and outlines it. A service's fields open that service's panel. The thank-you field shows the thank-you box in place of the contact form (preview only).
- **Language switch** reloads the preview in that language and re-applies all unsaved edits.
- **Saving** is unchanged: same server action, validation, audit entry.

## Security
- Framing allowed only by our own site: CSP `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`. Other sites still can't frame it.
- The preview listener runs only inside a frame, accepts messages only from the parent window on the same origin, only touches elements marked with a known text key, and sets plain text (never HTML).
- Inside the preview: no load splash, no analytics events.

## Checks
- Unit test for the message handler: wrong origin ignored, unknown key ignored, markup shown as text.
- Existing unit and browser tests stay green; manual check on the Railway preview after deploy.

## Left to the builder
Exact column widths, outline style, how the carousel exposes "open panel N", where the `data-` text-key markers go.
