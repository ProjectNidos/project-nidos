/*
 * flow-bg.js — index.html only.
 *
 * A WebGL halftone-flow field behind everything below the hero. The header of
 * landing.js records that the hero-net canvas and the fw-stage particle tunnel
 * were deleted because two always-on canvases plus filters dragged the services
 * scroll down to 14fps. This is a canvas coming back, so it comes back gated:
 *
 *   - it does not exist at all without WebGL, and the page is byte-identical
 *     to what it is today when the context cannot be had;
 *   - the render loop does not start until the hero has scrolled out of view,
 *     and stops again the moment the hero comes back;
 *   - it stops when the tab is hidden;
 *   - prefers-reduced-motion and narrow viewports get exactly one frame and no
 *     loop at all — a still halftone texture, not an animation;
 *   - the drawing buffer is capped at FRAME_CAP px wide at DPR 1, so a retina
 *     screen renders the same number of fragments as a 1x one and the result is
 *     upscaled by the compositor. The shader is per-pixel and the cost is
 *     entirely in fragment count.
 *
 * No library. No scroll handler. The only thing that touches the canvas on
 * scroll is an opacity class, which the compositor handles off the main thread.
 */
(() => {
    'use strict';

    const canvas = document.getElementById('flow-bg');
    const hero = document.querySelector('.hero');
    if (!canvas) return;

    /* Widest drawing buffer, in device pixels. 1280 is a fragment budget, not a
       resolution target: the halftone grid is a repeating pattern with no fine
       detail to lose, so upscaling it costs nothing visible and saves roughly
       three quarters of the fragments on a 1440p retina display. */
    const FRAME_CAP = 1280;
    /* Dot pitch in CSS pixels. Converted to drawing-buffer pixels per resize so
       the halftone reads the same size whatever the buffer was capped to. */
    const DOT_PITCH_CSS = 7;
    const STATIC_FRAME_TIME = 6.2;  // a frame of the loop that composes well

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = window.matchMedia('(max-width: 767px)');

    /* Ported verbatim from the source effect; only gridSize became a uniform,
       so the dot pitch can follow the buffer cap instead of the raw pixel grid. */
    const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

    const FRAG = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_grid;

mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= u_resolution.x / u_resolution.y;

    vec2 flow_uv = p;
    float time = u_time * 0.4;

    for (float i = 1.0; i < 4.0; i++) {
        flow_uv *= rot(time * 0.1);
        flow_uv.x += sin(flow_uv.y * 2.0 * i + time) * 0.5;
        flow_uv.y += cos(flow_uv.x * 1.5 * i - time * 0.8) * 0.5;
    }

    float intensity = sin(flow_uv.x * 2.0 + flow_uv.y * 3.0) * 0.5 + 0.5;

    vec3 col_dark = vec3(0.02, 0.0, 0.0);
    vec3 col_red = vec3(0.8, 0.1, 0.05);
    vec3 col_bright = vec3(1.0, 0.6, 0.2);

    vec3 fluid_color = mix(col_dark, col_red, smoothstep(0.2, 0.6, intensity));
    fluid_color = mix(fluid_color, col_bright, smoothstep(0.7, 1.0, intensity));

    vec2 cell_uv = fract(gl_FragCoord.xy / u_grid) - 0.5;
    float radius = intensity * 0.45;
    float dot_mask = smoothstep(radius, radius - 0.1, length(cell_uv));

    vec3 final_color = mix(vec3(0.0), fluid_color, dot_mask);
    final_color += fluid_color * 0.15;

    gl_FragColor = vec4(final_color, 1.0);
}
`;

    const OPTS = {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'low-power',
    };

    /* Asked for strictly first: on a machine with no real GPU the browser
       refuses rather than handing back a software rasteriser, and a per-pixel
       shader on a software rasteriser is precisely the thing that cost this
       page its scroll last time. But being refused outright would mean the
       visitor sees nothing at all, so the second attempt drops the condition
       and takes whatever is on offer - and marks it, because what that earns
       is one still frame, never a loop. */
    let gl = canvas.getContext('webgl', { ...OPTS, failIfMajorPerformanceCaveat: true });
    let softwareOnly = false;
    if (!gl) {
        gl = canvas.getContext('webgl', OPTS);
        softwareOnly = true;
    }
    if (!gl) return;

    function compile(type, src) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    let uResolution = null;
    let uTime = null;
    let uGrid = null;

    /* Everything the context owns, built in one place because a lost context
       invalidates all of it at once and a restored one has to rebuild all of
       it from nothing. */
    function buildGL() {
        const vs = compile(gl.VERTEX_SHADER, VERT);
        const fs = compile(gl.FRAGMENT_SHADER, FRAG);
        if (!vs || !fs) return false;

        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER,
            new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]), gl.STATIC_DRAW);
        const aPos = gl.getAttribLocation(program, 'aPos');
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

        uResolution = gl.getUniformLocation(program, 'u_resolution');
        uTime = gl.getUniformLocation(program, 'u_time');
        uGrid = gl.getUniformLocation(program, 'u_grid');
        return true;
    }

    if (!buildGL()) return;

    let frame = 0;
    let running = false;
    let lost = false;
    let revealed = false;
    let startTime = performance.now();

    /* True when the field is a still image: one frame, no loop, no rAF. */
    function isStatic() {
        return softwareOnly || reduced.matches || narrow.matches;
    }

    function resize(force) {
        const cssW = Math.max(1, window.innerWidth);
        const cssH = Math.max(1, window.innerHeight);
        const scale = Math.min(1, FRAME_CAP / cssW);
        const w = Math.max(1, Math.round(cssW * scale));
        const h = Math.max(1, Math.round(cssH * scale));
        if (!force && canvas.width === w && canvas.height === h) return false;
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(uResolution, w, h);
        gl.uniform1f(uGrid, Math.max(2, DOT_PITCH_CSS * scale));
        return true;
    }

    function draw(seconds) {
        gl.uniform1f(uTime, seconds);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function tick(now) {
        frame = requestAnimationFrame(tick);
        draw((now - startTime) / 1000);
    }

    function start() {
        if (running || lost || isStatic()) return;
        running = true;
        /* Rebase the clock instead of carrying the paused interval forward, so
           resuming does not jump the field to wherever it would have drifted. */
        startTime = performance.now();
        frame = requestAnimationFrame(tick);
    }

    function stop() {
        if (!running) return;
        running = false;
        cancelAnimationFrame(frame);
    }

    /* One frame, drawn on demand: the still path, and also what a resize needs
       while the loop is stopped. */
    function drawStill() {
        if (lost) return;
        resize();
        draw(STATIC_FRAME_TIME);
    }

    /* Contexts are lost in normal operation, not only in disasters: macOS
       switches GPUs, machines sleep and wake, and a browser under memory
       pressure reclaims them. The first version of this treated the first loss
       as permanent, which meant one routine eviction retired the field for the
       rest of the visit. preventDefault() is what makes the browser promise a
       restore event; everything the old context owned is gone by then, so the
       restore rebuilds rather than resumes. */
    canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault();
        lost = true;
        stop();
    });

    canvas.addEventListener('webglcontextrestored', () => {
        if (!buildGL()) return;          // unrecoverable: leave the field dark
        lost = false;
        resize(true);
        if (revealed && !isStatic()) start();
        else if (revealed) drawStill();
    });

    resize();
    drawStill();

    /* ===== REVEAL =====
       The field belongs to everything below the hero, so it is tied to the
       hero's own visibility rather than to a scroll position: no threshold to
       keep in sync with the hero's height, and nothing reading layout on
       scroll. Hero gone -> fade in and run. Hero back -> fade out and stop. */
    function setRevealed(on) {
        if (on === revealed) return;
        revealed = on;
        canvas.classList.toggle('is-visible', on);
        if (on) {
            if (isStatic()) drawStill();
            else start();
        } else {
            stop();
        }
    }

    if (hero && 'IntersectionObserver' in window) {
        new IntersectionObserver(
            ([entry]) => {
                /* A hero with no box is not a hero that has scrolled away: the
                   site gate display:nones everything outside #pn-gate, and the
                   intro splash hides main, so during both the hero measures 0
                   and reports not-intersecting. Taking that at face value ran
                   the loop behind the password screen and behind the splash
                   video - the two moments on this page that can least afford
                   it. Requiring a real box is also self-correcting: the hero
                   regains its height when the lock lifts, which is itself an
                   intersection change, so the observer fires again. */
                const laidOut = entry.boundingClientRect.height > 0;
                setRevealed(laidOut && !entry.isIntersecting);
            },
            /* Not 0. Anchors on this page scroll their target to just under the
               fixed nav, so landing on #practices leaves the last ~70px of an
               828px hero on screen - under a threshold of 0, that is still "the
               hero is in view" and the field stayed dark through the whole
               practices section. At 0.15 the observer reports the hero gone
               once less than a sixth of it is left, which is what "below the
               hero" means to someone reading the page. */
            { threshold: 0.15 },
        ).observe(hero);
    } else {
        // No hero to hang it on: show the field rather than nothing.
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
            /* A resize can cross the narrow/wide line in either direction, so
               re-decide rather than assume the current mode still holds. */
            if (isStatic()) {
                stop();
                drawStill();
            } else {
                const changed = resize();
                if (revealed) start();
                else if (changed) drawStill();
            }
        }, 150);
    }, { passive: true });

    /* Someone turning reduced motion on mid-visit gets the still frame without
       reloading; turning it off gets the loop. */
    const onPreference = () => {
        if (isStatic()) {
            stop();
            drawStill();
        } else if (revealed) {
            start();
        }
    };
    if (typeof reduced.addEventListener === 'function') {
        reduced.addEventListener('change', onPreference);
        narrow.addEventListener('change', onPreference);
    }
})();
