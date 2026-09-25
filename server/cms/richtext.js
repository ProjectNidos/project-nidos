/*
 * The allow-list for text that carries markup. Everything else a block draws is
 * escaped; this is the one place HTML typed into the editor reaches the page, so
 * it runs on import, on save and again at render.
 */
const cheerio = require('cheerio');

const INLINE = new Set(['strong', 'em', 'b', 'i', 'br', 'a', 'span']);
const FULL = new Set([...INLINE, 'p', 'ul', 'ol', 'li', 'h3', 'h4', 'code', 'address',
  'table', 'thead', 'tbody', 'tr', 'th', 'td']);
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template']);
const SAFE_HREF = /^(https?:|mailto:|\/|#)/i;
const hasClass = (v, c) => v.split(/\s+/).includes(c);

// The only attributes that survive, per tag: each rule returns the value to
// keep, or null. The serialiser escapes quotes in what is kept.
const ATTRS = {
  a: { href: (v) => (SAFE_HREF.test(v.trim()) ? v.trim() : null) },
  span: { class: (v) => (hasClass(v, 'key') ? 'key' : null) },
  table: { class: (v) => (hasClass(v, 'legal-table') ? 'legal-table' : null) },
  th: { scope: (v) => (v === 'col' || v === 'row' ? v : null) },
  td: { 'data-label': (v) => v },
};

function sanitize(html, profile) {
  const allowed = profile === 'full' ? FULL : INLINE;
  // Parse as a fragment so no markup inside the input can close a wrapper; relies on cheerio's default parse5 backend, which parses like a browser.
  const $ = cheerio.load(html == null ? '' : String(html), null, false);
  const root = $.root()[0];

  // Children before parents, so unwrapping a node never skips one inside it.
  const walk = (node) => {
    $(node).contents().each((_, child) => walk(child));
    if (node === root) return;
    if (node.type === 'comment' || node.type === 'directive' || node.type === 'cdata') { $(node).remove(); return; }
    if (node.type !== 'tag' && node.type !== 'script' && node.type !== 'style') return;
    const tag = node.name.toLowerCase();
    if (DROP.has(tag)) { $(node).remove(); return; }
    if (!allowed.has(tag)) { $(node).replaceWith($(node).contents()); return; }
    const rules = ATTRS[tag] || {};
    const keep = {};
    for (const [name, value] of Object.entries(node.attribs || {})) {
      const rule = rules[name.toLowerCase()];
      const kept = rule ? rule(value) : null;
      if (kept != null) keep[name.toLowerCase()] = kept;
    }
    if (tag === 'span' && !keep.class) { $(node).replaceWith($(node).contents()); return; }
    node.attribs = keep;
  };
  walk(root);
  return $.root().html();
}

module.exports = { sanitize };
