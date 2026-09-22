#!/usr/bin/env node
/*
 * Builds index.html from one template and one content file.
 *
 *   site/landing.template.html   the only place the structure lives
 *   site/content.en.json         every string on the page
 *
 * Output is committed. Nothing here runs at request time: the server still
 * serves plain HTML off disk, and the CMS still treats the committed file as
 * the fallback for every data-cms key.
 *
 *   node scripts/build-landing.js            write the page
 *   node scripts/build-landing.js --check    verify the committed file matches,
 *                                            exit 1 if not (for CI / pre-commit)
 *
 * The build refuses to write if the content file does not have the shape the
 * template and the CRM expect - see assert() below.
 */
const fs = require('fs');
const path = require('path');
const { esc, render, cmsKeys, INDENT } = require('./lib/render');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'site', 'landing.template.html');
const TARGETS = [
    { content: 'content.en.json', out: 'index.html', home: '/' },
];

const CHECK = process.argv.includes('--check');

/* ---------- block builders ----------
   Six practices, seven select options, two footer columns and the nav links are
   repeated markup. They are built here rather than by a template engine: the
   template holds a {{BLOCK:name}} line and this fills it. */

/* ---------- the why glyphs ----------
   Three line marks from Tabler Icons (MIT), inlined rather than installed: the
   landing ships no icon font and no sprite sheet, and three 24px paths cost
   less than either. Drawn at stroke-width 1.5 instead of Tabler's own 2 so they
   sit at the weight of the hairlines around them rather than above it.

   aria-hidden, because each one only restates the claim beneath it. */
const WHY_GLYPHS = {
    // route-alt-left — one path branching and rejoining: the full cycle.
    route: ['M8 3h-5v5', 'M16 3h5v5',
            'M3 3l7.536 7.536a5 5 0 0 1 1.464 3.534v6.93',
            'M18 6.01v-.01', 'M16 8.02v-.01', 'M14 10v.01'],
    // terminal-2 — a prompt, for software over slideware.
    terminal: ['M8 9l3 3l-3 3', 'M13 15l3 0',
               'M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z'],
    // currency-dollar — the co-funding.
    dollar: ['M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2',
             'M12 3v3m0 12v3'],
};

function whyGlyph(name) {
    const paths = WHY_GLYPHS[name];
    if (!paths) throw new Error(`unknown why icon "${name}" — expected one of ${Object.keys(WHY_GLYPHS).join(', ')}`);
    return `<svg class="why-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor"`
        + ` stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`
        + ` aria-hidden="true" focusable="false">`
        + paths.map((d) => `<path d="${d}"/>`).join('')
        + `</svg>`;
}

const blocks = {
    /* The portrait, whether or not there is one yet. A photograph and the
       placeholder occupy the same 4:5 box, so the swap is a content change and
       nothing on the page moves.

       The caption sits inside the frame, on a scrim across its foot. That is a
       contrast problem by construction - it is type over a photograph nobody
       has chosen yet - so the scrim is built for the worst case rather than for
       the picture we expect: see .portrait figcaption in landing.css for the
       measurement against a pure white frame.

       Structure follows the caption's own job. The name and the role are one
       identity and stay together on the left; `meta` is a separate fact about
       the person - a city, a base - and sits opposite. Both optional: an empty
       role or meta is omitted rather than filled with a guess, and the band
       renders with whatever is there.

       alt="" on the image is deliberate. The figcaption already names the
       person to a screen reader, so alt would be a duplicate. */
    portrait: (c) => {
        const p = c.about.portrait;
        const initials = p.name.split(/\s+/).map((w) => w[0]).join('');
        const media = p.src
            ? `<img src="${esc(p.src)}" alt="${esc(p.alt)}" width="800" height="1000" loading="lazy" decoding="async">`
            : `<span class="portrait-empty" aria-hidden="true">${esc(initials)}</span>`;
        const role = p.role
            ? `\n${INDENT(28)}<span class="portrait-role">${esc(p.role)}</span>`
            : '';
        const meta = p.meta
            ? `\n${INDENT(24)}<span class="portrait-meta">${esc(p.meta)}</span>`
            : '';
        return [
            `${INDENT(16)}<figure class="portrait">`,
            `${INDENT(20)}<div class="portrait-frame">`,
            `${INDENT(24)}${media}`,
            `${INDENT(24)}<figcaption>`,
            `${INDENT(28)}<span class="portrait-id">`,
            `${INDENT(32)}<span class="portrait-name">${esc(p.name)}</span>${role}`,
            `${INDENT(28)}</span>${meta}`,
            `${INDENT(24)}</figcaption>`,
            `${INDENT(20)}</div>`,
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

    /* One reason per column. The glyph is chosen in the content file and drawn
       here: `icon` names an entry in WHY_GLYPHS, so the pairing of a mark to a
       claim is a content decision and the paths stay out of the JSON. An
       unknown name fails the build rather than rendering an empty column. */
    why: (c) => c.why.items.map((w) => `${INDENT(20)}<div class="why-item">
${INDENT(24)}<span class="why-icon">${whyGlyph(w.icon)}</span>
${INDENT(24)}<p class="why-claim"><span>${esc(w.claim)}</span></p>
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
   The template and the CRM both assume a shape: six practice cards, three
   reason columns, one known glyph per reason, and form option values the
   lead-interest map is keyed on. Anything else fails the build instead of
   shipping a page with an empty cell or a lead nobody can route. */

function assert(c) {
    const problems = [];

    if (c.practices.items.length !== 6)
        problems.push(`expected 6 practices, found ${c.practices.items.length}`);

    if (c.why.items.length !== 3)
        problems.push(`expected 3 reasons, found ${c.why.items.length}`);
    c.why.items.forEach((w) => {
        if (!WHY_GLYPHS[w.icon]) problems.push(`unknown why icon "${w.icon}" — expected one of ${Object.keys(WHY_GLYPHS).join(', ')}`);
    });

    /* The option VALUES are what the CRM's lead-interest map is keyed on (see
       server/lib/settings.js). They are Latvian slugs from when the site was
       bilingual, and they stay that way: renaming one here without the map
       would file every lead for it under "general". */
    const values = c.contact.options.map((o) => o.value);
    const dupes = values.filter((v, i) => values.indexOf(v) !== i);
    if (dupes.length) problems.push(`duplicate form option values: ${dupes.join(', ')}`);

    return problems;
}

/* ---------- main ---------- */

function main() {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    const contents = TARGETS.map((t) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site', t.content), 'utf8')));

    const problems = contents.flatMap(assert);
    if (problems.length) {
        console.error('build-landing: refusing to write.\n');
        problems.forEach((p) => console.error('  ✗ ' + p));
        process.exit(1);
    }

    const rendered = TARGETS.map((t, i) => {
        const content = { ...contents[i], nav: { ...contents[i].nav, home: t.home } };
        return { ...t, html: render(template, content, blocks) };
    });

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
            console.log(`  wrote ${r.out.padEnd(16)} ${(r.html.length / 1024).toFixed(1)} KB, ${cmsKeys(r.html).length} data-cms keys`);
        }
    }
    if (failed) process.exit(1);
}

main();
