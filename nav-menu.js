/*
 * nav-menu.js — the phone menu, on every page with the site nav.
 *
 * Below 720px base.css folds the four links behind .nav-toggle, top right on
 * the logo's row. The button ships `hidden`, so a page without this script
 * never shows a control that does nothing; this reveals it, then opens and
 * closes the panel: the button, Escape, a tap anywhere outside the nav, or
 * following a link - on the landing three of the four links are anchors on
 * the same page, so the panel has to get out of the way by itself.
 */
(() => {
    const nav = document.getElementById('mainNav');
    const btn = nav && nav.querySelector('.nav-toggle');
    if (!btn) return;

    const isOpen = () => nav.classList.contains('nav-open');
    const setOpen = (open) => {
        nav.classList.toggle('nav-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    btn.hidden = false;
    btn.addEventListener('click', () => setOpen(!isOpen()));

    nav.querySelectorAll('.nav-links a').forEach((a) => {
        a.addEventListener('click', () => setOpen(false));
    });
    document.addEventListener('click', (e) => {
        if (isOpen() && !nav.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen()) {
            setOpen(false);
            btn.focus();
        }
    });

    // Turning a phone to landscape can cross 720px with the panel open.
    const wide = window.matchMedia('(min-width: 721px)');
    wide.addEventListener('change', () => { if (wide.matches) setOpen(false); });
})();
