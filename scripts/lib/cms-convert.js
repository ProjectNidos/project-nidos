/*
 * Today's content, as blocks. Pure functions: no database, no filesystem. The
 * import (scripts/cms-import.js) feeds them the files and the saved overrides,
 * and the tests feed them the committed files, which is how the tests prove
 * that a converted page draws exactly what the file draws.
 */
const cheerio = require('cheerio');
const { sanitize } = require('../../server/cms/richtext');

const withIds = (blocks) => blocks.map((b, i) => ({ id: `${b.type}-${i}`, ...b }));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
// Drop keys whose value is undefined or null, so optional fields are absent
// rather than present-and-empty.
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null));

function pageMeta(html) {
  const $ = cheerio.load(html);
  return {
    seoTitle: squash($('title').text()),
    seoDescription: squash($('meta[name="description"]').attr('content')),
    noindex: /noindex/i.test($('meta[name="robots"]').attr('content') || ''),
  };
}

function convertPricing(html) {
  const $ = cheerio.load(html);
  const text = (el) => squash($(el).text());
  const inner = (el) => squash($(el).html());
  const btn = (a) => (a && a.length ? { label: text(a), href: a.attr('href') } : undefined);
  const sec = (id) => $(`section#${id}`);
  const lede = (s) => {
    const p = s.find('.section-lede').first();
    return p.length ? sanitize(inner(p), 'inline') : undefined;
  };
  const amountSplit = (el) => {
    const a = $(el).clone();
    const unit = text(a.find('.amount-unit'));
    a.find('.amount-unit').remove();
    return { price: text(a), unit };
  };

  const hero = $('section.page-hero');
  const [titleLead, titleAccent] = (hero.find('.page-title').html() || '')
    .split(/<br\s*\/?>/i).map((s) => squash(cheerio.load(`<i>${s}</i>`, null, false).root().text()));

  const cat = sec('catalogue');
  const head = cat.find('.price-row--head p').map((_, p) => text(p)).get();
  const pk = sec('packages');
  const md = sec('model');
  const rt = sec('rates');
  const sb = sec('subscriptions');
  const tm = sec('terms');
  const cta = tm.find('.cta-row a');

  const blocks = [
    { type: 'page-intro', props: compact({
      back: btn(hero.find('.back-link')), titleLead, titleAccent,
      lede: sanitize(inner(hero.find('.page-lede p')), 'inline') || undefined,
    }) },
    { type: 'pricing-table', props: {
      anchor: 'catalogue', heading: text(cat.find('.section-title')),
      columns: { practice: head[0], from: head[1], range: head[2] },
      rows: cat.find('.price-row').not('.price-row--head').map((_, r) => {
        const a = $(r).find('h3 a');
        const range = $(r).find('.price-range').clone();
        range.find('.label-inline').remove();
        return compact({ practice: text($(r).find('h3')), href: a.length ? a.attr('href') : undefined,
          from: text($(r).find('.amount')), range: text(range) });
      }).get(),
    } },
    { type: 'packages', props: {
      anchor: 'packages', heading: text(pk.find('.section-title')),
      cells: pk.find('.pkg').map((_, c) => {
        const note = $(c).find('.pkg-note');
        return compact({
          forPractice: text($(c).find('.pkg-for')), name: text($(c).find('h3')),
          body: text($(c).children('p').not('[class]').first()),
          note: note.length ? text(note) : undefined,
          ...amountSplit($(c).find('.amount')),
        });
      }).get(),
    } },
    { type: 'steps', props: compact({
      anchor: 'model', heading: text(md.find('.section-title')), lede: lede(md),
      items: md.find('li.step').map((_, s) => {
        const price = $(s).find('.step-price');
        return compact({ title: text($(s).find('.step-title')), body: text($(s).find('.step-body')),
          price: price.length ? text(price) : undefined });
      }).get(),
    }) },
    { type: 'rates', props: compact({
      anchor: 'rates', heading: text(rt.find('.section-title')), lede: lede(rt),
      rows: rt.find('.rate-row').map((_, r) => ({ role: text($(r).find('.role')), rate: text($(r).find('.rate')) })).get(),
    }) },
    { type: 'subscriptions', props: compact({
      anchor: 'subscriptions', heading: text(sb.find('.section-title')), lede: lede(sb),
      plans: sb.find('.plan').map((_, x) => {
        const { price, unit } = amountSplit($(x).find('.amount'));
        return { name: text($(x).find('h3')), amount: price, unit, body: text($(x).children('p').not('[class]').first()) };
      }).get(),
    }) },
    { type: 'not-included', props: compact({
      anchor: 'terms', heading: text(tm.find('.section-title')),
      items: tm.find('.scope-list li').map((_, li) => text(li)).get(),
      note: tm.find('.price-note').length ? text(tm.find('.price-note')) : undefined,
      primary: btn(cta.filter('.btn-primary')), secondary: btn(cta.filter('.btn-quiet')),
    }) },
  ];

  return { page: { layout: 'standard', title: 'Pricing', ...pageMeta(html) }, blocks: withIds(blocks) };
}

module.exports = { withIds, pageMeta, convertPricing };
