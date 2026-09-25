#!/usr/bin/env node
/*
 * Files vs database, page by page, on a running development server
 * (npm run dev:cms). Exit 1 on any failure; writes screenshots and diff
 * images to tmp/parity/. See the spec, §7 "Proof nothing changed".
 *
 * Since plan 1b the database pages load their own stylesheets (spec §14), so
 * besides pixels this holds every computed style of every element to the
 * file's: at a width inside every band the stylesheets break at, and in the
 * hover and error states no screenshot reaches.
 *
 * CMS_PARITY_ENGINES=chromium (or webkit) runs one engine, which takes about
 * five minutes.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { normalizeHtml } = require('../test/helpers/html');

const BASE = process.env.CMS_PARITY_BASE || 'http://127.0.0.1:4031';
const PW = process.env.PW || '/Users/test/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const ENGINES = (process.env.CMS_PARITY_ENGINES || 'chromium,webkit').split(',');
const OUT = path.join(__dirname, '..', 'tmp', 'parity');
const SAME_LOOK = [
    '/', '/nidos/digitalization.html', '/nidos/pricing.html',
    '/nidos/privacy.html', '/nidos/terms.html', '/nidos/cookie-policy.html', '/nidos/gdpr.html',
];
// One width inside every band the stylesheets break at (640, 720, 860, 900,
// 1000; the orbit's 1600 too); screenshots at the five used since plan 1a.
const WIDTHS = [390, 700, 768, 880, 960, 1024, 1440, 1920];
const SHOT_WIDTHS = [390, 768, 1024, 1440, 1920];
// States no screenshot reaches, taken at 1440 after it: [action, selector].
// Focus is not among them: the flagged form, below, focuses its first field,
// and a separate focus step would blur on the submit click and move the
// button under the pointer.
const STATES = {
    '/': [['hover', '.index .card'], ['hover', '.why-item']],
    '/nidos/digitalization.html': [['hover', '.toc a']],
    '/nidos/pricing.html': [['hover', '.price-row h3 a']],
    '/nidos/privacy.html': [['hover', '.legal-nav a']],
};
const rows = [];
const check = (page, name, ok, detail = '') => rows.push({ page, name, ok, detail });
const slug = (p) => p.replace(/\W+/g, '_');

const get = async (p, flag) => {
    const r = await fetch(`${BASE}${p}?__cms=${flag}`);
    return { status: r.status, html: await r.text(), cacheControl: r.headers.get('cache-control') || '' };
};

// Share of pixels that differ by more than 8/255; writes a diff image.
function pixelDiff(a, b, out) {
    const py = [
        'import sys',
        'from PIL import Image, ImageChops',
        "a, b = Image.open(sys.argv[1]).convert('RGB'), Image.open(sys.argv[2]).convert('RGB')",
        'if a.size != b.size:',
        "    print('size', a.size, b.size); sys.exit(0)",
        "d = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 8 else 0)",
        'd.save(sys.argv[3])',
        'print(sum(1 for v in d.getdata() if v) / (a.size[0] * a.size[1]))',
    ].join('\n');
    return execFileSync('python3', ['-c', py, a, b, out]).toString().trim();
}

/* Runs in the page. Every computed property of every element in <body>, and
   of its ::before and ::after when they draw - bar custom properties, which
   draw nothing themselves and show up in the properties that use them. Sent
   back as one hash per element, since the full list is megabytes; the
   elements named in `detail` come back in full, to say what differs. */
function styles(detail) {
    const one = (n) => {
        const cls = (n.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).join('.');
        return `${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ''}${cls ? `.${cls}` : ''}`;
    };
    const label = (el) => {
        const parts = [];
        for (let n = el; n && parts.length < 3; n = n.parentElement) {
            parts.unshift(one(n));
            if (n === document.body) break;
        }
        return parts.join(' > ');
    };
    return [...document.querySelectorAll('body, body *')].filter((el) => el.tagName !== 'SCRIPT').map((el, i) => {
        const props = [];
        for (const pseudo of ['', '::before', '::after']) {
            const cs = getComputedStyle(el, pseudo || null);
            if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
            for (let k = 0; k < cs.length; k++) {
                if (!cs[k].startsWith('--')) props.push(`${pseudo}${cs[k]}: ${cs.getPropertyValue(cs[k])}`);
            }
        }
        if (detail && detail.includes(i)) return { el: label(el), props };
        const s = props.join('\n');
        let h = 2166136261;
        for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619);
        return { h: h >>> 0 };
    });
}

// Compares the two pages as they stand; on a difference, says where. A
// difference is taken again after half a second before it counts: an
// observer or a class change can land in one page a moment before the other.
async function sameStyles(file, db, retry = true) {
    const [a, b] = await Promise.all([file.evaluate(styles, null), db.evaluate(styles, null)]);
    if (a.length !== b.length) return [`${a.length} elements in the file, ${b.length} in the database page`];
    const bad = a.map((x, i) => (x.h === b[i].h ? -1 : i)).filter((i) => i >= 0).slice(0, 4);
    if (!bad.length) return [];
    if (retry) {
        await Promise.all([file.waitForTimeout(500), db.waitForTimeout(500)]);
        return sameStyles(file, db, false);
    }
    const [da, db2] = await Promise.all([file.evaluate(styles, bad), db.evaluate(styles, bad)]);
    return bad.map((i) => {
        const theirs = new Map(db2[i].props.map((p) => [p.slice(0, p.indexOf(': ')), p]));
        const diff = da[i].props.filter((p) => theirs.get(p.slice(0, p.indexOf(': '))) !== p).slice(0, 2)
            .map((p) => `${p} ≠ ${theirs.get(p.slice(0, p.indexOf(': '))) || '(not set)'}`);
        if (theirs.size !== da[i].props.length) diff.push(`${da[i].props.length} properties ≠ ${theirs.size}`);
        return `${da[i].el}: ${diff.join('; ')}`;
    });
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });

    for (const p of SAME_LOOK) {
        const [file, db] = [await get(p, 0), await get(p, 1)];
        const [a, b] = [normalizeHtml(file.html, p), normalizeHtml(db.html, p)];
        const at = [...a].findIndex((ch, i) => ch !== b[i]);
        check(p, 'body html', a === b, a === b ? '' : `at ${at}: file «${a.slice(at, at + 150)}» db «${b.slice(at, at + 150)}»`);
        // Smaller is fine: the database pages drop the build comment, indentation and
        // some head tags (spec §13); the body-html row above catches any content change.
        const ratio = db.html.length / file.html.length;
        check(p, 'size not above file +5%', ratio <= 1.05, `${(ratio * 100).toFixed(1)}%`);
        // The two pages are meant to be identical, so every row above can pass while
        // comparing the file with itself - a build error or a missing page silently
        // falls through to the file (server/cms/middleware.js), and only a forced
        // response's Cache-Control: no-store proves the database version was hit.
        check(p, 'served from the database', db.cacheControl.includes('no-store'), db.cacheControl);
    }

    const nf = await fetch(`${BASE}/no-such-page?__cms=1`);
    const nfHtml = await nf.text();
    check('/404', 'status 404 from the database', nf.status === 404 && nfHtml.includes('Page not found.'), String(nf.status));

    const pw = require(PW);
    for (const engine of ENGINES) {
        let browser;
        try { browser = await pw[engine].launch(); } catch (e) { check(engine, 'launch', false, e.message); continue; }
        for (const p of SAME_LOOK) {
            for (const w of WIDTHS) {
                const where = `${p} ${engine} ${w}`;
                // Both versions open side by side and are put through the same steps,
                // so each state is compared the moment both are in it.
                const sides = [];
                for (const flag of [0, 1]) {
                    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
                    await ctx.addInitScript(() => {
                        try { sessionStorage.setItem('pn_gate_unlocked', '1'); sessionStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
                    });
                    const page = await ctx.newPage();
                    const errors = [];
                    page.on('pageerror', (e) => errors.push(String(e)));
                    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
                    const resp = await page.goto(`${BASE}${p}?__cms=${flag}`, { waitUntil: 'load' });
                    sides.push({ ctx, page, errors, cacheControl: (resp && (await resp.headerValue('cache-control'))) || '' });
                }
                const [file, db] = sides;
                const both = (fn) => Promise.all(sides.map(({ page }) => fn(page)));
                // Same reasoning as the HTTP pass above: a silent fallback to the file
                // would otherwise pass every row below too.
                check(where, 'browser got the database page', db.cacheControl.includes('no-store'), db.cacheControl);
                await both((pg) => pg.waitForTimeout(1500));
                let diff = await sameStyles(file.page, db.page);
                check(where, 'computed styles, at rest', !diff.length, diff.join(' | '));
                if (SHOT_WIDTHS.includes(w)) {
                    const shots = [0, 1].map((flag) => path.join(OUT, `${engine}-${w}-${slug(p)}-${flag}.png`));
                    await file.page.screenshot({ path: shots[0], fullPage: true });
                    await db.page.screenshot({ path: shots[1], fullPage: true });
                    const d = pixelDiff(shots[0], shots[1], path.join(OUT, `${engine}-${w}-${slug(p)}-diff.png`));
                    check(where, 'pixels', !d.startsWith('size') && Number(d) <= 0.001, d);
                }
                for (const [action, selector] of w === 1440 ? STATES[p] || [] : []) {
                    await both((pg) => pg[action](selector));
                    await both((pg) => pg.waitForTimeout(300));
                    diff = await sameStyles(file.page, db.page);
                    check(where, `computed styles, ${action} ${selector}`, !diff.length, diff.join(' | '));
                }
                const orbit = await both((pg) => pg.locator('.hero-orbit.is-drawn').count());
                let invalid = [null, null];
                if (p === '/') {
                    await both((pg) => pg.click('.contact-form button[type="submit"]'));
                    await both((pg) => pg.waitForTimeout(300));
                    invalid = await both((pg) => pg.locator('.contact-form .is-invalid').count());
                    diff = await sameStyles(file.page, db.page);
                    check(where, 'computed styles, form flagged', !diff.length, diff.join(' | '));
                    check(where, 'form flags 3 empty fields', invalid[1] === 3, String(invalid[1]));
                }
                check(where, 'no console errors', sides.every((s) => !s.errors.length), JSON.stringify(sides.map((s) => s.errors)));
                check(where, 'same behaviour', invalid[0] === invalid[1] && orbit[0] === orbit[1], JSON.stringify({ invalid, orbit }));
                await Promise.all(sides.map((s) => s.ctx.close()));
            }
        }
        await browser.close();
    }

    const failed = rows.filter((r) => !r.ok);
    for (const r of rows) console.log(`${r.ok ? '✓' : '✗'} ${r.page.padEnd(40)} ${r.name}${r.ok ? '' : '  ' + r.detail}`);
    console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
    process.exit(failed.length ? 1 : 0);
})();
