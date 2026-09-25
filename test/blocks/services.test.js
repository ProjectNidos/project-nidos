const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { normalizeHtml, sectionOf } = require('../helpers/html');
const { getBlock } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');
const d = require('../../site/digi.en.json');

const P = '/nidos/digitalization.html';
const file = fs.readFileSync(path.join(__dirname, '../..', P), 'utf8');
const ctx = { page: { path: P, layout: 'standard' }, esc, rich: sanitize, anchors: new Set() };
const same = (type, props, selector) =>
  assert.equal(normalizeHtml(`<body>${getBlock(type).render(props, ctx)}</body>`, P),
               normalizeHtml(`<body>${sectionOf(file, selector)}</body>`, P));

test('page-intro', () => same('page-intro', {
  back: { label: d.hero.back, href: d.hero.backHref }, titleLead: d.hero.titleLead,
  titleAccent: d.hero.titleAccent, lede: d.hero.ledeHTML,
}, 'section.page-hero'));

test('service-catalogue', () => same('service-catalogue', {
  anchor: d.ids.practices, heading: d.practices.heading, tocLabel: d.a11y.tocHeading, tocAria: d.a11y.toc,
  practices: d.practices.items.map((p) => ({
    anchor: p.id, title: p.title, tocText: d.toc.items.find((t) => t.href === `#${p.id}`).text,
    outcome: p.outcome, diagram: p.key, body: p.body, problemLabel: p.problemLabel, problemText: p.problemText,
    scopeHeading: p.scopeHeading, scope: p.scope, pkgHeading: p.pkgHeading, pkgName: p.pkgName,
    pkgBody: p.pkgBody, pkgNote: p.pkgNote, priceLead: p.priceLead, price: p.price, priceNote: p.priceNote,
  })),
}, `section#${d.ids.practices}`));

test('steps', () => same('steps', {
  anchor: d.ids.process, heading: d.process.heading,
  items: d.process.steps.map(({ title, body, price }) => (price ? { title, body, price } : { title, body })),
}, `section#${d.ids.process}`));

test('contact-info', () => same('contact-info', {
  anchor: d.ids.contact, heading: d.contact.heading, subheading: d.contact.subheading, body: d.contact.bodyHTML,
  emailLabel: d.contact.emailLabel, email: d.contact.email,
  cta: { label: d.contact.cta.text, href: d.contact.cta.href },
  links: d.contact.links.map((l) => ({ label: l.text, href: l.href })),
}, `section#${d.ids.contact}`));

test('page-intro without back link or accent', () => {
  const html = getBlock('page-intro').render({ titleLead: 'Privacy Policy' }, ctx);
  assert.doesNotMatch(html, /back-link|<br>|page-lede|legal-/);
});

test('page-intro prints the updated date and marks the current document', () => {
  const html = getBlock('page-intro').render({
    titleLead: 'Terms', updated: { label: 'Last updated', date: '2026-09-03' },
    docNav: { label: 'Legal documents', links: [{ label: 'A', href: '/a.html' }, { label: 'Here', href: P }] },
  }, ctx);
  assert.match(html, /<p class="legal-updated">Last updated <time datetime="2026-09-03">3 September 2026<\/time><\/p>/);
  assert.match(html, /<a href="\/a.html">A<\/a>/);
  assert.match(html, /<a href="\/nidos\/digitalization.html" aria-current="page">Here<\/a>/);
});
