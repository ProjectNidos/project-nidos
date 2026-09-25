const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { normalizeHtml, sectionOf } = require('../helpers/html');
const { getBlock } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');
const { validatePage } = require('../../server/cms/validate');
const { convertPricing } = require('../../scripts/lib/cms-convert');

const P = '/nidos/pricing.html';
const file = fs.readFileSync(path.join(__dirname, '../..', P), 'utf8');
const ctx = { page: { path: P, layout: 'standard' }, esc, rich: sanitize, anchors: new Set() };
const { page, blocks } = convertPricing(file);

test('the converted page is valid', () => {
  assert.deepEqual(validatePage(page.layout, blocks), []);
  assert.deepEqual(blocks.map((b) => b.type),
    ['page-intro', 'pricing-table', 'packages', 'steps', 'rates', 'subscriptions', 'not-included']);
  assert.equal(page.seoTitle, 'Pricing — CRM, automation, integrations and AI | Project Nidos');
  assert.equal(page.noindex, false);
});

for (const b of blocks) {
  const sel = b.type === 'page-intro' ? 'section.page-hero' : `section#${b.props.anchor}`;
  test(`${b.type} matches ${sel}`, () => {
    assert.equal(normalizeHtml(`<body>${getBlock(b.type).render(b.props, ctx)}</body>`, P),
                 normalizeHtml(`<body>${sectionOf(file, sel)}</body>`, P));
  });
}
