#!/usr/bin/env node
/*
 * Builds nidos/digitalization.html from one template and one content file — the
 * same arrangement as the landing.
 *
 *   node scripts/build-digitalization.js            write the page
 *   node scripts/build-digitalization.js --check    verify, exit 1 if stale
 *
 * Output is committed. Nothing runs at request time.
 */
const fs = require('fs');
const path = require('path');
const { esc, render, cmsKeys, INDENT } = require('./lib/render');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'site', 'digitalization.template.html');
const TARGETS = [
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

       Headings: the practice title is the h2; "Scope of service" and
       "Recommended entry package" stay h3 because they head an eleven-item list
       and a three-paragraph block respectively — demoting them would leave 63
       dash items with no heading at all. "Client problem" is a span, because
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

function assert(c) {
    const problems = [];

    const n = c.practices.items.length;
    if (n !== 6) problems.push(`expected 6 practices, found ${n}`);

    /* The anchors are a contract with two other pages: the landing's cards link
       to them, and the pricing table will carry the same six ids. */
    const EXPECTED = ['crm', 'sales', 'support', 'integrations', 'ai', 'commerce'];
    const ids = c.practices.items.map((i) => i.id).join(',');
    if (ids !== EXPECTED.join(','))
        problems.push(`anchors must stay ${EXPECTED.join(', ')} — the landing and the pricing page link to them. Found: ${ids}`);

    if (c.toc.items.length !== n) problems.push(`table of contents lists ${c.toc.items.length} of ${n} practices`);
    c.toc.items.forEach((t) => {
        if (!c.practices.items.some((p) => '#' + p.id === t.href))
            problems.push(`table of contents points at ${t.href}, which is not a practice on this page`);
    });

    return problems;
}

/* ---------- main ---------- */

function main() {
    const template = fs.readFileSync(TEMPLATE, 'utf8');
    const contents = TARGETS.map((t) => JSON.parse(fs.readFileSync(path.join(ROOT, 'site', t.content), 'utf8')));

    const problems = contents.flatMap(assert);
    if (problems.length) {
        console.error('build-digitalization: refusing to write.\n');
        problems.forEach((p) => console.error('  ✗ ' + p));
        process.exit(1);
    }

    const rendered = TARGETS.map((t, i) => ({ ...t, html: render(template, contents[i], blocks) }));

    let failed = false;
    for (const r of rendered) {
        const dest = path.join(ROOT, r.out);
        if (CHECK) {
            const current = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
            if (current !== r.html) { console.error(`  ✗ ${r.out} is out of date — run: npm run build:pages`); failed = true; }
            else console.log(`  ✓ ${r.out} matches the template`);
        } else {
            fs.writeFileSync(dest, r.html);
            console.log(`  wrote ${r.out.padEnd(30)} ${(r.html.length / 1024).toFixed(1)} KB, ${cmsKeys(r.html).length} data-cms keys`);
        }
    }
    if (failed) process.exit(1);
}

main();
