/*
 * topology-bg.js — index.html only.
 *
 * The field behind everything below the hero: a slowly turning sphere of 120
 * pulsing nodes, each tied to its near neighbours by a faint line. Ported from
 * the TopologyField React component, which rendered the scene with three.js
 * inside an iframe that also pulled in the Tailwind CDN, Iconify and a web
 * font, then hid everything but the canvas. The scene itself is 120 points and
 * a few hundred line segments, so it is drawn here on a 2D canvas with the same
 * camera, fog and motion, and none of that is downloaded.
 *
 * Replaces the WebGL halftone field (flow-bg.js) and inherits its rules, for
 * the same reason: two always-on canvases once dragged this page's scroll to
 * 14fps, so anything that animates back here comes back gated.
 *
 *   - the loop does not start until the hero has scrolled out of view, and
 *     stops again the moment it comes back;
 *   - it stops when the tab is hidden;
 *   - prefers-reduced-motion gets exactly one frame and no loop;
 *   - the canvas is fixed, not tall: it never scrolls, so scrolling never
 *     repaints it, and the only thing scroll changes is an opacity class.
 *
 * No library. No scroll handler.
 */
(() => {
    'use strict';

    const canvas = document.getElementById('topology-bg');
    const hero = document.querySelector('.hero');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    /* ===== THE SCENE, as the source built it =====
       A perspective camera (60° vertical field of view) 650 units back from a
       group of points on a unit sphere, scaled up to R units. Linear fog from
       300 to 950 units in front of the camera fades the far side of the sphere
       into the ground. The component's iframe painted #070707 behind it. */
    const NODES = 120;
    const LINK = 0.45;              // chord length under which two nodes are tied
    const FOV = 60 * Math.PI / 180;
    const CAM_Z = 650;
    const FOG_NEAR = 300;
    const FOG_FAR = 950;
    const FOG = 10;                 // fog colour, 0x0a0a0a, one channel
    /* Motion, per second. The source stepped these per frame at an assumed
       60fps (0.0018 and 0.0006 rad a frame); per second, the speed is the same
       on a 120Hz screen and on a throttled one. */
    const SPIN_Y = 0.0018 * 60;
    const SPIN_Z = 0.0006 * 60;
    const TILT_X = 0.2;
    const STILL_TIME = 14;          // a moment of the turn that composes well
    const LINE_LEVELS = 48;         // alpha steps the lines are batched into

    /* Deterministic stand-in for the source's Math.random(), so the sphere is
       the same on every visit. */
    let seed = 0x7a3c19;
    const rand = () => {
        seed = (seed + 0x6d2b79f5) >>> 0;
        let x = seed;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };

    /* Nodes on a Fibonacci sphere, exactly as the source placed them. */
    const px = new Float64Array(NODES), py = new Float64Array(NODES), pz = new Float64Array(NODES);
    const baseSize = new Float64Array(NODES), pulseSpeed = new Float64Array(NODES), pulseOffset = new Float64Array(NODES);
    for (let i = 0; i < NODES; i++) {
        const phi = Math.acos(-1 + (2 * i) / NODES);
        const theta = Math.sqrt(NODES * Math.PI) * phi;
        px[i] = Math.cos(theta) * Math.sin(phi);
        py[i] = Math.sin(theta) * Math.sin(phi);
        pz[i] = Math.cos(phi);
        baseSize[i] = rand() * 1.5 + 1.0;
        pulseSpeed[i] = (rand() * 0.02 + 0.015) * 60;   // per second
        pulseOffset[i] = rand() * Math.PI * 2;
    }

    /* Links: every pair closer than LINK, brighter the closer they are. */
    const linkA = [], linkB = [], linkAlpha = [];
    for (let i = 0; i < NODES; i++) {
        for (let j = i + 1; j < NODES; j++) {
            const d = Math.hypot(px[i] - px[j], py[i] - py[j], pz[i] - pz[j]);
            if (d < LINK) {
                linkA.push(i);
                linkB.push(j);
                linkAlpha.push((1 - d / LINK) * 0.8);
            }
        }
    }
    const LINKS = linkA.length;

    /* Per-frame scratch: where each node landed. */
    const sx = new Float64Array(NODES), sy = new Float64Array(NODES);
    const depth = new Float64Array(NODES), fogAt = new Float64Array(NODES);
    const order = Array.from({ length: NODES }, (_, i) => i);
    const lineLevel = new Uint8Array(LINKS);

    let width = 0;
    let height = 0;

    /* Placement. The source put the sphere a fifth of the width right of
       centre and a little low, at radius 380 - in scene units, which at this
       camera come out about a third bigger in CSS pixels on a 1000px-tall
       window. On a phone it shrank to 200 and sat centred, well down. */
    function placement() {
        const wide = width > 768;
        return {
            R: wide ? 380 : 200,
            cx: wide ? width * 0.2 : 0,
            cy: wide ? -height * 0.05 : -height * 0.2,
        };
    }

    function resize() {
        const w = Math.max(1, window.innerWidth);
        const h = Math.max(1, window.innerHeight);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === width && h === height && canvas.width === Math.round(w * dpr)) return false;
        width = w;
        height = h;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return true;
    }

    function draw(t) {
        const { R, cx, cy } = placement();
        const f = (height / 2) / Math.tan(FOV / 2);     // px per unit at depth 1

        // Group rotation, three.js Euler order XYZ: v' = Rx · Ry · Rz · v.
        const ay = t * SPIN_Y, az = t * SPIN_Z;
        const cX = Math.cos(TILT_X), sX = Math.sin(TILT_X);
        const cY = Math.cos(ay), sY = Math.sin(ay);
        const cZ = Math.cos(az), sZ = Math.sin(az);

        for (let i = 0; i < NODES; i++) {
            // Rz
            let x = px[i] * cZ - py[i] * sZ;
            let y = px[i] * sZ + py[i] * cZ;
            let z = pz[i];
            // Ry
            const x2 = x * cY + z * sY;
            const z2 = -x * sY + z * cY;
            x = x2; z = z2;
            // Rx
            const y3 = y * cX - z * sX;
            const z3 = y * sX + z * cX;
            y = y3; z = z3;
            // scale, then move the group
            x = x * R + cx;
            y = y * R + cy;
            z = z * R;
            const d = CAM_Z - z;
            depth[i] = d;
            sx[i] = width / 2 + (x * f) / d;
            sy[i] = height / 2 - (y * f) / d;
            fogAt[i] = Math.min(1, Math.max(0, (d - FOG_NEAR) / (FOG_FAR - FOG_NEAR)));
        }

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#070707';
        ctx.fillRect(0, 0, width, height);

        /* Lines. Additive, 1px, each coloured by its closeness and fogged by
           its depth, at the source's 0.65 opacity. Rounded to 48 steps and
           stroked one path per step rather than one per line. */
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineWidth = 1;
        for (let k = 0; k < LINKS; k++) {
            const fog = (fogAt[linkA[k]] + fogAt[linkB[k]]) / 2;
            const v = (linkAlpha[k] * (1 - fog) + (FOG / 255) * fog) * 0.65;
            lineLevel[k] = Math.min(LINE_LEVELS, Math.round(v * LINE_LEVELS));
        }
        for (let l = 1; l <= LINE_LEVELS; l++) {
            let any = false;
            for (let k = 0; k < LINKS; k++) {
                if (lineLevel[k] !== l) continue;
                if (!any) { ctx.beginPath(); any = true; }
                ctx.moveTo(sx[linkA[k]], sy[linkA[k]]);
                ctx.lineTo(sx[linkB[k]], sy[linkB[k]]);
            }
            if (any) {
                ctx.strokeStyle = `rgba(255,255,255,${(l / LINE_LEVELS).toFixed(4)})`;
                ctx.stroke();
            }
        }

        /* Nodes, far to near. Each pulses in size and opacity on its own
           clock; fog pulls its colour toward the ground as it turns away. */
        ctx.globalCompositeOperation = 'source-over';
        order.sort((a, b) => depth[b] - depth[a]);
        for (let o = 0; o < NODES; o++) {
            const i = order[o];
            const pulse = (Math.sin(t * pulseSpeed[i] + pulseOffset[i]) + 1) / 2;
            const radius = ((baseSize[i] + pulse * 1.8) * f) / depth[i];
            const alpha = 0.4 + pulse * 0.6;
            const c = Math.round(255 * (1 - fogAt[i]) + FOG * fogAt[i]);
            ctx.fillStyle = `rgba(${c},${c},${c},${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(sx[i], sy[i], radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /* ===== LOOP ===== */
    let raf = 0;
    let running = false;
    let revealed = false;
    let clock = STILL_TIME;
    let last = 0;

    function tick(now) {
        raf = requestAnimationFrame(tick);
        // Capped, so a long frame or a resumed tab moves the sphere a step,
        // not a leap.
        const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
        last = now;
        clock += dt;
        draw(clock);
    }

    function start() {
        if (running || reduced.matches) return;
        running = true;
        last = 0;
        raf = requestAnimationFrame(tick);
    }

    function stop() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(raf);
    }

    function drawStill() {
        resize();
        draw(clock);
    }

    resize();
    drawStill();

    /* ===== REVEAL =====
       The field belongs to everything below the hero, so it is tied to the
       hero's own visibility rather than to a scroll position. Hero gone -> fade
       in and run. Hero back -> fade out and stop. */
    function setRevealed(on) {
        if (on === revealed) return;
        revealed = on;
        canvas.classList.toggle('is-visible', on);
        if (on) {
            drawStill();
            start();
        } else {
            stop();
        }
    }

    if (hero && 'IntersectionObserver' in window) {
        new IntersectionObserver(
            ([entry]) => {
                /* A hero with no box has not scrolled away: the site gate and
                   the intro splash both hide it, and it then measures 0 and
                   reports not-intersecting. Requiring a real box keeps the loop
                   off behind both, and corrects itself when the lock lifts. */
                const laidOut = entry.boundingClientRect.height > 0;
                setRevealed(laidOut && !entry.isIntersecting);
            },
            /* Not 0: an anchor jump leaves the last ~70px of the hero under the
               nav, and that should already count as below the hero. */
            { threshold: 0.15 },
        ).observe(hero);
    } else {
        setRevealed(true);
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop();
        else if (revealed) start();
    });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (resize() && !running) draw(clock);
        }, 150);
    });

    reduced.addEventListener('change', () => {
        if (reduced.matches) { stop(); drawStill(); }
        else if (revealed) start();
    });
})();
