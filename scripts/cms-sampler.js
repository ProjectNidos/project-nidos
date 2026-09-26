#!/usr/bin/env node
/*
 * Every block on both layouts (spec §14), against a running development
 * server from this branch (npm run dev:cms). The two sampler pages are drawn
 * here, with this branch's code and the imported pages' own content, and
 * handed to the browser at /__sampler/<layout>; everything they load comes
 * from the server, and the database is not read.
 *
 * Checks that nothing breaks when a block leaves the layout it was written
 * for, and that each block looks the same on both layouts. Writes full-page
 * screenshots to tmp/sampler/ for a person to look at. Exit 1 on any failure.
 */
const fs = require('fs');
const path = require('path');
const { renderPage } = require('../server/cms/layout');
const conv = require('./lib/cms-convert');
const { BLOCK_TYPES } = require('../blocks');

const BASE = process.env.CMS_PARITY_BASE || 'http://127.0.0.1:4031';
const PW = process.env.PW || '/Users/test/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const OUT = path.join(__dirname, '..', 'tmp', 'sampler');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const rows = [];
const check = (where, name, ok, detail = '') => rows.push({ where, name, ok, detail });

// The first block of each type on the pages the import builds, in the order
// blocks/index.js lists the types, then a second Practice cards grid - no
// anchor, so no second id - to show the pointer pane serves both.
function samplerBlocks() {
    const pages = [
        conv.convertHome(JSON.parse(read('site/content.en.json'))),
        conv.convertServices(JSON.parse(read('site/digi.en.json'))),
        conv.convertPricing(read('nidos/pricing.html')),
        conv.convertLegal(read('nidos/privacy.html')),
        conv.convert404(),
    ];
    const first = new Map();
    for (const { blocks } of pages) for (const b of blocks) if (!first.has(b.type)) first.set(b.type, b);
    const missing = BLOCK_TYPES.filter((t) => !first.has(t));
    if (missing.length) throw new Error(`no sample of ${missing.join(', ')}`);
    const cards = first.get('practice-cards');
    return [...BLOCK_TYPES.map((t) => first.get(t)),
        { ...cards, id: 'second-grid', props: { ...cards.props, anchor: undefined } }];
}

const site = conv.siteSettingsFrom(JSON.parse(read('site/content.en.json')));
const blocks = samplerBlocks();
const html = (layout) => renderPage({
    page: { path: `/__sampler/${layout}`, layout, seoTitle: `Every block, ${layout} layout`, seoDescription: 'Sampler.', noindex: true },
    blocks,
    site,
});

// Runs in the page: every computed property of every element of each block,
// as the parity run takes them, sent whole - a dozen of these, not the parity
// run's hundreds.
function blockStyles() {
    return [...document.querySelectorAll('main > section')].map((section) =>
        [section, ...section.querySelectorAll('*')].map((el) => {
            const props = [];
            for (const pseudo of ['', '::before', '::after']) {
                const cs = getComputedStyle(el, pseudo || null);
                if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
                for (let k = 0; k < cs.length; k++) {
                    if (!cs[k].startsWith('--')) props.push(`${pseudo}${cs[k]}: ${cs.getPropertyValue(cs[k])}`);
                }
            }
            const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).join('.');
            return { el: `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`, props };
        }));
}

// On a phone the home frame lets anchors land nearer the top (its nav has
// scrolled away) and gives the hero room under the nav that lies over it,
// which also makes the hero - and the orbit's canvas that fills it - taller.
// What follows from that height is the frame's doing too: transform and
// perspective origins sit at half the box, and the canvas takes its aspect
// ratio from the box it fills. None of it is the block's. Only the hero's own
// box and the canvas grow; nothing inside them is excused.
const frameOwned = (w, el, prop) => w <= 720 && (/^scroll-margin-(top|block-start)$/.test(prop)
    || (/^(section\.hero\.|canvas\.hero-orbit)/.test(el)
        && /^(padding-top|padding-block-start|height|block-size|perspective-origin|transform-origin|aspect-ratio)$/.test(prop)));

function blockDiff(w, home, standard) {
    const out = [];
    home.forEach((els, i) => {
        if (standard[i].length !== els.length) {
            out.push(`${els[0].el}: ${els.length} elements on home, ${standard[i].length} on standard`);
            return;
        }
        els.forEach((e, j) => {
            const theirs = new Map(standard[i][j].props.map((p) => [p.slice(0, p.indexOf(': ')), p]));
            if (theirs.size !== e.props.length && out.length < 8) {
                out.push(`${e.el}: ${e.props.length} properties on home, ${theirs.size} on standard`);
            }
            for (const p of e.props) {
                const name = p.slice(0, p.indexOf(': '));
                if (theirs.get(name) !== p && !frameOwned(w, e.el, name) && out.length < 8) {
                    out.push(`${e.el} ${p} ≠ ${theirs.get(name) || '(not set)'}`);
                }
            }
        });
    });
    return out;
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const pw = require(PW);
    for (const engine of ['chromium', 'webkit']) {
        const browser = await pw[engine].launch();
        for (const w of [390, 1024, 1440]) {
            const styles = {};
            for (const layout of ['home', 'standard']) {
                const where = `${layout} ${engine} ${w}`;
                const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
                await ctx.addInitScript(() => {
                    try { sessionStorage.setItem('pn_gate_unlocked', '1'); sessionStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
                });
                const page = await ctx.newPage();
                const errors = [];
                page.on('pageerror', (e) => errors.push(String(e)));
                page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
                const url = `${BASE}/__sampler/${layout}`;
                await page.route(url, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: html(layout) }));
                await page.goto(url, { waitUntil: 'load' });
                await page.waitForTimeout(1500);
                // Things the fixed wait can lose a race to, in WebKit
                // under load: a web font arriving late (it shifts widths by a
                // fraction of a pixel) and the orbit's first frame. Neither
                // wait costs anything once they have happened; the orbit's is
                // bounded and never throws, so a hero that never draws still
                // fails "the orbit draws" below instead of stopping the run.
                await page.evaluate(() => document.fonts.ready);
                await page.waitForSelector('.hero-orbit.is-drawn', { timeout: 10000 }).catch(() => {});
                // And the page itself showing: on the home layout the intro
                // lock hides <main> until it lifts, and under load WebKit has
                // been a beat behind on that too. The standard layout has no
                // lock, so this returns at once there.
                await page.waitForFunction(() => getComputedStyle(document.querySelector('main')).visibility === 'visible', null, { timeout: 10000 }).catch(() => {});
                const flat = await page.$$eval('main > section', (s) =>
                    s.filter((x) => !x.getBoundingClientRect().height).map((x) => x.className));
                check(where, 'every block has a box', !flat.length, flat.join(', '));
                check(where, 'the orbit draws', (await page.locator('.hero-orbit.is-drawn').count()) === 1);
                styles[layout] = await page.evaluate(blockStyles);
                if (w !== 1024) await page.screenshot({ path: path.join(OUT, `${engine}-${w}-${layout}.png`), fullPage: true });
                if (w === 1440) {
                    const grid = page.locator('.b-practice-cards').nth(1);
                    await grid.locator('.card').first().hover();
                    await page.waitForTimeout(300);
                    check(where, 'the pointer pane lights the second grid', (await grid.locator('.index-hl.is-on').count()) === 1);
                }
                await page.click('.contact-form button[type="submit"]');
                await page.waitForTimeout(300);
                check(where, 'the form flags 3 empty fields', (await page.locator('.contact-form .is-invalid').count()) === 3);
                check(where, 'no console errors', !errors.length, errors.join(' | '));
                await ctx.close();
            }
            const diff = blockDiff(w, styles.home, styles.standard);
            check(`both layouts ${engine} ${w}`, 'each block looks the same on both', !diff.length, diff.join(' | '));
        }
        await browser.close();
    }
    const failed = rows.filter((r) => !r.ok);
    for (const r of rows) console.log(`${r.ok ? '✓' : '✗'} ${r.where.padEnd(28)} ${r.name}${r.ok ? '' : '  ' + r.detail}`);
    console.log(`\n${rows.length - failed.length}/${rows.length} passed; screenshots in tmp/sampler/`);
    process.exit(failed.length ? 1 : 0);
})();
