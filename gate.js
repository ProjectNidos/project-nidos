/*
 * Front-end site gate. Client-side only: the password below is served to every
 * visitor in plain text and is trivially bypassed. Casual deterrent, not security.
 */
(function () {
    var PASSWORD = '0607';
    var STORAGE_KEY = 'pn_gate_unlocked';

    try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') return;
    } catch (e) {
        return; // storage blocked — do not lock the user out
    }

    var style = document.createElement('style');
    style.textContent = [
        'html.pn-locked, html.pn-locked body { overflow: hidden !important; }',
        'html.pn-locked body > *:not(#pn-gate) { display: none !important; }',
        '#pn-gate {',
        '  position: fixed; inset: 0; z-index: 2147483647;',
        '  display: flex; align-items: center; justify-content: center; padding: 1.5rem;',
        '  background: #050505;',
        '  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
        '}',
        '#pn-gate .pn-card {',
        '  width: 100%; max-width: 360px; text-align: center;',
        '  padding: 2.5rem 2rem;',
        '  background: rgba(255, 255, 255, 0.025);',
        '  border: 1px solid rgba(255, 255, 255, 0.06);',
        '  border-radius: 20px;',
        '}',
        '#pn-gate .pn-logo {',
        '  font-family: Outfit, Inter, sans-serif; font-size: 1.35rem; font-weight: 600;',
        '  color: #f4f4f5; margin-bottom: 0.5rem;',
        '}',
        '#pn-gate .pn-hint { font-size: 0.85rem; color: #a1a1aa; margin-bottom: 1.75rem; }',
        '#pn-gate input {',
        '  width: 100%; padding: 0.85rem 1rem; text-align: center;',
        '  font-size: 1.1rem; letter-spacing: 0.3em; font-family: inherit;',
        '  color: #f4f4f5; background: rgba(255, 255, 255, 0.04);',
        '  border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 14px;',
        '  outline: none; transition: border-color 200ms;',
        '}',
        '#pn-gate input:focus { border-color: #ff5f1f; }',
        '#pn-gate button {',
        '  width: 100%; margin-top: 1rem; padding: 0.85rem 1rem; cursor: pointer;',
        '  font-family: inherit; font-size: 0.9rem; font-weight: 600; color: #fff;',
        '  background: #ff5f1f; border: 0; border-radius: 14px;',
        '  transition: background 200ms;',
        '}',
        '#pn-gate button:hover { background: #ff8554; }',
        '#pn-gate .pn-error {',
        '  min-height: 1.2rem; margin-top: 0.85rem;',
        '  font-size: 0.8rem; color: #ef4444; visibility: hidden;',
        '}',
        '#pn-gate .pn-error.pn-show { visibility: visible; }',
        '@keyframes pn-shake { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }',
        '#pn-gate .pn-shake { animation: pn-shake 180ms ease-in-out 2; }'
    ].join('\n');
    document.documentElement.appendChild(style);
    document.documentElement.classList.add('pn-locked');

    function mount() {
        var gate = document.createElement('div');
        gate.id = 'pn-gate';
        gate.innerHTML = [
            '<div class="pn-card">',
            '  <div class="pn-logo">Project Nidos</div>',
            '  <div class="pn-hint">Enter password to continue</div>',
            '  <form id="pn-form">',
            '    <input id="pn-input" type="password" inputmode="numeric" autocomplete="off"',
            '           autofocus aria-label="Password" placeholder="••••">',
            '    <button type="submit">Enter</button>',
            '  </form>',
            '  <div class="pn-error" id="pn-error">Wrong password</div>',
            '</div>'
        ].join('');
        document.body.appendChild(gate);

        var input = gate.querySelector('#pn-input');
        var error = gate.querySelector('#pn-error');
        var card = gate.querySelector('.pn-card');

        input.focus();
        input.addEventListener('input', function () {
            error.classList.remove('pn-show');
        });

        gate.querySelector('#pn-form').addEventListener('submit', function (e) {
            e.preventDefault();
            if (input.value === PASSWORD) {
                try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (err) { /* ignore */ }
                location.reload(); // replay intro splash and scroll animations from a clean state
                return;
            }
            error.classList.add('pn-show');
            card.classList.remove('pn-shake');
            void card.offsetWidth;
            card.classList.add('pn-shake');
            input.value = '';
            input.focus();
        });
    }

    if (document.body) {
        mount();
    } else {
        document.addEventListener('DOMContentLoaded', mount);
    }
})();
