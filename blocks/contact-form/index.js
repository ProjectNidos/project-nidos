module.exports = {
  type: 'contact-form',
  label: 'Contact form',
  layouts: ['home'],
  maxPerPage: 1,
  fields: {
    anchor: { type: 'anchor', label: 'Anchor (for links)' },
    heading: { type: 'text', label: 'Heading', max: 60, required: true },
    lede: { type: 'text', label: 'Lede', max: 160, required: true },
    infoHeading: { type: 'text', label: 'Side heading', max: 40, required: true },
    infoBody: { type: 'longtext', label: 'Side text', max: 300, required: true },
    emailLabel: { type: 'text', label: 'Email label', max: 48, required: true },
    email: { type: 'text', label: 'Email address', max: 80, required: true },
    labels: { type: 'group', label: 'Field labels', required: true, of: {
      name: { type: 'text', label: 'Name', max: 32, required: true },
      email: { type: 'text', label: 'Email', max: 32, required: true },
      interest: { type: 'text', label: 'Interest', max: 40, required: true },
      message: { type: 'text', label: 'Message', max: 32, required: true },
    } },
    options: { type: 'list', label: 'Interest options', min: 1, max: 10, of: {
      value: { type: 'anchor', label: 'CRM lead category', required: true },
      text: { type: 'text', label: 'Text', max: 40, required: true },
    } },
    submit: { type: 'text', label: 'Button label', max: 28, required: true },
  },
  anchor: (p) => p.anchor || null,
  assets: () => [],
  /*
   * The ids, names and classes inside the form below (name, email, interest,
   * message, #name-err, .contact-form, ...) are fixed, not fields: landing.js
   * finds and validates the form by these exact selectors. Option values must
   * be keys of the leads.interestMap setting, or the CRM files the lead as
   * "general".
   */
  render(p, { esc }) {
    const id = p.anchor ? ` id="${esc(p.anchor)}"` : '';
    const L = p.labels;
    const options = p.options.map((o) => `<option value="${esc(o.value)}">${esc(o.text)}</option>`).join('\n');
    return `<section${id} class="contact">
<div class="wrap">
<h2 class="section-title">${esc(p.heading)}</h2>
<p class="contact-lede">${esc(p.lede)}</p>
<div class="contact-block">
<div class="contact-info">
<p class="label">${esc(p.infoHeading)}</p>
<p class="contact-body">${esc(p.infoBody)}</p>
<p class="label">${esc(p.emailLabel)}</p>
<a class="contact-email hit-44" href="mailto:${esc(p.email)}">${esc(p.email)}</a>
</div>
<form class="contact-form" action="/api/webhooks/form-lead" method="POST" novalidate>
<div class="form-row">
<div class="field">
<div class="field-box">
<label for="name">${esc(L.name)}</label>
<input type="text" id="name" name="name" autocomplete="name" required aria-describedby="name-err">
</div>
<span class="field-err" id="name-err"></span>
</div>
<div class="field">
<div class="field-box">
<label for="email">${esc(L.email)}</label>
<input type="email" id="email" name="email" autocomplete="email" required aria-describedby="email-err">
</div>
<span class="field-err" id="email-err"></span>
</div>
</div>
<div class="field field-select">
<div class="field-box">
<label for="interest">${esc(L.interest)}</label>
<select id="interest" name="interest">
${options}
</select>
</div>
</div>
<div class="field">
<div class="field-box">
<label for="message">${esc(L.message)}</label>
<textarea id="message" name="message" rows="5" required aria-describedby="message-err"></textarea>
</div>
<span class="field-err" id="message-err"></span>
</div>
<p class="form-status" role="status" aria-live="polite"></p>
<button type="submit" class="btn-primary">${esc(p.submit)}</button>
</form>
</div>
</div>
</section>`;
  },
};
