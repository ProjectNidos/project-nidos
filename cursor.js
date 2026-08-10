/*
 * Project Nidos — crosshair cursor.
 * Desktop (fine pointer) only; the module is inert on touch devices and
 * leaves the page untouched when it does not activate.
 */
(function () {
    'use strict';
    if (window.__pnCursor) return;
    if (!window.matchMedia || !matchMedia('(pointer: fine)').matches) return;
    window.__pnCursor = true;

    var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

    var style = document.createElement('style');
    style.id = 'pn-cursor-style';
    style.textContent = [
        'html.pn-cursor, html.pn-cursor * { cursor: none !important; }',
        'html.pn-cursor input, html.pn-cursor textarea { cursor: text !important; }',
        'html.pn-cursor select { cursor: auto !important; }',
        '.pn-cur { position: fixed; top: 0; left: 0; pointer-events: none; z-index: 2147483000; will-change: transform; }',
        '.pn-cur-dot { width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px; background: var(--primary, #ff5f1f); }',
        '.pn-cur-ring { width: 32px; height: 32px; margin: -16px 0 0 -16px; }',
        '.pn-cur-ring .pn-cur-c {',
        '  position: absolute; inset: 0; border: 1px solid rgba(255,255,255,0.55); border-radius: 50%;',
        '  transition: transform 200ms ease, border-color 200ms ease;',
        '}',
        /* crosshair ticks — 5px hairlines just outside the ring at N/E/S/W */
        '.pn-cur-tick { position: absolute; background: rgba(255,255,255,0.55); transition: background 200ms ease, transform 200ms ease; }',
        '.pn-cur-tick.n { top: -7px; left: 50%; width: 1px; height: 5px; margin-left: -0.5px; }',
        '.pn-cur-tick.s { bottom: -7px; left: 50%; width: 1px; height: 5px; margin-left: -0.5px; }',
        '.pn-cur-tick.w { left: -7px; top: 50%; height: 1px; width: 5px; margin-top: -0.5px; }',
        '.pn-cur-tick.e { right: -7px; top: 50%; height: 1px; width: 5px; margin-top: -0.5px; }',
        '.pn-cur-ring .pn-cur-rot { position: absolute; inset: 0; transition: transform 260ms ease; }',
        '.pn-cur-label {',
        '  position: absolute; top: 100%; left: 50%; transform: translate(-50%, 10px);',
        '  font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.6rem;',
        '  letter-spacing: 0.2em; text-transform: uppercase; white-space: nowrap;',
        '  color: var(--text-primary, #f4f4f5); opacity: 0; transition: opacity 200ms ease;',
        '}',
        '.pn-cur-ring.has-label .pn-cur-label { opacity: 1; }',
        '.pn-cur-ring.is-hover .pn-cur-c { transform: scale(1.45); border-color: var(--primary, #ff5f1f); }',
        '.pn-cur-ring.is-hover .pn-cur-tick { background: var(--primary, #ff5f1f); }',
        '.pn-cur-ring.is-hover .pn-cur-rot { transform: rotate(45deg); }',
        '.pn-cur-ring.is-down .pn-cur-c { transform: scale(0.85); }',
        '.pn-cur-ring.is-hover.is-down .pn-cur-c { transform: scale(1.2); }',
        '.pn-cur.is-hidden { opacity: 0; }',
        '.pn-cur { transition: opacity 250ms ease; }',
        '@media (prefers-reduced-motion: reduce) {',
        '  .pn-cur-ring .pn-cur-c, .pn-cur-tick, .pn-cur-ring .pn-cur-rot { transition: none; }',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    var dot = document.createElement('div');
    dot.className = 'pn-cur pn-cur-dot is-hidden';
    dot.setAttribute('aria-hidden', 'true');

    var ring = document.createElement('div');
    ring.className = 'pn-cur pn-cur-ring is-hidden';
    ring.setAttribute('aria-hidden', 'true');
    ring.innerHTML =
        '<div class="pn-cur-rot">' +
            '<span class="pn-cur-tick n"></span><span class="pn-cur-tick e"></span>' +
            '<span class="pn-cur-tick s"></span><span class="pn-cur-tick w"></span>' +
        '</div>' +
        '<div class="pn-cur-c"></div>' +
        '<span class="pn-cur-label"></span>';
    var labelEl = ring.querySelector('.pn-cur-label');

    function mountEls() {
        document.body.appendChild(dot);
        document.body.appendChild(ring);
        document.documentElement.classList.add('pn-cursor');
    }
    if (document.body) mountEls();
    else document.addEventListener('DOMContentLoaded', mountEls);

    var px = -100, py = -100;   // pointer
    var rx = -100, ry = -100;   // ring (lerped)
    var seen = false;
    var labelTarget = null;

    var INTERACTIVE = 'a, button, [role="button"], label, select, input, textarea, .lang-pill';

    document.addEventListener('mousemove', function (e) {
        px = e.clientX; py = e.clientY;
        dot.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
        if (!seen) {
            seen = true;
            rx = px; ry = py;
            dot.classList.remove('is-hidden');
            ring.classList.remove('is-hidden');
        }
        // Live label re-read: state machines (arcade) may swap the attribute
        // while the pointer stays inside the same element.
        if (labelTarget) {
            var t = labelTarget.getAttribute('data-cursor-label');
            if (t) { labelEl.textContent = t; ring.classList.add('has-label'); }
            else ring.classList.remove('has-label');
        }
    }, { passive: true });

    document.addEventListener('mouseover', function (e) {
        var el = e.target;
        if (el.closest) {
            if (el.closest(INTERACTIVE)) ring.classList.add('is-hover');
            labelTarget = el.closest('[data-cursor-label]');
            if (labelTarget) {
                labelEl.textContent = labelTarget.getAttribute('data-cursor-label') || '';
                ring.classList.toggle('has-label', !!labelEl.textContent);
            }
        }
    }, { passive: true });

    document.addEventListener('mouseout', function (e) {
        var el = e.target;
        if (el.closest) {
            if (el.closest(INTERACTIVE)) ring.classList.remove('is-hover');
            if (labelTarget && el.closest('[data-cursor-label]') === labelTarget) {
                labelTarget = null;
                ring.classList.remove('has-label');
            }
        }
    }, { passive: true });

    document.addEventListener('mousedown', function () { ring.classList.add('is-down'); }, { passive: true });
    document.addEventListener('mouseup', function () { ring.classList.remove('is-down'); }, { passive: true });

    document.documentElement.addEventListener('mouseleave', function () {
        dot.classList.add('is-hidden');
        ring.classList.add('is-hidden');
    });
    document.documentElement.addEventListener('mouseenter', function () {
        if (!seen) return;
        dot.classList.remove('is-hidden');
        ring.classList.remove('is-hidden');
    });
    window.addEventListener('blur', function () {
        dot.classList.add('is-hidden');
        ring.classList.add('is-hidden');
    });

    // Single rAF loop: lerp the ring toward the pointer; skip DOM writes once converged.
    var lastRx = null, lastRy = null;
    (function loop() {
        var k = reduceMotion.matches ? 1 : 0.18;
        rx += (px - rx) * k;
        ry += (py - ry) * k;
        if (Math.abs(px - rx) < 0.1) rx = px;
        if (Math.abs(py - ry) < 0.1) ry = py;
        if (rx !== lastRx || ry !== lastRy) {
            ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
            lastRx = rx; lastRy = ry;
        }
        requestAnimationFrame(loop);
    })();

    // Lets other modules force a label re-evaluation (e.g. arcade state changes).
    window.__pnCursorRefresh = function () {
        if (!labelTarget) return;
        var t = labelTarget.getAttribute('data-cursor-label');
        if (t) { labelEl.textContent = t; ring.classList.add('has-label'); }
        else ring.classList.remove('has-label');
    };
})();
