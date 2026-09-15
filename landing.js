/*
 * landing.js — index.html and index-en.html only.
 *
 * Replaces script.js on these two pages. Everything script.js used to do here
 * that the redesign still needs is carried over; everything that drove the
 * deleted decoration is gone with it.
 *
 *   carried over : intro sequence, language switcher, ?for= preselect,
 *                  arcade popup, cookie consent banner
 *   new          : form validation with real messages, nav hairline sentinel
 *   gone         : Lenis, IntersectionObserver scroll reveals, hero-net canvas,
 *                  fw-stage particle tunnel, the pinned practices stepper,
 *                  the stage image swapper, the closing-CTA rise, the
 *                  conviction parallax, the mobile nav drawer
 *
 * No library. No scroll handler that does layout work.
 */

/* ===== INTRO =====
   Protected behaviour: same video files, same muted/playsinline autoplay, same
   "Izlaist" control, same once-per-session key, same dissolve. Four changes
   only - a reduced-motion branch, a poster frame, the splash wordmark demoted
   to <p> in the markup, and the removal of the Lenis restart and the scroll
   animation kick that used to run at the end of the hand-off. */
(() => {
    const screenEl = document.querySelector('.intro-screen');
    const logo = document.querySelector('.intro-logo');
    const video = document.querySelector('.intro-video');
    const nav = document.getElementById('mainNav');

    const reveal = () => {
        document.documentElement.classList.remove('intro-lock');
        if (nav) nav.classList.add('visible');
        /* Every path out of the intro ends here - played out, skipped, failed,
           reduced motion, deep link, second visit - so this is the one place
           the handoff can be announced. The flag is for listeners that attach
           after the fact: the reduced-motion and already-seen branches call
           reveal() during parse, before anything below this IIFE exists. */
        document.documentElement.dataset.introDone = '1';
        document.dispatchEvent(new Event('pn:intro-done'));
    };

    const finishIntro = () => {
        if (!screenEl || screenEl.classList.contains('intro-done')) return;
        try { sessionStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
        screenEl.classList.add('intro-done');
        const main = document.querySelector('main');
        if (main) main.classList.remove('intro-active');
        /* The hero is already laid out and painted underneath at full opacity -
           intro-lock only hid it. Dropping the lock uncovers a finished page,
           so there is nothing to animate in and nothing to shift. */
        reveal();
        window.scrollTo(0, 0);
    };

    let seen = false;
    try { seen = sessionStorage.getItem('pn_intro_seen') === '1'; } catch (e) {}

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Someone arriving from a practice page lands on /?for=crm#contact. They
       have never seen this page, so pn_intro_seen is unset, so without this they
       get ten seconds of drone footage before the form they clicked a button to
       reach. A hash or a ?for= means they asked for a specific place on the
       page; the splash is a first impression, not a toll booth in front of one. */
    const deepLinked = !!window.location.hash ||
        new URLSearchParams(window.location.search).has('for');

    /* The lock hides <main>, so the browser cannot honour the hash on its own
       while the splash is up, and scrollRestoration is manual. Once the lock is
       off, put them where they asked to be - scroll-margin-top in base.css keeps
       the heading clear of the fixed nav. */
    const goToTarget = () => {
        const hash = window.location.hash;
        if (!hash) return;
        let target = null;
        try { target = document.querySelector(hash); } catch (e) { return; }
        if (target) requestAnimationFrame(() => target.scrollIntoView());
    };

    if (reduced || deepLinked) {
        /* No video, no splash, no dissolve. The same end state, reached at once:
           the splash is removed outright rather than faded. */
        try { sessionStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
        if (screenEl) screenEl.remove();
        reveal();
        if (deepLinked) goToTarget();
    } else if (seen && screenEl) {
        screenEl.style.transition = 'none';
        finishIntro();
    } else if (screenEl && video) {
        video.addEventListener('ended', finishIntro);

        // Text splash - used when there is no video or it cannot play.
        const logoSplash = () => {
            screenEl.classList.add('video-failed');
            setTimeout(() => logo && logo.classList.add('show'), 150);
            setTimeout(finishIntro, 1800);
        };
        video.addEventListener('error', logoSplash);

        const skip = screenEl.querySelector('.intro-skip');
        if (skip) skip.addEventListener('click', finishIntro);

        /* The page is hidden behind this splash, so nothing here may wait on the
           network for long. If the first frame has not played within 2.5s - a
           slow phone connection, a stalled fetch - we abandon the video and show
           the logo instead. Once it is actually playing we hold only for the
           frames that are left. */
        let playing = false;
        const stall = setTimeout(() => { if (!playing) logoSplash(); }, 2500);
        video.addEventListener('playing', () => {
            playing = true;
            clearTimeout(stall);
            /* Backup for a missed 'ended' event: the frames that remain, plus a
               beat. The clip always plays out in full - no early cut on phones. */
            const left = ((video.duration || 8) - video.currentTime) * 1000 + 1500;
            setTimeout(finishIntro, left);
        }, { once: true });
        video.addEventListener('stalled', () => { if (!playing) logoSplash(); });

        const played = video.play();
        if (played) played.catch(logoSplash); // autoplay blocked, or no source
    } else {
        reveal();
    }
})();

/* ===== NAV HAIRLINE =====
   A 1px sentinel at the top of the document rather than a scroll listener, so
   nothing runs on the scroll thread. */
(() => {
    const nav = document.getElementById('mainNav');
    if (!nav || !('IntersectionObserver' in window)) return;

    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:40px;left:0;width:1px;height:1px;pointer-events:none;';
    document.body.prepend(sentinel);

    new IntersectionObserver(
        ([e]) => nav.classList.toggle('scrolled', !e.isIntersecting)
    ).observe(sentinel);
})();

/* ===== THE PRACTICES FOLD =====
   The six cards fold on a phone and are plain cells above it. Which of those
   two a card is comes down to two attributes, and this is the only thing that
   touches them.

   The markup ships open and unnamed, so a page with no JS is the page as it
   has always been - six cells, everything visible, at every width. Folding is
   the enhancement, not the baseline. The alternative, shipping them closed and
   opening them here, puts the desktop grid one script error away from six
   collapsed headings.

   name="" is what makes the fold exclusive, and it is added at phone width
   only: set on six cards that are all open, a browser that supports it would
   honour the exclusivity immediately and shut five of them. */
(() => {
    const folds = document.querySelectorAll('.card-fold');
    if (!folds.length) return;

    const phone = window.matchMedia('(max-width: 720px)');

    function sync() {
        const folded = phone.matches;
        /* Names first, across all six, and only then the open states. Done per
           card, the first one named would still be sharing a name with five
           open cards and the browser would close them on the spot. */
        folds.forEach((f) => {
            if (folded) f.setAttribute('name', 'practices');
            else f.removeAttribute('name');
        });
        folds.forEach((f) => { f.open = !folded; });

        /* pointer-events:none in the stylesheet takes the mouse away from the
           summary above 720px, but it has nothing to say about the keyboard:
           a <summary> is focusable in its own right, and Enter on one would
           have collapsed a desktop cell that is supposed to have no closed
           state. Taking it out of the tab order is the half CSS cannot do. */
        folds.forEach((f) => {
            const head = f.querySelector('.card-head');
            if (!head) return;
            if (folded) head.removeAttribute('tabindex');
            else head.setAttribute('tabindex', '-1');
        });
    }

    /* Belt to the tabindex's braces. pointer-events stops the mouse and
       tabindex="-1" stops the tab key, but neither stops a toggle that starts
       some other way - an extension, a find-in-page jump, anything that lands
       focus there and sends Enter. A collapsed cell above 720px has no plus to
       reopen it, so the close is the thing to refuse rather than the routes to
       it. Enter on a <summary> arrives here as a click, so one listener holds
       both doors. */
    folds.forEach((f) => {
        const head = f.querySelector('.card-head');
        if (head) head.addEventListener('click', (e) => {
            if (!phone.matches) e.preventDefault();
        });
    });

    sync();
    phone.addEventListener('change', sync);
})();

/* ===== HERO BACKDROP =====
   Ambience behind the headline, and the last thing on the page entitled to
   bandwidth. It loads only when all of these hold: the viewport is at least
   720px, the visitor has not asked for reduced motion, and the connection is
   not metered or 2G. Otherwise the element is removed and the still declared in
   landing.css stands in - the markup carries preload="none" and no poster
   attribute, so up to that point the browser has requested nothing at all.

   Playback waits for the intro handoff. Starting it earlier would put a decode
   and a 1.2MB fetch in the same moment as the splash dissolve, which is the one
   frame on this page that has to be smooth, and would drag the largest paint
   along with it. */
(() => {
    const bg = document.querySelector('.hero-bg');
    if (!bg) return;
    const video = bg.querySelector('.hero-loop');
    if (!video) return;

    const c = navigator.connection || {};
    const stillOnly =
        window.innerWidth < 720 ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        c.saveData === true ||
        /(^|-)2g$/.test(c.effectiveType || '');


    /* Desktop reduced-motion and metered connections have no media query to
       carry the still, so hand it over here. Below 720px landing.css has it. */
    const thrifty = c.saveData === true || /(^|-)2g$/.test(c.effectiveType || '');
    const still = () => {
        if (window.innerWidth >= 720 && !bg.style.backgroundImage) {
            /* Someone who asked their browser to save data is the last person who
               should be sent the 186KB still; they get the 40KB one. */
            const src = thrifty ? bg.dataset.posterSm : bg.dataset.poster;
            if (src) bg.style.backgroundImage = 'url("' + src + '")';
        }
    };

    if (stillOnly) {
        still();
        video.remove();
        return;
    }

    const start = () => {
        video.addEventListener('playing', () => {
            /* One frame's grace so the opacity transition has a value to move
               from - setting src and class in the same tick skips the fade. */
            requestAnimationFrame(() => video.classList.add('is-playing'));
        }, { once: true });
        /* No codec here: the <source> list decides, so a browser without AV1
           takes the H.264 file without us guessing which one that is. */
        video.load();
        const played = video.play();
        /* Autoplay refused, decode failed, file missing: fall back to the still
           rather than leaving a black box where the backdrop should be. */
        if (played) played.catch(() => { still(); video.remove(); });
    };

    if (document.documentElement.dataset.introDone === '1') start();
    else document.addEventListener('pn:intro-done', start, { once: true });
})();

/* ===== LANGUAGE SWITCHER ===== */
(function () {
    function isEnglishPage() {
        return window.location.pathname.includes('-en');
    }

    function getTargetPath(lang) {
        var path = window.location.pathname;
        if (lang === 'en') {
            if (path === '/' || path === '/index.html') return '/index-en.html';
            return path.replace(/\.html$/, '-en.html');
        }
        if (path === '/index-en.html') return '/';
        if (path.endsWith('-en.html')) return path.replace('-en.html', '.html');
        return path;
    }

    function buildSwitcher() {
        var container = document.querySelector('.lang-switcher-container');
        if (!container) return;
        var isEN = isEnglishPage();
        container.innerHTML = '';

        [['LV', 'lv', 'Latviešu'], ['EN', 'en', 'English']].forEach(function (spec) {
            var active = (spec[1] === 'en') === isEN;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'lang-pill' + (active ? ' active' : '');
            btn.textContent = spec[0];
            btn.setAttribute('aria-label', spec[2]);
            if (active) btn.setAttribute('aria-current', 'true');
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                window.location.href = getTargetPath(spec[1]);
            });
            container.appendChild(btn);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildSwitcher);
    } else {
        buildSwitcher();
    }
})();

/* ===== FORM =====
   The form still posts natively to /api/webhooks/form-lead - novalidate only
   swaps the browser's bubbles for messages that sit with their field and are
   announced once, politely. If this script never runs, the browser's own
   required-field handling takes over and the form still submits. */
(() => {
    const form = document.querySelector('.contact-form');
    if (!form) return;

    const status = form.querySelector('.form-status');
    const isEN = document.documentElement.lang === 'en';
    const T = isEN ? {
        required: 'This field is required.',
        email: 'Enter a valid email address.',
        summary: (n) => `${n} field${n > 1 ? 's' : ''} need attention.`,
    } : {
        required: 'Šis lauks ir obligāts.',
        email: 'Ievadiet derīgu e-pasta adresi.',
        summary: (n) => (n === 1 ? 'Jāaizpilda 1 lauks.' : `Jāaizpilda ${n} lauki.`),
    };

    const fieldOf = (el) => el.closest('.field');
    const errOf = (el) => document.getElementById(el.id + '-err');

    function validate(el) {
        const err = errOf(el);
        let msg = '';
        if (el.required && !el.value.trim()) msg = T.required;
        else if (el.type === 'email' && el.value && !el.checkValidity()) msg = T.email;

        const field = fieldOf(el);
        if (field) field.classList.toggle('is-invalid', !!msg);
        el.setAttribute('aria-invalid', msg ? 'true' : 'false');
        if (err) err.textContent = msg;
        return !msg;
    }

    const controls = [...form.querySelectorAll('input, textarea')];
    controls.forEach((el) => {
        // Validate on the way out, then live once it has been marked wrong.
        el.addEventListener('blur', () => validate(el));
        el.addEventListener('input', () => {
            if (fieldOf(el) && fieldOf(el).classList.contains('is-invalid')) validate(el);
        });
    });

    form.addEventListener('submit', (e) => {
        const bad = controls.filter((el) => !validate(el));
        if (!bad.length) { if (status) status.textContent = ''; return; }
        e.preventDefault();
        if (status) status.textContent = T.summary(bad.length);
        bad[0].focus();
    });

    /* The practice detail pages link in with ?for=<value>. */
    const select = document.getElementById('interest');
    const want = new URLSearchParams(window.location.search).get('for');
    if (select && want && [...select.options].some((o) => o.value === want)) select.value = want;
})();

/* ===== COOKIE CONSENT =====
   Carried over unchanged in behaviour. Both buttons are styled identically in
   landing.css: a consent choice has to be symmetric. */
(function () {
    const consent = localStorage.getItem('cookie_consent');
    if (consent === 'accepted' || consent === 'declined') return;

    const isEN = document.documentElement.lang === 'en';
    const t = {
        text: isEN
            ? 'This site uses only essential cookies — no tracking, no ads. Choosing "Decline" means no cookies will be stored.'
            : 'Šī vietne izmanto tikai nepieciešamās sīkdatnes — bez izsekošanas, bez reklāmām. Izvēloties "Noraidīt", netiks saglabātas nekādas sīkdatnes.',
        policy: isEN ? 'Cookie Policy' : 'Sīkdatņu politika',
        decline: isEN ? 'Decline' : 'Noraidīt',
        accept: isEN ? 'Accept' : 'Apstiprināt',
    };

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = '<div class="cookie-banner-inner">' +
        '<p>' + t.text + ' <a href="/nidos/cookie-policy.html">' + t.policy + '</a></p>' +
        '<div class="cookie-buttons">' +
            '<button type="button" id="cookie-decline">' + t.decline + '</button>' +
            '<button type="button" id="cookie-accept">' + t.accept + '</button>' +
        '</div></div>';
    document.body.appendChild(banner);

    function hide() {
        banner.style.transition = 'opacity 0.3s';
        banner.style.opacity = '0';
        setTimeout(() => banner.remove(), 300);
    }
    banner.querySelector('#cookie-accept').addEventListener('click', () => {
        localStorage.setItem('cookie_consent', 'accepted'); hide();
    });
    banner.querySelector('#cookie-decline').addEventListener('click', () => {
        localStorage.setItem('cookie_consent', 'declined'); hide();
    });
})();

/* ===== EASTER EGG — the footer button opens the arcade ===== */
(() => {
    const egg = document.querySelector('.egg-arcade');
    if (!egg) return;

    egg.addEventListener('click', () => {
        const lang = egg.getAttribute('data-arcade-lang') === 'en' ? 'en' : 'lv';
        const url = `/arcade.html?lang=${lang}`;
        const w = Math.min(1100, screen.availWidth - 80);
        const h = Math.min(780, screen.availHeight - 80);
        const x = Math.round((screen.availWidth - w) / 2);
        const y = Math.round((screen.availHeight - h) / 2);

        /* Deliberately no `noopener`: the popup has to inherit this tab's
           sessionStorage or the site gate would ask for the password again. */
        const win = window.open(url, 'pn-arcade',
            `popup=yes,width=${w},height=${h},left=${x},top=${y}`);

        // Phones ignore popup geometry and blockers can return null — plain tab.
        if (!win) window.open(url, '_blank');
        else win.focus();
    });
})();

/* ===== THE POINTER PANE =====
   One pane that travels between the six cells instead of six cells that each
   light up alone. Everything about how it looks is in landing.css; this only
   decides which cell it is over.

   Pointer devices only. The cells fold into an accordion at phone width, where
   there is no hover to answer and tapping a card's link would flash the pane
   on the way out.

   Position comes from offsetLeft/offsetTop against .index, which is the cells'
   offsetParent because .index is positioned. Written as a translate plus a
   scale on a 1x1 box, so the only thing that ever animates is a transform. */
(() => {
    const index = document.querySelector('.index');
    if (!index) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

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
})();
