const button = (b, cls, esc) => (b ? `\n<a href="${esc(b.href)}" class="${cls}">${esc(b.label)}</a>` : '');
const buttonField = (label) => ({ type: 'group', label, of: {
  label: { type: 'text', label: 'Label', max: 28, required: true },
  href: { type: 'link', label: 'Link', required: true },
} });

module.exports = {
  type: 'button-row',
  label: 'Button row',
  layouts: ['standard'],
  fields: { primary: buttonField('Primary button'), secondary: buttonField('Secondary button') },
  anchor: () => null,
  assets: () => [],
  render(p, { esc }) {
    return `<section class="button-row b-button-row">
<div class="wrap cta-row">${button(p.primary, 'btn-primary', esc)}${button(p.secondary, 'btn-quiet', esc)}
</div>
</section>`;
  },
};
