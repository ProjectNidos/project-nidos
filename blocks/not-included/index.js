const button = (b, cls, esc) => (b ? `\n<a href="${esc(b.href)}" class="${cls}">${esc(b.label)}</a>` : '');
const buttonField = (label) => ({ type: 'group', label, of: {
  label: { type: 'text', label: 'Label', max: 28, required: true },
  href: { type: 'link', label: 'Link', required: true },
} });

module.exports = {
  type: 'not-included',
  label: 'Not included',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    items: { type: 'list', label: 'Items', min: 1, max: 12, itemMax: 200, of: 'string' },
    note: { type: 'longtext', label: 'Note', max: 400 },
    primary: buttonField('Primary button'),
    secondary: buttonField('Secondary button'),
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const note = p.note ? `\n<p class="price-note">${esc(p.note)}</p>` : '';
    const buttons = p.primary || p.secondary
      ? `\n<div class="cta-row">${button(p.primary, 'btn-primary', esc)}${button(p.secondary, 'btn-quiet', esc)}\n</div>`
      : '';
    return `<section${id} class="pricing-section b-not-included">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<div class="lattice terms-pane">
<div>
<ul class="scope-list">
${p.items.map((t) => `<li>${esc(t)}</li>`).join('\n')}
</ul>${note}
</div>
</div>${buttons}
</div>
</section>`;
  },
};
