/*
 * What a page loads, from what its blocks use. Today's stylesheets, unchanged:
 * the home layout draws with landing.css and the standard layout with
 * pages.css, which is why a block is tied to the layouts it was written for
 * until the styles are untangled (plan 1b).
 */
const { getBlock } = require('../../blocks');

const STYLES = {
  base: '/base.css?v=5',
  shared: '/shared.css?v=2',
  landing: '/landing.css?v=28',
  pages: '/pages.css?v=8',
  visuals: '/visuals.css?v=1',
};
const SCRIPTS = {
  landing: '/landing.js?v=10',
  diagrams: '/practice-visuals.js?v=1',
  orbit: '/orbital-hero.js?v=2',
  field: '/topology-bg.js?v=1',
};

function used(blocks) {
  const keys = new Set();
  for (const b of blocks) {
    const def = getBlock(b.type);
    if (def) def.assets(b.props).forEach((k) => keys.add(k));
  }
  return keys;
}

function stylesFor(layout, blocks) {
  const u = used(blocks);
  return [
    STYLES.base,
    ...(u.has('shared') ? [STYLES.shared] : []),
    layout === 'home' ? STYLES.landing : STYLES.pages,
    ...(u.has('visuals') ? [STYLES.visuals] : []),
  ];
}

function scriptsFor(layout, blocks) {
  const u = used(blocks);
  if (layout === 'home') {
    return [
      SCRIPTS.landing,
      ...(u.has('diagrams') ? [SCRIPTS.diagrams] : []),
      ...(u.has('orbit') ? [SCRIPTS.orbit] : []),
      SCRIPTS.field,
    ];
  }
  return [SCRIPTS.field, ...(u.has('diagrams') ? [SCRIPTS.diagrams] : [])];
}

module.exports = { STYLES, SCRIPTS, stylesFor, scriptsFor };
