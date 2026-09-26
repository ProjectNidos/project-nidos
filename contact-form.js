/*
 * contact-form.js - checks and sends the Contact form, on every page with one.
 * Moved out of landing.js (plan 1b), since landing.js loads on the home layout
 * only.
 */

/* ===== FORM =====
   A valid form is sent from here, as JSON to /api/webhooks/form-lead, so the
   visitor stays on the page and hears how it went in the status line, which is
   announced once, politely. novalidate swaps the browser's bubbles for
   messages that sit with their field. Without this script the browser posts
   the form itself - novalidate means it checks nothing first - and the server
   takes that post too and sends the visitor back to the form. */
(() => {
    const form = document.querySelector('.contact-form');
    if (!form) return;

    const status = form.querySelector('.form-status');
    const button = form.querySelector('button[type="submit"]');
    const T = {
        required: 'This field is required.',
        email: 'Enter a valid email address.',
        summary: (n) => `${n} field${n > 1 ? 's' : ''} need attention.`,
        sending: 'Sending…',
        sent: 'Thank you. Your message has been sent.',
        failed: (email) => `Your message could not be sent. Please try again${email ? `, or write to ${email}` : ''}.`,
    };
    const say = (text) => { if (status) status.textContent = text; };

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

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const bad = controls.filter((el) => !validate(el));
        if (bad.length) {
            say(T.summary(bad.length));
            bad[0].focus();
            return;
        }

        if (button) button.disabled = true;
        say(T.sending);
        // A server that never answers ends in the failure message too, not in
        // "Sending…" for good. AbortController rather than AbortSignal.timeout,
        // which Safari only has from 16.
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(), 15000);
        try {
            const res = await fetch(form.action, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(Object.fromEntries(new FormData(form))),
                signal: abort.signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            form.reset();
            say(T.sent);
        } catch (err) {
            // The address beside the form, so a failed send still reaches someone.
            const email = document.querySelector('.contact-email');
            say(T.failed(email && email.textContent.trim()));
        } finally {
            clearTimeout(timer);
            if (button) button.disabled = false;
        }
    });

    /* The practice detail pages link in with ?for=<value>. */
    const select = document.getElementById('interest');
    const want = new URLSearchParams(window.location.search).get('for');
    if (select && want && [...select.options].some((o) => o.value === want)) select.value = want;
})();
