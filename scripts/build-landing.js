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
const { esc, render, cmsKeys, keyShape, INDENT } = require('./lib/render');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'site', 'landing.template.html');
const TARGETS = [
    { content: 'content.lv.json', out: 'index.html', home: '/' },
    { content: 'content.en.json', out: 'index-en.html', home: '/index-en.html' },
];

const CHECK = process.argv.includes('--check');

/* ---------- block builders ----------
   Six practices, seven select options, two footer columns and the nav links are
   repeated markup. They are built here rather than by a template engine: the
   template holds a {{BLOCK:name}} line and this fills it. */

const blocks = {
    /* The portrait, whether or not there is one yet. A photograph and the
       placeholder occupy the same 4:5 box, so the swap is a content change and
       nothing on the page moves. The name sits in the caption rather than over
       the image: text laid on a photograph nobody has seen yet is a contrast
       problem waiting to happen, and with the caption carrying the name there
       is nothing left for alt to say - hence alt="" on a decorative duplicate.
       The role line is omitted when empty rather than filled with a guess. */
    portrait: (c) => {
        const p = c.about.portrait;
        const initials = p.name.split(/\s+/).map((w) => w[0]).join('');
        const media = p.src
            ? `<img src="${esc(p.src)}" alt="${esc(p.alt)}" width="800" height="1000" loading="lazy" decoding="async">`
            : `<span class="portrait-empty" aria-hidden="true">${esc(initials)}</span>`;
        const role = p.role
            ? `\n${INDENT(24)}<span class="portrait-role">${esc(p.role)}</span>`
            : '';
        return [
            `${INDENT(16)}<figure class="portrait">`,
            `${INDENT(20)}<div class="portrait-frame">${media}</div>`,
            `${INDENT(20)}<figcaption>`,
            `${INDENT(24)}<span class="portrait-name">${esc(p.name)}</span>${role}`,
            `${INDENT(20)}</figcaption>`,
            `${INDENT(16)}</figure>`,
        ].join('\n');
    },

    navLinks: (c) => c.nav.links
        .map((l) => `${INDENT(16)}<a href="${esc(l.href)}">${esc(l.text)}</a>`)
        .join('\n'),

    /* One card per practice, laid out as a grid of cells rather than as floating
       cards: the gap is a 1px hairline showing through, so the six read as one
       table with six compartments. No price here — it lives on the pricing page,
       linked once from the section head.

       On a phone the card folds: the <summary> is what stays on screen and
       everything after it is behind a tap. The scope is written twice on
       purpose - once as a middot line for the folded state, once as the dash
       list for the open one - because a single list inside <summary> would weld
       the heading and the scope together and leave nowhere for the description
       to sit between them, which would reorder the desktop cards too. Both come
       off the same it.bullets, so they cannot drift, and the folded one is
       aria-hidden because the real list is a tap away.

       No name="" here: it is what makes the fold exclusive and landing.js adds
       it at phone width only. Emitting it with six open cards would have let a
       supporting browser close five of them on the desktop grid. */
    practices: (c) => c.practices.items.map((it) => `${INDENT(20)}<li class="card">
${INDENT(24)}<details class="card-fold">
${INDENT(28)}<summary class="card-head">
${INDENT(32)}<h3 data-cms="practice.${it.key}.title">${esc(it.title)}</h3>
${INDENT(32)}<p class="card-brief" aria-hidden="true">${it.bullets.map((b) => esc(b)).join(' &middot; ')}</p>
${INDENT(28)}</summary>
${INDENT(28)}<p class="card-body" data-cms="practice.${it.key}.body">${esc(it.body)}</p>
${INDENT(28)}<ul class="card-scope">
${it.bullets.map((b) => `${INDENT(32)}<li>${esc(b)}</li>`).join('\n')}
${INDENT(28)}</ul>
${INDENT(28)}<a class="card-link" href="${esc(it.href)}">${esc(it.linkText)}</a>
${INDENT(24)}</details>
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

/* ---------- structural assertions ----------
   These are the reason the generator exists. Anything that would let the two
   pages diverge fails the build instead of shipping. */

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
        return { ...t, html: render(template, content, blocks) };
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
