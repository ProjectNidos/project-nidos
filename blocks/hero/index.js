const button = { type: 'group', required: true, of: {
  label: { type: 'text', label: 'Label', max: 28, required: true },
  href: { type: 'link', label: 'Link', required: true },
} };

module.exports = {
  type: 'hero',
  label: 'Hero',
  layouts: ['home', 'standard'],
  maxPerPage: 1,
  fields: {
    titleLead: { type: 'text', label: 'Headline, line 1', max: 40, required: true },
    titleAccent: { type: 'text', label: 'Headline, line 2', max: 40, required: true },
    lede: { type: 'richtext', label: 'Lede', max: 320, profile: 'inline', required: true },
    primary: { ...button, label: 'Primary button' },
    secondary: { ...button, label: 'Secondary button' },
  },
  anchor: () => null,
  assets: () => ['orbit'],
  render(p, { esc, rich }) {
    return `<section class="hero b-hero">
<canvas class="hero-orbit" aria-hidden="true"></canvas>
<div class="wrap">
<h1 class="hero-title"><span>${esc(p.titleLead)}</span><br><span>${esc(p.titleAccent)}</span></h1>
<div class="hero-foot">
<div class="hero-actions">
<a href="${esc(p.primary.href)}" class="btn-primary">${esc(p.primary.label)}</a>
<a href="${esc(p.secondary.href)}" class="btn-quiet">${esc(p.secondary.label)}</a>
</div>
<p class="hero-lede">${rich(p.lede, 'inline')}</p>
</div>
</div>
</section>`;
  },
};
