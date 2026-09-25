const { validateProps } = require('./fields');

function validatePage(layout, blocks, getBlock = require('../../blocks').getBlock) {
  if (!Array.isArray(blocks)) return [{ path: 'blocks', message: 'A page is a list of blocks.' }];
  const errors = [];
  const ids = new Set();
  const counts = {};
  blocks.forEach((b, i) => {
    const path = `blocks[${i}]`;
    if (!b || typeof b.id !== 'string' || !b.id || ids.has(b.id)) {
      errors.push({ path: `${path}.id`, message: 'Every block needs a unique id.' });
    } else {
      ids.add(b.id);
    }
    const def = b && getBlock(b.type);
    if (!def) { errors.push({ path, message: `Unknown block type "${b && b.type}".` }); return; }
    if (!def.layouts.includes(layout)) {
      errors.push({ path, message: `${def.label} cannot be used on a "${layout}" page yet.` });
      return;
    }
    counts[b.type] = (counts[b.type] || 0) + 1;
    if (def.maxPerPage && counts[b.type] > def.maxPerPage) {
      errors.push({ path, message: `Only ${def.maxPerPage} ${def.label} per page.` });
    }
    errors.push(...validateProps(def.fields, b.props, path));
  });
  return errors;
}

module.exports = { validatePage };
