#!/usr/bin/env node
/*
 * The page editor end to end (spec docs/superpowers/specs/2026-09-27-page-
 * editor-design.md §7), against a running development server from this branch
 * (PORT=4041 npm run dev:cms) and the development database.
 *
 * It signs in as a throwaway admin it creates (a random password, never
 * printed) and deactivates at the end, and it leaves every page and the menu
 * and footer as it found them, so `npm run cms:parity` passes after it.
 * Exit 1 on any failure. (page.$eval and evaluate are Playwright calls that run
 * a function in the test browser; nothing here uses eval.)
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { normalizeHtml } = require('../test/helpers/html');

const BASE = process.env.CMS_PARITY_BASE || 'http://127.0.0.1:4041';
const PW = process.env.PW || '/Users/test/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const EMAIL = 'editor-check@example.invalid';
const rows = [];
const check = (where, name, ok, detail = '') => rows.push({ where, name, ok, detail });

async function signIn(prisma) {
  const password = crypto.randomBytes(18).toString('base64url');
  const data = { password: await bcrypt.hash(password, 10), role: 'admin', isActive: true, name: 'Editor check' };
  await prisma.user.upsert({ where: { email: EMAIL }, update: data, create: { email: EMAIL, ...data } });
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password }),
  });
  const token = (res.headers.get('set-cookie') || '').match(/(?:^|[;,]\s*)token=([^;]+)/);
  if (!res.ok || !token) throw new Error(`signing in failed (${res.status})`);
  return token[1];
}

const apiFor = (token) => async (method, url, body) => {
  const res = await fetch(`${BASE}/api/admin${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const pageHtml = async (token, path, flag) =>
  (await fetch(`${BASE}${path}?__cms=${flag}`, { headers: { Cookie: `token=${token}` } })).text();

async function throughTheRoutes(call) {
  const pages = (await call('GET', '/pages')).body;
  check('routes', 'lists the eight pages', Array.isArray(pages) && pages.length === 8, JSON.stringify(pages).slice(0, 200));
  for (const p of pages) {
    const open = (await call('GET', `/pages/${p.id}`)).body;
    const saved = await call('PUT', `/pages/${p.id}/draft`, { baseVersionId: open.versionId, meta: open.meta, blocks: open.blocks });
    const again = (await call('GET', `/pages/${p.id}`)).body;
    check(p.path, 'saved unchanged, it comes back identical', saved.status === 200
      && JSON.stringify(again.blocks) === JSON.stringify(open.blocks) && JSON.stringify(again.meta) === JSON.stringify(open.meta),
    String(saved.status));
    const stale = await call('PUT', `/pages/${p.id}/draft`, { baseVersionId: open.versionId, meta: open.meta, blocks: open.blocks });
    check(p.path, 'a save from a stale copy is refused', stale.status === 409, String(stale.status));
    await call('DELETE', `/pages/${p.id}/draft`);
  }
  const site = (await call('GET', '/site')).body;
  const saved = await call('PUT', '/site/draft', { base: site.base, settings: site.live });
  const again = (await call('GET', '/site')).body;
  check('menu & footer', 'saved unchanged, they come back identical', saved.status === 200
    && JSON.stringify(again.draft) === JSON.stringify(site.live), String(saved.status));
  const stale = await call('PUT', '/site/draft', { base: site.base, settings: site.live });
  check('menu & footer', 'a save from a stale copy is refused', stale.status === 409, String(stale.status));
  await call('DELETE', '/site/draft');

  const pricing = pages.find((p) => p.path === '/nidos/pricing.html');
  const open = (await call('GET', `/pages/${pricing.id}`)).body;
  const blocks = JSON.parse(JSON.stringify(open.blocks));
  blocks[1].props.heading = 'x'.repeat(81);
  const bad = await call('PUT', `/pages/${pricing.id}/draft`, { baseVersionId: open.versionId, meta: open.meta, blocks });
  check('routes', 'an over-long heading is refused, naming its field',
    bad.status === 422 && bad.body.errors.some((e) => e.path === 'blocks[1].heading'), JSON.stringify(bad.body).slice(0, 200));
  return pages;
}

const waitFor = (page, method, part) =>
  page.waitForResponse((r) => r.url().includes(part) && r.request().method() === method);

async function openAdmin(browser, token) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addCookies([{ name: 'token', value: token, url: BASE }]);
  await ctx.addInitScript(() => {
    try { sessionStorage.setItem('pn_gate_unlocked', '1'); sessionStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // The one refused save below is on purpose; the browser logs its 422.
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 422/.test(m.text())) errors.push(m.text()); });
  // Start-up ends by showing the dashboard and then reading the settings; a click before that is undone.
  await Promise.all([waitFor(page, 'GET', '/api/admin/settings'), page.goto(`${BASE}/admin.html`, { waitUntil: 'load' })]);
  await page.click('.crm-nav-item[data-view="pages"]');
  await page.waitForSelector('[data-page-id]');
  return { ctx, page, errors };
}

async function saveDraft(page, part) {
  await Promise.all([waitFor(page, 'PUT', part), page.click('[data-act="save"]')]);
}

// The view reloads what it shows after a publish or a restore; the next step waits for that.
async function publish(page, part, reload) {
  await page.click('[data-act="publish"]');
  await Promise.all([waitFor(page, 'POST', part), waitFor(page, 'GET', reload), page.click('#ui-ask-confirm')]);
}

async function openPreview(ctx, page) {
  const [tab] = await Promise.all([ctx.waitForEvent('page'), page.click('[data-act="preview"]')]);
  await tab.waitForURL(/__cms=draft/, { waitUntil: 'load' });
  return tab;
}

// Edit, preview, publish, then restore the page as it was, in the browser.
async function editPreviewPublishRestore(browser, token, pages, engine, call) {
  const { ctx, page, errors } = await openAdmin(browser, token);
  const where = `pricing ${engine}`;
  const pricing = pages.find((p) => p.path === '/nidos/pricing.html');
  const reload = `/api/admin/pages/${pricing.id}?`;
  // What the page is before the edit, and the version to restore after it.
  const before = normalizeHtml(await pageHtml(token, pricing.path, 1), pricing.path);
  const was = (await call('GET', `/pages/${pricing.id}/versions`)).body.find((v) => v.live).id;
  await page.click(`[data-page-id="${pricing.id}"]`);
  await page.waitForSelector('.pg-card');
  const marks = await page.$$eval('.pg-card', (cards) => cards.map((card, i) => {
    const input = card.querySelector('input[data-kind="text"]');
    return input ? { path: input.dataset.path, mark: `Check ${i}` } : null;
  }).filter(Boolean));
  for (const m of marks) await page.fill(`[data-path="${m.path}"]`, m.mark);
  await saveDraft(page, `/pages/${pricing.id}/draft`);

  const preview = await openPreview(ctx, page);
  // The search title shows in the tab's title; the rest on the page, perhaps in capitals.
  const shown = (await preview.evaluate(() => `${document.title}\n${document.body.innerText}`)).toLowerCase();
  check(where, `the preview shows all ${marks.length} edits`,
    marks.length > 3 && marks.every((m) => shown.includes(m.mark.toLowerCase())), preview.url());
  await preview.close();

  await publish(page, `/pages/${pricing.id}/publish`, reload);
  const live = await pageHtml(token, pricing.path, 1);
  check(where, 'published, the page shows them', marks.every((m) => live.includes(m.mark)));

  await page.click('[data-act="history"]');
  await page.waitForSelector(`[data-restore="${was}"]`);
  await Promise.all([waitFor(page, 'POST', '/restore'), waitFor(page, 'GET', reload), page.click(`[data-restore="${was}"]`)]);
  await publish(page, `/pages/${pricing.id}/publish`, reload);
  const back = normalizeHtml(await pageHtml(token, pricing.path, 1), pricing.path);
  check(where, 'restored and published, the page is as it was before the edit', back === before);
  check(where, 'no errors in the admin', !errors.length, errors.join(' | '));
  await ctx.close();
}

async function listsAndErrors(browser, token, pages, call) {
  const { ctx, page, errors } = await openAdmin(browser, token);
  const services = pages.find((p) => p.path === '/nidos/digitalization.html');
  const scope = async () => (await call('GET', `/pages/${services.id}`)).body.blocks[1].props.practices[0].scope;
  const list = 'blocks[1].practices[0].scope';
  const n = (await scope()).length;
  await page.click(`[data-page-id="${services.id}"]`);
  await page.waitForSelector('.pg-card');

  await page.click(`[data-list-add="${list}"]`);
  await page.fill(`[data-path="${list}[${n}]"]`, 'Check item');
  await saveDraft(page, `/pages/${services.id}/draft`);
  let now = await scope();
  check('services lists', 'an added item is saved at the end', now.length === n + 1 && now[n] === 'Check item', JSON.stringify(now.slice(-2)));

  await page.click(`[data-list="${list}"] > .pg-item[data-index="${n}"] [data-item-act="up"]`);
  await saveDraft(page, `/pages/${services.id}/draft`);
  now = await scope();
  check('services lists', 'moved up, it is saved one place higher', now[n - 1] === 'Check item', JSON.stringify(now.slice(-2)));

  await page.click(`[data-list="${list}"] > .pg-item[data-index="${n - 1}"] [data-item-act="remove"]`);
  await saveDraft(page, `/pages/${services.id}/draft`);
  now = await scope();
  check('services lists', 'removed, it is gone', now.length === n && !now.includes('Check item'), String(now.length));

  const firstText = await page.$eval('.pg-card input[data-kind="text"]', (el) => el.dataset.path);
  await page.fill(`[data-path="${firstText}"]`, '');
  await Promise.all([waitFor(page, 'PUT', `/pages/${services.id}/draft`), page.click('[data-act="save"]')]);
  const flagged = await page.waitForSelector(`.pg-field.is-invalid [data-path="${firstText}"]`, { timeout: 5000 }).then(() => true, () => false);
  check('services errors', 'an emptied required field is marked after saving', flagged);

  await page.click('[data-act="discard"]');
  await Promise.all([waitFor(page, 'DELETE', `/pages/${services.id}/draft`), page.click('#ui-ask-confirm')]);
  check('services', 'discarded, no draft is left', !(await call('GET', '/pages')).body.find((p) => p.id === services.id).hasDraft);
  check('services', 'no errors in the admin', !errors.length, errors.join(' | '));
  await ctx.close();
}

async function menuAndFooter(browser, token, pages, call) {
  const { ctx, page, errors } = await openAdmin(browser, token);
  const original = (await call('GET', '/site')).body.live.footer.legal;
  const setLegal = async (text) => {
    if (await page.$('[data-act="back"]')) await page.click('[data-act="back"]');
    await page.click('[data-site]');
    await page.waitForSelector('[data-path="settings.footer.legal"]');
    await page.fill('[data-path="settings.footer.legal"]', text);
    await saveDraft(page, '/site/draft');
  };

  await setLegal('Check legal line');
  const preview = await openPreview(ctx, page);
  check('menu & footer', 'the preview shows the new footer', (await preview.textContent('footer')).includes('Check legal line'));
  await preview.close();
  await publish(page, '/site/publish', '/api/admin/site?');
  let everywhere = true;
  for (const p of pages) everywhere = everywhere && (await pageHtml(token, p.path === '/404' ? '/no-such-page' : p.path, 1)).includes('Check legal line');
  check('menu & footer', 'published, every page shows it', everywhere);

  await setLegal(original);
  await publish(page, '/site/publish', '/api/admin/site?');
  check('menu & footer', 'put back as it was', (await call('GET', '/site')).body.live.footer.legal === original);
  check('menu & footer', 'no errors in the admin', !errors.length, errors.join(' | '));
  await ctx.close();
}

(async () => {
  require('./lib/dev-db').useDevDatabase();
  const prisma = require('../server/prisma');
  let token;
  try {
    token = await signIn(prisma);
    const call = apiFor(token);
    const pages = await throughTheRoutes(call);
    const pw = require(PW);
    for (const engine of ['chromium', 'webkit']) {
      const browser = await pw[engine].launch();
      await editPreviewPublishRestore(browser, token, pages, engine, call);
      if (engine === 'chromium') {
        await listsAndErrors(browser, token, pages, call);
        await menuAndFooter(browser, token, pages, call);
      }
      await browser.close();
    }
  } catch (err) {
    check('run', 'finished', false, err.message);
  } finally {
    await prisma.user.updateMany({ where: { email: EMAIL }, data: { isActive: false } }).catch(() => {});
    await prisma.$disconnect();
  }
  const failed = rows.filter((r) => !r.ok);
  for (const r of rows) console.log(`${r.ok ? '✓' : '✗'} ${r.where.padEnd(30)} ${r.name}${r.ok ? '' : `  ${r.detail}`}`);
  console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
