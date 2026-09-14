#!/usr/bin/env node
/*
 * Builds index.html (LV) and index-en.html (EN) from one template and two
 * content files, so the two language versions cannot drift apart.
 *
 *   site/landing.template.html   the only place the structure lives
 *   site/content.lv.json         every Latvian string
 *   site/content.en.json         every English string
 *
 * Output is committed. Nothing here runs at request time: the server still
 * serves plain HTML off disk, and the CMS still treats the committed file as
 * the fallback for every data-cms key.
 *
 *   node scripts/build-landing.js            write both pages
 *   node scripts/build-landing.js --check    verify the committed files match,
 *                                            exit 1 if not (for CI / pre-commit)
 *
 * The build refuses to write if the two content files disagree on structure -
 * see assert() below. That is the whole point of the generator: key parity is
 * guaranteed by construction rather than noticed later.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'site', 'landing.template.html');
const TARGETS = [
    { content: 'content.lv.json', out: 'index.html', home: '/' },
    { content: 'content.en.json', out: 'index-en.html', home: '/index-en.html' },
];

const CHECK = process.argv.includes('--check');

/* ---------- helpers ---------- */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

/* Dot-path lookup. Throws rather than rendering "undefined" into a page. */
function get(obj, pathStr) {
    const value = pathStr.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    if (value === undefined || value === null) throw new Error(`missing content key: ${pathStr}`);
    return value;
}

const INDENT = (n) => ' '.repeat(n);

/* ---------- block builders ----------
   Six practices, seven select options, two footer columns and the nav links are
   repeated markup. They are built here rather than by a template engine: the
   template holds a {{BLOCK:name}} line and this fills it. */

const blocks = {
    navLinks: (c) => c.nav.links
        .map((l) => `${INDENT(16)}<a href="${esc(l.href)}">${esc(l.text)}</a>`)
        .join('\n'),

    /* One row per practice. The price sits in its own grid column so all six
       amounts line up and can be compared without moving. */
    practices: (c) => c.practices.items.map((it) => `${INDENT(20)}<li class="index-row">
${INDENT(24)}<div class="index-head">
${INDENT(28)}<h3 data-cms="practice.${it.key}.title">${esc(it.title)}</h3>
${INDENT(28)}<p class="index-body" data-cms="practice.${it.key}.body">${esc(it.body)}</p>
${INDENT(24)}</div>
${INDENT(24)}<ul class="index-scope">
${it.bullets.map((b) => `${INDENT(28)}<li>${esc(b)}</li>`).join('\n')}
${INDENT(24)}</ul>
${INDENT(24)}<div class="index-price">
${INDENT(28)}<p class="price">${esc(it.priceLead)} <span data-cms="practice.${it.key}.price">${esc(it.priceAmount)}</span></p>
${INDENT(28)}<p class="price-note">${esc(it.priceNote)}</p>
${INDENT(28)}<a class="index-link" href="${esc(it.href)}">${esc(it.linkText)}</a>
${INDENT(24)}</div>
${INDENT(20)}</li>`).join('\n'),

    why: (c) => c.why.items.map((w) => `${INDENT(20)}<div class="why-item">
${INDENT(24)}<p class="why-claim">${esc(w.claim)}</p>
${INDENT(24)}<p class="why-support">${esc(w.support)}</p>
${INDENT(20)}</div>`).join('\n'),

    options: (c) => c.contact.options
        .map((o) => `${INDENT(32)}<option value="${esc(o.value)}" data-cms="${esc(o.cms)}">${esc(o.text)}</option>`)
        .join('\n'),

    footerCols: (c) => c.footer.cols.map((col) => `${INDENT(20)}<div class="footer-col">
${INDENT(24)}<h3>${esc(col.heading)}</h3>
${col.links.map((l) => `${INDENT(24)}<a href="${esc(l.href)}">${esc(l.text)}</a>`).join('\n')}
${INDENT(20)}</div>`).join('\n'),
};

/* ---------- render ---------- */

function render(template, content) {
    let out = template;

    // Blocks first: they introduce markup that must not then be scanned for slots.
    out = out.replace(/^[ \t]*\{\{BLOCK:(\w+)\}\}[ \t]*$/gm, (_, name) => {
        if (!blocks[name]) throw new Error(`unknown block: ${name}`);
        return blocks[name](content);
    });

    // {{{path}}} — raw HTML, for the handful of strings that carry inline markup
    // (<strong>, <span class="key">, <br>). Deliberately not available to the CMS:
    // no data-cms key is placed on an element rendered this way.
    out = out.replace(/\{\{\{([\w.]+)\}\}\}/g, (_, p) => String(get(content, p)));

    // {{path}} — escaped text
    out = out.replace(/\{\{([\w.]+)\}\}/g, (_, p) => esc(get(content, p)));

    const leftover = out.match(/\{\{[^}]*\}\}/);
    if (leftover) throw new Error(`unfilled slot: ${leftover[0]}`);
    return out;
}

/* ---------- structural assertions ----------
   These are the reason the generator exists. Anything that would let the two
   pages diverge fails the build instead of shipping. */

function keyShape(v, prefix = '') {
    if (Array.isArray(v)) return v.map((x, i) => keyShape(x, `${prefix}[]`)).flat();
    if (v && typeof v === 'object') {
        return Object.keys(v).sort().map((k) => keyShape(v[k], `${prefix}.${k}`)).flat();
    }
    return [prefix];
}

function assert(lv, en) {
    const problems = [];

    const a = keyShape(lv).join('\n');
    const b = keyShape(en).join('\n');
    if (a !== b) {
        const sa = new Set(keyShape(lv));
        const sb = new Set(keyShape(en));
        const onlyLv = [...sa].filter((k) => !sb.has(k));
        const onlyEn = [...sb].filter((k) => !sa.has(k));
        problems.push(`content files disagree on structure.\n  only in LV: ${onlyLv.join(', ') || '-'}\n  only in EN: ${onlyEn.join(', ') || '-'}`);
    }

    if (lv.practices.items.length !== en.practices.items.length)
        problems.push(`practice count differs: LV ${lv.practices.items.length}, EN ${en.practices.items.length}`);
    if (lv.practices.items.length !== 6)
        problems.push(`expected 6 practices, found ${lv.practices.items.length}`);

    const lvKeys = lv.practices.items.map((i) => i.key).join(',');
    const enKeys = en.practices.items.map((i) => i.key).join(',');
    if (lvKeys !== enKeys) problems.push(`practice keys differ:\n  LV ${lvKeys}\n  EN ${enKeys}`);

    lv.practices.items.forEach((it, i) => {
        const counterpart = en.practices.items[i];
        // A length mismatch is already reported above; without this guard the
        // loop would dereference the missing entry and crash before printing it.
        if (!counterpart) return;
        if (it.bullets.length !== counterpart.bullets.length)
            problems.push(`practice "${it.key}" has ${it.bullets.length} bullets in LV, ${counterpart.bullets.length} in EN`);
    });

    const lvOpt = lv.contact.options.map((o) => `${o.value}:${o.cms}`).join(',');
    const enOpt = en.contact.options.map((o) => `${o.value}:${o.cms}`).join(',');
    if (lvOpt !== enOpt) problems.push(`form option values/keys differ:\n  LV ${lvOpt}\n  EN ${enOpt}`);

    return problems;
}

/* Every data-cms key must exist on both rendered pages, or the admin panel
   offers a field that silently edits nothing in one language. */
function cmsKeys(html) {
    return [...html.matchAll(/data-cms="([^"]+)"/g)].map((m) => m[1]).sort();
}

/* ---------- main ---------- */

function main() {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    const contents = TARGETS.map((t) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site', t.content), 'utf8')));

    const problems = assert(contents[0], contents[1]);
    if (problems.length) {
        console.error('build-landing: refusing to write.\n');
        problems.forEach((p) => console.error('  ✗ ' + p));
        process.exit(1);
    }

    const rendered = TARGETS.map((t, i) => {
        const content = { ...contents[i], nav: { ...contents[i].nav, home: t.home } };
        return { ...t, html: render(template, content) };
    });

    const kLv = cmsKeys(rendered[0].html);
    const kEn = cmsKeys(rendered[1].html);
    if (kLv.join(',') !== kEn.join(',')) {
        console.error('build-landing: refusing to write — data-cms keys differ between pages.');
        console.error('  only in LV:', kLv.filter((k) => !kEn.includes(k)).join(', ') || '-');
        console.error('  only in EN:', kEn.filter((k) => !kLv.includes(k)).join(', ') || '-');
        process.exit(1);
    }

    let failed = false;
    for (const r of rendered) {
        const dest = path.join(ROOT, r.out);
        if (CHECK) {
            const current = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
            if (current !== r.html) {
                console.error(`  ✗ ${r.out} is out of date — run: npm run build:landing`);
                failed = true;
            } else {
                console.log(`  ✓ ${r.out} matches the template`);
            }
        } else {
            fs.writeFileSync(dest, r.html);
            console.log(`  wrote ${r.out.padEnd(16)} ${(r.html.length / 1024).toFixed(1)} KB, ${kLv.length} data-cms keys`);
        }
    }
    if (failed) process.exit(1);
    if (!CHECK) console.log(`\n  ${kLv.length} CMS keys, identical on both pages.`);
}

main();
