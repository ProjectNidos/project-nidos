/*
 * orbital-hero.js — the hero backdrop on index.html and index-en.html.
 *
 * A vanilla port of the OrbitalHeroSection React component. The site has no
 * React, no bundler and no Tailwind, and the component's React part was only
 * a ref and an effect around a 2D canvas, so the drawing code is carried over
 * as it was and the wrapper became the two small blocks at the bottom.
 *
 * What it draws: the Sun does not sit still. Relative to the stars around it,
 * it moves at 19.4 km/s toward the solar apex in Hercules. The planets keep
 * running their Kepler ellipses around it, so the path each planet actually
 * cuts through space is an ellipse plus a straight drift: a helix. The camera
 * travels with the Sun, so the Sun stays put, the background stars slide past
 * with real depth parallax, and every planet leaves a spiral behind it.
 *
 * One thing is drawn for looks rather than for truth: by default the orbits
 * are swung square to the Sun's course (alignToCourse = 1), which makes every
 * wake a helix about one shared axis. The real ecliptic leans 53 degrees to
 * the course; alignToCourse = 0 gives you that instead.
 *
 * Costs nothing it does not have to, on the same rules as topology-bg.js:
 *   - nothing runs until the intro hands off (pn:intro-done), so the splash
 *     dissolve - the one frame on this page that has to be smooth - never
 *     shares a frame with this;
 *   - the loop runs only while the hero has a real box and is on screen, so it
 *     is idle behind the site gate, behind the splash, and below the fold;
 *   - a reduced-motion preference gets one still frame and no loop at all.
 */
(() => {
    'use strict';

    /* ===== ELEMENTS =====
       Real orbital elements, J2000, referred to the ecliptic. a in AU, i, node,
       peri and M0 in degrees. size is the dot radius in px - not to scale,
       nothing would be visible if it were. */
    const SOLAR_SYSTEM = [
        { name: 'Mercury', a: 0.38710, e: 0.20563, i: 7.005, node: 48.331, peri: 29.125, M0: 174.796, color: '#fff0d0', size: 2.2 },
        { name: 'Venus',   a: 0.72333, e: 0.00677, i: 3.395, node: 76.680, peri: 54.853, M0: 50.115,  color: '#ffc65a', size: 3.4 },
        { name: 'Earth',   a: 1.00000, e: 0.01671, i: 0.000, node: 348.739, peri: 114.208, M0: 357.517, color: '#5fd8ff', size: 3.8, glow: 1.1 },
        { name: 'Mars',    a: 1.52371, e: 0.09339, i: 1.850, node: 49.558, peri: 286.483, M0: 19.373, color: '#ff4a32', size: 2.9 },
        { name: 'Jupiter', a: 5.20290, e: 0.04839, i: 1.303, node: 100.464, peri: 273.867, M0: 20.020, color: '#ffa62e', size: 5.4 },
        { name: 'Saturn',  a: 9.53700, e: 0.05386, i: 2.485, node: 113.665, peri: 339.392, M0: 317.020, color: '#ffd884', size: 4.8 },
        { name: 'Uranus',  a: 19.1913, e: 0.04726, i: 0.773, node: 74.006, peri: 98.999, M0: 142.238, color: '#7fe6ff', size: 4.2 },
        { name: 'Neptune', a: 30.0690, e: 0.00859, i: 1.770, node: 131.784, peri: 276.336, M0: 256.228, color: '#3f7dff', size: 4.4 },
    ];

    /* Extra tilt and swing added to each orbit plane at planeSpread = 1, in
       degrees. Fixed rather than random, so the rosette is the same every load. */
    const PLANE_FAN = [
        [58, 35], [27, 145], [71, 250], [40, 80],
        [84, 190], [33, 310], [62, 120], [15, 20],
    ];

    /* Eccentricity each orbit is pulled toward at eccentricity = 1. */
    const ECC_FAN = [0.52, 0.34, 0.63, 0.44, 0.3, 0.58, 0.4, 0.68];

    /* Every knob the component had, with its defaults. See the React original
       for the long form; the ones that matter for placement are focus (where
       the Sun sits, as fractions of width and height), viewRadius (half-width
       of the view in AU - larger draws a smaller system), roll (which way the
       helix runs across the screen) and scrim (the veil copy sits on). */
    const DEFAULTS = {
        planets: SOLAR_SYSTEM,
        yearSeconds: 16,        // seconds of wall clock per Earth year
        trailYears: 2.6,        // how much past track each planet keeps
        compress: 0.42,         // radial squeeze: r AU is drawn at r^compress
        maxTurns: 3,            // cap on the coils a fast planet keeps
        planeSpread: 1,         // 0 = the real flat disc, 1 = fanned planes
        eccentricity: 0.25,     // 0 = the real near-circles
        alignToCourse: 1,       // 1 = helices about one shared axis
        driftSpeed: 1.5,        // 4.09 is the true 19.4 km/s ratio
        apex: [272, 53],        // solar apex, ecliptic lon/lat in degrees
        viewRadius: 3.4,
        tilt: 45,               // camera pitch: 0 looks straight down
        spin: 252,              // camera yaw
        roll: 13.5,             // camera roll about the line of sight
        lead: 0.12,             // Sun ahead of focus, fraction of the short side
        focus: [0.5, 0.5],
        /* One veil per entry: [edge, strength]. Each is drawn over the whole
           scene, heaviest at its edge and gone two thirds of the way across. */
        scrim: [],
        starCount: 1500,
        glow: 1,
        showOrbits: false,
        showSunTrack: true,
        interactive: true,
        paused: false,
        sunColor: '#FFF2CC',
        ground: '#000000',      // what the frame is cleared to, and the veil colour
    };

    const TAU = Math.PI * 2;
    const RAD = Math.PI / 180;

    /* Alpha steps the stars and the wakes are drawn in. See the star and wake
       passes in render() for why there are steps at all. */
    const STAR_LEVELS = 64;
    const WAKE_LEVELS = 96;
    const STAR_TINTS = ['255,255,255', '175,205,255', '255,214,170'];
    const STAR_STYLES = [];
    for (const tint of STAR_TINTS) {
        for (let l = 1; l <= STAR_LEVELS; l++) {
            STAR_STYLES.push(`rgba(${tint},${(l / STAR_LEVELS).toFixed(4)})`);
        }
    }

    /* Kepler's equation M = E - e·sin E, solved for the eccentric anomaly.
       Newton's method; at solar-system eccentricities three passes are plenty. */
    function eccentricAnomaly(M, e) {
        let m = M % TAU;
        if (m < 0) m += TAU;
        let E = m + e * Math.sin(m) * (1 + e * Math.cos(m));
        for (let k = 0; k < 8; k++) {
            const step = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
            E -= step;
            if (Math.abs(step) < 1e-10) break;
        }
        return E;
    }

    function parseRGB(color) {
        const c = color.trim();
        if (c[0] === '#') {
            const hex = c.slice(1);
            const full = hex.length === 3
                ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
                : hex.slice(0, 6);
            const n = parseInt(full, 16);
            return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        }
        const m = c.match(/(\d+(?:\.\d+)?)/g);
        if (m && m.length >= 3) return [+m[0], +m[1], +m[2]];
        return [255, 255, 255];
    }

    function mulberry32(seed) {
        let t = seed >>> 0;
        return () => {
            t += 0x6d2b79f5;
            let x = t;
            x = Math.imul(x ^ (x >>> 15), x | 1);
            x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
            return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
        };
    }

    /* ===== THE SCENE =====
       host is the element whose box the canvas fills and whose pointer moves
       nudge the camera. Returns { update(partial), setActive(bool), destroy() }:
       nothing is drawn until setActive(true). */
    function createOrbit(host, canvas, initial) {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return null;

        const C = Object.assign({}, DEFAULTS, initial);

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let width = 0;
        let height = 0;
        let dpr = 1;
        /* Simulation clock, in Earth years since J2000. A still frame is taken
           at 1.7, where the coils read well. */
        let years = reduced ? 1.7 : 0;
        let lastFrame = 0;
        let raf = 0;
        let active = false;

        /* --- camera ------------------------------------------------------- */
        // World axes: x, y span the ecliptic, z points to the ecliptic north
        // pole. Screen basis is built from yaw about z, then pitch about the
        // new x, then roll about the line of sight.
        let pxPerAU = 1;
        let cx = 0;
        let cy = 0;
        let camDist = 1; // camera standoff from the Sun, in AU
        const RIGHT = { x: 1, y: 0, z: 0 };
        const UP = { x: 0, y: 1, z: 0 };
        const FWD = { x: 0, y: 0, z: 1 }; // from the Sun back toward the camera

        function setCamera(yawDeg, pitchDeg, rollDeg) {
            const A = yawDeg * RAD;
            const B = pitchDeg * RAD;
            const ca = Math.cos(A), sa = Math.sin(A);
            const cb = Math.cos(B), sb = Math.sin(B);
            const rx = ca, ry = sa, rz = 0;
            const ux = -sa * cb, uy = ca * cb, uz = sb;
            FWD.x = sa * sb; FWD.y = -ca * sb; FWD.z = cb;
            // Roll changes nothing in space - it only decides which way the
            // helix runs across the screen.
            const R = rollDeg * RAD;
            const cr = Math.cos(R), sr = Math.sin(R);
            RIGHT.x = rx * cr + ux * sr;
            RIGHT.y = ry * cr + uy * sr;
            RIGHT.z = rz * cr + uz * sr;
            UP.x = -rx * sr + ux * cr;
            UP.y = -ry * sr + uy * cr;
            UP.z = -rz * sr + uz * cr;
        }

        // Scratch output for project(); reused to keep the hot loop allocation-free.
        const P = { x: 0, y: 0, depth: 0, s: 0, ok: false };

        /* World offset from the Sun -> screen. */
        function project(dx, dy, dz) {
            const vx = dx * RIGHT.x + dy * RIGHT.y + dz * RIGHT.z;
            const vy = dx * UP.x + dy * UP.y + dz * UP.z;
            const vz = dx * FWD.x + dy * FWD.y + dz * FWD.z;
            const depth = camDist - vz;
            if (depth < 0.6) {
                P.ok = false;
                return;
            }
            const s = camDist / depth;
            P.x = cx + vx * pxPerAU * s;
            P.y = cy - vy * pxPerAU * s;
            P.depth = depth;
            P.s = s;
            P.ok = true;
        }

        /* --- the Sun's own velocity --------------------------------------- */
        const DIR = { x: 0, y: 0, z: 0 };
        function setApex(lonDeg, latDeg) {
            const l = lonDeg * RAD;
            const b = latDeg * RAD;
            DIR.x = Math.cos(b) * Math.cos(l);
            DIR.y = Math.cos(b) * Math.sin(l);
            DIR.z = Math.sin(b);
        }

        /* --- heliocentric position from orbital elements ------------------ */
        function elementsOf(p, index, gamma, spread, ecc, align) {
            const aDraw = Math.pow(p.a, gamma);
            // Kepler's third law on the drawn spacing: P = a^1.5 years.
            const period = Math.pow(aDraw, 1.5);
            const fan = PLANE_FAN[index % PLANE_FAN.length];
            const inc = (p.i + spread * fan[0]) * RAD;
            const node = (p.node + spread * fan[1]) * RAD;
            const target = ECC_FAN[index % ECC_FAN.length];
            const ci = Math.cos(inc), si = Math.sin(inc);
            const cn = Math.cos(node), sn = Math.sin(node);
            return {
                p,
                rgb: parseRGB(p.color),
                e: Math.min(0.85, p.e + ecc * (target - p.e)),
                aDraw,
                period,
                n: TAU / period,
                cw: Math.cos(p.peri * RAD), sw: Math.sin(p.peri * RAD),
                ci, si, cn, sn,
                M0: p.M0 * RAD,
                swing: align > 0 ? swingToCourse(si * sn, -si * cn, ci, align) : null,
            };
        }

        /* The rotation that swings an orbit plane toward the one standing
           square to the Sun's course. At align = 1 the normal ends up along the
           course, so every wake is a true helix and all share one axis. */
        function swingToCourse(nx, ny, nz, align) {
            // Aim at whichever end of the course the plane already leans
            // toward, so an orbit is never turned inside out.
            const s = nx * DIR.x + ny * DIR.y + nz * DIR.z >= 0 ? 1 : -1;
            let tx = nx + align * (s * DIR.x - nx);
            let ty = ny + align * (s * DIR.y - ny);
            let tz = nz + align * (s * DIR.z - nz);
            const tl = Math.hypot(tx, ty, tz);
            if (tl < 1e-9) return null;
            tx /= tl; ty /= tl; tz /= tl;
            // Rodrigues: rotate n onto the blended normal, about their cross product.
            let ax = ny * tz - nz * ty;
            let ay = nz * tx - nx * tz;
            let az = nx * ty - ny * tx;
            const al = Math.hypot(ax, ay, az);
            if (al < 1e-9) return null;
            ax /= al; ay /= al; az /= al;
            const c = Math.max(-1, Math.min(1, nx * tx + ny * ty + nz * tz));
            const sA = al > 1 ? 1 : al;
            const k = 1 - c;
            return [
                c + ax * ax * k, ax * ay * k - az * sA, ax * az * k + ay * sA,
                ay * ax * k + az * sA, c + ay * ay * k, ay * az * k - ax * sA,
                az * ax * k - ay * sA, az * ay * k + ax * sA, c + az * az * k,
            ];
        }

        const R3 = { x: 0, y: 0, z: 0 };
        /* Heliocentric position at mean anomaly M, already squeezed. Writes R3. */
        function helio(el, M, gamma) {
            const e = el.e;
            const E = eccentricAnomaly(M, e);
            const xo = el.p.a * (Math.cos(E) - e);
            const yo = el.p.a * Math.sqrt(1 - e * e) * Math.sin(E);
            // turn by the argument of perihelion, inside the orbit plane
            const x1 = xo * el.cw - yo * el.sw;
            const y1 = xo * el.sw + yo * el.cw;
            // tip the plane by the inclination
            const y2 = y1 * el.ci;
            const z2 = y1 * el.si;
            // swing round by the ascending node
            let x = x1 * el.cn - y2 * el.sn;
            let y = x1 * el.sn + y2 * el.cn;
            let z = z2;
            // swing the whole plane toward the Sun's course
            const S = el.swing;
            if (S) {
                const rx = S[0] * x + S[1] * y + S[2] * z;
                const ry = S[3] * x + S[4] * y + S[5] * z;
                const rz = S[6] * x + S[7] * y + S[8] * z;
                x = rx; y = ry; z = rz;
            }
            // Squeeze along the radius. Angles are untouched, so tilts and the
            // Sun's offset from the ellipse centre survive.
            if (gamma !== 1) {
                const r = Math.sqrt(x * x + y * y + z * z);
                if (r > 1e-9) {
                    const s = Math.pow(r, gamma - 1);
                    x *= s; y *= s; z *= s;
                }
            }
            R3.x = x; R3.y = y; R3.z = z;
        }

        let elems = [];
        let elemsKey = '';
        function syncElements() {
            const key =
                C.compress + '/' + C.planeSpread + '/' + C.eccentricity + '/' +
                C.alignToCourse + '/' + C.apex[0] + ',' + C.apex[1] + '/' +
                C.planets.map((p) => p.name + p.a + p.e + p.color).join('|');
            if (key === elemsKey) return;
            elemsKey = key;
            elems = C.planets.map((p, idx) =>
                elementsOf(p, idx, C.compress, C.planeSpread, C.eccentricity, C.alignToCourse));
        }

        /* --- background stars --------------------------------------------- */
        // Kept in world coords, so turning the camera does not drag them
        // along. Real stars sit some 270,000 AU away and would not shift by a
        // pixel in a lifetime of watching, so the depth range is squeezed hard;
        // the gradient is honest though: near stars slide, far ones barely stir.
        let D_NEAR = 60;
        let D_FAR = 1400;
        let sx = new Float64Array(0), sy = sx, sz = sx, sMag = sx, sPhase = sx;
        let sTint = new Uint8Array(0);
        let starN = 0;
        // Per-frame scratch for the star pass: where each visible star landed,
        // its size, its alpha step, and the draw order grouped by step.
        let vX = new Float32Array(0), vY = vX, vR = vX;
        let vStep = new Uint16Array(0), vOrder = new Uint32Array(0);
        const stepCount = new Uint32Array(STAR_STYLES.length);
        const stepAt = new Uint32Array(STAR_STYLES.length);
        let rand = mulberry32(0xc0ffee);

        /* Distance the Sun has travelled, in AU. */
        let dist = 0;

        /* Place one star at a random spot in the frustum, at an optional fixed
           depth, optionally on a given edge (0 left, 1 right, 2 top, 3 bottom). */
        function seedStar(k, depth, edge) {
            const d = depth !== undefined
                ? depth
                : D_NEAR * Math.pow(D_FAR / D_NEAR, Math.pow(rand(), 0.55));
            const halfW = (width * 0.5) * 1.15;
            const halfH = (height * 0.5) * 1.15;
            let ox, oy;
            if (edge === 0) { ox = -halfW; oy = (rand() * 2 - 1) * halfH; }
            else if (edge === 1) { ox = halfW; oy = (rand() * 2 - 1) * halfH; }
            else if (edge === 2) { ox = (rand() * 2 - 1) * halfW; oy = -halfH; }
            else if (edge === 3) { ox = (rand() * 2 - 1) * halfW; oy = halfH; }
            else { ox = (rand() * 2 - 1) * halfW; oy = (rand() * 2 - 1) * halfH; }
            // Those are offsets from the middle of the frame, and projection
            // measures from the Sun. The original took them as offsets from the
            // Sun, which only holds with the Sun centred: pushed right, a star
            // "re-entering on the left edge" landed a frame's width left of the
            // Sun - mid-screen - and they piled up there as a dotted column.
            ox += width * 0.5 - cx;
            oy += height * 0.5 - cy;
            const scale = d / (camDist * pxPerAU);
            const vx = ox * scale;
            const vy = -oy * scale;
            const vz = camDist - d;
            // view basis -> world, then offset by where the Sun is right now
            sx[k] = vx * RIGHT.x + vy * UP.x + vz * FWD.x + DIR.x * dist;
            sy[k] = vx * RIGHT.y + vy * UP.y + vz * FWD.y + DIR.y * dist;
            sz[k] = vx * RIGHT.z + vy * UP.z + vz * FWD.z + DIR.z * dist;
            sMag[k] = Math.pow(rand(), 2.4);
            sPhase[k] = rand() * TAU;
            const t = rand();
            sTint[k] = t > 0.9 ? 1 : t < 0.08 ? 2 : 0;
        }

        function buildStars() {
            starN = Math.max(
                60,
                Math.round(C.starCount * Math.min(2, (width * height) / (1440 * 900)))
            );
            sx = new Float64Array(starN);
            sy = new Float64Array(starN);
            sz = new Float64Array(starN);
            sMag = new Float64Array(starN);
            sPhase = new Float64Array(starN);
            sTint = new Uint8Array(starN);
            vX = new Float32Array(starN);
            vY = new Float32Array(starN);
            vR = new Float32Array(starN);
            vStep = new Uint16Array(starN);
            vOrder = new Uint32Array(starN);
            rand = mulberry32(0xc0ffee);
            for (let k = 0; k < starN; k++) seedStar(k);
        }

        /* --- sprites ------------------------------------------------------ */
        const glowCache = new Map();
        function glowSprite(color) {
            const hit = glowCache.get(color);
            if (hit) return hit;
            const R = 64;
            const c = document.createElement('canvas');
            c.width = c.height = R * 2;
            const g2 = c.getContext('2d');
            const [r, g, b] = parseRGB(color);
            const grad = g2.createRadialGradient(R, R, 0, R, R, R);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.15, `rgba(${r},${g},${b},0.95)`);
            grad.addColorStop(0.36, `rgba(${r},${g},${b},0.26)`);
            grad.addColorStop(0.66, `rgba(${r},${g},${b},0.05)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            g2.fillStyle = grad;
            g2.fillRect(0, 0, R * 2, R * 2);
            glowCache.set(color, c);
            return c;
        }

        /* Where the Sun lands on screen: focus, then a little ahead along its
           course so the spirals have room behind it. Needs the camera set. */
        function placeSun() {
            cx = width * C.focus[0];
            cy = height * C.focus[1];
            project(DIR.x, DIR.y, DIR.z);
            if (P.ok) {
                const dxs = P.x - cx;
                const dys = P.y - cy;
                const len = Math.hypot(dxs, dys) || 1;
                const push = Math.min(width, height) * C.lead;
                cx += (dxs / len) * push;
                cy += (dys / len) * push;
            }
        }

        /* --- sizing ------------------------------------------------------- */
        function resize() {
            const rect = host.getBoundingClientRect();
            const w = Math.max(1, rect.width);
            const h = Math.max(1, rect.height);
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (w === width && h === height) return;
            width = w;
            height = h;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            layout();
            placeSun();
            buildStars();
        }

        function layout() {
            pxPerAU = (Math.min(width, height) * 0.5) / C.viewRadius;
            camDist = C.viewRadius * 3.1;
            D_NEAR = camDist * 5;
            D_FAR = camDist * 120;
            setApex(C.apex[0], C.apex[1]);
            setCamera(C.spin, C.tilt, C.roll);
        }

        /* --- pointer ------------------------------------------------------ */
        let pointerX = 0, pointerY = 0, camX = 0, camY = 0;
        function onPointer(ev) {
            if (!C.interactive) return;
            const rect = host.getBoundingClientRect();
            pointerX = ((ev.clientX - rect.left) / rect.width - 0.5) * 2;
            pointerY = ((ev.clientY - rect.top) / rect.height - 0.5) * 2;
        }
        function onLeave() { pointerX = 0; pointerY = 0; }

        /* --- the star at the centre -------------------------------------- */
        function drawSun(k, t) {
            const [r, g, b] = parseRGB(C.sunColor);
            const pulse = 1 + Math.sin(t * 2.1) * 0.02;
            // The real Sun is 0.0093 AU across - a fifth of a pixel here. What
            // you actually see at this range is its glare, so that is drawn.
            const R = Math.max(5, Math.min(width, height) * 0.013) * pulse;

            // A tight halo, not a wash: the disc carries the light.
            const haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 14);
            haze.addColorStop(0, `rgba(${r},${g},${b},${0.05 * k})`);
            haze.addColorStop(0.4, `rgba(255,190,110,${0.014 * k})`);
            haze.addColorStop(1, 'rgba(255,160,80,0)');
            ctx.fillStyle = haze;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 14, 0, TAU);
            ctx.fill();

            const outer = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 4.6);
            outer.addColorStop(0, `rgba(${r},${g},${b},${0.34 * k})`);
            outer.addColorStop(0.3, `rgba(255,222,160,${0.1 * k})`);
            outer.addColorStop(0.62, `rgba(255,196,110,${0.025 * k})`);
            outer.addColorStop(1, 'rgba(255,180,90,0)');
            ctx.fillStyle = outer;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 4.6, 0, TAU);
            ctx.fill();

            const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 2.3);
            bloom.addColorStop(0, `rgba(255,255,255,${k})`);
            bloom.addColorStop(0.42, `rgba(255,252,240,${0.7 * k})`);
            bloom.addColorStop(0.72, `rgba(${r},${g},${b},${0.22 * k})`);
            bloom.addColorStop(1, 'rgba(255,210,140,0)');
            ctx.fillStyle = bloom;
            ctx.beginPath();
            ctx.arc(cx, cy, R * 2.3, 0, TAU);
            ctx.fill();

            ctx.fillStyle = 'rgba(255,255,255,1)';
            ctx.beginPath();
            ctx.arc(cx, cy, R, 0, TAU);
            ctx.fill();
        }

        /* --- one frame ---------------------------------------------------- */
        function render(t) {
            const k = C.glow;
            // layout first: it sets the course, which the element maths needs.
            layout();
            syncElements();

            // ease the camera toward the pointer
            camX += (pointerX - camX) * 0.04;
            camY += (pointerY - camY) * 0.04;
            setCamera(C.spin + camX * 7, C.tilt + camY * 5, C.roll);

            dist = C.driftSpeed * t;
            placeSun();

            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = C.ground;
            ctx.fillRect(0, 0, width, height);
            ctx.globalCompositeOperation = 'lighter';

            /* stars --------------------------------------------------------
               Worked out first, drawn second. The original gave every star its
               own rgba() string, so the browser parsed ~1400 colours a frame -
               half the cost of the whole scene. Here each star's alpha is
               rounded to one of 64 steps per tint and every step is filled as
               a single path, so a frame parses at most 192. A step of 1/64 on
               a point of light is below what anyone can see. */
            const dRef = D_NEAR * 3.3;
            let shown = 0;
            stepCount.fill(0);
            const left = -width * 0.12;
            const right = width * 1.12;
            const top = -height * 0.12;
            const bottom = height * 1.12;
            for (let s = 0; s < starN; s++) {
                // position relative to the Sun, which is where the camera rides
                project(sx[s] - DIR.x * dist, sy[s] - DIR.y * dist, sz[s] - DIR.z * dist);
                if (!P.ok || P.depth > D_FAR * 1.25) {
                    seedStar(s);
                    continue;
                }
                if (P.x < left || P.x > right || P.y < top || P.y > bottom) {
                    // gone off an edge: bring it back in on the opposite side
                    seedStar(s, undefined,
                        P.x < left ? 1 : P.x > right ? 0 : P.y < top ? 3 : 2);
                    continue;
                }
                if (P.depth < D_NEAR * 0.75) continue;

                // apparent brightness falls off with distance, and fades out at
                // the far wall so nothing pops in
                const near = Math.min(1, (P.depth - D_NEAR * 0.75) / (D_NEAR * 0.6));
                const far = 1 - Math.max(0, (P.depth - D_FAR * 0.78) / (D_FAR * 0.32));
                let a = (0.2 + sMag[s] * 1.05) * Math.pow(dRef / P.depth, 0.8) * near * far;
                if (a <= 0.012) continue;
                a *= 0.82 + 0.18 * Math.sin(t * 9 + sPhase[s]);
                const level = Math.max(1, Math.min(STAR_LEVELS, Math.round(a * STAR_LEVELS)));
                const step = sTint[s] * STAR_LEVELS + level - 1;
                vX[shown] = P.x;
                vY[shown] = P.y;
                vR[shown] = Math.min(2.3, 0.55 + sMag[s] * 1.5 * Math.pow(dRef / P.depth, 0.5));
                vStep[shown] = step;
                stepCount[step]++;
                shown++;
            }
            // Counting sort by step, then one fill per step.
            for (let q = 0, at = 0; q < stepCount.length; q++) {
                stepAt[q] = at;
                at += stepCount[q];
            }
            for (let v = 0; v < shown; v++) vOrder[stepAt[vStep[v]]++] = v;
            for (let q = 0, at = 0; q < stepCount.length; q++) {
                const n = stepCount[q];
                if (!n) continue;
                ctx.fillStyle = STAR_STYLES[q];
                ctx.beginPath();
                for (const end = at + n; at < end; at++) {
                    const v = vOrder[at];
                    const size = vR[v];
                    if (size < 1.05) {
                        ctx.rect(vX[v], vY[v], size, size);
                    } else {
                        ctx.moveTo(vX[v] + size * 0.5, vY[v]);
                        ctx.arc(vX[v], vY[v], size * 0.5, 0, TAU);
                    }
                }
                ctx.fill();
            }

            /* the Sun's own track through space ----------------------------- */
            if (C.showSunTrack) {
                // A straight line, so it can run much further back than the
                // planets' wakes without any clutter.
                const back = C.driftSpeed * C.trailYears * 1.1;
                project(0, 0, 0);
                const hx = P.x, hy = P.y;
                project(-DIR.x * back, -DIR.y * back, -DIR.z * back);
                if (P.ok) {
                    const grad = ctx.createLinearGradient(hx, hy, P.x, P.y);
                    grad.addColorStop(0, `rgba(255,246,214,${k})`);
                    grad.addColorStop(0.45, `rgba(255,206,110,${0.55 * k})`);
                    grad.addColorStop(1, 'rgba(255,180,80,0)');
                    ctx.strokeStyle = grad;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(hx, hy);
                    ctx.lineTo(P.x, P.y);
                    ctx.lineWidth = 11;
                    ctx.globalAlpha = 0.16;
                    ctx.stroke();
                    ctx.lineWidth = 4;
                    ctx.globalAlpha = 0.3;
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                    ctx.lineWidth = 1.8;
                    ctx.stroke();
                }
            }

            /* orbit guides -------------------------------------------------- */
            if (C.showOrbits) {
                for (const el of elems) {
                    const [r, g, b] = el.rgb;
                    const steps = 160;
                    ctx.beginPath();
                    let started = false;
                    for (let q = 0; q <= steps; q++) {
                        // step in eccentric anomaly, then back out the mean anomaly
                        const E = (q / steps) * TAU;
                        const M = E - el.e * Math.sin(E);
                        helio(el, M, C.compress);
                        project(R3.x, R3.y, R3.z);
                        if (!P.ok) { started = false; continue; }
                        if (!started) { ctx.moveTo(P.x, P.y); started = true; }
                        else ctx.lineTo(P.x, P.y);
                    }
                    ctx.strokeStyle = `rgba(${r},${g},${b},${0.045 * k})`;
                    ctx.lineWidth = 4;
                    ctx.stroke();
                    ctx.strokeStyle = `rgba(${r},${g},${b},${0.3 * k})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            /* planets and their helical wakes -------------------------------- */
            const shots = [];

            for (const el of elems) {
                const [r, g, b] = el.rgb;
                const bright = (el.p.glow ?? 1) * k;
                // A wake is a window on the past, the same for every planet -
                // except Mercury would wind 5 coils into a scribble, so fast
                // planets get theirs clipped to a few turns.
                const span = Math.min(C.trailYears, C.maxTurns * el.period);
                const turns = span / el.period;
                // Enough samples to keep tight coils smooth; a stretched orbit
                // needs more, since a planet covers more ground per step near
                // perihelion.
                const N = Math.max(
                    48,
                    Math.min(360, Math.ceil(turns * 46 * (1 + 2.2 * el.e)) + 48)
                );

                const xs = new Float64Array(N + 1);
                const ys = new Float64Array(N + 1);
                const okArr = new Uint8Array(N + 1);
                for (let q = 0; q <= N; q++) {
                    const age = (1 - q / N) * span; // years back from now
                    const M = el.M0 + el.n * (t - age);
                    helio(el, M, C.compress);
                    // where the planet really was: its place around the Sun at
                    // that moment, minus how far the Sun has moved since.
                    // Ellipse plus drift is a helix.
                    const back = C.driftSpeed * age;
                    project(R3.x - DIR.x * back, R3.y - DIR.y * back, R3.z - DIR.z * back);
                    xs[q] = P.x; ys[q] = P.y; okArr[q] = P.ok ? 1 : 0;
                    if (q === N && P.ok) {
                        shots.push({ el, x: P.x, y: P.y, depth: P.depth, s: P.s });
                    }
                }

                const stroke = (from, to, alpha, wide) => {
                    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
                    ctx.lineWidth = wide;
                    ctx.beginPath();
                    let started = false;
                    for (let q = from; q <= to; q++) {
                        if (!okArr[q]) { started = false; continue; }
                        if (!started) { ctx.moveTo(xs[q], ys[q]); started = true; }
                        else ctx.lineTo(xs[q], ys[q]);
                    }
                    ctx.stroke();
                };

                // The soft halo first, as two unbroken paths near the head.
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                stroke(Math.floor(N * 0.72), N, 0.05 * bright, 6.5);
                stroke(Math.floor(N * 0.86), N, 0.05 * bright, 3);

                // Then the line itself, fading from the planet back to nothing.
                // The original stroked every segment on its own, which gives
                // the fade as many steps as there are samples - but also up to
                // 360 strokes and colour parses per planet per frame. Here the
                // alpha is rounded to 1/96 and each run of segments that share
                // a step is one stroke: still far more steps than the eye can
                // separate, and a run is a joined polyline, so it cannot bead.
                // Butt ends where runs meet: two round ends at one joint would
                // overlap and light up.
                ctx.lineCap = 'butt';
                ctx.lineWidth = 1.3;
                let runLevel = -1;
                let open = false;
                for (let q = 0; q < N; q++) {
                    if (!okArr[q] || !okArr[q + 1]) {
                        if (open) { ctx.stroke(); open = false; }
                        continue;
                    }
                    const f = (q + 1) / N; // 0 at the tail, 1 at the planet
                    const a = Math.pow(f, 2.6) * 0.95 * bright;
                    const level = Math.round(a * WAKE_LEVELS);
                    if (level < 1) continue; // the tail is already invisible here
                    if (open && level === runLevel) {
                        ctx.lineTo(xs[q + 1], ys[q + 1]);
                        continue;
                    }
                    if (open) ctx.stroke();
                    ctx.strokeStyle = `rgba(${r},${g},${b},${(level / WAKE_LEVELS).toFixed(4)})`;
                    ctx.beginPath();
                    ctx.moveTo(xs[q], ys[q]);
                    ctx.lineTo(xs[q + 1], ys[q + 1]);
                    runLevel = level;
                    open = true;
                }
                if (open) ctx.stroke();
            }

            /* bodies, back to front around the Sun ----------------------------- */
            shots.sort((p, q) => q.depth - p.depth);
            const sizeScale = Math.min(width, height) / 660;
            const drawShot = (o) => {
                const depth = Math.min(1.3, Math.max(0.5, o.s));
                const size = o.el.p.size * depth * sizeScale;
                const bright = (o.el.p.glow ?? 1) * k;
                const R = size * 3.3;
                ctx.globalAlpha = Math.min(1, 0.9 * bright);
                ctx.drawImage(glowSprite(o.el.p.color), o.x - R, o.y - R, R * 2, R * 2);
                ctx.globalAlpha = 1;
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.beginPath();
                ctx.arc(o.x, o.y, size * 0.5, 0, TAU);
                ctx.fill();
            };

            let idx = 0;
            while (idx < shots.length && shots[idx].depth > camDist) drawShot(shots[idx++]);
            drawSun(k, t);
            while (idx < shots.length) drawShot(shots[idx++]);

            ctx.globalCompositeOperation = 'source-over';

            /* the veils that copy sits on ------------------------------------- */
            const [gr, gg, gb] = parseRGB(C.ground);
            for (const [edge, strength] of C.scrim) {
                const s = Math.max(0, Math.min(1, strength));
                const g =
                    edge === 'left' ? ctx.createLinearGradient(0, 0, width, 0)
                    : edge === 'right' ? ctx.createLinearGradient(width, 0, 0, 0)
                    : edge === 'top' ? ctx.createLinearGradient(0, 0, 0, height)
                    : ctx.createLinearGradient(0, height, 0, 0);
                // Heavy at the edge, then off quickly - a straight ramp would
                // grey the whole frame. Twelve stops rather than three: with
                // only a few, the slope kinks at each and reads as a band.
                for (let q = 0; q <= 12; q++) {
                    const x = q / 12;
                    g.addColorStop(x, `rgba(${gr},${gg},${gb},${(s * Math.pow(1 - x, 2.4)).toFixed(4)})`);
                }
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, width, height);
            }
        }

        /* --- loop --------------------------------------------------------- */
        function tick(now) {
            raf = requestAnimationFrame(tick);
            const dt = lastFrame ? Math.min(0.05, (now - lastFrame) / 1000) : 0;
            lastFrame = now;
            if (!C.paused) years += dt / Math.max(0.1, C.yearSeconds);
            render(years);
        }

        function start() {
            if (raf || reduced) return;
            lastFrame = 0;
            raf = requestAnimationFrame(tick);
        }
        function stop() {
            cancelAnimationFrame(raf);
            raf = 0;
        }

        const ro = new ResizeObserver(() => {
            if (!active) return;
            resize();
            // A running loop picks the new size up on its next frame.
            if (!raf) render(years);
        });
        ro.observe(host);

        host.addEventListener('pointermove', onPointer);
        host.addEventListener('pointerleave', onLeave);

        return {
            /* Merge new settings. A running loop picks them up next frame; a
               still one is redrawn so the change shows. */
            update(partial) {
                Object.assign(C, partial);
                if (!width) return;
                layout();
                placeSun();
                /* The star field is seeded around the Sun's place on screen, so
                   moving the Sun re-seeds it as surely as a new count does. */
                buildStars();
                if (active && !raf) render(years);
            },
            /* On: size up, draw, and run (unless motion is reduced, in which
               case the one frame stands). Off: stop spending anything. */
            setActive(on) {
                if (on === active) return;
                active = on;
                if (!on) { stop(); return; }
                resize();
                render(years);
                start();
            },
            destroy() {
                stop();
                ro.disconnect();
                host.removeEventListener('pointermove', onPointer);
                host.removeEventListener('pointerleave', onLeave);
            },
        };
    }

    /* ===== HERO =====
       The copy runs down the left - headline, lede, buttons - under a veil
       drawn in from that edge, and the Sun takes the right half.

       Where on the right depends on how far the headline reaches. It stops
       growing at 84px, so from 1600px up it ends well short of the Sun and the
       system can sit level with it, just below its middle. Narrower, the
       headline runs most of the way across, so the Sun drops below it, beside
       the lede. Both are sized for the English headline, the longer of the
       two; check both languages after moving them.

       On a phone the copy fills the width and there is no side left, so the
       Sun sits in the band above the headline and the coils run behind it at
       low glow - a texture there, not a subject. The component's own demo put
       the art at the bottom on a phone, which on this page lands the Sun on
       the second button. */
    const hero = document.querySelector('.hero');
    const canvas = hero && hero.querySelector('.hero-orbit');
    if (!canvas || !('ResizeObserver' in window)) return;

    const narrow = window.matchMedia('(max-width: 720px)');
    const wide = window.matchMedia('(min-width: 1600px)');
    const ground = getComputedStyle(document.documentElement)
        .getPropertyValue('--ground').trim() || '#050505';

    const framing = () => {
        if (narrow.matches) return {
            focus: [0.74, 0.07],
            scrim: [['bottom', 0.9]],
            viewRadius: 2.7,
            lead: 0.04,
            glow: 0.6,
        };
        if (wide.matches) return {
            focus: [0.78, 0.56],
            scrim: [['left', 0.92]],
            viewRadius: 3,
            lead: 0.12,
            glow: 1,
        };
        return {
            focus: [0.8, 0.68],
            scrim: [['left', 0.92]],
            viewRadius: 3.4,
            lead: 0.12,
            glow: 1,
        };
    };

    const orbit = createOrbit(hero, canvas, Object.assign({ ground }, framing()));
    if (!orbit) return;
    narrow.addEventListener('change', () => orbit.update(framing()));
    wide.addEventListener('change', () => orbit.update(framing()));

    /* Run only while the hero is on screen and has a real box. The site gate
       display:nones everything outside itself and the intro hides <main>, so
       during both the hero measures 0 - see topology-bg.js for the same check. */
    let onScreen = false;
    let introDone = document.documentElement.dataset.introDone === '1';
    const sync = () => {
        const on = introDone && onScreen && !document.hidden;
        orbit.setActive(on);
        if (on) canvas.classList.add('is-drawn');
    };

    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            onScreen = entry.isIntersecting && entry.boundingClientRect.height > 0;
            sync();
        }).observe(hero);
    } else {
        onScreen = true;
    }
    if (!introDone) {
        document.addEventListener('pn:intro-done', () => { introDone = true; sync(); }, { once: true });
    }
    document.addEventListener('visibilitychange', sync);
    sync();
})();
