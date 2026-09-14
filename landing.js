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

    if (reduced) {
        /* No video, no splash, no dissolve. The same end state, reached at once:
           the splash is removed outright rather than faded. */
        try { sessionStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
        if (screenEl) screenEl.remove();
        reveal();
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
