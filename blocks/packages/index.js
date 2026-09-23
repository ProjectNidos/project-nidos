module.exports = {
  type: 'packages',
  label: 'Packages',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    cells: { type: 'list', label: 'Packages', min: 1, max: 9, of: {
      forPractice: { type: 'text', label: 'For which practice', max: 60, required: true },
      name: { type: 'text', label: 'Name', max: 48, required: true },
      body: { type: 'longtext', label: 'Text', max: 360, required: true },
      note: { type: 'text', label: 'Note', max: 200 },
      price: { type: 'text', label: 'Price', max: 24, required: true },
      unit: { type: 'text', label: 'Unit', max: 24, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const cells = p.cells.map((c) => `<div class="pkg">
<p class="pkg-for">${esc(c.forPractice)}</p>
<h3>${esc(c.name)}</h3>
<p>${esc(c.body)}</p>${c.note ? `\n<p class="pkg-note">${esc(c.note)}</p>` : ''}
<p class="amount">${esc(c.price)}<span class="amount-unit">${esc(c.unit)}</span></p>
</div>`).join('\n');
    return `<section${id} class="pricing-section">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<div class="lattice pkg-grid">
${cells}
</div>
</div>
</section>`;
  },
};
