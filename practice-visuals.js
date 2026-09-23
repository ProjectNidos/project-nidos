/*
 * practice-visuals.js — plays the practice diagrams on index.html and the
 * services page. The drawing and its vocabulary are in
 * scripts/lib/practice-visuals.js and visuals.css.
 */
/* ===== PRACTICE VISUALS =====
   Each practice's diagram is drawn in its finished state (see landing.css and
   scripts/lib/practice-visuals.js). Here it is armed - every animation parked
   on its first frame - and played once, the first time it is mostly on screen.
   Diagrams that come into view together play in page order, a beat apart,
   rather than all at once. Hovering or focusing the card (landing) or practice
   block (services page) whose diagram has finished plays it again; nothing
   loops on its own.

   Reduced motion: never armed, so the finished diagram is all there is. */
(() => {
    const visuals = [...document.querySelectorAll('.card-visual')];
    if (!visuals.length || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const until = new Map();     // visual -> time its current play finishes

    const play = (v) => {
        v.classList.remove('is-armed', 'is-playing');
        void v.getBoundingClientRect();          // restart, not resume
        v.classList.add('is-armed');
        requestAnimationFrame(() => v.classList.add('is-playing'));
        until.set(v, performance.now() + (parseFloat(v.dataset.length) || 3) * 1000);
    };

    visuals.forEach((v) => v.classList.add('is-armed'));

    const io = new IntersectionObserver((entries) => {
        entries
            .filter((e) => e.isIntersecting)
            .map((e) => e.target)
            .sort((a, b) => visuals.indexOf(a) - visuals.indexOf(b))
            .forEach((v, i) => {
                io.unobserve(v);
                setTimeout(() => play(v), i * 250);
            });
    }, { threshold: 0.6 });
    visuals.forEach((v) => io.observe(v));

    visuals.forEach((v) => {
        // The cell or block the diagram belongs to: hovering it replays.
        const card = v.closest('.card, .practice');
        if (!card) return;
        const again = () => {
            const end = until.get(v);
            if (end && performance.now() > end) play(v);
        };
        card.addEventListener('pointerenter', again);
        card.addEventListener('focusin', again);
    });
})();
