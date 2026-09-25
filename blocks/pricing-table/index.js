module.exports = {
  type: 'pricing-table',
  label: 'Pricing table',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    columns: { type: 'group', label: 'Column labels', required: true, of: {
      practice: { type: 'text', label: 'Practice', max: 24, required: true },
      from: { type: 'text', label: 'From', max: 24, required: true },
      range: { type: 'text', label: 'Range', max: 24, required: true },
    } },
    rows: { type: 'list', label: 'Rows', min: 1, max: 12, of: {
      practice: { type: 'text', label: 'Practice', max: 60, required: true },
      href: { type: 'link', label: 'Link' },
      from: { type: 'text', label: 'From', max: 24, required: true },
      range: { type: 'text', label: 'Range', max: 32, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const C = p.columns;
    // The range label repeats inside each row for the phone layout, where the
    // head row is hidden and each row stacks.
    const rows = p.rows.map((r) => `<div class="price-row">
<h3>${r.href ? `<a href="${esc(r.href)}">${esc(r.practice)}</a>` : esc(r.practice)}</h3>
<p class="amount">${esc(r.from)}</p>
<p class="price-range"><span class="label-inline">${esc(C.range)} </span>${esc(r.range)}</p>
</div>`).join('\n');
    return `<section${id} class="pricing-section b-pricing-table">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<div class="lattice price-table">
<div class="price-row price-row--head" aria-hidden="true">
<p>${esc(C.practice)}</p>
<p>${esc(C.from)}</p>
<p>${esc(C.range)}</p>
</div>
${rows}
</div>
</div>
</section>`;
  },
};
