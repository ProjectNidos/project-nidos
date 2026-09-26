/*
 * contact-form.js - checks the Contact form's fields in the browser, on every
 * page with one. Moved out of landing.js unchanged (plan 1b), since landing.js
 * loads on the home layout only.
 */

/* ===== FORM =====
   The form still posts natively to /api/webhooks/form-lead - novalidate only
   swaps the browser's bubbles for messages that sit with their field and are
   announced once, politely. If this script never runs, the browser's own
   required-field handling takes over and the form still submits. */
(() => {
    const form = document.querySelector('.contact-form');
    if (!form) return;

    const status = form.querySelector('.form-status');
    const T = {
        required: 'This field is required.',
        email: 'Enter a valid email address.',
        summary: (n) => `${n} field${n > 1 ? 's' : ''} need attention.`,
    };

    const fieldOf = (el) => el.closest('.field');
    const errOf = (el) => document.getElementById(el.id + '-err');

    function validate(el) {
        const err = errOf(el);
        let msg = '';
        if (el.required && !el.value.trim()) msg = T.required;
        else if (el.type === 'email' && el.value && !el.checkValidity()) msg = T.email;

        const field = fieldOf(el);
        if (field) field.classList.toggle('is-invalid', !!msg);
        el.setAttribute('aria-invalid', msg ? 'true' : 'false');
        if (err) err.textContent = msg;
        return !msg;
    }

    const controls = [...form.querySelectorAll('input, textarea')];
    controls.forEach((el) => {
        // Validate on the way out, then live once it has been marked wrong.
        el.addEventListener('blur', () => validate(el));
        el.addEventListener('input', () => {
            if (fieldOf(el) && fieldOf(el).classList.contains('is-invalid')) validate(el);
        });
    });

    form.addEventListener('submit', (e) => {
        const bad = controls.filter((el) => !validate(el));
        if (!bad.length) { if (status) status.textContent = ''; return; }
        e.preventDefault();
        if (status) status.textContent = T.summary(bad.length);
        bad[0].focus();
    });

    /* The practice detail pages link in with ?for=<value>. */
    const select = document.getElementById('interest');
    const want = new URLSearchParams(window.location.search).get('for');
    if (select && want && [...select.options].some((o) => o.value === want)) select.value = want;
})();
