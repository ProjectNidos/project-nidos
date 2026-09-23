const { VISUALS } = require('../../scripts/lib/practice-visuals');

const DIAGRAMS = [...Object.keys(VISUALS), 'none'];
const two = (i) => String(i + 1).padStart(2, '0');
const hasDiagram = (x) => x.diagram !== 'none' && VISUALS[x.diagram];

module.exports = {
  type: 'service-catalogue',
  label: 'Service catalogue',
  layouts: ['standard'],
  maxPerPage: 1,
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 80, required: true },
    tocLabel: { type: 'text', label: '"On this page" label', max: 40, required: true },
    tocAria: { type: 'text', label: 'Index name for screen readers', max: 40, required: true },
    practices: { type: 'list', label: 'Practices', min: 1, max: 9, of: {
      anchor: { type: 'anchor', label: 'Anchor', required: true },
      title: { type: 'text', label: 'Title', max: 60, required: true },
      tocText: { type: 'text', label: 'Name in the index', max: 60, required: true },
      outcome: { type: 'text', label: 'Outcome', max: 120, required: true },
      diagram: { type: 'select', label: 'Diagram', options: DIAGRAMS, required: true },
      body: { type: 'longtext', label: 'Description', max: 400, required: true },
      problemLabel: { type: 'text', label: 'Problem label', max: 24, required: true },
      problemText: { type: 'text', label: 'Client problem', max: 200, required: true },
      scopeHeading: { type: 'text', label: 'Scope heading', max: 40, required: true },
      // Plain strings, not objects: each item is one dash-list line, nothing else varies per line.
      scope: { type: 'list', label: 'Scope', min: 1, max: 14, itemMax: 90, of: 'string' },
      pkgHeading: { type: 'text', label: 'Package heading', max: 40, required: true },
      pkgName: { type: 'text', label: 'Package name', max: 48, required: true },
      pkgBody: { type: 'longtext', label: 'Package text', max: 400, required: true },
      pkgNote: { type: 'text', label: 'Package note', max: 200 },
      priceLead: { type: 'text', label: 'Price lead', max: 12, required: true },
      price: { type: 'text', label: 'Price', max: 24, required: true },
      priceNote: { type: 'text', label: 'Price note', max: 160 },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: (p) => (p.practices.some(hasDiagram) ? ['visuals', 'diagrams'] : []),
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const toc = p.practices.map((x, i) =>
      `<li><a href="#${esc(x.anchor)}"><span class="toc-num">${two(i)}</span>${esc(x.tocText)}</a></li>`).join('\n');
    const items = p.practices.map((x, i) => {
      const v = hasDiagram(x);
      const visual = v ? `\n<div class="card-visual practice-visual" aria-hidden="true" data-length="${v.length}">${v.draw()}</div>` : '';
      // Today's copy for four of six practices leaves the package note blank;
      // the paragraph is still drawn (as the built page does), just empty.
      const pkgNote = `\n<p class="pkg-note">${esc(x.pkgNote || '')}</p>`;
      const priceNote = `\n<p class="price-note">${esc(x.priceNote || '')}</p>`;
      return `<article class="practice" id="${esc(x.anchor)}">
<div class="practice-id">
<p class="practice-num">${two(i)}</p>
<h2>${esc(x.title)}</h2>
<p class="practice-outcome">${esc(x.outcome)}</p>${visual}
</div>
<div class="practice-detail">
<p class="practice-body">${esc(x.body)}</p>
<p class="practice-problem"><span class="label">${esc(x.problemLabel)}</span>${esc(x.problemText)}</p>
<h3 class="sub">${esc(x.scopeHeading)}</h3>
<ul class="scope-list">
${x.scope.map((s) => `<li>${esc(s)}</li>`).join('\n')}
</ul>
<h3 class="sub">${esc(x.pkgHeading)}</h3>
<p class="pkg-name">${esc(x.pkgName)}</p>
<p class="pkg-body">${esc(x.pkgBody)}</p>${pkgNote}
<p class="practice-price">${esc(x.priceLead)} <span>${esc(x.price)}</span></p>${priceNote}
</div>
</article>`;
    }).join('\n');
    return `<section${id} class="practices">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<nav class="toc" aria-label="${esc(p.tocAria)}">
<p class="label">${esc(p.tocLabel)}</p>
<ol>
${toc}
</ol>
</nav>
</div>
<div class="wrap">
<div class="lattice practice-list">
${items}
</div>
</div>
</section>`;
  },
};
