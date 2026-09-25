# CMS Release Runbook

This runbook moves the site into the page editor. Each step requires the owner's approval before you proceed.

## Step 1: Merge to production

1. Merge `cms/foundation` to `main` on GitHub.
2. Wait for Railway to deploy the change to the production service.
3. Open https://www.projectnidos.eu in your browser and check:
   - The home page loads and looks the same as before.
   - A legal page (like /nidos/privacy.html) loads and looks the same.
   - A missing page (/no-such-page) still shows the old 404 page.
4. The merge deliberately changes three small things the owner may notice. They are expected, not faults:
   - Pricing's process step numbers now read 01, 02, 03, 04 (they read 1–4).
   - The "Back to homepage" link on Pricing and the legal pages has a larger touch target. Nothing changes visually.
   - The Services page's process heading may wrap onto its lines differently.
5. Report OK to proceed to the owner.

## Step 2: Apply the database schema

1. Open the Railway dashboard and navigate to the production service (ProjectNidos.eu → project-nidos).
2. Check the current start command. It must be: `npm run start:deploy`
3. Open the service's Variables tab. Create or update `RUN_DB_PUSH` and set it to `1`.
4. Click Deploy to restart the service.
5. Open the Deployments tab and watch the latest deployment's logs.
6. Look for this line: `✓ schema is up to date. Unset RUN_DB_PUSH now.`
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
5. Report OK to proceed to the owner.

## Step 5: Switch on the page editor

1. Sign in to the admin panel.
2. Go to Settings.
3. Find "Serve pages from the page editor" and turn it **on**.
4. Save the settings.
5. The live site now serves pages from the editor. File changes, and edits in the Site content tab, no longer change these pages.

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
     - Services: The practice diagrams are displayed and working.
     - Pricing: The moving background field behind the page is running. Pricing has no diagrams.
     - Contact form (its own section near the bottom of the home page, above the footer): Submit the empty form and confirm its three fields (name, email, message) are flagged as required.
   - 404 page: Confirm it shows the new 404 design (different from the file version you saw in step 4).

4. Report results to the owner.

## Step 7: Rollback (if needed)

If anything is wrong:

1. Sign in to the admin panel.
2. Go to Settings.
3. Find "Serve pages from the page editor" and turn it **off**.
4. Save the settings.
5. The site is now serving files again. The next page request will use the file version.
6. Contact the development team to review the issue.

---

## Development Database (for testing)

If you need to run a parity check before release:

- The development database is in Railway, project `projectnidos-cms-dev`.
- To test locally: `PORT=4041 npm run dev:cms`
- To run parity checks: `CMS_PARITY_BASE=http://127.0.0.1:4041 npm run cms:parity`
- The last test run was 312/312 pages passing.
- Re-run parity after any change to blocks, layouts, or converters before switching on the editor.
