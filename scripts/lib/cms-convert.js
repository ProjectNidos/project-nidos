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

// The legal pages (rebuilt on main in 9897ae5): the standard page intro plus a
// "Last updated" line and the links between the four documents, then one
// section of numbered clauses, with an "at a glance" grid first on Privacy.
function convertLegal(html) {
  const $ = cheerio.load(html);
  const text = (el) => squash($(el).text());
  const inner = (el) => squash($(el).html());
  const hero = $('section.page-hero');
  const back = hero.find('.back-link');
  const updated = hero.find('.legal-updated');
  const docNav = hero.find('nav.legal-nav');
  const doc = $('section.legal-section');
  const glance = doc.find('.legal-glance > div').map((_, g) => ({
    title: text($(g).find('h2')), body: sanitize(inner($(g).find('p')), 'inline'),
  })).get();

  return {
    page: { layout: 'standard', title: text(hero.find('.page-title')), ...pageMeta(html) },
    blocks: withIds([
      { type: 'page-intro', props: compact({
        back: back.length ? { label: text(back), href: back.attr('href') } : undefined,
        titleLead: text(hero.find('.page-title')),
        lede: hero.find('.page-lede p').length ? sanitize(inner(hero.find('.page-lede p')), 'inline') : undefined,
        updated: updated.length ? {
          label: squash(updated.contents().filter((_, n) => n.type === 'text').text()),
          date: updated.find('time').attr('datetime'),
        } : undefined,
        docNav: docNav.length ? {
          label: docNav.attr('aria-label'),
          links: docNav.find('a').map((_, a) => ({ label: text(a), href: $(a).attr('href') })).get(),
        } : undefined,
      }) },
      { type: 'legal-document', props: compact({
        glance: glance.length ? glance : undefined,
        clauses: doc.find('.legal-clause').map((_, c) => ({
          anchor: $(c).attr('id'),
          title: text($(c).find('.legal-clause-id h2')),
          body: sanitize(inner($(c).find('.legal-body')), 'full'),
        })).get(),
      }) },
    ]),
  };
}

// The old 404 is a terminal animation typing the missing path. It becomes a
// plain page in the site's look; its two ways out are kept.
function convert404() {
  return {
    page: { layout: 'standard', title: 'Page not found', seoTitle: '404 — Project Nidos',
      seoDescription: 'This page does not exist or has moved.', noindex: true },
    blocks: withIds([
      { type: 'page-intro', props: { titleLead: 'Page not found.', lede: 'This page does not exist or has moved.' } },
      { type: 'button-row', props: { primary: { label: 'Back to home', href: '/' }, secondary: { label: 'Contact', href: '/#contact' } } },
    ]),
  };
}

function convertHome(c) {
  return {
    page: { layout: 'home', title: 'Home', seoTitle: c.meta.title, seoDescription: c.meta.description, noindex: false },
    blocks: withIds([
      { type: 'hero', props: {
        titleLead: c.hero.titleLead, titleAccent: c.hero.titleAccent, lede: sanitize(c.hero.subtitleHTML, 'inline'),
        primary: { label: c.hero.cta, href: '#contact' },
        secondary: { label: c.hero.ctaSecondary, href: c.hero.ctaSecondaryHref },
      } },
      { type: 'text', props: compact({
        anchor: 'about', heading: c.about.heading, subheading: c.about.subheading || undefined,
        body: sanitize(c.about.bodyHTML, 'inline'),
      }) },
      { type: 'practice-cards', props: {
        anchor: 'practices', heading: c.practices.heading,
        sideLink: { label: c.practices.pricingLabel, href: c.practices.pricingHref },
        cards: c.practices.items.map((p) => ({
          title: p.title, summary: p.summary, link: { label: p.linkText, href: p.href }, diagram: p.key,
        })),
      } },
      { type: 'reasons', props: { heading: c.why.heading, items: c.why.items.map(({ icon, claim, support }) => ({ icon, claim, support })) } },
      { type: 'contact-form', props: {
        anchor: 'contact', heading: c.contact.heading, lede: c.contact.lede,
        infoHeading: c.contact.infoHeading, infoBody: c.contact.infoBody,
        emailLabel: c.contact.emailLabel, email: c.contact.email, labels: { ...c.contact.labels },
        options: c.contact.options.map(({ value, text }) => ({ value, text })), submit: c.contact.submit,
      } },
    ]),
  };
}

function convertServices(d) {
  const tocText = (id) => {
    const t = d.toc.items.find((x) => x.href === `#${id}`);
    if (!t) throw new Error(`services: no table-of-contents entry for #${id}`);
    return t.text;
  };
  return {
    page: { layout: 'standard', title: 'Services', seoTitle: d.meta.title, seoDescription: d.meta.description, noindex: false },
    blocks: withIds([
      { type: 'page-intro', props: {
        back: { label: d.hero.back, href: d.hero.backHref }, titleLead: d.hero.titleLead,
        titleAccent: d.hero.titleAccent, lede: sanitize(d.hero.ledeHTML, 'inline'),
      } },
      { type: 'service-catalogue', props: {
        anchor: d.ids.practices, heading: d.practices.heading, tocLabel: d.a11y.tocHeading, tocAria: d.a11y.toc,
        practices: d.practices.items.map((p) => compact({
          anchor: p.id, title: p.title, tocText: tocText(p.id), outcome: p.outcome, diagram: p.key,
          body: p.body, problemLabel: p.problemLabel, problemText: p.problemText,
          scopeHeading: p.scopeHeading, scope: [...p.scope], pkgHeading: p.pkgHeading, pkgName: p.pkgName,
          pkgBody: p.pkgBody, pkgNote: p.pkgNote || undefined, priceLead: p.priceLead, price: p.price,
          priceNote: p.priceNote || undefined,
        })),
      } },
      { type: 'steps', props: {
        anchor: d.ids.process, heading: d.process.heading,
        items: d.process.steps.map((s) => compact({ title: s.title, body: s.body, price: s.price || undefined })),
      } },
      { type: 'reasons', props: { anchor: d.ids.why, heading: d.why.heading, items: d.why.items.map(({ icon, claim, support }) => ({ icon, claim, support })) } },
      { type: 'contact-info', props: {
        anchor: d.ids.contact, heading: d.contact.heading, subheading: d.contact.subheading,
        body: sanitize(d.contact.bodyHTML, 'inline'), emailLabel: d.contact.emailLabel, email: d.contact.email,
        cta: { label: d.contact.cta.text, href: d.contact.cta.href },
        links: d.contact.links.map((l) => ({ label: l.text, href: l.href })),
      } },
    ]),
  };
}

// The home nav's links are same-page fragments. Stored, each one gets the page
// it belongs to, plus the anchor it jumps to when that anchor is on the page
// being drawn (see resolveNavHref in server/cms/layout.js).
const NAV_TARGETS = {
  '#practices': { href: '/nidos/digitalization.html', anchor: 'practices' },
  '/nidos/pricing.html': { href: '/nidos/pricing.html' },
  '#about': { href: '/#about', anchor: 'about' },
  '#contact': { href: '/#contact', anchor: 'contact' },
};

function siteSettingsFrom(c) {
  return {
    nav: {
      logo: c.nav.logo,
      links: c.nav.links.map((l) => {
        const target = NAV_TARGETS[l.href];
        if (!target) throw new Error(`nav: no target for ${l.href}`);
        return { text: l.text, ...target };
      }),
    },
    footer: {
      taglineHTML: sanitize(c.footer.taglineHTML, 'inline'),
      cols: c.footer.cols.map((col) => ({ heading: col.heading, links: col.links.map(({ text, href }) => ({ text, href })) })),
      legal: c.footer.legal,
      arcade: { text: c.footer.arcade, aria: c.footer.arcadeAria },
    },
    labels: { skip: c.a11y.skip, introSkip: c.intro.skip },
  };
}

// Saved "Site content" edits are keyed by data-cms name. Three shapes:
//   practice.<key>.<field>  -> the practice item with that key
//   form.<name>             -> the contact option carrying that cms name
//   anything else           -> a dot-path into the content file
// A key that cannot be placed stops the import: silently dropping an edit the
// owner made is the one outcome worse than not importing.
function applyOverrides(content, overrides) {
  const out = structuredClone(content);
  for (const { key, value } of overrides) {
    let m;
    if ((m = key.match(/^practice\.([a-z-]+)\.([a-zA-Z]+)$/))) {
      const item = out.practices.items.find((p) => p.key === m[1]);
      if (!item || typeof item[m[2]] !== 'string') throw new Error(`override ${key}: no such practice field`);
      item[m[2]] = value;
    } else if (key.startsWith('form.')) {
      const opt = out.contact && out.contact.options.find((o) => o.cms === key);
      if (!opt) throw new Error(`override ${key}: no contact option carries it`);
      opt.text = value;
    } else {
      const parts = key.split('.');
      let o = out;
      for (const part of parts.slice(0, -1)) {
        if (!o[part] || typeof o[part] !== 'object') throw new Error(`override ${key}: no such field`);
        o = o[part];
      }
      if (typeof o[parts.at(-1)] !== 'string') throw new Error(`override ${key}: no such field`);
      o[parts.at(-1)] = value;
    }
  }
  return out;
}

module.exports = { withIds, pageMeta, convertPricing, convertLegal, convert404, convertHome, convertServices, siteSettingsFrom, applyOverrides };
