const { VISUALS } = require('../../scripts/lib/practice-visuals');

const DIAGRAMS = [...Object.keys(VISUALS), 'none'];
const hasDiagram = (c) => c.diagram !== 'none' && VISUALS[c.diagram];

module.exports = {
  type: 'practice-cards',
  label: 'Practice cards',
  layouts: ['home'],
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    sideLink: { type: 'group', label: 'Side link', required: true, of: {
      label: { type: 'text', label: 'Label', max: 28, required: true },
      href: { type: 'link', label: 'Link', required: true },
    } },
    cards: { type: 'list', label: 'Cards', min: 1, max: 9, of: {
      title: { type: 'text', label: 'Title', max: 48, required: true },
      summary: { type: 'text', label: 'Summary', max: 140, required: true },
      link: { type: 'group', label: 'Link', required: true, of: {
        label: { type: 'text', label: 'Label', max: 24, required: true },
        href: { type: 'link', label: 'Link', required: true },
      } },
      diagram: { type: 'select', label: 'Diagram', options: DIAGRAMS, required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: (p) => (p.cards.some(hasDiagram) ? ['visuals', 'diagrams'] : []),
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const cards = p.cards.map((c) => {
      const v = hasDiagram(c);
      const visual = v ? `<div class="card-visual" aria-hidden="true" data-length="${v.length}">${v.draw()}</div>\n` : '';
      return `<li class="card">
${visual}<h3>${esc(c.title)}</h3>
<p class="card-body">${esc(c.summary)}</p>
<a class="card-link" href="${esc(c.link.href)}">${esc(c.link.label)}</a>
</li>`;
    }).join('\n');
    return `<section${id} class="practices b-practice-cards">
<div class="wrap">
<div class="practices-head">
<h2 class="section-title">${esc(p.heading)}</h2>
<a class="pricing-link hit-44" href="${esc(p.sideLink.href)}">${esc(p.sideLink.label)}</a>
</div>
</div>
<div class="wrap">
<ul class="index">
${cards}
</ul>
</div>
</section>`;
  },
};
