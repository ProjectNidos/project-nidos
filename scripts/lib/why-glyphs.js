/*
 * The why glyphs, for every page that runs the three marked columns
 * (index.html and the services page).
 *
 * Three line marks from Tabler Icons (MIT), inlined rather than installed: the
 * site ships no icon font and no sprite sheet, and three 24px paths cost
 * less than either. Drawn at stroke-width 1.5 instead of Tabler's own 2 so they
 * sit at the weight of the hairlines around them rather than above it.
 *
 * aria-hidden, because each one only restates the claim beneath it.
 */
const WHY_GLYPHS = {
    // route-alt-left — one path branching and rejoining: the full cycle.
    route: ['M8 3h-5v5', 'M16 3h5v5',
            'M3 3l7.536 7.536a5 5 0 0 1 1.464 3.534v6.93',
            'M18 6.01v-.01', 'M16 8.02v-.01', 'M14 10v.01'],
    // terminal-2 — a prompt, for software over slideware.
    terminal: ['M8 9l3 3l-3 3', 'M13 15l3 0',
               'M3 4m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z'],
    // currency-dollar — the co-funding.
    dollar: ['M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2',
             'M12 3v3m0 12v3'],
};

function whyGlyph(name) {
    const paths = WHY_GLYPHS[name];
    if (!paths) throw new Error(`unknown why icon "${name}" — expected one of ${Object.keys(WHY_GLYPHS).join(', ')}`);
    return `<svg class="why-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor"`
        + ` stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"`
        + ` aria-hidden="true" focusable="false">`
        + paths.map((d) => `<path d="${d}"/>`).join('')
        + `</svg>`;
}

module.exports = { WHY_GLYPHS, whyGlyph };
