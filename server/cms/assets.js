/*
 * What a page drawn from blocks loads.
 *
 * Styles: base.css, then one sheet for the page's layout, joined here at
 * start-up (spec §14). In cascade order it holds the shared vocabulary
 * (server/cms/styles/common.css), every block's style.css scoped to that
 * block (server/cms/css.js), the diagrams (visuals.css, as it is), and last
 * the layout's frame (server/cms/styles/<layout>.css), which may fit a block
 * to its surroundings. Every block is in both sheets, used or not, so each
 * layout is one cached file rather than one per page.
 *
 * Scripts: the layout's own, then what the page's blocks ask for.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getBlock, BLOCK_TYPES } = require('../../blocks');
const { scopeCss, stripComments } = require('./css');

const ROOT = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const readIfAny = (f) => (fs.existsSync(path.join(ROOT, f)) ? read(f) : '');

const BASE_CSS = '/base.css?v=6';
const SCRIPTS = {
  menu: '/nav-menu.js?v=1',
  landing: '/landing.js?v=13',
  form: '/contact-form.js?v=1',
  pane: '/pointer-pane.js?v=1',
  diagrams: '/practice-visuals.js?v=1',
  orbit: '/orbital-hero.js?v=4',
  field: '/topology-bg.js?v=1',
};

function buildCss(layout) {
  const css = [
    stripComments(read('server/cms/styles/common.css')),
    ...BLOCK_TYPES.map((t) => scopeCss(readIfAny(`blocks/${t}/style.css`), t)),
    stripComments(read('visuals.css')),
    stripComments(read(`server/cms/styles/${layout}.css`)),
  ].join('\n').replace(/\n\s*\n/g, '\n');
  return { css, hash: crypto.createHash('sha256').update(css).digest('hex').slice(0, 12) };
}

// Built once, as the server starts. A sheet that cannot be built is logged and
// leaves CSS empty rather than stopping the start: this process also serves the
// CRM and the lead form. With no sheet, stylesFor throws inside renderPage, and
// the CMS middleware serves each block page's file instead - never the page
// without its styles.
function buildAll() {
  try {
    return { home: buildCss('home'), standard: buildCss('standard') };
  } catch (err) {
    console.error(`cms: the layout stylesheets could not be built, block pages fall back to their files: ${err.message}`);
    return {};
  }
}
const CSS = buildAll();

function stylesFor(layout) {
  if (!Object.hasOwn(CSS, layout)) throw new Error(`no stylesheet for the "${layout}" layout`);
  return [BASE_CSS, `/cms/${layout}.css?v=${CSS[layout].hash}`];
}

// GET /cms/:layout.css
function serveCss(req, res, next) {
  const built = Object.hasOwn(CSS, req.params.layout) ? CSS[req.params.layout] : null;
  if (!built) return next();
  // The address carries the sheet's hash, so a matching ?v= can be kept for a
  // year. Any other ?v= - a page from before a deploy - gets today's sheet,
  // never pinned.
  res.set('Cache-Control', req.query.v === built.hash ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.type('text/css').send(built.css);
}

function used(blocks) {
  const keys = new Set();
  for (const b of blocks) {
    const def = getBlock(b.type);
    if (def) def.assets(b.props).forEach((k) => keys.add(k));
  }
  return keys;
}

// The home layout's order is the page on disk's (site/landing.template.html);
// a standard page adds its blocks' scripts after its own two.
function scriptsFor(layout, blocks) {
  const u = used(blocks);
  const some = (...keys) => keys.filter((k) => u.has(k)).map((k) => SCRIPTS[k]);
  if (layout === 'home') {
    return [SCRIPTS.menu, SCRIPTS.landing, ...some('form', 'pane', 'diagrams', 'orbit'), SCRIPTS.field];
  }
  return [SCRIPTS.menu, SCRIPTS.field, ...some('diagrams', 'form', 'pane', 'orbit')];
}

module.exports = { CSS, SCRIPTS, stylesFor, scriptsFor, serveCss };
