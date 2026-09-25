// Clause numbers are printed, not stored: renumbering never means editing
// every clause, only reordering the list.
const two = (i) => String(i + 1).padStart(2, '0');

module.exports = {
  type: 'legal-document',
  label: 'Legal document',
  layouts: ['standard'],
  maxPerPage: 1,
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    glance: { type: 'list', label: 'At a glance', min: 0, max: 6, of: {
      title: { type: 'text', label: 'Title', max: 40, required: true },
      body: { type: 'richtext', label: 'Text', max: 240, profile: 'inline', required: true },
    } },
    clauses: { type: 'list', label: 'Clauses', min: 1, max: 30, of: {
      anchor: { type: 'anchor', label: 'Anchor', required: true },
      title: { type: 'text', label: 'Title', max: 80, required: true },
      body: { type: 'richtext', label: 'Text', max: 8000, profile: 'full', required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const glance = p.glance && p.glance.length
      ? `<div class="lattice legal-glance">\n${p.glance.map((g) => `<div>
<h2>${esc(g.title)}</h2>
<p>${rich(g.body, 'inline')}</p>
</div>`).join('\n')}\n</div>\n`
      : '';
    const clauses = p.clauses.map((c, i) => `<div class="legal-clause" id="${esc(c.anchor)}">
<div class="legal-clause-id"><span class="legal-num">${two(i)}</span><h2>${esc(c.title)}</h2></div>
<div class="legal-body">${rich(c.body, 'full')}</div>
</div>`).join('\n');
    return `<section${id} class="legal-section b-legal-document">
<div class="wrap">
${glance}<div class="lattice legal-doc">
${clauses}
</div>
</div>
</section>`;
  },
};
