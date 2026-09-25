const cheerio = require('cheerio');

// Addresses the normaliser leaves as they are: fragments, mail, phone, data and
// anything with a scheme.
const ABSOLUTE = /^(https?:|mailto:|tel:|#|data:)/i;

function normalizeHtml(html, pagePath = '/') {
  const $ = cheerio.load(html);
  $('*').contents().filter((_, n) => n.type === 'comment').remove();
  $('[data-cms]').removeAttr('data-cms');
  $('[href],[src]').each((_, el) => {
    for (const attr of ['href', 'src']) {
      const v = $(el).attr(attr);
      if (!v || ABSOLUTE.test(v)) continue;
      const u = new URL(v, 'https://site.invalid' + pagePath);
      $(el).attr(attr, u.pathname + u.search + u.hash);
    }
  });
  $('*').each((_, el) => {
    if (el.attribs.class) {
      // b-<type> marks a block's root for its scoped styles (plan 1b). The
      // pages on disk never carry it, so it is not a difference.
      const cls = el.attribs.class.split(/\s+/).filter((c) => c && !/^b-[a-z-]+$/.test(c)).sort().join(' ');
      if (cls) el.attribs.class = cls;
      else delete el.attribs.class;
    }
    el.attribs = Object.fromEntries(Object.keys(el.attribs).sort().map((k) => [k, el.attribs[k]]));
  });
  return $('body').html().replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}

function bodyOf(html) {
  return cheerio.load(html)('body').html();
}

function sectionOf(html, selector) {
  const $ = cheerio.load(html);
  const el = $(selector).first();
  if (!el.length) throw new Error(`no element matches ${selector}`);
  return $.html(el);
}

module.exports = { normalizeHtml, bodyOf, sectionOf };
