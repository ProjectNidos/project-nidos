module.exports = {
  type: 'text',
  label: 'Text',
  layouts: ['home'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    subheading: { type: 'text', label: 'Subheading', max: 100 },
    body: { type: 'richtext', label: 'Body', max: 1200, profile: 'inline', required: true },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const sub = p.subheading ? `\n<h3 class="about-sub">${esc(p.subheading)}</h3>` : '';
    return `<section${id} class="about">
<div class="wrap about-grid">
<div class="about-prose">
<h2 class="section-title">${esc(p.heading)}</h2>${sub}
<p>${rich(p.body, 'inline')}</p>
</div>
</div>
</section>`;
  },
};
