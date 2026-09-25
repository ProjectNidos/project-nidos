const two = (i) => String(i + 1).padStart(2, '0');

module.exports = {
  type: 'steps',
  label: 'Steps',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    lede: { type: 'richtext', label: 'Lede', max: 400, profile: 'inline' },
    items: { type: 'list', label: 'Steps', min: 2, max: 6, of: {
      title: { type: 'text', label: 'Title', max: 32, required: true },
      body: { type: 'text', label: 'Text', max: 120, required: true },
      price: { type: 'text', label: 'Price', max: 32 },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const lede = p.lede ? `\n<p class="section-lede">${rich(p.lede, 'inline')}</p>` : '';
    // Unlike the price note above, a step's price is genuinely absent (the
    // "Scaling" step has none) rather than an empty line, so this stays a
    // ternary: no price, no paragraph.
    const items = p.items.map((s, i) => `<li class="step">
<p class="step-num">${two(i)}</p>
<h3 class="step-title">${esc(s.title)}</h3>
<p class="step-body">${esc(s.body)}</p>${s.price ? `\n<p class="step-price">${esc(s.price)}</p>` : ''}
</li>`).join('\n');
    return `<section${id} class="pricing-section b-steps">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>${lede}
<ol class="steps">
${items}
</ol>
</div>
</section>`;
  },
};
