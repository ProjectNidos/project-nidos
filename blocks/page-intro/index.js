// "2026-09-23" -> "23 September 2026", the form the legal pages print.
const longDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB',
  { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

module.exports = {
  type: 'page-intro',
  label: 'Page intro',
  layouts: ['home', 'standard'],
  maxPerPage: 1,
  fields: {
    back: { type: 'group', label: 'Back link', of: {
      label: { type: 'text', label: 'Label', max: 32, required: true },
      href: { type: 'link', label: 'Link', required: true },
    } },
    titleLead: { type: 'text', label: 'Title, line 1', max: 60, required: true },
    titleAccent: { type: 'text', label: 'Title, line 2', max: 60 },
    lede: { type: 'richtext', label: 'Lede', max: 360, profile: 'inline' },
    // "updated" and "docNav" are legal-only: the services/pricing pages never
    // set them, the four legal documents and the 404 always do (Task 9).
    updated: { type: 'group', label: 'Last updated', of: {
      label: { type: 'text', label: 'Label', max: 24, required: true },
      date: { type: 'date', label: 'Date', required: true },
    } },
    docNav: { type: 'group', label: 'Links between documents', of: {
      label: { type: 'text', label: 'Name for screen readers', max: 40, required: true },
      links: { type: 'list', label: 'Links', min: 1, max: 8, of: {
        label: { type: 'text', label: 'Label', max: 40, required: true },
        href: { type: 'link', label: 'Link', required: true },
      } },
    } },
  },
  anchor: () => null,
  assets: () => [],
  render(p, { esc, rich, page }) {
    const back = p.back ? `<a class="back-link hit-44" href="${esc(p.back.href)}">${esc(p.back.label)}</a>\n` : '';
    const title = esc(p.titleLead) + (p.titleAccent ? `<br>${esc(p.titleAccent)}` : '');
    const lede = p.lede ? `\n<div class="page-lede">\n<p>${rich(p.lede, 'inline')}</p>\n</div>` : '';
    const updated = p.updated
      ? `\n<p class="legal-updated">${esc(p.updated.label)} <time datetime="${esc(p.updated.date)}">${longDate(p.updated.date)}</time></p>`
      : '';
    // The link to the page being drawn gets aria-current="page", the way the
    // nav's own current-page link already works.
    const docNav = p.docNav ? `\n<nav class="legal-nav" aria-label="${esc(p.docNav.label)}">
${p.docNav.links.map((l) => `<a href="${esc(l.href)}"${l.href === page.path ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`).join('\n')}
</nav>` : '';
    return `<section class="page-hero b-page-intro">
<div class="wrap">
${back}<h1 class="page-title">${title}</h1>${lede}${updated}${docNav}
</div>
</section>`;
  },
};
