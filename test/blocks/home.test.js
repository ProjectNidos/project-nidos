const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { normalizeHtml, sectionOf } = require('../helpers/html');
const { getBlock } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');
const c = require('../../site/content.en.json');

const file = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const ctx = { page: { path: '/', layout: 'home' }, esc, rich: sanitize, anchors: new Set() };
const same = (type, props, selector) =>
  assert.equal(normalizeHtml(`<body>${getBlock(type).render(props, ctx)}</body>`),
               normalizeHtml(`<body>${sectionOf(file, selector)}</body>`));

test('hero', () => same('hero', {
  titleLead: c.hero.titleLead, titleAccent: c.hero.titleAccent, lede: c.hero.subtitleHTML,
  primary: { label: c.hero.cta, href: '#contact' },
  secondary: { label: c.hero.ctaSecondary, href: c.hero.ctaSecondaryHref },
}, 'section.hero'));

test('text (about)', () => same('text', {
  anchor: 'about', heading: c.about.heading, subheading: c.about.subheading, body: c.about.bodyHTML,
}, 'section#about'));

test('practice-cards', () => same('practice-cards', {
  anchor: 'practices', heading: c.practices.heading,
  sideLink: { label: c.practices.pricingLabel, href: c.practices.pricingHref },
  cards: c.practices.items.map((p) => ({ title: p.title, summary: p.summary, link: { label: p.linkText, href: p.href }, diagram: p.key })),
}, 'section#practices'));

test('reasons', () => same('reasons', { heading: c.why.heading, items: c.why.items }, 'section.why'));

test('contact-form', () => same('contact-form', {
  anchor: 'contact', heading: c.contact.heading, lede: c.contact.lede, infoHeading: c.contact.infoHeading,
  infoBody: c.contact.infoBody, emailLabel: c.contact.emailLabel, email: c.contact.email,
  labels: c.contact.labels, options: c.contact.options.map(({ value, text }) => ({ value, text })), submit: c.contact.submit,
}, 'section#contact'));

test('reasons with no anchor has no id', () => {
  assert.doesNotMatch(getBlock('reasons').render({ heading: 'h', items: c.why.items }, ctx), /<section id=/);
});
