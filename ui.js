/*
 * Shared interface behaviour for the CRM and the admin panel.
 *
 * Three things, all of which replace something the browser does badly:
 *
 *   ui.ask()      in place of confirm() and prompt(). A native dialog cannot
 *                 be styled, cannot name the record it is about, cannot
 *                 validate before you commit, and in the password case puts a
 *                 credential into an input we do not control.
 *
 *   ui.flash()    in place of alert(). An alert blocks the page, has to be
 *                 dismissed before anything else can happen, and looks like a
 *                 browser error rather than the product speaking.
 *
 *   ui.skeleton   in place of the word "Loading…", which tells you nothing
 *                 about what is coming and makes the layout jump when it does.
 *
 * The dialog mounts itself on load, so neither page carries markup for it.
 */
(function () {
    'use strict';

    const esc = (str) => String(str === null || str === undefined ? '' : str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    // --- Toast -------------------------------------------------------------

    function flash(message, kind) {
        const el = document.createElement('div');
        el.className = 'toast ' + (kind === 'error' ? 'is-error' : 'is-ok');
        el.textContent = message;
        // Errors are announced assertively; confirmations are not worth
        // interrupting a screen reader mid-sentence for.
        el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
        document.body.appendChild(el);
        setTimeout(() => el.remove(), kind === 'error' ? 6000 : 3500);
    }

    // --- Skeletons ---------------------------------------------------------

    const skeleton = {
        rows: (count, cls) => Array.from({ length: count },
            () => '<div class="skeleton ' + (cls || 'skeleton-row') + '"></div>').join(''),
        table: (rows, cols) => Array.from({ length: rows }, () =>
            '<tr>' + Array.from({ length: cols },
                () => '<td><div class="skeleton skeleton-row"></div></td>').join('') + '</tr>').join(''),
    };

    // --- Dialog ------------------------------------------------------------

    let el, input, hint, confirmBtn, suggestBtn;
    let resolver = null;
    let validate = null;
    let lastFocus = null;

    function mount() {
        el = document.createElement('div');
        el.id = 'ui-ask';
        el.className = 'crm-modal-overlay ask';
        el.hidden = true;
        el.innerHTML = [
            '<div class="crm-modal-content ask-panel" role="dialog" aria-modal="true"',
            '     aria-labelledby="ui-ask-title" aria-describedby="ui-ask-body">',
            '  <div class="ask-head">',
            '    <h2 class="ask-title" id="ui-ask-title"></h2>',
            '    <p class="ask-body" id="ui-ask-body"></p>',
            '  </div>',
            '  <div class="ask-field" id="ui-ask-field" hidden>',
            '    <label class="crm-label" for="ui-ask-input" id="ui-ask-label"></label>',
            '    <div class="ask-input-row">',
            '      <input id="ui-ask-input" class="crm-input" type="text" autocomplete="off" spellcheck="false">',
            '      <button type="button" class="btn-quiet" id="ui-ask-suggest">Suggest</button>',
            '    </div>',
            '    <p class="ask-hint" id="ui-ask-hint"></p>',
            '  </div>',
            '  <div class="ask-actions">',
            '    <button type="button" class="btn-quiet" id="ui-ask-cancel">Cancel</button>',
            '    <button type="button" class="btn-solid" id="ui-ask-confirm"></button>',
            '  </div>',
            '</div>',
        ].join('');
        document.body.appendChild(el);

        input = el.querySelector('#ui-ask-input');
        hint = el.querySelector('#ui-ask-hint');
        confirmBtn = el.querySelector('#ui-ask-confirm');
        suggestBtn = el.querySelector('#ui-ask-suggest');

        input.addEventListener('input', check);
        confirmBtn.addEventListener('click', commit);
        el.querySelector('#ui-ask-cancel').addEventListener('click', () => close(null));
        el.addEventListener('click', (e) => { if (e.target === el) close(null); });

        /* Unambiguous by construction: no l/1/I or O/0, and no punctuation to
           be mangled by the chat message this inevitably gets pasted into. */
        suggestBtn.addEventListener('click', () => {
            const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            const bytes = crypto.getRandomValues(new Uint32Array(16));
            input.value = Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
            input.type = 'text'; // it is being handed over, so it has to be readable
            check();
            input.select();
        });
    }

    function close(value) {
        el.hidden = true;
        document.removeEventListener('keydown', keys, true);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        const resolve = resolver;
        resolver = null;
        if (resolve) resolve(value);
    }

    function keys(e) {
        if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
        if (e.key === 'Enter' && !confirmBtn.disabled) { e.preventDefault(); commit(); return; }
        // A modal that lets focus wander behind it is not modal.
        if (e.key === 'Tab') {
            const list = Array.from(el.querySelectorAll('button:not([disabled]), input'))
                .filter((node) => node.offsetParent !== null);
            if (!list.length) return;
            const first = list[0];
            const last = list[list.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    }

    function check() {
        if (!validate) return;
        const problem = validate(input.value);
        confirmBtn.disabled = Boolean(problem);
        hint.textContent = problem || hint.dataset.help || '';
        hint.classList.toggle('is-error', Boolean(problem) && input.value.length > 0);
    }

    function commit() {
        if (confirmBtn.disabled) return;
        close(validate ? input.value : true);
    }

    /**
     * @param {object} opts
     * @param {string} opts.title
     * @param {string} [opts.body]           may contain <strong> around the record's name
     * @param {string} [opts.confirmLabel]
     * @param {boolean} [opts.destructive]
     * @param {object} [opts.field]          {label, help, placeholder, type, value, suggest, validate}
     * @returns {Promise<null|true|string>}  null if dismissed
     */
    function ask(opts) {
        if (!el) mount();
        lastFocus = document.activeElement;

        el.querySelector('#ui-ask-title').textContent = opts.title;
        el.querySelector('#ui-ask-body').innerHTML = opts.body || '';
        confirmBtn.textContent = opts.confirmLabel || 'Confirm';
        confirmBtn.classList.toggle('is-destructive', Boolean(opts.destructive));

        const field = opts.field;
        el.querySelector('#ui-ask-field').hidden = !field;
        suggestBtn.hidden = !(field && field.suggest);
        validate = field ? (field.validate || (() => null)) : null;

        if (field) {
            el.querySelector('#ui-ask-label').textContent = field.label || '';
            input.type = field.type || 'text';
            input.placeholder = field.placeholder || '';
            input.value = field.value || '';
            hint.dataset.help = field.help || '';
            check();
        } else {
            confirmBtn.disabled = false;
            hint.textContent = '';
        }

        el.hidden = false;
        document.addEventListener('keydown', keys, true);
        (field ? input : confirmBtn).focus();

        return new Promise((resolve) => { resolver = resolve; });
    }

    /* The common case by far: a yes/no about one named thing. */
    function confirmAction(title, body, opts) {
        return ask(Object.assign({ title, body, confirmLabel: 'Confirm' }, opts || {}))
            .then(Boolean);
    }

    window.ui = { ask, confirm: confirmAction, flash, skeleton, esc };
}());
