/*
 * Every block the site can draw. A block is a folder with an index.js; see the
 * contract in docs/superpowers/specs/2026-09-23-cms-foundation-design.md §5.
 */
const TYPES = [];

const registry = new Map(TYPES.map((t) => [t, require(`./${t}`)]));

module.exports = {
  getBlock: (type) => registry.get(type),
  BLOCK_TYPES: TYPES,
};
