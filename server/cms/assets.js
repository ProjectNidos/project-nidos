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
  landing: '/landing.js?v=12',
  diagrams: '/practice-visuals.js?v=1',
  orbit: '/orbital-hero.js?v=3',
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

// Built once, as the server starts: a sheet that cannot be built stops the
// start, rather than serving pages without their styles.
const CSS = { home: buildCss('home'), standard: buildCss('standard') };

const stylesFor = (layout) => [BASE_CSS, `/cms/${layout}.css?v=${CSS[layout].hash}`];

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

function scriptsFor(layout, blocks) {
  const u = used(blocks);
  if (layout === 'home') {
    return [
      SCRIPTS.menu,
      SCRIPTS.landing,
      ...(u.has('diagrams') ? [SCRIPTS.diagrams] : []),
      ...(u.has('orbit') ? [SCRIPTS.orbit] : []),
      SCRIPTS.field,
    ];
  }
  return [SCRIPTS.menu, SCRIPTS.field, ...(u.has('diagrams') ? [SCRIPTS.diagrams] : [])];
}

module.exports = { CSS, SCRIPTS, stylesFor, scriptsFor, serveCss };
