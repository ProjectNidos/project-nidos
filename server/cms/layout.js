/*
 * The page frame around a page's blocks: head, intro (home only), nav, the
 * topology field, footer and scripts. Mirrors site/landing.template.html (the
 * "home" layout) and site/digitalization.template.html (the "standard"
 * layout); test/cms/layout.test.js holds it to those files.
 */
const { esc } = require('../../scripts/lib/render');
const { sanitize } = require('./richtext');
const { getBlock } = require('../../blocks');
const { stylesFor, scriptsFor } = require('./assets');

const SITE_URL = 'https://www.projectnidos.eu';
const OG_IMAGE = 'https://www.projectnidos.eu/logo-latest.png';

// Verbatim from site/landing.template.html.
const INTRO_SCRIPT = `<script>
            /* Source picked here, during parse, so the fetch still starts as early as a
               src attribute would. A phone gets a 341 KB encode instead of 1.2 MB, and a
               metered or 2G connection gets no video at all - play() then rejects and the
               splash falls through to the logo. A visitor who has asked for reduced
               motion gets no video and no splash at all; see landing.js. */
            (function () {
                var v = document.currentScript.previousElementSibling;
                var c = navigator.connection || {};
                try { if (sessionStorage.getItem('pn_intro_seen') === '1') return; } catch (e) {}
                if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
                /* Deep link from a practice page - the splash is skipped in
                   landing.js, so do not spend 1.2 MB fetching a video for it. */
                if (location.hash || /[?&]for=/.test(location.search)) return;
                if (c.saveData === true || /(^|-)2g$/.test(c.effectiveType || '')) return;
                v.src = window.innerWidth <= 820 ? '/intro-video-mobile.mp4?v=2' : '/intro-video.mp4?v=2';
            })();
        </script>`;

// Verbatim from site/digitalization.template.html.
const HAIRLINE_SCRIPT = `<script>
        /* Nav hairline once the page has scrolled - a sentinel, as on the
           landing, so nothing runs on the scroll thread. */
        (() => {
            const nav = document.getElementById('mainNav');
            if (!nav || !('IntersectionObserver' in window)) return;
            const sentinel = document.createElement('div');
            sentinel.setAttribute('aria-hidden', 'true');
            sentinel.style.cssText = 'position:absolute;top:40px;left:0;width:1px;height:1px;pointer-events:none;';
            document.body.prepend(sentinel);
            new IntersectionObserver(([e]) => nav.classList.toggle('scrolled', !e.isIntersecting)).observe(sentinel);
        })();
    </script>`;

const NOSCRIPT_HOME = `<noscript><style>
        .intro-screen { display: none !important; }
        html.intro-lock, html.intro-lock body { overflow: visible !important; }
        html.intro-lock main { visibility: visible !important; }
        .nav { opacity: 1 !important; }
    </style></noscript>`;

function resolveNavHref(link, page, anchors) {
  if (link.anchor && anchors.has(link.anchor)) return { href: `#${link.anchor}`, current: false };
  if (page.path === '/' && link.href.startsWith('/#')) return { href: link.href.slice(1), current: false };
  return { href: link.href, current: link.href === page.path };
}

function renderPage({ page, blocks, site }) {
  const defs = blocks.map((b) => {
    const def = getBlock(b.type);
    if (!def) throw new Error(`unknown block type "${b.type}"`);
    return def;
  });
  const anchors = new Set(blocks.map((b, i) => defs[i].anchor(b.props)).filter(Boolean));
  const ctx = { page, esc, rich: sanitize, anchors };
  const body = blocks.map((b, i) => defs[i].render(b.props, ctx)).join('\n');

  const home = page.layout === 'home';
  const nav = site.nav.links.map((l) => {
    const r = resolveNavHref(l, page, anchors);
    return `<a href="${esc(r.href)}"${r.current ? ' aria-current="page"' : ''}>${esc(l.text)}</a>`;
  }).join('\n');
  const cols = site.footer.cols.map((c) => `<div class="footer-col">
<h3>${esc(c.heading)}</h3>
${c.links.map((l) => `<a href="${esc(l.href)}">${esc(l.text)}</a>`).join('\n')}
</div>`).join('\n');
  const arcade = home
    ? `\n<button type="button" class="egg-arcade" aria-label="${esc(site.footer.arcade.aria)}">${esc(site.footer.arcade.text)}</button>`
    : '';
  const intro = home ? `<div class="intro-screen">
<video class="intro-video" muted playsinline preload="auto" aria-hidden="true"></video>
${INTRO_SCRIPT}
<p class="intro-logo">Project Nidos</p>
<button class="intro-skip hit-44" type="button">${esc(site.labels.introSkip)}</button>
</div>\n` : '';

  const canonical = page.path === '/404' ? null : SITE_URL + page.path;
  const styles = stylesFor(page.layout, blocks).map((h) => `<link rel="stylesheet" href="${h}">`).join('\n');
  const scripts = [
    ...(home ? [] : [HAIRLINE_SCRIPT]),
    ...scriptsFor(page.layout, blocks).map((s) => `<script src="${s}"></script>`),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en"${home ? ' class="intro-lock"' : ''}>
<head>
<script src="/gate.js?v=1"></script>
${home ? "<script>history.scrollRestoration = 'manual';</script>\n" : ''}<meta charset="UTF-8">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${esc(page.seoTitle)}</title>
<meta name="description" content="${esc(page.seoDescription)}">
<meta name="robots" content="${page.noindex ? 'noindex, follow' : 'index, follow'}">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">\n` : ''}<meta property="og:type" content="website">
${canonical ? `<meta property="og:url" content="${esc(canonical)}">\n` : ''}<meta property="og:title" content="${esc(page.seoTitle)}">
<meta property="og:description" content="${esc(page.seoDescription)}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="twitter:card" content="summary_large_image">
<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/archivo-lat.woff2" crossorigin>
${styles}
${home ? NOSCRIPT_HOME + '\n' : ''}</head>
<body>
<a class="skip-link" href="#main">${esc(site.labels.skip)}</a>
${intro}<nav class="${home ? 'nav' : 'nav nav--row'}" id="mainNav">
<div class="nav-inner">
<a href="/" class="nav-logo">${esc(site.nav.logo)}</a>
<button class="nav-toggle" type="button" aria-expanded="false" aria-controls="navLinks" aria-label="${esc(site.labels.menu)}" hidden><span></span><span></span><span></span></button>
<div class="nav-links" id="navLinks">
${nav}
</div>
</div>
</nav>
<main id="main">
<canvas id="topology-bg" aria-hidden="true"></canvas>
${body}
<footer${home ? '' : ' class="footer-lattice"'}>
<div class="footer-inner">
<div class="footer-brand">
<a href="/" class="nav-logo">${esc(site.nav.logo)}</a>
<p>${sanitize(site.footer.taglineHTML, 'inline')}</p>
</div>
<div class="footer-nav">
${cols}
</div>
</div>
<div class="footer-bottom">
<p>${esc(site.footer.legal)}</p>${arcade}
</div>
</footer>
</main>
${scripts}
</body>
</html>`;
}

module.exports = { renderPage, resolveNavHref };
