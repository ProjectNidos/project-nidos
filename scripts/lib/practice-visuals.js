/*
 * The six practice visuals, drawn at build time into the practice cards.
 *
 * Each one is a small diagram of the practice's own work - a pipeline, a
 * follow-up timeline, an inbox, a sync, a document read into fields, a
 * checkout - built from the page's own parts: square hairline boxes, the
 * page's typeface, the ink ramp. No icon set, no glow, no gradient.
 *
 * Every visual tells its card's sentence once: the problem, then the result.
 * The markup below IS the result - every element sits where it ends up - so
 * with no JS, with reduced motion, or before the card is reached, the card
 * shows the finished state. landing.js arms a visual (every animation parked
 * at its first frame) and plays it once when the card scrolls in; hovering the
 * card replays it. The animation classes and their keyframes are in
 * landing.css under PRACTICE VISUALS:
 *
 *   a-fade   appears              a-out    disappears (pair with v-was)
 *   a-rise   rises into place     a-slide  slides in from the left
 *   a-draw   a stroke draws on    a-pulse  a short dash travels a path
 *   a-land   flies in from --dx/--dy, turned by --r, and settles
 *   a-move   travels from --dx/--dy to where it is drawn
 *   a-grow   grows from its left edge
 *   a-scan   the scan line in the document
 *   a-type   a typed character (a <tspan> takes fill-opacity, not opacity)
 *
 * --t is when it starts, --d how long it takes, both in seconds. Elements that
 * only exist at the start (a value that gets replaced, a source tag) carry
 * v-was, which hides them when nothing is playing.
 *
 * The viewBox is 360 x 200, the same for all six, so a label is the same size
 * in every card. The words are English, like the rest of the page; they are
 * decoration (the card is aria-hidden'd around them) and the card's sentence
 * carries the meaning.
 */

const W = 360;
const H = 200;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* style="--t:.5s;--dx:12px" from { t: .5, dx: 12 }. Times are seconds, offsets
   user units (a CSS px inside an SVG is one user unit). */
function vars(o) {
    if (!o) return '';
    const units = { t: 's', d: 's', dx: 'px', dy: 'px', r: 'deg', len: '' };
    // Rounded, so 0.25 + 5 * 0.07 prints as 0.6s rather than 0.6000000000000001s.
    const s = Object.entries(o).map(([k, v]) => `--${k}:${+(+v).toFixed(3)}${units[k] ?? ''}`).join(';');
    return ` style="${s}"`;
}

function cls(base, anim) { return anim ? `${base} ${anim}` : base; }

const rect = (x, y, w, h, c, a, v) => `<rect class="${cls(c, a)}" x="${x}" y="${y}" width="${w}" height="${h}"${vars(v)}/>`;
const text = (x, y, s, c, a, v, anchor) =>
    `<text class="${cls(c, a)}" x="${x}" y="${y}"${anchor ? ` text-anchor="${anchor}"` : ''}${vars(v)}>${esc(s)}</text>`;
const line = (x1, y1, x2, y2, c, a, v) => `<line class="${cls(c, a)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${vars(v)}/>`;
const path = (d, c, a, v) => `<path class="${cls(c, a)}" d="${d}"${vars(v)}/>`;
const g = (inner, a, v) => `<g${a ? ` class="${a}"` : ''}${vars(v)}>${inner}</g>`;

/* A tick: 9 wide, 7 tall, drawn from the left. */
const check = (x, y, t) => path(`M${x} ${y + 3.5}l3 3.5l6 -7`, 'v-check', t === undefined ? '' : 'a-draw', t === undefined ? null : { t, d: 0.3, len: 14 });

/* An envelope: the page's box with a fold. */
const envelope = (x, y, a, v) => g(
    rect(x, y, 13, 9, 'v-box') + path(`M${x} ${y}l6.5 5l6.5 -5`, 'v-rule'), a, v);

function svg(inner) {
    return `<svg viewBox="0 0 ${W} ${H}" focusable="false">${inner}</svg>`;
}

/* ===== CRM =====
   Four customers arrive from four places - a spreadsheet, a phone call, an
   inbox, a notes app - and land as cards in one pipeline. Then a deal moves
   from Lead to Proposal, and the column counts follow it. */
function crm() {
    const top = 56;              // header baseline; the board sits below it
    const cols = [
        { x: 20, name: 'Lead', was: '2', now: '1' },
        { x: 130, name: 'Proposal', was: '1', now: '2' },
        { x: 240, name: 'Won', was: null, now: '1' },
    ];
    const heads = cols.map((c) => g(
        text(c.x, top, c.name, 'v-label')
        + (c.was
            ? text(c.x + 100, top, c.was, 'v-label v-was', 'a-out', { t: 2.5, d: 0.2 }, 'end')
              + text(c.x + 100, top, c.now, 'v-label', 'a-fade', { t: 2.6, d: 0.25 }, 'end')
            : text(c.x + 100, top, c.now, 'v-label', '', null, 'end'))
        + line(c.x, top + 10.5, c.x + 100, top + 10.5, 'v-rule'),
        'a-fade', { t: 0.35, d: 0.4 })).join('');

    // A card, and above it the place this customer was kept before.
    const card = (x, y, name, from) =>
        text(x, y - 6, from, 'v-tag v-was', 'a-out', { t: 0.95, d: 0.25 })
        + rect(x, y, 100, 34, 'v-box')
        + text(x + 10, y + 21, name, 'v-text');

    // Where each card starts, as an offset from where it lands, and its tilt.
    const land = (inner, t, dx, dy, r) => g(inner, 'a-land', { t, d: 0.7, dx, dy, r });
    const row1 = top + 24, row2 = top + 68;

    return svg(
        heads
        + land(card(20, row1, 'Nord Freight', 'Excel row 14'), 0.5, 22, 68, -7)
        + land(card(240, row1, 'Kalns Studio', 'Sticky note'), 0.62, 6, -52, -4)
        + land(card(130, row1, 'Baltic Timber', 'Gmail thread'), 0.74, 30, 50, 6)
        // Riga Dental lands in Lead, then moves one column right.
        + g(
            land(card(130, row2, 'Riga Dental', 'Call log'), 0.86, 104, 36, 5)
            + rect(130, row2, 100, 34, 'v-box-on', 'a-fade', { t: 2.2, d: 0.3 }),
            'a-move', { t: 1.9, d: 0.6, dx: -110, dy: 0 })
    );
}

/* ===== SALES =====
   One lead, followed from the web form to a won deal: assigned to a person,
   then three follow-ups on day 0, 3 and 7 that nobody had to remember. */
function sales() {
    const y = 104;
    const stops = [
        { x: 30, top: 'New lead', below: 'Web form' },
        { x: 106, top: 'Assigned', below: 'Ilze K.' },
        { x: 178, top: 'Day 0', mail: true },
        { x: 222, top: 'Day 3', mail: true },
        { x: 266, top: 'Day 7', mail: true },
        { x: 330, top: 'Won', below: '€4,800', value: true },
    ];
    // Departure and travel time of each hop between consecutive stops.
    const hops = [
        { t: 0.5, d: 0.55 }, { t: 1.35, d: 0.5 }, { t: 2.0, d: 0.35 },
        { t: 2.55, d: 0.35 }, { t: 3.1, d: 0.45 },
    ];
    const arrive = [0.15, ...hops.map((h) => +(h.t + h.d).toFixed(2))];

    let out = line(stops[0].x, y, stops[5].x, y, 'v-rule');
    hops.forEach((h, i) => {
        const a = stops[i].x + 4, b = stops[i + 1].x - 4;
        out += line(a, y, b, y, 'v-progress', 'a-draw', { t: h.t, d: h.d, len: b - a });
    });
    stops.forEach((s, i) => {
        out += text(s.x, 84, s.top, 'v-label', '', null, 'middle');
        out += rect(s.x - 4, y - 4, 8, 8, 'v-node');
        out += rect(s.x - 4, y - 4, 8, 8, 'v-node-on', 'a-fade', { t: arrive[i], d: 0.2 });
        if (s.mail) out += envelope(s.x - 6.5, 120, 'a-rise', { t: arrive[i] + 0.05, d: 0.35 });
        else out += text(s.x, 132, s.below, s.value ? 'v-value' : 'v-text', 'a-rise', { t: arrive[i] + 0.05, d: 0.35 }, 'middle');
    });

    // The lead itself: drawn at Won, carried back to the start by five nested
    // offsets that each run out in turn.
    let dot = `<circle class="v-dot v-was a-out" cx="${stops[5].x}" cy="${y}" r="3.5"${vars({ t: 3.6, d: 0.2 })}/>`;
    hops.forEach((h, i) => {
        dot = g(dot, 'a-move', { t: h.t, d: h.d, dx: stops[i].x - stops[i + 1].x, dy: 0 });
    });
    return svg(out + dot);
}

/* ===== SUPPORT =====
   Four messages land in a shared inbox. Three are answered from the knowledge
   base in seconds; the fourth goes to a person. */
function support() {
    const rows = [
        { q: 'Where is my order?', a: 'Answered in 9 s' },
        { q: 'Change delivery address', a: 'Answered in 14 s' },
        { q: 'Can I get an invoice copy?', a: 'Answered in 11 s' },
        { q: 'Parcel arrived damaged', a: 'Sent to Marta', person: true },
    ];
    let out = text(20, 24, 'Inbox', 'v-label')
        + text(340, 24, 'Average reply 11 s', 'v-label', 'a-fade', { t: 3.0, d: 0.4 }, 'end');
    rows.forEach((r, i) => {
        const y = 36 + i * 38;
        const t = 1.0 + i * 0.5;
        out += g(rect(20, y, 182, 28, 'v-box') + text(30, y + 18, r.q, 'v-text'), 'a-rise', { t: 0.15 + i * 0.12, d: 0.4 });
        out += line(202, y + 14, 214, y + 14, 'v-progress', 'a-draw', { t, d: 0.2, len: 12 });
        if (r.person) {
            out += g(rect(218, y + 8, 12, 12, 'v-box-on') + text(224, y + 17.5, 'M', 'v-mini', '', null, 'middle'),
                'a-fade', { t: t + 0.15, d: 0.3 });
        } else {
            out += check(219, y + 10.5, t + 0.15);
        }
        out += text(236, y + 18, r.a, r.person ? 'v-value' : 'v-text', 'a-slide', { t: t + 0.2, d: 0.35 });
    });
    return svg(out);
}

/* ===== INTEGRATIONS =====
   An order typed once. The same moment it is saved, stock, the invoice and the
   customer record change together, in three systems, with nobody retyping it. */
function integrations() {
    const typed = 'Order 2041';
    const tspans = [...typed].map((ch, i) =>
        `<tspan class="a-type"${vars({ t: 0.25 + i * 0.07, d: 0.05 })}>${ch === ' ' ? '&#160;' : esc(ch)}</tspan>`).join('');

    const systems = [
        { y: 20, name: 'Warehouse', was: 'Stock 118', now: 'Stock 115', d: 'M148 100H181V40H214', len: 126 },
        { y: 80, name: 'Accounting', was: 'No invoice', now: 'Invoice 0412', d: 'M148 100H214', len: 66 },
        { y: 140, name: 'CRM', was: 'Last order 2 Sep', now: 'Last order today', d: 'M148 100H181V160H214', len: 126 },
    ];
    const sync = 2.0;

    let out = text(20, 70, 'New order', 'v-label')
        + rect(20, 78, 128, 44, 'v-box')
        + rect(20, 78, 128, 44, 'v-box-on', 'a-fade', { t: 1.15, d: 0.25 })
        + `<text class="v-value" x="32" y="104.5">${tspans}</text>`
        + text(20, 142, 'Typed once', 'v-label', 'a-fade', { t: sync + 0.35, d: 0.4 });

    systems.forEach((s) => {
        out += path(s.d, 'v-rule');
        out += path(s.d, 'v-link-on', 'a-fade', { t: sync, d: 0.3 });
        out += path(s.d, 'v-pulse', 'a-pulse', { t: 1.35, d: sync - 1.35, len: s.len });
        out += rect(214, s.y, 126, 40, 'v-box');
        out += rect(214, s.y, 126, 40, 'v-box-on', 'a-fade', { t: sync, d: 0.25 });
        out += text(224, s.y + 15, s.name, 'v-label');
        out += text(224, s.y + 31, s.was, 'v-value v-was', 'a-out', { t: sync, d: 0.15 });
        out += text(224, s.y + 31, s.now, 'v-value', 'a-fade', { t: sync + 0.05, d: 0.25 });
    });
    return svg(out);
}

/* ===== AI =====
   A supplier invoice read field by field into structured data, then the time
   it took by hand next to the time it takes now. */
function ai() {
    // The scan runs top to bottom of the page over 1.6 s from 0.3 s, so a field
    // at y is reached at 0.3 + 1.6 * (y - 16) / 168.
    const at = (y) => +(0.3 + (1.6 * (y - 16)) / 168).toFixed(2);
    const fields = [
        { x: 32, y: 50, w: 66, label: 'Supplier', value: 'Nord Freight', row: 44 },
        { x: 70, y: 106, w: 50, label: 'Amount', value: '€1,240.00', row: 74 },
        { x: 32, y: 140, w: 42, label: 'Due', value: '14 Oct', row: 104 },
    ];
    const filler = [[32, 62, 48], [32, 80, 80], [32, 90, 62], [32, 106, 30], [32, 122, 84], [32, 158, 64], [32, 168, 40]];

    let out = rect(20, 16, 112, 168, 'v-box') + text(32, 36, 'Invoice', 'v-text');
    filler.forEach(([x, y, w]) => { out += rect(x, y, w, 3, 'v-bar'); });
    fields.forEach((f) => {
        const t = at(f.y);
        out += rect(f.x, f.y, f.w, 3, 'v-bar-on');
        out += rect(f.x - 4, f.y - 5, f.w + 8, 13, 'v-mark', 'a-fade', { t, d: 0.2 });
        out += text(156, f.row, f.label, 'v-label');
        out += text(340, f.row, f.value, 'v-value', 'a-slide', { t: t + 0.1, d: 0.35 }, 'end');
        out += line(156, f.row + 9.5, 340, f.row + 9.5, 'v-rule');
    });
    out += line(20, 16, 132, 16, 'v-scan', 'a-scan', { t: 0.3, d: 1.7 });

    // Time: by hand, then with AI.
    out += text(156, 150, 'By hand', 'v-label')
        + rect(206, 145, 90, 6, 'v-box', 'a-grow', { t: 2.05, d: 0.7 })
        + text(340, 150, '12 min', 'v-text', 'a-fade', { t: 2.6, d: 0.3 }, 'end')
        + text(156, 172, 'With AI', 'v-label')
        + rect(206, 167, 5, 6, 'v-fill', 'a-grow', { t: 2.85, d: 0.2 })
        + text(340, 172, '40 s', 'v-value', 'a-fade', { t: 2.95, d: 0.3 }, 'end');
    return svg(out);
}

/* ===== COMMERCE =====
   A cart paid with one of three methods, verified by 3-D Secure, then the one
   payment becomes a shipped parcel and a posted entry in the books. */
function commerce() {
    /* The widest of the six: five steps across. The gaps between steps are
       kept to 14 so the boxes that carry words - 3-D Secure above all, the
       step the whole card turns on - get the width instead. */
    const chips = [
        { y: 58, name: 'Card' },
        { y: 89, name: 'SEPA' },
        { y: 120, name: 'Apple Pay', chosen: true },
    ];
    const outs = [
        { y: 40, name: 'Delivery', was: 'Waiting', now: 'Shipped', d: 'M246 100H254V60H262' },
        { y: 120, name: 'Accounting', was: 'Unpaid', now: 'Posted', d: 'M246 100H254V140H262' },
    ];
    const done = 2.3;

    let out = rect(8, 80, 56, 40, 'v-box')
        + rect(8, 80, 56, 40, 'v-box-on', 'a-fade', { t: 0.15, d: 0.25 })
        + text(16, 95, 'Cart', 'v-label')
        + text(16, 111, '€84.00', 'v-value');

    const hop1 = 'M64 100H71V131H78', hop2 = 'M148 131H155V100H162';
    out += path(hop1, 'v-rule') + path(hop1, 'v-link-on', 'a-fade', { t: 0.8, d: 0.2 })
        + path(hop1, 'v-pulse', 'a-pulse', { t: 0.4, d: 0.4, len: 45 });
    chips.forEach((c) => {
        out += rect(78, c.y, 70, 22, 'v-box');
        if (c.chosen) out += rect(78, c.y, 70, 22, 'v-box-on', 'a-fade', { t: 0.8, d: 0.2 });
        out += text(86, c.y + 15, c.name, c.chosen ? 'v-text' : 'v-label');
    });
    out += path(hop2, 'v-rule') + path(hop2, 'v-link-on', 'a-fade', { t: 1.35, d: 0.2 })
        + path(hop2, 'v-pulse', 'a-pulse', { t: 0.95, d: 0.4, len: 45 });

    out += rect(162, 76, 84, 48, 'v-box')
        + rect(162, 76, 84, 48, 'v-box-on', 'a-fade', { t: 1.35, d: 0.25 })
        + text(171, 94, '3-D Secure', 'v-label')
        + check(172, 104, 1.45)
        + text(186, 113, 'Passed', 'v-value', 'a-fade', { t: 1.6, d: 0.3 });

    outs.forEach((o) => {
        out += path(o.d, 'v-rule') + path(o.d, 'v-link-on', 'a-fade', { t: done, d: 0.2 })
            + path(o.d, 'v-pulse', 'a-pulse', { t: 1.85, d: done - 1.85, len: 56 });
        out += rect(262, o.y, 90, 40, 'v-box')
            + rect(262, o.y, 90, 40, 'v-box-on', 'a-fade', { t: done, d: 0.25 })
            + text(271, o.y + 15, o.name, 'v-label')
            + text(271, o.y + 31, o.was, 'v-value v-was', 'a-out', { t: done, d: 0.15 })
            + text(271, o.y + 31, o.now, 'v-value', 'a-fade', { t: done + 0.05, d: 0.25 });
    });
    return svg(out);
}

/* How long each one runs, in seconds - landing.js waits this long before a
   hover may replay it. */
const VISUALS = {
    crm: { draw: crm, length: 3.1 },
    sales: { draw: sales, length: 3.8 },
    support: { draw: support, length: 3.4 },
    integrations: { draw: integrations, length: 2.8 },
    ai: { draw: ai, length: 3.3 },
    commerce: { draw: commerce, length: 2.6 },
};

module.exports = { VISUALS };
