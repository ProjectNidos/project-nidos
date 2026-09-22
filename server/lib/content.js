/*
 * Editable copy for the static marketing pages.
 *
 * The landing pages are hand-tuned HTML with a lot of animation wired to their
 * exact structure, so they are not templates and are not going to become
 * templates. Instead a region is marked in place:
 *
 *     <h1 data-cms="hero.title">Digitalizācija, kas strādā</h1>
 *     <meta name="description" data-cms="meta.description" content="...">
 *
 * and the admin panel stores an override against (page, key). At serve time
 * the override is swapped in server-side, so a visitor - and a crawler - gets
 * the final text in the first response, with no flash of the old copy.
 *
 * With an empty SiteContent table every page serves byte-for-byte as committed.
 * That is the property that makes this safe to ship: the HTML file is always
 * the fallback, and "revert" is just deleting a row.
 */
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const prisma = require('../prisma');

const ROOT = path.join(__dirname, '..', '..');

/* Pages the admin panel may edit. An allowlist, not a directory scan: the
   internal tools (crm, login, admin) have no business being editable, and
   `page` arrives from an HTTP request - it must never reach the filesystem
   unchecked. */
const MANAGED_PAGES = [
    'index.html',
    '404.html',
    'nidos/pricing.html',
    'nidos/digitalization.html',
    'nidos/privacy.html',
    'nidos/terms.html',
    'nidos/gdpr.html',
    'nidos/cookie-policy.html',
];

const MANAGED_SET = new Set(MANAGED_PAGES);

/* Rendered pages are cached until something is saved. Parsing 35 KB of HTML
   per request would be a real cost on the landing page; parsing it once per
   edit is free. `version` is bumped by invalidate() rather than the cache being
   cleared, so an in-flight render cannot repopulate a stale entry. */
const cache = new Map();
let version = 0;
let overrides = null; // page -> { key: value }

function invalidate() {
    version += 1;
    cache.clear();
    overrides = null;
}

function isManaged(page) {
    return MANAGED_SET.has(page);
}

/* Maps a URL path onto a managed file, or null. `/` and `/index.html` are the
   same file; anything with a traversal segment fails the allowlist check and
   is refused here rather than reaching fs.readFile. */
function pageForRequest(urlPath) {
    let page = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
    if (page.includes('..')) return null;
    return isManaged(page) ? page : null;
}

function readSource(page) {
    if (!isManaged(page)) throw new Error(`Not a managed page: ${page}`);
    return fs.readFileSync(path.join(ROOT, page), 'utf8');
}

/*
 * What a marked element's editable value actually is:
 *  - <meta>, <img>, <a> and friends: the attribute named by data-cms-attr,
 *    defaulting to `content` for meta and `alt` for img.
 *  - everything else: its text.
 * Only text is ever written back, never markup - an override cannot introduce
 * a tag, a script or an attribute into the page.
 */
function targetAttr($el) {
    const explicit = $el.attr('data-cms-attr');
    if (explicit) return explicit;

    const tag = ($el.prop('tagName') || '').toLowerCase();
    if (tag === 'meta') return 'content';
    if (tag === 'img') return 'alt';
    return null;
}

function readValue($el) {
    const attr = targetAttr($el);
    return attr ? ($el.attr(attr) || '') : $el.text();
}

function writeValue($el, value) {
    const attr = targetAttr($el);
    if (attr) $el.attr(attr, value);
    else $el.text(value); // .text(), never .html() - overrides are copy, not markup
}

/**
 * Every editable field on a page, with the text committed in the file as its
 * fallback. Used by the admin UI to build its form.
 */
function fields(page) {
    const $ = cheerio.load(readSource(page));
    const found = [];
    const seen = new Set();

    $('[data-cms]').each((_, el) => {
        const $el = $(el);
        const key = $el.attr('data-cms');
        if (!key || seen.has(key)) return; // first occurrence wins, duplicates ignored
        seen.add(key);

        found.push({
            key,
            original: readValue($el).trim(),
            tag: ($el.prop('tagName') || '').toLowerCase(),
            attr: targetAttr($el),
            multiline: readValue($el).trim().length > 90,
        });
    });

    return found;
}

/*
 * One-time move of stored overrides for the switch to an English-only site.
 *
 * Overrides are keyed on the page FILE, and several files changed language
 * under the same name: index.html and nidos/pricing.html were Latvian and are
 * now the English pages, and the legal pages were translated in place. Left
 * alone, a Latvian edit saved against one of them would be painted over the
 * English text. So every override saved while those files were Latvian is
 * moved under ARCHIVE - kept, never rendered, and invisible to the admin panel,
 * which only lists MANAGED_PAGES - and the English pages' own overrides follow
 * them to their new file names.
 *
 * Runs once, in a transaction, and records itself in a marker row under the
 * same unmanaged prefix. It has to be recorded rather than inferred: after the
 * move, index.html holds English overrides that must NOT be archived again.
 */
const ARCHIVE = 'lv-archive/';
const MIGRATION_MARKER = { page: 'lv-archive', key: 'english-only-migrated' };

const LATVIAN_PAGES = [
    'index.html',
    '404.html',
    'nidos/index.html',
    'nidos/about.html',
    'nidos/contact.html',
    'nidos/platform.html',
    'nidos/pricing.html',
    'nidos/digitalizacija.html',
    'nidos/privacy.html',
    'nidos/terms.html',
    'nidos/gdpr.html',
    'nidos/cookie-policy.html',
    'nidos/404.html',
];
const RENAMED_ENGLISH_PAGES = [
    ['index-en.html', 'index.html'],
    ['nidos/pricing-en.html', 'nidos/pricing.html'],
];

async function migrateToEnglishOnly() {
    const done = await prisma.siteContent.findUnique({ where: { page_key: MIGRATION_MARKER } });
    if (done) return;

    const results = await prisma.$transaction([
        ...LATVIAN_PAGES.map((page) => prisma.siteContent.updateMany({
            where: { page }, data: { page: ARCHIVE + page },
        })),
        ...RENAMED_ENGLISH_PAGES.map(([from, to]) => prisma.siteContent.updateMany({
            where: { page: from }, data: { page: to },
        })),
        prisma.siteContent.create({
            data: { ...MIGRATION_MARKER, value: new Date().toISOString(), updatedBy: 'system' },
        }),
    ]);

    const archived = results.slice(0, LATVIAN_PAGES.length).reduce((n, r) => n + r.count, 0);
    const renamed = results.slice(LATVIAN_PAGES.length, -1).reduce((n, r) => n + r.count, 0);
    console.log(`Content: English-only migration done - ${archived} Latvian override(s) archived under ${ARCHIVE}, ${renamed} English override(s) moved to their new page.`);
}

/* Started when the server boots, and awaited before overrides are first read,
   so no request can render a Latvian override onto an English page while it
   runs. Resolves to whether it succeeded and never rejects - it is fired
   without an await at boot, where a rejection would take the process down. */
let migrated = null;
function ensureMigrated() {
    if (!migrated) {
        migrated = migrateToEnglishOnly().then(() => true, (err) => {
            console.error('Content: English-only migration failed, overrides stay where they were:', err.message);
            migrated = null; // tried again the next time overrides are loaded
            return false;
        });
    }
    return migrated;
}

async function loadOverrides() {
    if (overrides) return overrides;

    /* Unmigrated rows would put Latvian text on English pages, so until the
       move has happened every page serves its committed English copy. */
    if (!(await ensureMigrated())) {
        overrides = {};
        return overrides;
    }

    const map = {};
    try {
        const rows = await prisma.siteContent.findMany();
        for (const row of rows) {
            if (!map[row.page]) map[row.page] = {};
            map[row.page][row.key] = row.value;
        }
    } catch (err) {
        // A missing table must never take the public site down - an empty map
        // means every page serves its committed copy, which is correct.
        console.error('Content overrides unavailable, serving files as-is:', err.message);
    }

    overrides = map;
    return overrides;
}

/**
 * The rendered HTML for a managed page, overrides applied.
 */
async function render(page) {
    const cached = cache.get(page);
    if (cached && cached.version === version) return cached.html;

    const source = readSource(page);
    const all = await loadOverrides();
    const pageOverrides = all[page];

    // Nothing to swap in: hand back the file untouched, unparsed.
    if (!pageOverrides || !Object.keys(pageOverrides).length) {
        cache.set(page, { version, html: source });
        return source;
    }

    const $ = cheerio.load(source, { decodeEntities: false });
    let applied = 0;

    $('[data-cms]').each((_, el) => {
        const $el = $(el);
        const key = $el.attr('data-cms');
        const value = pageOverrides[key];
        if (key && value !== undefined && value !== null && value !== '') {
            writeValue($el, value);
            applied += 1;
        }
    });

    const html = applied ? $.html() : source;
    cache.set(page, { version, html });
    return html;
}

/**
 * Express middleware. Sits in front of express.static so a managed page is
 * rendered rather than streamed from disk. Anything not managed falls straight
 * through, and any failure falls through too - a broken override must not be
 * able to take a page offline.
 */
function middleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const page = pageForRequest(req.path);
    if (!page) return next();

    render(page)
        .then((html) => {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            res.send(html);
        })
        .catch((err) => {
            console.error(`Content render failed for ${page}:`, err.message);
            next();
        });
}

module.exports = {
    MANAGED_PAGES,
    ensureMigrated,
    isManaged,
    fields,
    render,
    middleware,
    invalidate,
    readSource,
};
