const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { normalizeHtml, sectionOf } = require('../helpers/html');
const { getBlock } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');
const { validatePage } = require('../../server/cms/validate');
const { convertLegal, convert404 } = require('../../scripts/lib/cms-convert');

const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');

for (const f of ['privacy', 'terms', 'cookie-policy', 'gdpr']) {
  const P = `/nidos/${f}.html`;
  const file = read(P);
  const ctx = { page: { path: P, layout: 'standard' }, esc, rich: sanitize, anchors: new Set() };
  const { page, blocks } = convertLegal(file);
  const same = (b, selector) =>
    assert.equal(normalizeHtml(`<body>${getBlock(b.type).render(b.props, ctx)}</body>`, P),
                 normalizeHtml(`<body>${sectionOf(file, selector)}</body>`, P));

  test(`${f}: valid, noindex, titled`, () => {
    assert.deepEqual(validatePage(page.layout, blocks), []);
    assert.deepEqual(blocks.map((b) => b.type), ['page-intro', 'legal-document']);
    assert.equal(page.noindex, true);
    assert.match(page.seoTitle, /\| Project Nidos$/);
  });
  test(`${f}: page intro matches`, () => same(blocks[0], 'section.page-hero'));
  test(`${f}: document matches`, () => same(blocks[1], 'section.legal-section'));
}

test('only privacy has an at-a-glance grid', () => {
  assert.equal(convertLegal(read('nidos/privacy.html')).blocks[1].props.glance.length, 4);
  assert.equal(convertLegal(read('nidos/terms.html')).blocks[1].props.glance, undefined);
});

test('404 page', () => {
  const { page, blocks } = convert404();
  assert.deepEqual(validatePage(page.layout, blocks), []);
  assert.equal(page.noindex, true);
});

test('button-row renders one or two buttons', () => {
  const ctx = { page: { path: '/404', layout: 'standard' }, esc, rich: sanitize, anchors: new Set() };
  const one = getBlock('button-row').render({ primary: { label: 'Home', href: '/' } }, ctx);
  assert.match(one, /class="btn-primary">Home</);
  assert.doesNotMatch(one, /btn-quiet/);
});
