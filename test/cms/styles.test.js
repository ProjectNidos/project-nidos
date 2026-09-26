const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const { parseCss, scopeCss } = require('../../server/cms/css');
const { getBlock, BLOCK_TYPES } = require('../../blocks');
const conv = require('../../scripts/lib/cms-convert');
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('../../server/cms/richtext');

const ROOT = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(ROOT, f));

/* The move from the legacy sheets into server/cms/styles/ and the blocks'
   style.css (plan 1b, Task 3), held rule by rule. Every legacy rule is in a
   new sheet with the same selector and declarations, in the same @media, or
   is listed below with the reason it is not. And nothing is in the new sheets
   that the old did not have, bar the additions listed. */
const LEGACY = ['landing.css', 'pages.css', 'shared.css'];
const BLOCK_SHEETS = BLOCK_TYPES.map((t) => [t, `blocks/${t}/style.css`]).filter(([, f]) => exists(f));
const NEW = ['server/cms/styles/common.css', 'server/cms/styles/home.css', 'server/cms/styles/standard.css',
  ...BLOCK_SHEETS.map(([, f]) => f)];

// [sheet, @media or '', selector]: legacy rules no block page draws.
const NOT_CARRIED = new Set([
  // The portrait: the Text block draws none.
  ...['.portrait', '.portrait-frame', '.portrait-frame img', '.portrait figcaption', '.portrait-id',
    '.portrait-name', '.portrait-role', '.portrait-meta'].map((s) => ['landing.css', '', s]),
  ['landing.css', '@media (max-width: 860px)', '.portrait-frame'],
  // Four anchors by id; the home frame now covers every anchored section.
  ...['#main', '#practices', '#about', '#contact'].map((s) => ['landing.css', '@media (max-width: 720px)', s]),
  // The market note: no block draws it.
  ...['.market-note', '.market-note-heading', '.market-note p', '.market-note a', '.market-note a:hover']
    .map((s) => ['pages.css', '', s]),
].map((r) => r.join(' | ')));

// [sheet, @media or '', selector] -> properties left out. .lattice came later
// in pages.css at the same weight, so it always set the contact block's gap
// and the practices' padding; loading before the blocks, it would not. The
// hero's colour token moves onto the hero (see ADDED).
const TRIMMED = new Map([
  [['landing.css', '', ':root'], ['--ink-over-media']],
  [['pages.css', '', '.contact-block'], ['gap']],
  [['pages.css', '', '.practice'], ['padding-block']],
].map(([place, props]) => [place.join(' | '), props]));

// [sheet, @media or '', selector ("&" dropped), declarations] with no legacy source.
const ADDED = new Set([
  ['blocks/hero/style.css', '', '.hero', '--ink-over-media: #e4e4e7'],
  ...['main[id]', 'section[id]', 'article[id]'].map((s) =>
    ['server/cms/styles/home.css', '@media (max-width: 720px)', s, 'scroll-margin-top: var(--s4)']),
].map((r) => r.join(' | ')));

const entries = (file) => parseCss(read(file)).flatMap((r) => r.selectors.map((s) => ({
  file, at: r.at || '', sel: s.replace(/^&/, ''), decls: r.decls,
})));
const place = (e) => [e.file, e.at, e.sel].join(' | ');
const rule = (e) => [e.at, e.sel, e.decls.join('; ')].join(' | ');
const prop = (d) => d.slice(0, d.indexOf(':')).trim();

test('every legacy rule arrived, word for word, or is listed as not carried', () => {
  const arrived = new Set(NEW.flatMap(entries).map(rule));
  const missing = LEGACY.flatMap(entries).filter((e) => !NOT_CARRIED.has(place(e)))
    .map((e) => rule({ ...e, decls: e.decls.filter((d) => !(TRIMMED.get(place(e)) || []).includes(prop(d))) }))
    .filter((r) => !arrived.has(r));
  assert.deepEqual([...new Set(missing)], []);
});

test('nothing arrived that the legacy sheets did not have, bar the listed additions', () => {
  const had = new Set(LEGACY.flatMap(entries).filter((e) => !NOT_CARRIED.has(place(e)))
    .map((e) => rule({ ...e, decls: e.decls.filter((d) => !(TRIMMED.get(place(e)) || []).includes(prop(d))) })));
  const extra = NEW.flatMap(entries).filter((e) => !ADDED.has(`${place(e)} | ${e.decls.join('; ')}`))
    .map(rule).filter((r) => !had.has(r));
  assert.deepEqual([...new Set(extra)], []);
});

test('every exception above names a real rule', () => {
  const places = new Set(LEGACY.flatMap(entries).map(place));
  for (const k of [...NOT_CARRIED, ...TRIMMED.keys()]) assert.ok(places.has(k), k);
  const added = new Set(NEW.flatMap(entries).map((e) => `${place(e)} | ${e.decls.join('; ')}`));
  for (const k of ADDED) assert.ok(added.has(k), k);
});

test('every block sheet scopes cleanly', () => {
  for (const [t, f] of BLOCK_SHEETS) assert.doesNotThrow(() => scopeCss(read(f), t), f);
});

/* A block's sheet styles only what the block draws, plus the classes its
   script adds. Drawn from every page the import builds. */
const ADDED_BY_SCRIPT = { hero: ['is-drawn'], 'practice-cards': ['index-hl', 'is-on'], 'contact-form': ['is-invalid'] };
const PAGES = [
  ['/', conv.convertHome(JSON.parse(read('site/content.en.json')))],
  ['/nidos/digitalization.html', conv.convertServices(JSON.parse(read('site/digi.en.json')))],
  ['/nidos/pricing.html', conv.convertPricing(read('nidos/pricing.html'))],
  ...['privacy', 'terms', 'cookie-policy', 'gdpr'].map((f) => [`/nidos/${f}.html`, conv.convertLegal(read(`nidos/${f}.html`))]),
  ['/404', conv.convert404()],
];

test("a block's sheet only styles classes the block draws", () => {
  const drawn = {};
  for (const [p, { page, blocks }] of PAGES) {
    for (const b of blocks) {
      const html = getBlock(b.type).render(b.props, { page: { ...page, path: p }, esc, rich: sanitize, anchors: new Set() });
      const set = (drawn[b.type] ||= new Set(ADDED_BY_SCRIPT[b.type] || []));
      cheerio.load(html, null, false)('[class]').each((_, el) => el.attribs.class.split(/\s+/).forEach((c) => set.add(c)));
    }
  }
  for (const [t, f] of BLOCK_SHEETS) {
    const strangers = entries(f).flatMap((e) => [...e.sel.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))
      .filter((c) => !drawn[t].has(c));
    assert.deepEqual([...new Set(strangers)], [], f);
  }
});

/* The pages on disk still load landing.css, pages.css and shared.css, and the
   blocks were copied from exactly these versions. If one changes, make the
   same change where its rule now lives (the map is in plan 1b, Task 3), run
   npm run cms:parity, then record the new hash here. */
const COPIED_FROM = {
  'landing.css': 'b5c0d70713114402',
  'pages.css': '6619b14873bec317',
  'shared.css': '0f71b47d1a330dd9',
};
test('the legacy sheets are the versions the blocks were copied from', () => {
  for (const [f, hash] of Object.entries(COPIED_FROM)) {
    assert.equal(crypto.createHash('sha256').update(read(f)).digest('hex').slice(0, 16), hash,
      `${f} changed after its rules were copied into the blocks: copy the change too, then update this hash`);
  }
});
