#!/usr/bin/env node
/*
 * The home page as a first-time visitor meets it, in Chromium and WebKit,
 * against a local server of this branch. The files are served, so no database
 * is needed:
 *
 *   NODE_ENV=development DATABASE_URL=postgresql://dummy:dummy@127.0.0.1:1/dummy JWT_SECRET=x PORT=4043 node server.js
 *   npm run landing:check
 *
 * Development mode matters: in production the server asks browsers to upgrade
 * every request to https, and WebKit does that even for 127.0.0.1.
 *
 * Exit 1 on any failure. (page.evaluate runs a function in the test browser;
 * nothing here uses eval.)
 */
const BASE = process.env.LANDING_BASE || 'http://127.0.0.1:4043';
const PW = process.env.PW || '/Users/test/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const rows = [];
const check = (where, name, ok, detail = '') => rows.push({ where, name, ok, detail });

async function context(browser, viewport, { introSeen = false } = {}) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript((seen) => {
    try {
      sessionStorage.setItem('pn_gate_unlocked', '1');
      if (seen) localStorage.setItem('pn_intro_seen', '1');
    } catch (e) {}
  }, introSeen);
  return ctx;
}

const intro = (page) => page.evaluate(() => {
  const main = document.querySelector('main');
  const screen = document.querySelector('.intro-screen');
  return {
    playing: Boolean(screen) && !screen.classList.contains('intro-done'),
    pageShown: getComputedStyle(main).visibility === 'visible',
    pageInert: main.inert === true,
  };
});

async function firstVisit(browser, where) {
  const ctx = await context(browser, { width: 1440, height: 900 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(800);
  const early = await intro(page);
  check(where, 'on a first visit the intro plays over a page already shown', early.playing && early.pageShown, JSON.stringify(early));
  check(where, 'while it plays, the page behind it takes no focus', early.playing && early.pageInert, JSON.stringify(early));
  await page.waitForFunction(() => document.querySelector('.intro-screen').classList.contains('intro-done'), null, { timeout: 15000 });
  const after = await intro(page);
  check(where, 'when it ends, the page is usable', after.pageShown && !after.pageInert, JSON.stringify(after));

  const again = await ctx.newPage();
  await again.goto(`${BASE}/`, { waitUntil: 'load' });
  const second = await intro(again);
  check(where, 'a later visit in the same browser skips it', !second.playing && !second.pageInert, JSON.stringify(second));
  await ctx.close();
}

// Relative luminance and contrast, WCAG 2.
const channels = (c) => c.match(/[\d.]+/g).map(Number);
const lum = ([r, g, b]) => [r, g, b].map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; })
  .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
const over = (top, under) => { const [r, g, b, a = 1] = channels(top); const u = channels(under); return [r, g, b].map((v, i) => v * a + u[i] * (1 - a)); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// While the intro plays it is a dialog: Tab stays in it, Escape skips it, and a
// screen reader hears what it is. (WebKit, like Safari, does not Tab to links
// by default, so the Tab walk runs in Chromium.)
async function introAsDialog(browser, where, engine) {
  const ctx = await context(browser, { width: 1440, height: 900 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const dialog = await page.evaluate(() => {
    const s = document.querySelector('.intro-screen');
    const by = s.getAttribute('aria-labelledby');
    return { role: s.getAttribute('role'), modal: s.getAttribute('aria-modal'), name: by && document.getElementById(by) ? document.getElementById(by).textContent.trim() : s.getAttribute('aria-label') };
  });
  check(where, 'the intro is announced as a dialog, named', dialog.role === 'dialog' && dialog.modal === 'true' && Boolean(dialog.name), JSON.stringify(dialog));
  if (engine === 'chromium') {
    const escaped = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate(() => {
        const el = document.activeElement;
        return el && el !== document.body && !el.closest('.intro-screen') ? `${el.tagName.toLowerCase()} "${el.textContent.trim().slice(0, 20)}"` : null;
      });
      if (stop) escaped.push(stop);
    }
    check(where, 'while it plays, Tab reaches nothing behind it', !escaped.length, escaped.join(', '));
  }
  await page.keyboard.press('Escape');
  const skipped = await page.waitForFunction(() => document.querySelector('.intro-screen').classList.contains('intro-done'), null, { timeout: 1000 }).then(() => true, () => false);
  check(where, 'Escape skips it', skipped);
  const behind = await page.evaluate(() => [...document.body.children].filter((el) => el.inert).map((el) => el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '')));
  check(where, 'after it, nothing on the page is left out of reach', !behind.length, behind.join(', '));
  await ctx.close();
}

// landing.js ends the intro. If it never runs - blocked, a failed download, an
// error - the page must still become usable, not stay under the splash.
async function withoutLandingJs(browser, where) {
  const ctx = await context(browser, { width: 1440, height: 900 });
  await ctx.route((url) => url.pathname === '/landing.js', (route) => route.abort());
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  const usable = await page.waitForFunction(() => {
    const screen = document.querySelector('.intro-screen');
    const covered = screen && getComputedStyle(screen).visibility !== 'hidden' && getComputedStyle(screen).display !== 'none';
    return !covered && !document.querySelector('main').inert && getComputedStyle(document.documentElement).overflowY !== 'hidden';
  }, null, { timeout: 3000 }).then(() => true, () => false);
  check(where, 'without landing.js the page still comes out from under the intro', usable);
  await ctx.close();
}

// And if landing.js starts the intro but breaks partway, nothing may stay frozen.
async function landingJsBreaks(browser, where) {
  const ctx = await context(browser, { width: 1440, height: 900 });
  await ctx.route((url) => url.pathname === '/landing.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: "for (const el of document.body.children) if (!el.classList.contains('intro-screen')) el.inert = true; throw new Error('landing.js broke');",
  }));
  const page = await ctx.newPage();
  page.on('pageerror', () => {});
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  const usable = await page.waitForFunction(() => !document.querySelector('.intro-screen') && ![...document.body.children].some((el) => el.inert),
    null, { timeout: 3000 }).then(() => true, () => false);
  check(where, 'if landing.js breaks partway, the page is still usable', usable);
  await ctx.close();
}

async function phone(browser, where) {
  const ctx = await context(browser, { width: 390, height: 844 }, { introSeen: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  await page.waitForSelector('#cookie-banner');
  await page.waitForTimeout(600); // the banner slides in
  const hidden = await page.evaluate(() => {
    const banner = document.getElementById('cookie-banner').getBoundingClientRect();
    return [...document.querySelectorAll('.hero a, .hero button')].filter((el) => el.offsetHeight)
      .filter((el) => el.getBoundingClientRect().bottom > banner.top).map((el) => el.textContent.trim());
  });
  check(where, 'on a phone the cookie notice leaves both hero buttons in view', !hidden.length, `covered: ${hidden.join(', ')}`);

  const form = await page.evaluate(() => {
    const select = document.getElementById('interest');
    const box = document.querySelector('.field-box');
    const cs = getComputedStyle(box);
    return { value: select.value, first: select.options[0].text, border: cs.borderTopColor, inside: cs.backgroundColor };
  });
  check(where, 'the topic starts unchosen, so no enquiry is filed as CRM by default', form.value === '', JSON.stringify({ value: form.value, first: form.first }));
  const ratio = contrast(over(form.border, form.inside), channels(form.inside));
  check(where, "a form field's outline meets 3:1", ratio >= 3, `${ratio.toFixed(2)}:1`);

  const silent = await page.$$eval('.field-err', (els) => els.filter((el) => !['polite', 'assertive'].includes(el.getAttribute('aria-live'))).map((el) => el.id));
  check(where, "a field's error message is read out when it appears", !silent.length, silent.join(', '));

  // A practice page's "talk to us" link still arrives with its topic chosen.
  const linked = await ctx.newPage();
  await linked.goto(`${BASE}/?for=crm#contact`, { waitUntil: 'load' });
  const topic = await linked.$eval('#interest', (el) => el.value);
  check(where, 'a link from a practice page arrives with its topic chosen', topic === 'crm', topic);
  await ctx.close();
}

(async () => {
  const pw = require(PW);
  try {
    for (const engine of ['chromium', 'webkit']) {
      const browser = await pw[engine].launch();
      await firstVisit(browser, engine);
      await withoutLandingJs(browser, engine);
      await landingJsBreaks(browser, engine);
      await introAsDialog(browser, engine, engine);
      await phone(browser, `${engine} phone`);
      await browser.close();
    }
  } catch (err) {
    check('run', 'finished', false, err.message.split('\n')[0]);
  }
  const failed = rows.filter((r) => !r.ok);
  for (const r of rows) console.log(`${r.ok ? '✓' : '✗'} ${r.where.padEnd(16)} ${r.name}${r.ok ? '' : `  ${r.detail}`}`);
  console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
  process.exit(failed.length ? 1 : 0);
})();
