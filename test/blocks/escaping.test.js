/*
 * Every block, fed hostile text in every field an editor can type into, must
 * not let a tag through. Starts from the converters' real props, so each block
 * renders its full markup, then replaces each free-text value: text, longtext,
 * string-list items and rich text outright, and links behind a leading "/"
 * (which the link check accepts). Optional text fields left empty are filled
 * too, so the branches that only draw when they are set are covered.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { getBlock, BLOCK_TYPES } = require('../../blocks');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');
const conv = require('../../scripts/lib/cms-convert');

const XSS = '"><script>x</script>';
const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');

function poison(fields, props) {
  const out = { ...props };
  for (const [key, f] of Object.entries(fields)) {
    const v = out[key];
    if (['text', 'longtext', 'richtext'].includes(f.type)) out[key] = XSS;
    else if (f.type === 'link') out[key] = '/' + XSS;
    else if (f.type === 'list' && Array.isArray(v)) out[key] = v.map((item) => (f.of === 'string' ? XSS : poison(f.of, item)));
    else if (f.type === 'group' && v) out[key] = poison(f.of, v);
  }
  return out;
}

const PAGES = [
  ['/', conv.convertHome(require('../../site/content.en.json'))],
  ['/nidos/digitalization.html', conv.convertServices(require('../../site/digi.en.json'))],
  ['/nidos/pricing.html', conv.convertPricing(read('nidos/pricing.html'))],
  ...['privacy', 'terms', 'cookie-policy', 'gdpr'].map((f) => [`/nidos/${f}.html`, conv.convertLegal(read(`nidos/${f}.html`))]),
  ['/404', conv.convert404()],
];

const seen = new Set();
for (const [pagePath, { page, blocks }] of PAGES) {
  blocks.forEach((b, i) => {
    seen.add(b.type);
    test(`${pagePath} block ${i} (${b.type}) escapes hostile text`, () => {
      const def = getBlock(b.type);
      const ctx = { page: { ...page, path: pagePath }, esc, rich: sanitize, anchors: new Set() };
      const html = def.render(poison(def.fields, b.props), ctx);
      assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/, 'the hostile text reached the page, escaped');
      assert.doesNotMatch(html, /<script>x<\/script>/i);
    });
  });
}

test('every registered block is covered by a converted page', () => {
  assert.deepEqual(BLOCK_TYPES.filter((t) => !seen.has(t)), []);
});
