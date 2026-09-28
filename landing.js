/*
 * landing.js - the home layout's own behaviour: index.html, and every page
 * the editor draws on the home layout.
 *
 * Replaces script.js on this page. Everything script.js used to do here
 * that the redesign still needs is carried over; everything that drove the
 * deleted decoration is gone with it.
 *
 *   carried over : intro sequence, arcade popup, cookie consent banner
 *   new          : nav hairline sentinel
 *   moved out    : form checking and ?for= preselect (contact-form.js), the
 *                  practices' pointer pane (pointer-pane.js) - they load with
 *                  the blocks that use them, on either layout (plan 1b)
 *   gone         : Lenis, IntersectionObserver scroll reveals, hero-net canvas,
 *                  fw-stage particle tunnel, the pinned practices stepper,
 *                  the stage image swapper, the closing-CTA rise, the
 *                  conviction parallax, the mobile nav drawer
 *
 * No library. No scroll handler that does layout work.
 */

/* ===== INTRO =====
   Protected behaviour: same video files, same muted/playsinline autoplay, same
   "Izlaist" control, same dissolve. Four changes only - a reduced-motion
   branch, a poster frame, the splash wordmark demoted to <p> in the markup, and
   the removal of the Lenis restart and the scroll animation kick that used to
   run at the end of the hand-off. Since 28 Sep 2026 the page is shown under
   the splash rather than hidden (it paints first), and the splash plays once
   per browser (localStorage), not once per tab. */
(() => {
    const screenEl = document.querySelector('.intro-screen');
    const logo = document.querySelector('.intro-logo');
    const video = document.querySelector('.intro-video');
    const nav = document.getElementById('mainNav');
    const main = document.querySelector('main');

    /* While the splash plays it is a modal dialog (role and name in the
       markup): everything else on the page - skip link, nav, <main>, the cookie
       notice - is inert, so neither Tab nor a screen reader lands behind it. */
    const hold = (on) => {
        for (const el of document.body.children) if (el !== screenEl && el.tagName !== 'SCRIPT') el.inert = on;
    };

    const reveal = () => {
        document.documentElement.classList.remove('intro-lock');
        hold(false);
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
        try { localStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
        screenEl.classList.add('intro-done');
        if (main) main.classList.remove('intro-active');
        /* The hero is already laid out and painted underneath at full opacity,
           covered by the splash. Dissolving the splash uncovers a finished
           page, so there is nothing to animate in and nothing to shift. */
        reveal();
        window.scrollTo(0, 0);
    };

    let seen = false;
    try { seen = localStorage.getItem('pn_intro_seen') === '1'; } catch (e) {}

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* Someone arriving from a practice page lands on /?for=crm#contact. They
       may never have seen this page, so pn_intro_seen is unset, so without this they
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
        try { localStorage.setItem('pn_intro_seen', '1'); } catch (e) {}
        if (screenEl) screenEl.remove();
        reveal();
        if (deepLinked) goToTarget();
    } else if (seen && screenEl) {
        screenEl.style.transition = 'none';
        finishIntro();
    } else if (screenEl && video) {
        hold(true);
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') finishIntro(); });
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

        /* The page is covered by this splash, so nothing here may wait on the
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
    /* Set only once all of the above ran without an error: the page's own
       failsafe (in the markup) ends the splash on load if this is missing. */
    document.documentElement.dataset.introRunning = '1';
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

/* ===== COOKIE CONSENT =====
   Carried over unchanged in behaviour. Both buttons are styled identically in
   landing.css: a consent choice has to be symmetric. */
(function () {
    const consent = localStorage.getItem('cookie_consent');
    if (consent === 'accepted' || consent === 'declined') return;

    const t = {
        text: 'This site uses only essential cookies — no tracking, no ads. Choosing "Decline" means no cookies will be stored.',
        policy: 'Cookie Policy',
        decline: 'Decline',
        accept: 'Accept',
    };

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.innerHTML = '<div class="cookie-banner-inner">' +
        '<p>' + t.text + ' <a href="/nidos/cookie-policy.html">' + t.policy + '</a></p>' +
        '<div class="cookie-buttons">' +
            '<button type="button" id="cookie-decline">' + t.decline + '</button>' +
            '<button type="button" id="cookie-accept">' + t.accept + '</button>' +
        '</div></div>';
    // Added while the splash may still be up: held with the rest until it ends.
    banner.inert = document.documentElement.classList.contains('intro-lock');
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
        const url = '/arcade.html';
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
