#!/usr/bin/env node
/*
 * Files vs database, page by page, on a running development server
 * (npm run dev:cms). Exit 1 on any failure; writes screenshots and diff
 * images to tmp/parity/. See the spec, §7 "Proof nothing changed".
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { normalizeHtml } = require('../test/helpers/html');

const BASE = process.env.CMS_PARITY_BASE || 'http://127.0.0.1:4031';
const PW = process.env.PW || '/Users/test/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core';
const OUT = path.join(__dirname, '..', 'tmp', 'parity');
const SAME_LOOK = [
    '/', '/nidos/digitalization.html', '/nidos/pricing.html',
    '/nidos/privacy.html', '/nidos/terms.html', '/nidos/cookie-policy.html', '/nidos/gdpr.html',
];
const WIDTHS = [390, 768, 1024, 1440, 1920];
const rows = [];
const check = (page, name, ok, detail = '') => rows.push({ page, name, ok, detail });
const slug = (p) => p.replace(/\W+/g, '_');

const get = async (p, flag) => {
    const r = await fetch(`${BASE}${p}?__cms=${flag}`);
    return { status: r.status, html: await r.text() };
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
    }

    const nf = await fetch(`${BASE}/no-such-page?__cms=1`);
    const nfHtml = await nf.text();
    check('/404', 'status 404 from the database', nf.status === 404 && nfHtml.includes('Page not found.'), String(nf.status));

    const pw = require(PW);
    for (const engine of ['chromium', 'webkit']) {
        let browser;
        try { browser = await pw[engine].launch(); } catch (e) { check(engine, 'launch', false, e.message); continue; }
        for (const p of SAME_LOOK) {
            for (const w of WIDTHS) {
                const shots = [];
                const seen = [];
                for (const flag of [0, 1]) {
                    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
                    await ctx.addInitScript(() => {
                        try { sessionStorage.setItem('pn_gate_unlocked', '1'); sessionStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
                    });
                    const page = await ctx.newPage();
                    const errors = [];
                    page.on('pageerror', (e) => errors.push(String(e)));
                    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
                    await page.goto(`${BASE}${p}?__cms=${flag}`, { waitUntil: 'load' });
                    await page.waitForTimeout(1500);
                    const shot = path.join(OUT, `${engine}-${w}-${slug(p)}-${flag}.png`);
                    await page.screenshot({ path: shot, fullPage: true });
                    shots.push(shot);
                    let invalid = null;
                    if (p === '/') {
                        await page.click('.contact-form button[type="submit"]');
                        invalid = await page.locator('.contact-form .is-invalid').count();
                    }
                    seen.push({ errors, invalid, orbit: await page.locator('.hero-orbit.is-drawn').count() });
                    await ctx.close();
                }
                const where = `${p} ${engine} ${w}`;
                const d = pixelDiff(shots[0], shots[1], path.join(OUT, `${engine}-${w}-${slug(p)}-diff.png`));
                check(where, 'pixels', !d.startsWith('size') && Number(d) <= 0.001, d);
                check(where, 'no console errors', seen.every((x) => !x.errors.length), JSON.stringify(seen.map((x) => x.errors)));
                check(where, 'same behaviour', seen[0].invalid === seen[1].invalid && seen[0].orbit === seen[1].orbit,
                    JSON.stringify(seen.map(({ invalid, orbit }) => ({ invalid, orbit }))));
                if (p === '/') check(where, 'form flags 3 empty fields', seen[1].invalid === 3, String(seen[1].invalid));
            }
        }
        await browser.close();
    }

    const failed = rows.filter((r) => !r.ok);
    for (const r of rows) console.log(`${r.ok ? '✓' : '✗'} ${r.page.padEnd(40)} ${r.name}${r.ok ? '' : '  ' + r.detail}`);
    console.log(`\n${rows.length - failed.length}/${rows.length} passed`);
    process.exit(failed.length ? 1 : 0);
})();
