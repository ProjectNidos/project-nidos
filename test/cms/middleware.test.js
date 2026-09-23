const test = require('node:test');
const assert = require('node:assert/strict');
const { createCmsMiddleware } = require('../../server/cms/middleware');

function harness({ on = true, paths = ['/', '/404'], render = () => '<p>db</p>', preview = false } = {}) {
  let t = 0;
  let ver = 1;
  const logs = [];
  const calls = { getPublished: 0 };
  const store = {
    listPublishedPaths: async () => paths,
    getPublished: async (site, p) => {
      calls.getPublished += 1;
      return paths.includes(p) ? { page: { path: p, layout: 'home' }, blocks: [], versionId: ver } : null;
    },
    getPublishedVersionId: async () => ver,
    getSiteSettings: async () => ({}),
  };
  const state = { on };
  const settings = { get: async (k) => (k === 'cms.servePages' ? state.on : undefined) };
  const cms = createCmsMiddleware({
    store, settings, renderPage: render, canPreview: async () => preview,
    log: { error: (...a) => logs.push(a.join(' ')) }, now: () => t,
  });
  const call = (path, query = {}) => new Promise((resolve) => {
    const res = {
      headers: {}, statusCode: 200,
      setHeader(k, v) { this.headers[k] = v; },
      status(c) { this.statusCode = c; return this; },
      send(b) { resolve({ sent: b, status: this.statusCode, headers: this.headers }); },
    };
    cms.middleware({ method: 'GET', path, query }, res, () => resolve({ next: true }));
  });
  return { cms, call, logs, calls, state, tick: (ms) => { t += ms; }, publish: () => { ver += 1; } };
}

test('serves a published page when the switch is on', async () => {
  assert.equal((await harness().call('/')).sent, '<p>db</p>');
});

test('falls through when off, unpublished, or not a page', async () => {
  assert.equal((await harness({ on: false }).call('/')).next, true);
  assert.equal((await harness().call('/nidos/pricing.html')).next, true);
  const h = harness();
  assert.equal((await h.call('/api/leads')).next, true);
  assert.equal(h.calls.getPublished, 0);
});

test('unknown block type falls through and is logged', async () => {
  const h = harness({ render: () => { throw new Error('unknown block type "gone"'); } });
  assert.equal((await h.call('/')).next, true);
  assert.match(h.logs.join('\n'), /\/ .*unknown block type "gone"/);
});

test('index.html aliases the home page; /404 is never served directly', async () => {
  const h = harness();
  assert.equal((await h.call('/index.html')).sent, '<p>db</p>');
  assert.equal((await h.call('/404')).next, true);
});

test('cache is reused, then rebuilt after a publish', async () => {
  let n = 0;
  const h = harness({ render: () => `<p>${++n}</p>` });
  assert.equal((await h.call('/')).sent, '<p>1</p>');
  assert.equal((await h.call('/')).sent, '<p>1</p>');
  h.tick(6000);
  assert.equal((await h.call('/')).sent, '<p>1</p>');
  h.publish();
  h.tick(6000);
  assert.equal((await h.call('/')).sent, '<p>2</p>');
});

test('switch off bypasses a warm cache', async () => {
  const h = harness();
  assert.equal((await h.call('/')).sent, '<p>db</p>');
  h.state.on = false;
  assert.equal((await h.call('/')).next, true);
});

test('preview flag is ignored without preview rights', async () => {
  assert.equal((await harness({ on: false }).call('/', { __cms: '1' })).next, true);
  assert.equal((await harness({ on: true }).call('/', { __cms: '0' })).sent, '<p>db</p>');
});

test('preview flag works with preview rights, uncached by browsers', async () => {
  const r = await harness({ on: false, preview: true }).call('/', { __cms: '1' });
  assert.equal(r.sent, '<p>db</p>');
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal((await harness({ on: true, preview: true }).call('/', { __cms: '0' })).next, true);
});

test('renderNotFound renders /404 with status 404, or reports it could not', async () => {
  const h = harness();
  const out = await new Promise((resolve) => {
    const res = { setHeader() {}, status(c) { this.statusCode = c; return this; }, send(b) { resolve({ b, s: this.statusCode }); } };
    h.cms.renderNotFound({ path: '/nope', query: {} }, res);
  });
  assert.deepEqual(out, { b: '<p>db</p>', s: 404 });
  assert.equal(await harness({ on: false }).cms.renderNotFound({ path: '/nope', query: {} }, {}), false);
});

test('canPreview: no valid cookie in production is no', async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
  const { createCanPreview } = require('../../server/cms/preview');
  const prisma = { user: { findUnique: async () => ({ role: 'admin', isActive: true }) } };
  const can = createCanPreview(prisma, { NODE_ENV: 'production' });
  assert.equal(await can({ cookies: {}, headers: {} }), false);
  assert.equal(await can({ cookies: { token: 'not-a-jwt' }, headers: {} }), false);
  assert.equal(await createCanPreview(prisma, { NODE_ENV: 'development' })({ cookies: {}, headers: {} }), true);
});
