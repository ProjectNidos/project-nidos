const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { normalizeHtml } = require('../helpers/html');
const { renderPage, resolveNavHref } = require('../../server/cms/layout');
const conv = require('../../scripts/lib/cms-convert');

const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
const site = conv.siteSettingsFrom(require('../../site/content.en.json'));
const PAGES = [
  ['index.html', '/', () => conv.convertHome(require('../../site/content.en.json'))],
  ['nidos/digitalization.html', '/nidos/digitalization.html', () => conv.convertServices(require('../../site/digi.en.json'))],
  ['nidos/pricing.html', '/nidos/pricing.html', () => conv.convertPricing(read('nidos/pricing.html'))],
  ...['privacy', 'terms', 'cookie-policy', 'gdpr'].map((f) =>
    [`nidos/${f}.html`, `/nidos/${f}.html`, () => conv.convertLegal(read(`nidos/${f}.html`))]),
];
const sheets = (html, p) => cheerio.load(html)('link[rel="stylesheet"]').map((_, l) => {
  const u = new URL(l.attribs.href, 'https://site.invalid' + p);
  return u.pathname + u.search;
}).get();

for (const [file, pagePath, convert] of PAGES) {
  const { page, blocks } = convert();
  const html = renderPage({ page: { ...page, path: pagePath }, blocks, site });
  test(`${file}: body is unchanged`, () => {
    assert.equal(normalizeHtml(html, pagePath), normalizeHtml(read(file), pagePath));
  });
  test(`${file}: same stylesheets, same title and description`, () => {
    assert.deepEqual(sheets(html, pagePath), sheets(read(file), pagePath));
    const a = cheerio.load(html);
    const b = cheerio.load(read(file));
    assert.equal(a('title').text(), b('title').text().trim());
    assert.equal(a('meta[name="description"]').attr('content'), b('meta[name="description"]').attr('content'));
  });
}

test('nav: anchors on the page win, home fragments collapse on home', () => {
  const services = { text: 'Services', href: '/nidos/digitalization.html', anchor: 'practices' };
  const about = { text: 'About', href: '/#about', anchor: 'about' };
  assert.deepEqual(resolveNavHref(services, { path: '/' }, new Set(['practices'])), { href: '#practices', current: false });
  assert.deepEqual(resolveNavHref(services, { path: '/nidos/digitalization.html' }, new Set(['services'])), { href: '/nidos/digitalization.html', current: true });
  assert.deepEqual(resolveNavHref(about, { path: '/nidos/pricing.html' }, new Set()), { href: '/#about', current: false });
});

test('unknown block type throws, naming it', () => {
  assert.throws(() => renderPage({ page: { path: '/x', layout: 'standard', seoTitle: 't', seoDescription: 'd' },
    blocks: [{ id: 'a', type: 'gone', props: {} }], site }), /unknown block type "gone"/);
});

test('noindex pages say so and carry no canonical on /404', () => {
  const { page, blocks } = conv.convert404();
  const html = renderPage({ page: { ...page, path: '/404' }, blocks, site });
  assert.match(html, /<meta name="robots" content="noindex, follow">/);
  assert.doesNotMatch(html, /rel="canonical"/);
});
