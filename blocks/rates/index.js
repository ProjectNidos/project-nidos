module.exports = {
  type: 'rates',
  label: 'Hourly rates',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    lede: { type: 'richtext', label: 'Lede', max: 300, profile: 'inline' },
    rows: { type: 'list', label: 'Rates', min: 1, max: 8, of: {
      role: { type: 'text', label: 'Role', max: 48, required: true },
      rate: { type: 'text', label: 'Rate', max: 32, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const lede = p.lede ? `\n<p class="section-lede">${rich(p.lede, 'inline')}</p>` : '';
    const rows = p.rows.map((r) => `<div class="rate-row">
<p class="role">${esc(r.role)}</p>
<p class="rate">${esc(r.rate)}</p>
</div>`).join('\n');
    return `<section${id} class="pricing-section">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>${lede}
<div class="lattice rate-table">
${rows}
</div>
</div>
</section>`;
  },
};
