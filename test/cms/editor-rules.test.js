const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const conv = require('../../scripts/lib/cms-convert');
const { checkDraft, checkSite, makeAnchor } = require('../../server/cms/editor-rules');

const read = (f) => fs.readFileSync(path.join(__dirname, '../..', f), 'utf8');
const content = JSON.parse(read('site/content.en.json'));
const PAGES = {
  home: conv.convertHome(content),
  services: conv.convertServices(JSON.parse(read('site/digi.en.json'))),
  pricing: conv.convertPricing(read('nidos/pricing.html')),
  ...Object.fromEntries(['privacy', 'terms', 'cookie-policy', 'gdpr'].map((f) => [f, conv.convertLegal(read(`nidos/${f}.html`))])),
  notFound: conv.convert404(),
};
const copy = (v) => JSON.parse(JSON.stringify(v));
const metaOf = (page) => ({ seoTitle: page.seoTitle, seoDescription: page.seoDescription });
// The categories the home page's contact form uses today.
const CATEGORIES = PAGES.home.blocks[4].props.options.map((o) => o.value);

function check(name, edit) {
  const { page, blocks } = PAGES[name];
  const next = copy(blocks);
  const meta = metaOf(page);
  if (edit) edit(next, meta);
  return checkDraft({ layout: page.layout, before: blocks, blocks: next, meta, categories: CATEGORIES });
}

test('every page saved unchanged comes back exactly as it was', () => {
  for (const [name, { page, blocks }] of Object.entries(PAGES)) {
    const out = check(name);
    assert.deepEqual(out.errors, [], name);
    assert.deepEqual(out.blocks, blocks, name);
    assert.deepEqual(out.meta, metaOf(page), name);
  }
});

test('a heading within its limit is stored', () => {
  const out = check('pricing', (b) => { b[1].props.heading = 'What it costs'; });
  assert.deepEqual(out.errors, []);
  assert.equal(out.blocks[1].props.heading, 'What it costs');
});

test('a heading over its limit is refused, at its path', () => {
  const out = check('pricing', (b) => { b[1].props.heading = 'x'.repeat(81); });
  assert.deepEqual(out.errors.map((e) => e.path), ['blocks[1].heading']);
});

test('sections cannot be reordered', () => {
  const out = check('pricing', (b) => { [b[1], b[2]] = [b[2], b[1]]; });
  assert.deepEqual(out.errors.map((e) => e.path), ['blocks']);
});

test("a section's anchor cannot be changed", () => {
  const out = check('home', (b) => { b[1].props.anchor = 'about-us'; });
  assert.deepEqual(out.errors.map((e) => e.path), ['blocks[1].anchor']);
});

test('a new practice gets an anchor from its title; an existing one cannot be renamed', () => {
  const added = check('services', (b) => {
    const practices = b[1].props.practices;
    practices.push({ ...copy(practices[0]), anchor: '', title: 'Data platforms' });
  });
  assert.deepEqual(added.errors, []);
  assert.equal(added.blocks[1].props.practices.at(-1).anchor, 'data-platforms');

  const renamed = check('services', (b) => { b[1].props.practices[0].anchor = 'something-else'; });
  assert.deepEqual(renamed.errors.map((e) => e.path), ['blocks[1].practices[0].anchor']);
});

test('makeAnchor starts with a letter and never repeats one on the page', () => {
  const taken = new Set(['crm']);
  assert.equal(makeAnchor('CRM', taken), 'crm-2');
  assert.equal(makeAnchor('3D printing', taken), 'item-3d-printing');
  assert.equal(makeAnchor('', taken), 'item');
});

test("a contact option's category must be one of the CRM categories", () => {
  const bad = check('home', (b) => { b[4].props.options[0].value = 'nope'; });
  assert.deepEqual(bad.errors.map((e) => e.path), ['blocks[4].options[0].value']);
  const good = check('home', (b) => { b[4].props.options[0].value = CATEGORIES.at(-1); });
  assert.deepEqual(good.errors, []);
});

test('rich text is cleaned before it is stored', () => {
  const out = check('home', (b) => { b[1].props.body = '<script>alert(1)</script><strong>x</strong>'; });
  assert.deepEqual(out.errors, []);
  assert.equal(out.blocks[1].props.body, '<strong>x</strong>');
});

test('a block sent without its content, or without a list it needs, is refused', () => {
  const legal = (b) => b.findIndex((x) => x.type === 'legal-document');
  let at;
  const empty = check('privacy', (b) => { at = legal(b); b[at].props = {}; });
  assert.ok(empty.errors.some((e) => e.path === `blocks[${at}].clauses`), JSON.stringify(empty.errors));
  const none = check('privacy', (b) => { b[legal(b)].props = null; });
  assert.ok(none.errors.some((e) => e.path === `blocks[${at}]`), JSON.stringify(none.errors));
  const noList = check('services', (b) => { delete b[1].props.practices; });
  assert.deepEqual(noList.errors.map((e) => e.path), ['blocks[1].practices']);
});

test('search texts are required and held to 70 and 200 characters', () => {
  const out = check('pricing', (b, meta) => { meta.seoTitle = ''; meta.seoDescription = 'x'.repeat(201); });
  assert.deepEqual(out.errors.map((e) => e.path).sort(), ['meta.seoDescription', 'meta.seoTitle']);
});

// Menu and footer, as the form sends them: no anchors on the menu links.
const live = conv.siteSettingsFrom(content);
const asSent = () => {
  const s = copy(live);
  s.nav.links = s.nav.links.map(({ text, href }) => ({ text, href }));
  return s;
};

test('menu and footer saved unchanged come back exactly as they were', () => {
  const out = checkSite({ live, settings: asSent() });
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.settings, live);
});

test('links sent back with their shortcuts are taken as they are', () => {
  const out = checkSite({ live, settings: copy(live) });
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.settings, live);
});

test('a footer without its columns is refused', () => {
  const s = asSent();
  delete s.footer.cols;
  assert.deepEqual(checkSite({ live, settings: s }).errors.map((e) => e.path), ['settings.footer.cols']);
});

test("a menu link's section shortcut follows its address", () => {
  const moved = asSent();
  const contact = moved.nav.links.findIndex((l) => l.href === '/#contact');
  moved.nav.links[contact].href = '/nidos/pricing.html';
  let out = checkSite({ live, settings: moved });
  assert.deepEqual(out.settings.nav.links[contact], { text: moved.nav.links[contact].text, href: '/nidos/pricing.html' });

  moved.nav.links[contact].href = '/#about';
  out = checkSite({ live, settings: moved });
  assert.equal(out.settings.nav.links[contact].anchor, 'about');

  const services = out.settings.nav.links.find((l) => l.href === '/nidos/digitalization.html');
  assert.equal(services.anchor, 'practices');
});
