#!/usr/bin/env node
/*
 * Builds nidos/digitalizacija.html (LV) and nidos/digitalization.html (EN) from
 * one template and two content files — the same arrangement as the landing, and
 * for the same reason: these two pages were maintained by hand and had already
 * drifted apart once.
 *
 *   node scripts/build-digitalizacija.js            write both pages
 *   node scripts/build-digitalizacija.js --check    verify, exit 1 if stale
 *
 * Output is committed. Nothing runs at request time.
 */
const fs = require('fs');
const path = require('path');
const { esc, render, cmsKeys, keyShape, INDENT } = require('./lib/render');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'site', 'digitalizacija.template.html');
const TARGETS = [
    { content: 'digi.lv.json', out: 'nidos/digitalizacija.html' },
    { content: 'digi.en.json', out: 'nidos/digitalization.html' },
];
const CHECK = process.argv.includes('--check');

/* ---------- blocks ---------- */

const blocks = {
    /* Numbered, because on a page this long the number says where you are.
       <ol> so the numbering is real to a screen reader too, with the printed
       number matching the one on the practice block you are jumping to. */
    toc: (c) => c.toc.items.map((t) => `${INDENT(24)}<li><a href="${esc(t.href)}"><span class="toc-num">${esc(t.num)}</span>${esc(t.text)}</a></li>`).join('\n'),

    /* One <article> per practice.

       Headings: the practice title is the h2; "Pakalpojuma apjoms" and
       "Ieteicamā sākuma pakotne" stay h3 because they head an eleven-item list
       and a three-paragraph block respectively — demoting them would leave 63
       dash items with no heading at all. "Klienta problēma" is a span, because
       it captions a single sentence inside the same paragraph.

       Each practice ends in its own CTA, carrying ?for= so the landing's form
       arrives with the right interest already chosen. Query before hash, or
       window.location.search is empty when landing.js reads it.

       Quiet, not orange. Six orange buttons down a long page put two in view at
       once for a third of it — the sticky title keeps one on screen while the
       next arrives — which breaks the one-orange rule the landing set. The CTA
       is worth having for the preselection, not for being loud; the page's one
       orange is the primary action in the contact section. */
    practices: (c) => c.practices.items.map((p) => `${INDENT(16)}<article class="practice" id="${esc(p.id)}">
${INDENT(20)}<div class="practice-id">
${INDENT(24)}<p class="practice-num">${esc(p.num)}</p>
${INDENT(24)}<h2 data-cms="practice.${p.key}.title">${esc(p.title)}</h2>
${INDENT(24)}<p class="practice-outcome">${esc(p.outcome)}</p>
${INDENT(24)}<a class="btn-quiet" href="${esc(c.practices.ctaBase)}?for=${esc(p.interest)}#contact">${esc(c.practices.ctaText)}</a>
${INDENT(20)}</div>
${INDENT(20)}<div class="practice-detail">
${INDENT(24)}<p class="practice-body">${esc(p.body)}</p>
${INDENT(24)}<p class="practice-problem"><span class="label">${esc(p.problemLabel)}</span>${esc(p.problemText)}</p>
${INDENT(24)}<h3 class="sub">${esc(p.scopeHeading)}</h3>
${INDENT(24)}<ul class="scope-list">
${p.scope.map((s) => `${INDENT(28)}<li>${esc(s)}</li>`).join('\n')}
${INDENT(24)}</ul>
${INDENT(24)}<h3 class="sub">${esc(p.pkgHeading)}</h3>
${INDENT(24)}<p class="pkg-name">${esc(p.pkgName)}</p>
${INDENT(24)}<p class="pkg-body">${esc(p.pkgBody)}</p>
${INDENT(24)}<p class="pkg-note">${esc(p.pkgNote)}</p>
${INDENT(24)}<p class="practice-price">${esc(p.priceLead)} <span data-cms="practice.${p.key}.price">${esc(p.price)}</span></p>
${INDENT(24)}<p class="price-note">${esc(p.priceNote)}</p>
${INDENT(20)}</div>
${INDENT(16)}</article>`).join('\n'),

    /* These ARE a sequence — discovery, build, support, scale — so <ol> and the
       numbers both mean something here. */
    steps: (c) => c.process.steps.map((s) => `${INDENT(20)}<li class="step">
${INDENT(24)}<p class="step-num">${esc(s.num)}</p>
${INDENT(24)}<h3 class="step-title">${esc(s.title)}</h3>
${INDENT(24)}<p class="step-body">${esc(s.body)}</p>${s.price ? `
${INDENT(24)}<p class="step-price">${esc(s.price)}</p>` : ''}
${INDENT(20)}</li>`).join('\n'),

    convictions: (c) => c.why.convictions.map((w) => `${INDENT(20)}<li>${esc(w)}</li>`).join('\n'),

    contactLinks: (c) => c.contact.links.map((l) => `${INDENT(28)}<a class="quiet-link hit-44" href="${esc(l.href)}">${esc(l.text)}</a>`).join('\n'),

    footerCols: (c) => c.footer.cols.map((col) => `${INDENT(20)}<div class="footer-col">
${INDENT(24)}<h3>${esc(col.heading)}</h3>
${col.links.map((l) => `${INDENT(24)}<a href="${esc(l.href)}">${esc(l.text)}</a>`).join('\n')}
${INDENT(20)}</div>`).join('\n'),
};

/* ---------- assertions ---------- */

function assert(lv, en) {
    const problems = [];

    if (keyShape(lv).join('\n') !== keyShape(en).join('\n')) {
        const a = new Set(keyShape(lv));
        const b = new Set(keyShape(en));
        problems.push(`content files disagree on structure.\n  only in LV: ${[...a].filter((k) => !b.has(k)).join(', ') || '-'}\n  only in EN: ${[...b].filter((k) => !a.has(k)).join(', ') || '-'}`);
    }

    const n = lv.practices.items.length;
    if (n !== 6) problems.push(`expected 6 practices, found ${n}`);
    if (n !== en.practices.items.length)
        problems.push(`practice count differs: LV ${n}, EN ${en.practices.items.length}`);

    const lvKeys = lv.practices.items.map((i) => i.key).join(',');
    const enKeys = en.practices.items.map((i) => i.key).join(',');
    if (lvKeys !== enKeys) problems.push(`practice keys differ:\n  LV ${lvKeys}\n  EN ${enKeys}`);

    lv.practices.items.forEach((p, i) => {
        const other = en.practices.items[i];
        if (!other) return;   // count mismatch already reported
        if (p.scope.length !== other.scope.length)
            problems.push(`practice "${p.key}" has ${p.scope.length} scope items in LV, ${other.scope.length} in EN`);
        if (p.id !== other.id)
            problems.push(`practice "${p.key}" anchor differs: LV #${p.id}, EN #${other.id}`);
        if (p.interest !== other.interest)
            problems.push(`practice "${p.key}" ?for= value differs: LV ${p.interest}, EN ${other.interest}`);
    });

    /* The anchors are a contract with two other pages: the landing's cards link
       to them, and the pricing table will carry the same six ids. */
    const EXPECTED = ['crm', 'sales', 'support', 'integrations', 'ai', 'commerce'];
    for (const [lang, doc] of [['LV', lv], ['EN', en]]) {
        const ids = doc.practices.items.map((i) => i.id).join(',');
        if (ids !== EXPECTED.join(','))
            problems.push(`${lang} anchors must stay ${EXPECTED.join(', ')} — the landing and the pricing page link to them. Found: ${ids}`);
    }

    if (lv.toc.items.length !== n) problems.push(`table of contents lists ${lv.toc.items.length} of ${n} practices`);
    lv.toc.items.forEach((t) => {
        if (!lv.practices.items.some((p) => '#' + p.id === t.href))
            problems.push(`table of contents points at ${t.href}, which is not a practice on this page`);
    });

    if (lv.process.steps.length !== en.process.steps.length)
        problems.push(`process steps differ: LV ${lv.process.steps.length}, EN ${en.process.steps.length}`);

    return problems;
}

/* ---------- main ---------- */

function main() {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    /* The EN content file is written after the LV page has been built and
       verified, so a missing one is expected rather than an error. Everything
       that compares the two languages is skipped until both exist. */
    const targets = TARGETS.filter((t) => fs.existsSync(path.join(ROOT, 'site', t.content)));
    if (targets.length < TARGETS.length) {
        console.log('  note: ' + TARGETS.filter((t) => !targets.includes(t)).map((t) => t.content).join(', ') +
                    ' not present yet — building what exists, cross-language checks skipped');
    }
    const contents = targets.map((t) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site', t.content), 'utf8')));

    const problems = assert(contents[0], contents[1] || contents[0]);
    if (problems.length) {
        console.error('build-digitalizacija: refusing to write.\n');
        problems.forEach((p) => console.error('  ✗ ' + p));
        process.exit(1);
    }

    const rendered = targets.map((t, i) => ({ ...t, html: render(template, contents[i], blocks) }));

    const keys = rendered.map((r) => cmsKeys(r.html));
    if (rendered.length > 1 && keys[0].join(',') !== keys[1].join(',')) {
        console.error('build-digitalizacija: refusing to write — data-cms keys differ between pages.');
        process.exit(1);
    }

    let failed = false;
    for (const r of rendered) {
        const dest = path.join(ROOT, r.out);
        if (CHECK) {
            const current = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
            if (current !== r.html) { console.error(`  ✗ ${r.out} is out of date — run: npm run build:pages`); failed = true; }
            else console.log(`  ✓ ${r.out} matches the template`);
        } else {
            fs.writeFileSync(dest, r.html);
            console.log(`  wrote ${r.out.padEnd(30)} ${(r.html.length / 1024).toFixed(1)} KB, ${keys[0].length} data-cms keys`);
        }
    }
    if (failed) process.exit(1);
}

main();
