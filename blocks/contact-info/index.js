module.exports = {
  type: 'contact-info',
  label: 'Contact info',
  layouts: ['standard'],
  maxPerPage: 1,
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 60, required: true },
    subheading: { type: 'text', label: 'Subheading', max: 60, required: true },
    body: { type: 'richtext', label: 'Text', max: 300, profile: 'inline', required: true },
    emailLabel: { type: 'text', label: 'Email label', max: 48, required: true },
    email: { type: 'text', label: 'Email address', max: 80, required: true },
    cta: { type: 'group', label: 'Button', required: true, of: {
      label: { type: 'text', label: 'Label', max: 40, required: true },
      href: { type: 'link', label: 'Link', required: true },
    } },
    links: { type: 'list', label: 'Links', min: 0, max: 3, of: {
      label: { type: 'text', label: 'Label', max: 32, required: true },
      href: { type: 'link', label: 'Link', required: true },
    } },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  render(p, { esc, rich }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const links = (p.links || []).map((l) => `\n<a class="quiet-link hit-44" href="${esc(l.href)}">${esc(l.label)}</a>`).join('');
    return `<section${id} class="contact b-contact-info">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<div class="lattice contact-block">
<div>
<h3 class="contact-sub">${esc(p.subheading)}</h3>
<p class="contact-body">${rich(p.body, 'inline')}</p>
</div>
<div>
<p class="label">${esc(p.emailLabel)}</p>
<a class="contact-email hit-44" href="mailto:${esc(p.email)}">${esc(p.email)}</a>
<div class="contact-actions">
<a href="${esc(p.cta.href)}" class="btn-primary">${esc(p.cta.label)}</a>${links}
</div>
</div>
</div>
</div>
</section>`;
  },
};
