/*
 * Serves published pages from the page tables, in front of today's pipeline.
 *
 * Anything it cannot do - the switch is off, the path is not a published page,
 * the database is down, a block no longer exists - ends in next(), and the
 * request carries on to the "Site content" middleware and the files on disk
 * exactly as it did before this existed. Turning the switch off is therefore
 * the whole rollback.
 */
const SITE = 'projectnidos';
const RECHECK_MS = 5000;

function createCmsMiddleware({ store, settings, renderPage, canPreview, log = console, now = Date.now }) {
  const cache = new Map();
  let paths = { set: new Set(), checkedAt: -Infinity };
  let refreshing = null;

  // Single-flight: concurrent callers within one stale window share the one
  // request in flight, and a failing database is not retried on every one of
  // them. A failure is remembered as "nothing published" for RECHECK_MS, so a
  // downed database costs one query per window rather than one per request.
  async function publishedPaths() {
    if (now() - paths.checkedAt <= RECHECK_MS) return paths.set;
    if (!refreshing) {
      refreshing = store.listPublishedPaths(SITE).then(
        (list) => { paths = { set: new Set(list), checkedAt: now() }; },
        (err) => {
          paths = { set: new Set(), checkedAt: now() };
          log.error(`cms: page list unavailable, serving files for ${RECHECK_MS / 1000}s:`, err.message);
        },
      ).finally(() => { refreshing = null; });
    }
    await refreshing;
    return paths.set;
  }

  async function build(path) {
    const hit = cache.get(path);
    if (hit && now() - hit.checkedAt <= RECHECK_MS) return hit.html;
    if (hit && (await store.getPublishedVersionId(SITE, path)) === hit.versionId) {
      hit.checkedAt = now();
      return hit.html;
    }
    const found = await store.getPublished(SITE, path);
    if (!found) { cache.delete(path); return null; }
    const site = await store.getSiteSettings(SITE);
    const html = renderPage({ page: { ...found.page, path }, blocks: found.blocks, site });
    cache.set(path, { html, versionId: found.versionId, checkedAt: now() });
    return html;
  }

  // Resolves true once the response is sent, false when the caller should
  // carry on as if this did not exist.
  async function serve(req, res, path, status) {
    try {
      const flag = req.query && req.query.__cms;
      const forced = (flag === '1' || flag === '0') && (await canPreview(req)) ? flag : null;
      if (forced === '0') return false;
      if (!forced && !(await settings.get('cms.servePages'))) return false;
      if (!(await publishedPaths()).has(path)) return false;
      const html = await build(path);
      if (html == null) return false;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', forced ? 'no-store' : 'no-cache');
      res.status(status).send(html);
      return true;
    } catch (err) {
      log.error(`cms: ${path} fell back to the file:`, err.message);
      return false;
    }
  }

  function middleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    // Pages have no extension or end in .html, so assets and APIs never wait on the page tables.
    if (req.path.startsWith('/api/') || /\.(?!html$)[^./]+$/i.test(req.path)) return next();
    if (req.path === '/404') return next();
    const path = req.path === '/index.html' ? '/' : req.path;
    serve(req, res, path, 200).then((done) => { if (!done) next(); });
  }

  return {
    middleware,
    renderNotFound: (req, res) => serve(req, res, '/404', 404),
    clear: () => { cache.clear(); paths = { set: new Set(), checkedAt: -Infinity }; refreshing = null; },
  };
}

module.exports = { createCmsMiddleware };
