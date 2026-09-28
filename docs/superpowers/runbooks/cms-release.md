# CMS Release Runbook

This runbook moves the site into the page editor. Each step requires the owner's approval before you proceed.

## Step 1: Merge to production

1. Merge the branch to `main` on GitHub: `cms/foundation` (part 1a, merged 25 Sep 2026), then `cms/styles` (part 1b, merged), then `cms/editor` (part 2, the Pages section, with the 28 Sep landing and rate-limit fixes merged in).
2. Wait for Railway to deploy the change to the production service.
3. Open https://www.projectnidos.eu in your browser and check:
   - The home page loads and looks the same as before.
   - On the home page, submit the empty contact form: its three fields (name, email, message) are flagged as required.
   - On a computer, move the pointer across the practice cards: a faint highlight follows it from card to card.
   - In the browser console (F12 → Console), there is no red error, and no 404 for contact-form.js or pointer-pane.js.
   - A legal page (like /nidos/privacy.html) loads and looks the same.
   - A missing page (/no-such-page) still shows the old 404 page.
4. The merge deliberately changes three small things the owner may notice. They are expected, not faults:
   - Pricing's process step numbers now read 01, 02, 03, 04 (they read 1–4).
   - The "Back to homepage" link on Pricing and the legal pages has a larger touch target. Nothing changes visually.
   - The Services page's process heading may wrap onto its lines differently.

   Part 1b changes nothing visible: the home page loads two more small scripts, contact-form.js and pointer-pane.js, which used to be part of landing.js.

   Part 2 itself changes nothing visitors see. The admin panel gets a new **Pages** item under Site content. Until Step 3 is done it shows an error ("The page editor could not reach the database." or "The pages have not been imported yet.") with a Try again button: that is expected, there is nothing in it to edit yet.

   The same merge carries the 28 Sep landing fixes, which visitors do see. Check them too:
   - In a private window, the home page's intro plays over a page that is already there; Escape or Skip ends it. Open the page again in the same window: no intro (it is remembered per browser now, not per tab).
   - On a phone, the cookie notice leaves both hero buttons in view.
   - The contact form's topic list starts on "Choose a topic (optional)", and the fields' outlines are a little brighter.
   - /nidos/cookie-policy.html lists pn_intro_seen as Local storage, updated 28 September 2026.
   - Rate limits now count each visitor separately. In the Railway logs, the line `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` stops appearing after this deploy.
5. Report OK to proceed to the owner.

## Step 2: Apply the database schema

1. Open the Railway dashboard and navigate to the production service (ProjectNidos.eu → project-nidos).
2. Check the start command. `railway.json` in the repo sets it to `npm run start:deploy` (until 28 Sep 2026 none was set, so the service ran plain `npm start` and the flags below did nothing). In the latest deployment's logs you should see `· RUN_DB_PUSH is not set — skipping the schema push.` before `Server running`.
3. Open the service's Variables tab. Create or update `RUN_DB_PUSH` and set it to `1`.
4. Click Deploy to restart the service.
5. Open the Deployments tab and watch the latest deployment's logs.
6. Look for this line: `✓ schema is up to date. Unset RUN_DB_PUSH now.` The push creates the page tables and, for part 2, the column that keeps each version's search title and description.
7. Once you see it, the schema is ready. Report the log line to the owner for approval.
8. Return to Variables, set `RUN_DB_PUSH` to empty (or delete it), and click Deploy again.
9. Wait for the service to restart.

**If the log shows a schema push error** (`✗ schema push failed — the app will not start with a stale schema.`): the deploy script exits and the app does **not** start, so the site is down until you act.

1. Immediately open Variables, set `RUN_DB_PUSH` to empty (or delete it), and click Deploy. The site runs normally without the new tables while the page editor switch is off.
2. Confirm the home page loads again.
3. Contact the developer with the error lines from the log. Do not retry Step 2 until they say so.

## Step 3: Import the pages

**From this step on, do not edit anything in the admin's Site content tab.** The import copies the Site content edits once; an edit made after it does not reach the pages the editor will serve, and once the switch is on (Step 5) the Site content tab no longer changes these pages at all. If an edit is essential, make it, then contact the developer before Step 5.

1. Open the Variables tab. Create or update `RUN_CMS_IMPORT` and set it to `1`.
2. Click Deploy to restart the service.
3. Open the Deployments tab and watch the logs.
4. Look for these two lines, in this order:
   - `✓ 8 page(s) written.`
   - `✓ page import finished. Unset RUN_CMS_IMPORT now.`
5. Report both log lines to the owner for approval.
6. Return to Variables, set `RUN_CMS_IMPORT` to empty (or delete it), and click Deploy again.
7. Wait for the service to restart.

**If the log shows refusal lines starting with `  ✗ `:**

   The import was refused. Look for one of these problems:

   - **Contact form categories:** The log shows `contact option "X" is not a CRM lead category (Settings → Contact form categories)`. Go to the site's admin panel (Admin → Settings → Contact form categories) and add any missing categories. Then retry step 3.
   - **English-only migration:** The log shows `import refused: the English-only content migration did not complete`. The migration may have failed. Contact the development team.
   - **Validation errors:** Lines like `  ✗ / blocks[0].titleLead: Headline, line 1 is required.` mean the content blocks are invalid. Nothing is written and the site keeps serving its files.

   Once fixed, set `RUN_CMS_IMPORT` to empty and retry from step 1 of this section.

**Safe to retry:** If the flag is still set and the service redeploys, the import will print `✓ 0 page(s) written, 8 already existed and were left alone.` instead of `✓ 8 page(s) written.` This is harmless — nothing is overwritten or changed.

**Carried-over edits warning:** The log may show lines like these. They are notes, not errors, and the import still succeeds:
```
! index.html: saved "meta.ogTitle" is not carried over — the share tags now use the page's SEO title and description.
! index.html: saved "form.optionEsFondi" is not carried over — it is no longer on the page.
```
- The first kind is expected. The page's SEO title and description (set in the editor) are used for social sharing instead. Make a note of any unsaved customizations and re-add them in the editor if needed.
- The second kind is an edit saved for something an older version of the page had and today's page no longer shows. Visitors do not see it today either, so nothing is lost.

Both kinds are also listed after "Not carried:" in the import's audit log entry.

## Step 4: Preview the pages

1. Sign in to the admin panel with your admin account.
2. Open the live site (https://www.projectnidos.eu) in one tab.
3. For each of these pages, open them in two browser tabs (side by side):
   - Home page: https://www.projectnidos.eu/?__cms=1 (editor version) and https://www.projectnidos.eu/?__cms=0 (file version)
   - Services: https://www.projectnidos.eu/nidos/digitalization.html?__cms=1 and ?__cms=0
   - Pricing: https://www.projectnidos.eu/nidos/pricing.html?__cms=1 and ?__cms=0
   - Privacy: https://www.projectnidos.eu/nidos/privacy.html?__cms=1 and ?__cms=0
   - Terms: https://www.projectnidos.eu/nidos/terms.html?__cms=1 and ?__cms=0
   - Cookie Policy: https://www.projectnidos.eu/nidos/cookie-policy.html?__cms=1 and ?__cms=0
   - GDPR: https://www.projectnidos.eu/nidos/gdpr.html?__cms=1 and ?__cms=0
   - 404 page: https://www.projectnidos.eu/no-such-page?__cms=1 and ?__cms=0
4. Both versions should look the same, except the 404 page (it has a new look in the editor version).
5. Open the admin panel → **Pages**. Check:
   - It lists Menu & footer and the eight pages, each "Published … · Imported".
   - Open Pricing. Every section has its fields, filled in. Change nothing.
   - Click **Preview**: a new tab shows the pricing page as it is live.
   - Click **← All pages**. Nothing was saved, so nothing says "Unpublished changes".
6. Report OK to proceed to the owner.

## Step 5: Switch on the page editor

1. Sign in to the admin panel.
2. Go to Settings.
3. Find "Serve pages from the page editor" and turn it **on**.
4. Save the settings.
5. The live site now serves pages from the editor. File changes, and edits in the Site content tab, no longer change these pages.
6. Reload the admin panel: the Site content item is gone from the menu. Pages replaces it. (Its saved edits stay in the database.)

## Step 6: Live checks

1. Open a private browser window (or sign out) to avoid admin previews.
2. Check these pages in the live site:
   - https://www.projectnidos.eu (home)
   - https://www.projectnidos.eu/nidos/digitalization.html (services)
   - https://www.projectnidos.eu/nidos/pricing.html (pricing)
   - https://www.projectnidos.eu/nidos/privacy.html (privacy)
   - https://www.projectnidos.eu/nidos/terms.html (terms)
   - https://www.projectnidos.eu/nidos/cookie-policy.html (cookie policy)
   - https://www.projectnidos.eu/nidos/gdpr.html (GDPR)
   - https://www.projectnidos.eu/no-such-page (404)

3. For each page:
   - Confirm it loads and returns 200 (check the network tab). The one exception is /no-such-page, which returns 404: that is correct, it is the new 404 page.
   - Open the browser console (F12 → Console). There should be no red errors.
   - Check that interactive elements work:
     - Home page: The orbit animation is running (rotating circle).
     - Home page, on a computer: the highlight follows the pointer across the practice cards.
     - Services: The practice diagrams are displayed and working.
     - Pricing: The moving background field behind the page is running. Pricing has no diagrams.
     - Contact form (its own section near the bottom of the home page, above the footer): Submit the empty form and confirm its three fields (name, email, message) are flagged as required.
   - 404 page: Confirm it shows the new 404 design (different from the file version you saw in step 4).

4. Check the editor once, without changing the live site:
   - Admin → Pages → Pricing. Change one word in the first heading and click **Save draft**. The page says "unpublished changes".
   - Click **Preview**: the new tab shows the changed word.
   - In the private window, the live pricing page still shows the old word.
   - Back in the admin, click **Discard changes** and confirm. The form shows the old word again.
5. Report results to the owner.

## Step 7: Rollback (if needed)

If anything is wrong:

1. Sign in to the admin panel.
2. Go to Settings.
3. Find "Serve pages from the page editor" and turn it **off**.
4. Save the settings.
5. The site is now serving files again. The next page request will use the file version: the content as it was before the import. Reload the admin panel and Site content is back.
6. Everything published in Pages is kept. Switching back on serves it again.
7. Contact the development team to review the issue.

---

## Development Database (for testing)

If you need to run a parity check before release:

- The development database is in Railway, project `projectnidos-cms-dev`.
- To test locally: `PORT=4041 npm run dev:cms`
- To run parity checks: `CMS_PARITY_BASE=http://127.0.0.1:4041 npm run cms:parity`.
  - Add `CMS_PARITY_ENGINES=chromium` or `CMS_PARITY_ENGINES=webkit` to run one browser.
  - Each browser takes about five minutes.
- Every row must pass.
  - The last run, on 27 Sep 2026, after part 2, passed 302/302 rows in Chromium and 302/302 in WebKit.
- To check the editor end to end, with the same server: `npm run cms:editor-check`.
  - It signs in as a throwaway admin it creates, edits, previews, publishes and restores Pricing in Chromium and WebKit, works a list on Services, changes and restores the footer, and checks what a first session meets (a failed first load, field names, the unsaved mark, a double-click on Save). It leaves every page as it found it, so parity still passes after it.
  - Every row must pass (43/43 on 27 Sep 2026). The throwaway admin is switched off at the end.
  - Never point it at production: it publishes.
- Re-run parity before switching on the editor after any change to:
  - blocks;
  - layouts;
  - converters;
  - the stylesheets.
- Run the sampler too, with the same server: `CMS_PARITY_BASE=http://127.0.0.1:4041 npm run cms:sampler`.
  - It draws every block on both layouts; every row must pass (58/58).
  - Look at its screenshots in `tmp/sampler/`.
- Both runs use reduced motion, so neither sees the moving parts. Before switching on, preview the home page with `?__cms=1` in a normal browser: the orbit, the diagrams, the card highlight and the background field move as they do on the live site.
