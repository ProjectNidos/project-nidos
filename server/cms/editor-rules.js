/*
 * What the page editor may change, checked on every save (spec
 * docs/superpowers/specs/2026-09-27-page-editor-design.md §4.3): a page's
 * content, never its shape. Pure: the caller passes the page as it stands and
 * as submitted, and gets back what to store, or the errors.
 */
const { validatePage } = require('./validate');
const { validateProps } = require('./fields');
const { sanitize } = require('./richtext');
const { getBlock } = require('../../blocks');
const { SITE_FIELDS } = require('./site-fields');

const META_FIELDS = {
  seoTitle: { type: 'text', label: 'Search title', max: 70, required: true },
  seoDescription: { type: 'longtext', label: 'Search description', max: 200, required: true },
};
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
// A CRM category is stored as an anchor-type value, but it is not an anchor.
const isAnchor = (f) => f.type === 'anchor' && !f.choices;
const eachItem = (f, v, fn) => {
  if (f.type === 'list' && f.of !== 'string' && Array.isArray(v)) v.forEach((it, i) => isObj(it) && fn(it, i));
};

// A new item's anchor: its title in lowercase letters, digits and dashes,
// starting with a letter and unique on the page.
function makeAnchor(title, taken) {
  const base = String(title || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 32).replace(/-+$/, '');
  const stem = /^[a-z]/.test(base) ? base : `item${base ? `-${base}` : ''}`.slice(0, 32);
  let anchor = stem;
  for (let n = 2; taken.has(anchor); n += 1) anchor = `${stem}-${n}`;
  taken.add(anchor);
  return anchor;
}

function anchorsIn(fields, props, out) {
  for (const [k, f] of Object.entries(fields)) {
    const v = props[k];
    if (isAnchor(f) && typeof v === 'string' && v) out.add(v);
    else if (f.type === 'group' && isObj(v)) anchorsIn(f.of, v, out);
    else eachItem(f, v, (it) => anchorsIn(f.of, it, out));
  }
  return out;
}

// Anchors on a block or group stay as they were. In a list, an item keeps the
// anchor it had; a new item (empty anchor) gets one from its title.
function checkAnchors(fields, props, prev, path, taken, errors) {
  for (const [k, f] of Object.entries(fields)) {
    const at = `${path}.${k}`;
    const v = props[k];
    const was = isObj(prev) ? prev[k] : undefined;
    if (isAnchor(f)) {
      if ((v || '') !== (was || '')) errors.push({ path: at, message: 'Anchors cannot be changed in the editor.' });
    } else if (f.type === 'group' && isObj(v)) {
      checkAnchors(f.of, v, was, at, taken, errors);
    } else if (f.type === 'list' && f.of !== 'string') {
      const key = Object.keys(f.of).find((n) => isAnchor(f.of[n]));
      if (!key) continue;
      const had = new Set((Array.isArray(was) ? was : []).map((it) => isObj(it) && it[key]).filter(Boolean));
      const seen = new Set();
      eachItem(f, v, (item, i) => {
        if (!item[key]) item[key] = makeAnchor(item.title, taken);
        else if (!had.has(item[key]) || seen.has(item[key])) {
          errors.push({ path: `${at}[${i}].${key}`, message: 'Anchors cannot be changed in the editor.' });
        }
        seen.add(item[key]);
      });
    }
  }
}

function checkChoices(fields, props, path, categories, errors) {
  for (const [k, f] of Object.entries(fields)) {
    const at = `${path}.${k}`;
    const v = props[k];
    if (f.choices === 'crm') {
      if (v && !categories.includes(v)) errors.push({ path: at, message: `${f.label} must be one of the CRM categories in Settings.` });
    } else if (f.type === 'group' && isObj(v)) {
      checkChoices(f.of, v, at, categories, errors);
    } else {
      eachItem(f, v, (it, i) => checkChoices(f.of, it, `${at}[${i}]`, categories, errors));
    }
  }
}

function cleanRich(fields, props) {
  for (const [k, f] of Object.entries(fields)) {
    const v = props[k];
    if (f.type === 'richtext' && typeof v === 'string') props[k] = sanitize(v, f.profile);
    else if (f.type === 'group' && isObj(v)) cleanRich(f.of, v);
    else eachItem(f, v, (it) => cleanRich(f.of, it));
  }
}

function checkDraft({ layout, before, blocks, meta, categories }) {
  const shape = (list) => list.map((b) => `${isObj(b) ? b.id : ''}:${isObj(b) ? b.type : ''}`).join('|');
  if (!Array.isArray(blocks) || shape(blocks) !== shape(before)) {
    return { errors: [{ path: 'blocks', message: 'Sections cannot be added, removed or reordered in the editor.' }] };
  }
  const next = JSON.parse(JSON.stringify(blocks));
  const errors = [];
  const taken = new Set();
  before.forEach((b) => anchorsIn(getBlock(b.type).fields, b.props, taken));
  next.forEach((b) => isObj(b.props) && anchorsIn(getBlock(b.type).fields, b.props, taken));
  next.forEach((b, i) => {
    if (!isObj(b.props)) {
      errors.push({ path: `blocks[${i}]`, message: 'A section\'s content must be a set of fields.' });
      return;
    }
    const { fields } = getBlock(b.type);
    checkAnchors(fields, b.props, before[i].props, `blocks[${i}]`, taken, errors);
    checkChoices(fields, b.props, `blocks[${i}]`, categories, errors);
    cleanRich(fields, b.props);
  });
  const m = isObj(meta) ? { seoTitle: meta.seoTitle, seoDescription: meta.seoDescription } : {};
  errors.push(...validateProps(META_FIELDS, m, 'meta'), ...validatePage(layout, next));
  return errors.length ? { errors } : { blocks: next, meta: m, errors };
}

// Menu links jump to a section of the page they are on when the page has it
// (spec §3.4): a link keeps its anchor while its address is unchanged, and an
// address ending in #section takes that section.
function checkSite({ live, settings }) {
  if (!isObj(settings)) return { errors: [{ path: 'settings', message: 'Menu and footer are a set of fields.' }] };
  const next = JSON.parse(JSON.stringify(settings));
  // A link's shortcut is set below, never taken from the request.
  if (isObj(next.nav) && Array.isArray(next.nav.links)) {
    next.nav.links = next.nav.links.map((l) => (isObj(l) ? { text: l.text, href: l.href } : l));
  }
  const errors = validateProps(SITE_FIELDS, next, 'settings');
  if (errors.length) return { errors };
  const was = new Map(live.nav.links.map((l) => [l.href, l.anchor]));
  next.nav.links = next.nav.links.map(({ text, href }) => {
    const anchor = was.has(href) ? was.get(href) : (href.match(/#([a-z][a-z0-9-]{0,40})$/) || [])[1];
    return anchor ? { text, href, anchor } : { text, href };
  });
  next.footer.taglineHTML = sanitize(next.footer.taglineHTML, 'inline');
  return { settings: next, errors };
}

module.exports = { checkDraft, checkSite, makeAnchor, META_FIELDS };
