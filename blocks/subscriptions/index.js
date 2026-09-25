module.exports = {
  type: 'subscriptions',
  label: 'Subscriptions',
  layouts: ['standard'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    lede: { type: 'richtext', label: 'Lede', max: 300, profile: 'inline' },
    plans: { type: 'list', label: 'Plans', min: 1, max: 4, of: {
      name: { type: 'text', label: 'Name', max: 40, required: true },
      amount: { type: 'text', label: 'Amount', max: 32, required: true },
      unit: { type: 'text', label: 'Unit', max: 24, required: true },
      body: { type: 'text', label: 'Text', max: 200, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const lede = p.lede ? `\n<p class="section-lede">${rich(p.lede, 'inline')}</p>` : '';
    const plans = p.plans.map((x) => `<div class="plan">
<h3>${esc(x.name)}</h3>
<p class="amount">${esc(x.amount)}<span class="amount-unit">${esc(x.unit)}</span></p>
<p>${esc(x.body)}</p>
</div>`).join('\n');
    return `<section${id} class="pricing-section b-subscriptions">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>${lede}
<div class="lattice plan-grid">
${plans}
</div>
</div>
</section>`;
  },
};
