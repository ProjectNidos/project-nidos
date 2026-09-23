const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePage } = require('../../server/cms/validate');
const conv = require('../../scripts/lib/cms-convert');
const content = require('../../site/content.en.json');
const digi = require('../../site/digi.en.json');

test('home and services convert to valid pages', () => {
  for (const { page, blocks } of [conv.convertHome(content), conv.convertServices(digi)]) {
    assert.deepEqual(validatePage(page.layout, blocks), [], page.title);
  }
  assert.deepEqual(conv.convertHome(content).blocks.map((b) => b.type),
    ['hero', 'text', 'practice-cards', 'reasons', 'contact-form']);
  assert.deepEqual(conv.convertServices(digi).blocks.map((b) => b.type),
    ['page-intro', 'service-catalogue', 'steps', 'reasons', 'contact-info']);
});

test('applyOverrides sets nested, practice and form-option keys, leaves input alone', () => {
  const optionKey = content.contact.options[0].cms;
  const out = conv.applyOverrides(content, [
    { key: 'hero.titleLead', value: 'Edited.' },
    { key: 'practice.crm.title', value: 'CRM, edited' },
    { key: optionKey, value: 'Option, edited' },
  ]);
  assert.equal(out.hero.titleLead, 'Edited.');
  assert.equal(out.practices.items.find((p) => p.key === 'crm').title, 'CRM, edited');
  assert.equal(out.contact.options[0].text, 'Option, edited');
  assert.notEqual(content.hero.titleLead, 'Edited.');
});

test('applyOverrides refuses a key it cannot place', () => {
  assert.throws(() => conv.applyOverrides(content, [{ key: 'hero.nope', value: 'x' }]), /hero\.nope/);
  assert.throws(() => conv.applyOverrides(content, [{ key: 'practice.zzz.title', value: 'x' }]), /zzz/);
});

test('site settings: nav anchors, footer, labels', () => {
  const s = conv.siteSettingsFrom(content);
  assert.deepEqual(s.nav.links.map((l) => [l.href, l.anchor]),
    [['/nidos/digitalization.html', 'practices'], ['/nidos/pricing.html', undefined], ['/#about', 'about'], ['/#contact', 'contact']]);
  assert.equal(s.footer.arcade.text, content.footer.arcade);
  assert.equal(s.labels.introSkip, content.intro.skip);
});

test('uncarriedOverrides names the share-tag keys the block pages do not keep', () => {
  assert.deepEqual(conv.uncarriedOverrides([
    { key: 'meta.ogTitle', value: 'x' }, { key: 'hero.titleLead', value: 'y' }, { key: 'meta.ogDescription', value: 'z' },
  ]), ['meta.ogTitle', 'meta.ogDescription']);
  assert.deepEqual(conv.uncarriedOverrides([]), []);
});
