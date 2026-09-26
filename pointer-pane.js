/*
 * pointer-pane.js - the pane that travels across a Practice cards grid, on
 * every page with one. Moved out of landing.js (plan 1b), which loads on the
 * home layout only; it now serves every grid on the page, not just the
 * first.
 */

/* ===== THE POINTER PANE =====
   One pane that travels between the six cells instead of six cells that each
   light up alone. Everything about how it looks is in the block's style.css
   (blocks/practice-cards/, and landing.css for the page on disk); this only
   decides which cell it is over.

   Pointer devices only. The cells fold into an accordion at phone width, where
   there is no hover to answer and tapping a card's link would flash the pane
   on the way out.

   Position comes from offsetLeft/offsetTop against .index, which is the cells'
   offsetParent because .index is positioned. Written as a translate plus a
   scale on a 1x1 box, so the only thing that ever animates is a transform. */
(() => {
    if (!window.matchMedia('(hover: hover)').matches) return;

    document.querySelectorAll('.index').forEach((index) => {
        const cards = [...index.querySelectorAll('.card')];
        if (!cards.length) return;

        const pane = document.createElement('div');
        pane.className = 'index-hl';
        pane.setAttribute('aria-hidden', 'true');
        index.append(pane);

        let current = null;

        /* animate=false puts the pane somewhere without travelling there. Used for
           the first cell of a visit - otherwise the pane flies in from the grid's
           top-left corner as it fades up - and after a resize, where every cell has
           moved and sliding to catch up would be a lie about what happened. */
        const place = (card, animate) => {
            current = card;
            if (!animate) pane.style.transition = 'none';
            pane.style.transform =
                'translate(' + card.offsetLeft + 'px, ' + card.offsetTop + 'px) ' +
                'scale(' + card.offsetWidth + ', ' + card.offsetHeight + ')';
            if (!animate) {
                void pane.offsetHeight;      // flush, or the removal never lands
                pane.style.transition = '';
            }
            pane.classList.add('is-on');
        };

        const clear = () => { current = null; pane.classList.remove('is-on'); };

        cards.forEach((card) => {
            const show = () => place(card, pane.classList.contains('is-on'));
            card.addEventListener('pointerenter', show);
            // Tabbing to a card's link lights the same pane a mouse would.
            card.addEventListener('focusin', show);
        });

        index.addEventListener('pointerleave', clear);
        index.addEventListener('focusout', (e) => {
            if (!index.contains(e.relatedTarget)) clear();
        });

        window.addEventListener('resize', () => {
            if (current) place(current, false);
        }, { passive: true });
    });
})();
