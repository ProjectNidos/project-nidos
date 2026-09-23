/*
 * Field limits for block props. The limits are the design: a headline that
 * fits in 40 characters is one the layout was drawn for, so the editor refuses
 * a longer one rather than letting the page break.
 */
const cheerio = require('cheerio');

const LINK = /^(\/|#|https?:\/\/|mailto:)/;
const ANCHOR = /^[a-z][a-z0-9-]{0,40}$/;
const textLength = (html) => cheerio.load(html, null, false).root().text().length;
// A real day: 2026-02-30 parses in JavaScript (as 2 March), so round-trip it.
const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
  && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const isFields = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function validateProps(fields, props, prefix = '') {
  const errors = [];
  const at = (k) => (prefix ? `${prefix}.${k}` : k);
  const push = (path, message) => errors.push({ path, message });
  const p = props && typeof props === 'object' ? props : {};

  for (const key of Object.keys(p)) if (!fields[key]) push(at(key), 'Not a field of this block.');

  for (const [key, f] of Object.entries(fields)) {
    const v = p[key];
    const path = at(key);
    if (v === undefined || v === null || v === '') {
      if (f.required) push(path, `${f.label} is required.`);
      continue;
    }
    switch (f.type) {
      case 'text':
      case 'longtext':
        if (typeof v !== 'string') push(path, `${f.label} must be text.`);
        else if (v.length > f.max) push(path, `${f.label} is ${v.length} characters; the limit is ${f.max}.`);
        break;
      case 'richtext':
        if (typeof v !== 'string') push(path, `${f.label} must be text.`);
        else if (textLength(v) > f.max) push(path, `${f.label} is longer than ${f.max} characters.`);
        break;
      case 'select':
        if (!f.options.includes(v)) push(path, `${f.label} must be one of: ${f.options.join(', ')}.`);
        break;
      case 'link':
        if (typeof v !== 'string' || !LINK.test(v)) push(path, `${f.label} must start with /, #, https:// or mailto:.`);
        break;
      case 'anchor':
        if (typeof v !== 'string' || !ANCHOR.test(v)) push(path, `${f.label} must be lowercase letters, digits and dashes.`);
        break;
      case 'date':
        if (!isDay(v)) push(path, `${f.label} must be a date written YYYY-MM-DD.`);
        break;
      case 'list': {
        if (!Array.isArray(v)) { push(path, `${f.label} must be a list.`); break; }
        const min = f.min || 0;
        if (v.length < min || v.length > f.max) {
          push(path, `${f.label} needs between ${min} and ${f.max} items; it has ${v.length}.`);
          break;
        }
        if (f.of === 'string') {
          const itemMax = f.itemMax || 90;
          v.forEach((item, i) => {
            if (typeof item !== 'string' || !item.length || item.length > itemMax) {
              push(`${path}[${i}]`, `Each item is text of 1 to ${itemMax} characters.`);
            }
          });
        } else {
          v.forEach((item, i) => {
            if (!isFields(item)) {
              push(`${path}[${i}]`, `Each ${f.label} item must be a set of fields.`);
            } else {
              errors.push(...validateProps(f.of, item, `${path}[${i}]`));
            }
          });
        }
        break;
      }
      case 'group':
        if (!isFields(v)) {
          push(path, `${f.label} must be a set of fields.`);
        } else {
          errors.push(...validateProps(f.of, v, path));
        }
        break;
      default:
        push(path, `Unknown field type ${f.type}.`);
    }
  }
  return errors;
}

module.exports = { validateProps };
