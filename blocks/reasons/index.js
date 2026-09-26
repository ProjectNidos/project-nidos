const { whyGlyph, WHY_GLYPHS } = require('../../scripts/lib/why-glyphs');

module.exports = {
  type: 'reasons',
  label: 'Three reasons',
  layouts: ['home', 'standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    items: { type: 'list', label: 'Reasons', min: 3, max: 3, of: {
      icon: { type: 'select', label: 'Icon', options: Object.keys(WHY_GLYPHS), required: true },
      claim: { type: 'text', label: 'Claim', max: 48, required: true },
      support: { type: 'text', label: 'Support', max: 80, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const items = p.items.map((w) => `<div class="why-item">
<span class="why-icon">${whyGlyph(w.icon)}</span>
<p class="why-claim"><span>${esc(w.claim)}</span></p>
<p class="why-support">${esc(w.support)}</p>
</div>`).join('\n');
    return `<section${id} class="why b-reasons">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<div class="why-list">
${items}
</div>
</div>
</section>`;
  },
};
