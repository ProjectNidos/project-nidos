const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const conv = require('../../scripts/lib/cms-convert');
const { getBlock, BLOCK_TYPES } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');

const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
const PAGES = [
  conv.convertHome(JSON.parse(read('site/content.en.json'))),
  conv.convertServices(JSON.parse(read('site/digi.en.json'))),
  conv.convertPricing(read('nidos/pricing.html')),
  ...['privacy', 'terms', 'cookie-policy', 'gdpr'].map((f) => conv.convertLegal(read(`nidos/${f}.html`))),
  conv.convert404(),
];

// The class the block's style.css is scoped to (server/cms/css.js).
test('every block draws one root element, carrying b-<type>', () => {
  const seen = new Set();
  for (const { page, blocks } of PAGES) {
    for (const b of blocks) {
      const html = getBlock(b.type).render(b.props, { page: { ...page, path: '/x' }, esc, rich: sanitize, anchors: new Set() });
      const roots = cheerio.load(html, null, false).root().children();
      assert.equal(roots.length, 1, `${b.type} draws ${roots.length} root elements`);
      assert.ok(roots.first().hasClass(`b-${b.type}`), `${b.type}: the root lacks b-${b.type}`);
      seen.add(b.type);
    }
  }
  assert.deepEqual([...seen].sort(), [...BLOCK_TYPES].sort(), 'every block type is drawn');
});
