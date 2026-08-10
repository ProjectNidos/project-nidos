/*
 * Project Nidos — arcade section.
 * Idle: reactive dot grid (pointer proximity lights cells).
 * Click-and-hold (or Enter) dissolves the grid into an original maze-chase
 * game. Hard tuning, one life. Esc exits back to the idle grid.
 * Original visuals throughout — brand squares and hairlines, no borrowed assets.
 */
(function () {
    'use strict';
    if (window.__pnArcade) return;
    var mount = document.getElementById('nidos-arcade');
    if (!mount) return;
    window.__pnArcade = true;

    var lang = mount.getAttribute('data-lang') === 'en' ? 'en' : 'lv';
    var T = {
        lv: { score: 'PUNKTI', hi: 'REKORDS', esc: 'ESC — IZIET', pause: 'PAUZE — SPACE',
              win: 'SISTĒMA PABEIGTA', lose: 'GAME OVER', again: 'VĒLREIZ', exit: 'IZIET' },
        en: { score: 'SCORE', hi: 'HI', esc: 'ESC — EXIT', pause: 'PAUSED — SPACE',
              win: 'SYSTEM CLEARED', lose: 'GAME OVER', again: 'PLAY AGAIN', exit: 'EXIT' }
    }[lang];

    var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    var RM = function () { return reduceMotion && reduceMotion.matches; };

    function cssVar(name, fallback) {
        try {
            var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
            return v || fallback;
        } catch (e) { return fallback; }
    }
    var C = {
        primary: cssVar('--primary', '#ff5f1f'),
        primaryLight: cssVar('--primary-light', '#ff8554'),
        text: cssVar('--text-primary', '#f4f4f5'),
        secondary: cssVar('--text-secondary', '#a1a1aa'),
        muted: cssVar('--text-muted', '#71717a'),
        dot: 'rgba(255,255,255,0.28)',
        wall: 'rgba(255,255,255,0.35)',
        pellet: 'rgba(255,255,255,0.5)'
    };

    /* ---------- styles ---------- */
    var style = document.createElement('style');
    style.id = 'pn-arcade-style';
    style.textContent = [
        '#nidos-arcade canvas { display: block; width: 100%; height: 100%; }',
        '.pn-arc-overlay {',
        '  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;',
        '  background: rgba(5,5,5,0.55); z-index: 3;',
        '}',
        '.pn-arc-box {',
        '  text-align: center; padding: 2.5rem 3rem; background: rgba(5,5,5,0.92);',
        '  border: 1px solid rgba(255,255,255,0.1);',
        '}',
        '.pn-arc-title {',
        '  font-family: var(--font-mono, ui-monospace, monospace); font-size: 1rem; font-weight: 600;',
        '  letter-spacing: 0.3em; text-transform: uppercase; color: var(--primary, #ff5f1f); margin: 0 0 0.85rem;',
        '}',
        '.pn-arc-score {',
        '  font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.72rem;',
        '  letter-spacing: 0.2em; color: var(--text-secondary, #a1a1aa); margin: 0 0 1.9rem;',
        '}',
        '.pn-arc-btns { display: flex; gap: 1rem; justify-content: center; }',
        '.pn-arc-btns button {',
        '  font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.72rem; font-weight: 600;',
        '  letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-primary, #f4f4f5);',
        '  background: transparent; border: 1px solid var(--text-primary, #f4f4f5); border-radius: 0;',
        '  padding: 0.8rem 1.5rem; cursor: pointer;',
        '  box-shadow: 4px 4px 0 rgba(255,255,255,0.16);',
        '  transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease, color 180ms ease, border-color 180ms ease;',
        '}',
        '.pn-arc-btns button:hover, .pn-arc-btns button:focus-visible {',
        '  background: var(--primary, #ff5f1f); border-color: var(--primary, #ff5f1f); color: #0a0a0a;',
        '  transform: translate(3px, 3px); box-shadow: 1px 1px 0 rgba(255,95,31,0.4);',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    mount.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    /* ---------- shared state ---------- */
    var W = 0, H = 0, DPR = 1;
    var state = 'idle';                 // idle | charging | playing
    var visible = true, hidden = false;
    var rafId = null, lastT = 0;
    var activityUntil = 0;              // idle render throttle
    var idleLabel = mount.getAttribute('data-cursor-label') || '';

    function setState(s) {
        mount.classList.remove('pn-idle', 'pn-charging', 'pn-playing');
        mount.classList.add('pn-' + s);
        state = s;
        if (s === 'playing') mount.removeAttribute('data-cursor-label');
        else if (idleLabel) mount.setAttribute('data-cursor-label', idleLabel);
        if (window.__pnCursorRefresh) window.__pnCursorRefresh();
    }
    mount.classList.add('pn-idle');

    function resize() {
        var r = mount.getBoundingClientRect();
        W = Math.max(0, Math.round(r.width));
        H = Math.max(0, Math.round(r.height));
        DPR = Math.min(2.5, window.devicePixelRatio || 1);
        canvas.width = Math.max(1, W * DPR);
        canvas.height = Math.max(1, H * DPR);
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        buildIdleGrid();
        if (game) { computeMetrics(); paintWalls(); }
        poke();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(mount);
    else window.addEventListener('resize', resize, { passive: true });

    /* ---------- rAF management ---------- */
    function running() { return visible && !hidden; }
    function frame(t) {
        rafId = null;
        var dt = Math.min(0.05, (t - lastT) / 1000 || 0);
        lastT = t;
        if (state === 'playing') tickGame(t, dt);
        else tickIdle(t, dt);
        if (running()) rafId = requestAnimationFrame(frame);
    }
    function poke() {
        activityUntil = performance.now() + 1200;
        if (!rafId && running()) { lastT = performance.now(); rafId = requestAnimationFrame(frame); }
    }
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            visible = entries[0].isIntersecting;
            if (!visible) {
                cancelCharge();
                if (game && !game.over) game.paused = true;
            }
            if (visible) poke();
        }, { threshold: 0.05 }).observe(mount);
    }
    document.addEventListener('visibilitychange', function () {
        hidden = document.hidden;
        if (hidden) {
            cancelCharge();
            if (game && !game.over) game.paused = true;
        }
        if (!hidden) poke();
    });
    window.addEventListener('blur', function () { if (game && !game.over) { game.paused = true; poke(); } });

    /* ================= IDLE GRID ================= */
    var SPACING = 64, PROX = 150, MAXSQ = 24;
    var cells = [], cols = 0, rows = 0;
    var ptrX = -9999, ptrY = -9999;
    var pulses = [];                    // {i, t0}
    var nextPulseAt = 0;
    var charge = null;                  // {x, y, t0}
    var ripple = null;                  // {x, y, t0}

    function buildIdleGrid() {
        cells.length = 0;
        cols = Math.ceil(W / SPACING) + 1;
        rows = Math.ceil(H / SPACING) + 1;
        var ox = (W - (cols - 1) * SPACING) / 2;
        var oy = (H - (rows - 1) * SPACING) / 2;
        for (var r = 0; r < rows; r++)
            for (var c = 0; c < cols; c++)
                cells.push({ x: ox + c * SPACING, y: oy + r * SPACING, s: 0 });
    }

    function roundRect(x, y, w, h, rad) {
        ctx.beginPath();
        ctx.moveTo(x + rad, y);
        ctx.arcTo(x + w, y, x + w, y + h, rad);
        ctx.arcTo(x + w, y + h, x, y + h, rad);
        ctx.arcTo(x, y + h, x, y, rad);
        ctx.arcTo(x, y, x + w, y, rad);
        ctx.closePath();
    }

    function tickIdle(t, dt) {
        // pulse scheduling (skipped under reduced motion)
        if (!RM() && state === 'idle') {
            if (!nextPulseAt) nextPulseAt = t + 2500 + Math.random() * 1500;
            if (t >= nextPulseAt) {
                var n = 2 + (Math.random() * 2 | 0);
                for (var i = 0; i < n; i++) pulses.push({ i: (Math.random() * cells.length) | 0, t0: t });
                nextPulseAt = t + 2500 + Math.random() * 1500;
                activityUntil = t + 1400;
            }
        }
        var active = t < activityUntil || charge || ripple || pulses.length;
        if (!active) return;                       // static frame already on screen

        ctx.clearRect(0, 0, W, H);
        var k = 1 - Math.pow(0.0001, dt);          // frame-rate independent lerp
        var i, cell;
        for (i = pulses.length - 1; i >= 0; i--) if (t - pulses[i].t0 > 900) pulses.splice(i, 1);

        for (i = 0; i < cells.length; i++) {
            cell = cells[i];
            var dx = cell.x - ptrX, dy = cell.y - ptrY;
            var d = Math.sqrt(dx * dx + dy * dy);
            var target = d < PROX ? MAXSQ * (1 - d / PROX) : 0;
            for (var p = 0; p < pulses.length; p++) {
                if (pulses[p].i === i) {
                    var e = (t - pulses[p].t0) / 900;
                    target = Math.max(target, 10 * Math.sin(Math.PI * Math.min(1, e)));
                }
            }
            if (ripple) {
                var rt = (t - ripple.t0) / 400;
                if (rt < 1) {
                    var rdx = cell.x - ripple.x, rdy = cell.y - ripple.y;
                    var rd = Math.sqrt(rdx * rdx + rdy * rdy);
                    var edge = rt * Math.max(W, H);
                    if (Math.abs(rd - edge) < 120) target = Math.max(target, 18);
                }
            }
            cell.s = RM() ? target : cell.s + (target - cell.s) * k;
            if (cell.s > 0.5) {
                var s = cell.s;
                var alpha = 0.25 + 0.75 * (s / MAXSQ);
                ctx.fillStyle = C.primary;
                ctx.globalAlpha = alpha;
                roundRect(cell.x - s / 2, cell.y - s / 2, s, s, Math.min(4, s * 0.22));
                ctx.fill();
                ctx.globalAlpha = 1;
            } else {
                ctx.fillStyle = C.dot;
                ctx.fillRect(cell.x - 0.75, cell.y - 0.75, 1.5, 1.5);
            }
        }

        if (charge) {
            var prog = Math.min(1, (t - charge.t0) / 900);
            ctx.strokeStyle = C.primary;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(charge.x, charge.y, 34, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(charge.x, charge.y, 34, 0, Math.PI * 2);
            ctx.stroke();
            if (prog >= 1) {
                var cx = charge.x, cy = charge.y;
                charge = null;
                if (RM()) startGame();
                else {
                    ripple = { x: cx, y: cy, t0: t };
                    setTimeout(startGame, 380);
                }
            }
        }
        if (ripple && t - ripple.t0 > 450) ripple = null;
    }

    /* ================= GAME ================= */
    // Layout validated offline: 114 pellets + 4 power cells, all reachable,
    // horizontal wall symmetry, tunnel on row 6, ghost pen rows 4-6.
    var MAZE = [
        '###################',
        '#........#........#',
        '#o##.###.#.###.##o#',
        '#.................#',
        '#.##.#.##-##.#.##.#',
        '#....#.#GGG#.#....#',
        ' .##.#.#####.#.##. ',
        '#....#.......#....#',
        '#.##.###.#.###.##.#',
        '#....#...#...#....#',
        '#.##.##.###.##.##.#',
        '#o.......#.......o#',
        '###################'
    ];
    var MW = 19, MH = 13, TUNNEL_ROW = 6, DOOR = { x: 9, y: 4 };
    var PLAYER_START = { x: 9, y: 7 };
    var PEN = [{ x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }];

    var game = null;
    var tile = 24, mzX = 0, mzY = 0;

    function computeMetrics() {
        tile = Math.max(14, Math.floor(Math.min((W - 24) / MW, (H - 64) / MH)));
        mzX = Math.round((W - MW * tile) / 2);
        mzY = Math.round((H - MH * tile) / 2) + 8;
    }

    function wallAt(x, y) {
        if (y < 0 || y >= MH) return true;
        if (x < 0) x += MW; if (x >= MW) x -= MW;
        return MAZE[y][x] === '#';
    }
    function isDoor(x, y) {
        if (x < 0) x += MW; if (x >= MW) x -= MW;
        return MAZE[y] !== undefined && MAZE[y][x] === '-';
    }
    function passable(x, y, ghostPass) {
        if (y < 0 || y >= MH) return false;
        if (x < 0) x += MW; if (x >= MW) x -= MW;
        var c = MAZE[y][x];
        if (c === '#') return false;
        if (c === '-') return !!ghostPass;
        return true;
    }

    var wallsLayer = document.createElement('canvas');
    function paintWalls() {
        wallsLayer.width = canvas.width;
        wallsLayer.height = canvas.height;
        var w = wallsLayer.getContext('2d');
        w.setTransform(DPR, 0, 0, DPR, 0, 0);
        w.strokeStyle = C.wall;
        w.lineWidth = 1;
        var x, y;
        // hairline on every wall edge that borders a corridor
        for (y = 0; y < MH; y++) for (x = 0; x < MW; x++) {
            if (MAZE[y][x] !== '#') continue;
            var px = mzX + x * tile, py = mzY + y * tile;
            if (!wallAt(x, y - 1)) line(w, px, py, px + tile, py);
            if (!wallAt(x, y + 1)) line(w, px, py + tile, px + tile, py + tile);
            if (!wallAt(x - 1, y) && x > 0) line(w, px, py, px, py + tile);
            if (!wallAt(x + 1, y) && x < MW - 1) line(w, px + tile, py, px + tile, py + tile);
        }
        // pen door
        w.strokeStyle = C.primary;
        w.setLineDash([3, 3]);
        line(w, mzX + DOOR.x * tile, mzY + DOOR.y * tile + tile / 2, mzX + (DOOR.x + 1) * tile, mzY + DOOR.y * tile + tile / 2);
        w.setLineDash([]);
    }
    function line(c2, x1, y1, x2, y2) {
        c2.beginPath();
        c2.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
        c2.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
        c2.stroke();
    }

    function loadHi() { try { return parseInt(localStorage.getItem('pn_arcade_hs'), 10) || 0; } catch (e) { return 0; } }
    function saveHi(v) { try { localStorage.setItem('pn_arcade_hs', String(v)); } catch (e) {} }

    function makeEntity(x, y, speed) {
        return { x: x + 0.5, y: y + 0.5, dx: 0, dy: 0, speed: speed };
    }

    function startGame() {
        removeOverlay();
        computeMetrics();
        paintWalls();
        var pellets = {}, powers = {}, pc = 0;
        for (var y = 0; y < MH; y++) for (var x = 0; x < MW; x++) {
            if (MAZE[y][x] === '.') { pellets[x + ',' + y] = 1; pc++; }
            if (MAZE[y][x] === 'o') powers[x + ',' + y] = 1;
        }
        var player = makeEntity(PLAYER_START.x, PLAYER_START.y, 7);
        player.dx = -1; player.bx = -1; player.by = 0; player.mouth = 0;
        game = {
            t0: performance.now(), clock: 0, paused: false, over: false,
            pellets: pellets, powers: powers, pelletCount: pc,
            score: 0, hi: loadHi(),
            player: player,
            ghosts: [
                mkGhost(0, C.primaryLight, 1, 1, 0),     // chaser — starts far corner
                mkGhost(1, C.text, 8, 5, 2.5),           // ambusher
                mkGhost(2, C.secondary, 9, 5, 5.5),      // flanker
                mkGhost(3, C.muted, 10, 5, 8.5)          // drifter
            ],
            fright: 0, frightChain: 0,
            deathAt: 0, acc: 0, repathAt: 0, chaserMap: null
        };
        setState('playing');
        mount.focus({ preventScroll: true });
        poke();
    }

    function mkGhost(i, color, x, y, release) {
        var g = makeEntity(x, y, 6.44);
        g.id = i; g.color = color;
        g.mode = release === 0 ? 'active' : 'pen';   // pen | leaving | active | eyes
        g.release = release;                          // seconds on the game clock
        g.frightened = false;
        g.homeX = x; g.homeY = y;
        if (g.mode === 'active') { g.dx = -1; g.dy = 0; }
        return g;
    }

    /* --- BFS next-step map toward a target tile (ghost-passable graph) --- */
    var bfsPrev = new Int16Array(MW * MH);
    function bfsDir(fromX, fromY, toX, toY) {
        if (fromX === toX && fromY === toY) return null;
        bfsPrev.fill(-1);
        var qx = [toX], qy = [toY];                  // search backwards from target
        bfsPrev[toY * MW + toX] = toY * MW + toX;
        var head = 0;
        while (head < qx.length) {
            var cx = qx[head], cy = qy[head]; head++;
            for (var d = 0; d < 4; d++) {
                var nx = cx + [1, -1, 0, 0][d], ny = cy + [0, 0, 1, -1][d];
                if (nx < 0) nx = MW - 1; if (nx >= MW) nx = 0;
                if (!passable(nx, ny, true)) continue;
                var idx = ny * MW + nx;
                if (bfsPrev[idx] !== -1) continue;
                bfsPrev[idx] = cy * MW + cx;
                if (nx === fromX && ny === fromY) {
                    var tx = cx - fromX, ty = cy - fromY;
                    if (tx > 1) tx = -1; if (tx < -1) tx = 1; // tunnel step
                    return { x: tx, y: ty };
                }
                qx.push(nx); qy.push(ny);
            }
        }
        return null;
    }

    function atCenter(e) {
        return Math.abs(e.x - Math.floor(e.x) - 0.5) < 0.08 && Math.abs(e.y - Math.floor(e.y) - 0.5) < 0.08;
    }
    function tileOf(e) { return { x: Math.floor(e.x), y: Math.floor(e.y) }; }

    function stepEntity(e, dt, ghostPass) {
        if (!e.dx && !e.dy) return;
        var nx = e.x + e.dx * e.speed * dt;
        var ny = e.y + e.dy * e.speed * dt;
        // crossing the center of the tile ahead?
        var cx = Math.floor(e.x) + 0.5, cy = Math.floor(e.y) + 0.5;
        var crossed =
            (e.dx > 0 && e.x < cx && nx >= cx) || (e.dx < 0 && e.x > cx && nx <= cx) ||
            (e.dy > 0 && e.y < cy && ny >= cy) || (e.dy < 0 && e.y > cy && ny <= cy);
        if (crossed) { nx = cx; ny = cy; e.centered = true; } else e.centered = false;
        e.x = nx; e.y = ny;
        if (e.x < 0) e.x += MW;
        if (e.x >= MW) e.x -= MW;
    }

    function legal(tx, ty, dx, dy, ghostPass) {
        return passable(tx + dx, ty + dy, ghostPass);
    }

    function tickGame(t, dt) {
        var g = game;
        drawGame(t);
        if (g.paused || g.over || g.deathAt) {
            if (g.deathAt) {
                var e = (t - g.deathAt) / 1000;
                if (e > (RM() ? 0.05 : 1.0)) { g.deathAt = 0; endGame(false); }
            }
            return;
        }
        g.acc += dt;
        var STEP = 1 / 120;
        var guard = 0;
        while (g.acc >= STEP && guard++ < 12) {
            g.acc -= STEP;
            g.clock += STEP;
            simulate(STEP);
            if (g.over || g.deathAt) break;
        }
    }

    function simulate(dt) {
        var g = game, p = g.player;
        var t = g.clock;

        if (g.fright > 0) { g.fright -= dt; if (g.fright <= 0) { g.fright = 0; g.frightChain = 0; } }

        /* player */
        p.mouth += dt * 9;
        if (atCenter(p) || (!p.dx && !p.dy)) {
            var pt = tileOf(p);
            if ((p.bx || p.by) && legal(pt.x, pt.y, p.bx, p.by, false) &&
                (p.bx !== p.dx || p.by !== p.dy)) {
                // snap on axis change so cornering stays center-true; plain
                // reversal keeps the current position
                if (p.bx !== -p.dx || p.by !== -p.dy) { p.x = pt.x + 0.5; p.y = pt.y + 0.5; }
                p.dx = p.bx; p.dy = p.by;
            }
            if ((p.dx || p.dy) && !legal(pt.x, pt.y, p.dx, p.dy, false)) {
                p.x = pt.x + 0.5; p.y = pt.y + 0.5;
                p.dx = 0; p.dy = 0;
            }
        } else if (p.bx === -p.dx && p.by === -p.dy && (p.dx || p.dy)) {
            p.dx = p.bx; p.dy = p.by;   // reversal is always legal mid-corridor
        }
        stepEntity(p, dt, false);

        /* eat */
        var ptl = tileOf(p), key = ptl.x + ',' + ptl.y;
        if (g.pellets[key]) {
            delete g.pellets[key]; g.pelletCount--;
            g.score += 10;
        }
        if (g.powers[key]) {
            delete g.powers[key];
            g.score += 50;
            g.fright = 3.5; g.frightChain = 0;
            for (var i = 0; i < 4; i++) {
                var gh = g.ghosts[i];
                if (gh.mode === 'active') { gh.dx *= -1; gh.dy *= -1; }
            }
        }
        if (g.pelletCount <= 0 && !Object.keys(g.powers).length) { endGame(true); return; }

        /* difficulty ramp */
        var ramp = 0.92 + Math.min(1, t / 60) * 0.08;

        /* ghosts */
        if (t >= g.repathAt) {
            g.repathAt = t + 0.4;
            g.chaserTarget = { x: ptl.x, y: ptl.y };
        }
        for (i = 0; i < 4; i++) ghostBrain(g.ghosts[i], dt, ramp, ptl);

        /* collisions */
        for (i = 0; i < 4; i++) {
            var gh2 = g.ghosts[i];
            if (gh2.mode !== 'active') continue;
            if (Math.abs(gh2.x - p.x) < 0.55 && Math.abs(gh2.y - p.y) < 0.55) {
                if (g.fright > 0 && gh2.frightened) {
                    gh2.mode = 'eyes'; gh2.frightened = false;
                    g.frightChain = Math.min(3, g.frightChain);
                    g.score += 200 * Math.pow(2, g.frightChain);
                    g.frightChain++;
                } else {
                    g.deathAt = performance.now();
                    return;
                }
            }
        }
    }

    function ghostBrain(gh, dt, ramp, ptl) {
        var g = game, p = g.player;
        gh.frightened = g.fright > 0 && gh.mode === 'active' && !gh.noFright;

        if (gh.mode === 'pen') {
            gh.y = gh.homeY + 0.5 + Math.sin(g.clock * 3 + gh.id) * 0.12;
            gh.x = gh.homeX + 0.5;
            if (g.clock >= gh.release) { gh.mode = 'leaving'; }
            return;
        }
        if (gh.mode === 'leaving') {
            // slide to pen center column, then rise through the door
            var cxTarget = DOOR.x + 0.5;
            if (Math.abs(gh.x - cxTarget) > 0.05) {
                gh.x += (gh.x < cxTarget ? 1 : -1) * 2.5 * dt;
            } else {
                gh.x = cxTarget;
                gh.y -= 2.5 * dt;
                if (gh.y <= DOOR.y - 1 + 0.5) {
                    gh.y = DOOR.y - 1 + 0.5;
                    gh.mode = 'active'; gh.dx = Math.random() < 0.5 ? -1 : 1; gh.dy = 0;
                }
            }
            return;
        }

        var speed;
        if (gh.mode === 'eyes') speed = 10.5;
        else if (gh.frightened) speed = 7 * 0.55;
        else speed = 7 * ramp;
        gh.speed = speed;

        if (atCenter(gh)) {
            var tl = tileOf(gh);
            var tileKey = tl.x + ',' + tl.y;
            if (gh.lastTurn === tileKey) { stepEntity(gh, dt, gh.mode === 'eyes'); return; }
            gh.lastTurn = tileKey;

            if (gh.mode === 'eyes') {
                if (tl.x === DOOR.x && tl.y === DOOR.y - 1) {
                    // drop into the pen and reset
                    gh.mode = 'pen';
                    gh.homeX = PEN[gh.id % 3].x; gh.homeY = PEN[gh.id % 3].y;
                    gh.x = gh.homeX + 0.5; gh.y = gh.homeY + 0.5;
                    gh.release = g.clock + 1.5;
                    return;
                }
                var d0 = bfsDir(tl.x, tl.y, DOOR.x, DOOR.y - 1);
                if (d0) { gh.dx = d0.x; gh.dy = d0.y; }
            } else {
                var target = ghostTarget(gh, ptl);
                var best = null, bestScore = null;
                for (var d = 0; d < 4; d++) {
                    var dx = [1, -1, 0, 0][d], dy = [0, 0, 1, -1][d];
                    if (dx === -gh.dx && dy === -gh.dy && (gh.dx || gh.dy)) continue; // no reversing
                    if (!legal(tl.x, tl.y, dx, dy, false)) continue;
                    var nx = tl.x + dx, ny = tl.y + dy;
                    if (nx < 0) nx = MW - 1; if (nx >= MW) nx = 0;
                    var ddx = nx - target.x, ddy = ny - target.y;
                    var dist = ddx * ddx + ddy * ddy;
                    var scoreVal = gh.frightened ? -dist : dist;   // frightened maximizes distance
                    if (gh.rand) scoreVal = Math.random();          // drifter far from player
                    if (bestScore === null || scoreVal < bestScore) { bestScore = scoreVal; best = { x: dx, y: dy }; }
                }
                if (!best) best = { x: -gh.dx, y: -gh.dy };        // dead end: allowed to reverse
                if (best.x !== gh.dx || best.y !== gh.dy) { gh.x = tl.x + 0.5; gh.y = tl.y + 0.5; }
                gh.dx = best.x; gh.dy = best.y;
            }
        }
        stepEntity(gh, dt, gh.mode === 'eyes');
    }

    function ghostTarget(gh, ptl) {
        var g = game, p = g.player;
        gh.rand = false;
        var distToPlayer = Math.abs(gh.x - p.x) + Math.abs(gh.y - p.y);
        switch (gh.id) {
            case 0:  // chaser — BFS-refreshed tile
                return g.chaserTarget || ptl;
            case 1:  // ambusher — 4 tiles ahead
                return { x: ptl.x + (p.dx || -1) * 4, y: ptl.y + p.dy * 4 };
            case 2:  // flanker — double the chaser->player vector
                var ch = g.ghosts[0];
                return { x: ptl.x * 2 - ch.x, y: ptl.y * 2 - ch.y };
            default: // drifter — random until close, then direct chase
                if (distToPlayer > 6) gh.rand = true;
                return ptl;
        }
    }

    function endGame(won) {
        var g = game;
        g.over = true;
        if (g.score > g.hi) { g.hi = g.score; saveHi(g.hi); }
        showOverlay(won ? T.win : T.lose, g.score, g.hi);
    }

    /* ---------- game rendering ---------- */
    function drawGame(t) {
        var g = game;
        ctx.clearRect(0, 0, W, H);

        // dimmed ambient dots outside the maze
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        for (var i = 0; i < cells.length; i++) {
            var cl = cells[i];
            if (cl.x < mzX - 10 || cl.x > mzX + MW * tile + 10 || cl.y < mzY - 10 || cl.y > mzY + MH * tile + 10)
                ctx.fillRect(cl.x - 0.75, cl.y - 0.75, 1.5, 1.5);
        }

        ctx.drawImage(wallsLayer, 0, 0, W, H);

        // pellets
        ctx.fillStyle = C.pellet;
        for (var key in g.pellets) {
            var xy = key.split(',');
            ctx.fillRect(mzX + (+xy[0] + 0.5) * tile - 1, mzY + (+xy[1] + 0.5) * tile - 1, 2, 2);
        }
        // power cells
        var pulse = RM() ? 1 : 0.75 + 0.25 * Math.sin(t / 260);
        ctx.fillStyle = C.primary;
        for (key in g.powers) {
            xy = key.split(',');
            var ps = 7 * pulse;
            roundRect(mzX + (+xy[0] + 0.5) * tile - ps / 2, mzY + (+xy[1] + 0.5) * tile - ps / 2, ps, ps, 2);
            ctx.fill();
        }

        // player
        var p = g.player;
        if (!g.deathAt || RM()) drawPlayer(p, t);
        else drawDeath(p, t);

        // ghosts
        for (i = 0; i < 4; i++) drawGhost(g.ghosts[i], t);

        // HUD
        ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillStyle = C.secondary;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.fillText(T.score + ' ' + pad(g.score) + '   ' + T.hi + ' ' + pad(g.hi), mzX, mzY - 22);
        ctx.textAlign = 'right';
        ctx.fillText(T.esc, mzX + MW * tile, mzY - 22);
        ctx.textAlign = 'left';

        if (g.paused && !g.over) {
            ctx.fillStyle = 'rgba(5,5,5,0.6)';
            ctx.fillRect(mzX, mzY, MW * tile, MH * tile);
            ctx.fillStyle = C.text;
            ctx.textAlign = 'center';
            ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
            ctx.fillText(T.pause, W / 2, mzY + MH * tile / 2 - 6);
            ctx.textAlign = 'left';
        }
    }
    function pad(n) { n = String(n); while (n.length < 4) n = '0' + n; return n; }

    function px(e) { return { x: mzX + e.x * tile, y: mzY + e.y * tile }; }

    function drawPlayer(p, t) {
        var pos = px(p), s = tile * 0.7;
        drawPlayerAt(pos.x, pos.y, s, p, t);
        // tunnel twin
        if (p.x < 1) drawPlayerAt(pos.x + MW * tile, pos.y, s, p, t);
        if (p.x > MW - 1) drawPlayerAt(pos.x - MW * tile, pos.y, s, p, t);
    }
    function drawPlayerAt(x, y, s, p, t) {
        ctx.save();
        ctx.translate(x, y);
        var ang = Math.atan2(p.dy, p.dx || 1);
        ctx.rotate(ang);
        ctx.fillStyle = C.primary;
        roundRectAt(-s / 2, -s / 2, s, s, 3);
        ctx.fill();
        // animated mouth wedge
        var open = Math.abs(Math.sin(p.mouth)) * 0.55 + 0.08;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(s / 2 + 1, -(s / 2 + 1) * open);
        ctx.lineTo(s / 2 + 1, (s / 2 + 1) * open);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        ctx.restore();
    }
    function roundRectAt(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }

    function drawDeath(p, t) {
        var e = (t - game.deathAt) / 1000;
        if (e < 0.4) { drawPlayer(p, t); return; }   // freeze
        var f = (e - 0.4) / 0.6;
        var pos = px(p), s = tile * 0.28;
        ctx.fillStyle = C.primary;
        ctx.globalAlpha = Math.max(0, 1 - f);
        for (var i = 0; i < 8; i++) {
            var a = i / 8 * Math.PI * 2;
            var d = f * tile * 1.6;
            ctx.fillRect(pos.x + Math.cos(a) * d - s / 2, pos.y + Math.sin(a) * d - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
    }

    function drawGhost(gh, t) {
        var pos = px(gh), s = tile * 0.62;
        var flash = game.fright > 0 && game.fright < 1 && (t / 150 | 0) % 2 === 0;
        ctx.save();
        if (gh.mode === 'eyes') {
            drawEyes(pos.x, pos.y, gh, tile * 0.5);
            ctx.restore();
            return;
        }
        ctx.strokeStyle = gh.frightened ? (flash ? C.text : C.primary) : gh.color;
        ctx.lineWidth = 1.5;
        if (gh.frightened) ctx.setLineDash([3, 3]);
        roundRectAt(pos.x - s / 2, pos.y - s / 2, s, s, 3);
        ctx.stroke();
        ctx.setLineDash([]);
        drawEyes(pos.x, pos.y, gh, s);
        ctx.restore();
        // tunnel twin
        if (gh.x < 1 || gh.x > MW - 1) {
            var ox = gh.x < 1 ? MW * tile : -MW * tile;
            ctx.save();
            ctx.strokeStyle = gh.frightened ? (flash ? C.text : C.primary) : gh.color;
            ctx.lineWidth = 1.5;
            if (gh.frightened) ctx.setLineDash([3, 3]);
            roundRectAt(pos.x + ox - s / 2, pos.y - s / 2, s, s, 3);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }
    }
    function drawEyes(x, y, gh, s) {
        ctx.fillStyle = gh.mode === 'eyes' ? C.text : (gh.frightened ? C.primary : gh.color);
        var off = s * 0.18;
        var ex = gh.dx * 1.5, ey = gh.dy * 1.5;
        ctx.fillRect(x - off + ex - 1, y - 2 + ey, 2, 2);
        ctx.fillRect(x + off + ex - 1, y - 2 + ey, 2, 2);
    }

    /* ---------- overlays ---------- */
    var overlayEl = null;
    function showOverlay(title, score, hi) {
        removeOverlay();
        overlayEl = document.createElement('div');
        overlayEl.className = 'pn-arc-overlay';
        var box = document.createElement('div');
        box.className = 'pn-arc-box';
        var h = document.createElement('p');
        h.className = 'pn-arc-title';
        h.textContent = title;
        var sc = document.createElement('p');
        sc.className = 'pn-arc-score';
        sc.textContent = T.score + ' ' + pad(score) + ' — ' + T.hi + ' ' + pad(hi);
        var btns = document.createElement('div');
        btns.className = 'pn-arc-btns';
        var again = document.createElement('button');
        again.type = 'button'; again.textContent = T.again;
        again.addEventListener('click', function () { startGame(); });
        var exit = document.createElement('button');
        exit.type = 'button'; exit.textContent = T.exit;
        exit.addEventListener('click', exitGame);
        btns.appendChild(again); btns.appendChild(exit);
        box.appendChild(h); box.appendChild(sc); box.appendChild(btns);
        overlayEl.appendChild(box);
        mount.appendChild(overlayEl);
        again.focus({ preventScroll: true });
    }
    function removeOverlay() {
        if (overlayEl) { overlayEl.remove(); overlayEl = null; }
    }

    function exitGame() {
        removeOverlay();
        game = null;
        setState('idle');
        ctx.clearRect(0, 0, W, H);
        poke();
    }

    /* ---------- input ---------- */
    var DIRS = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
        a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1],
        A: [-1, 0], D: [1, 0], W: [0, -1], S: [0, 1]
    };
    document.addEventListener('keydown', function (e) {
        var tag = e.target && e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if (state === 'playing') {
            if (e.key === 'Escape') { exitGame(); return; }
            if (!game) return;
            if (e.key === ' ') {
                e.preventDefault();
                if (!game.over && !game.deathAt) { game.paused = !game.paused; poke(); }
                return;
            }
            var d = DIRS[e.key];
            if (d) {
                if (e.key.length > 1) e.preventDefault();   // arrows scroll the page; WASD don't
                game.player.bx = d[0]; game.player.by = d[1];
                if (game.paused) { game.paused = false; poke(); }
            }
            return;
        }
        // idle: Enter or Space starts when the stage itself has focus
        if (state === 'idle' && document.activeElement === mount && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            startGame();
        }
    });

    /* pointer: idle proximity + hold-to-start + swipe steering */
    var swipeX = 0, swipeY = 0, swipeTracking = false;

    canvas.addEventListener('pointermove', function (e) {
        var r = canvas.getBoundingClientRect();
        ptrX = e.clientX - r.left;
        ptrY = e.clientY - r.top;
        if (state !== 'playing') poke();
        if (charge) {
            var dx = ptrX - charge.x, dy = ptrY - charge.y;
            if (dx * dx + dy * dy > 14 * 14) cancelCharge();   // moved: it's a scroll/drag, not a hold
        }
        if (state === 'playing' && swipeTracking && game && !game.over) {
            var sdx = e.clientX - swipeX, sdy = e.clientY - swipeY;
            if (Math.abs(sdx) > 24 || Math.abs(sdy) > 24) {
                if (Math.abs(sdx) > Math.abs(sdy)) { game.player.bx = sdx > 0 ? 1 : -1; game.player.by = 0; }
                else { game.player.bx = 0; game.player.by = sdy > 0 ? 1 : -1; }
                swipeX = e.clientX; swipeY = e.clientY;
            }
        }
    }, { passive: true });

    canvas.addEventListener('pointerdown', function (e) {
        if (state === 'idle') {
            var r = canvas.getBoundingClientRect();
            charge = { x: e.clientX - r.left, y: e.clientY - r.top, t0: performance.now() };
            setState('charging');
            poke();
        } else if (state === 'playing') {
            swipeTracking = true;
            swipeX = e.clientX; swipeY = e.clientY;
            if (game && game.paused && !game.over && !game.deathAt) { game.paused = false; poke(); }
        }
    });
    function cancelCharge() {
        if (!charge) return;
        charge = null;
        if (state === 'charging') setState('idle');
        poke();
    }
    canvas.addEventListener('pointerup', function () { cancelCharge(); swipeTracking = false; });
    canvas.addEventListener('pointercancel', function () { cancelCharge(); swipeTracking = false; });
    canvas.addEventListener('pointerleave', function () {
        ptrX = -9999; ptrY = -9999;
        cancelCharge(); swipeTracking = false;
        poke();
    });
    canvas.addEventListener('contextmenu', function (e) {
        if (state !== 'idle') e.preventDefault();
    });

    /* ---------- boot ---------- */
    // Dev hook: lightweight state snapshot for testing; harmless in production.
    window.__pnArcadeState = function () {
        if (!game) return null;
        return {
            score: game.score, over: game.over, paused: game.paused,
            fright: Math.round(game.fright * 10) / 10,
            clock: Math.round(game.clock * 10) / 10,
            p: { x: Math.round(game.player.x * 10) / 10, y: Math.round(game.player.y * 10) / 10,
                 dx: game.player.dx, dy: game.player.dy },
            g: game.ghosts.map(function (g) {
                return { x: Math.round(g.x * 10) / 10, y: Math.round(g.y * 10) / 10, m: g.mode };
            })
        };
    };
    resize();
    poke();
})();
