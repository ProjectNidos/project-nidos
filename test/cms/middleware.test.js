const test = require('node:test');
const assert = require('node:assert/strict');
const { createCmsMiddleware } = require('../../server/cms/middleware');

function harness({
  on = true, paths = ['/', '/404'], render = () => '<p>db</p>', preview = false, listPublishedPaths,
} = {}) {
  let t = 0;
  let ver = 1;
  const logs = [];
  const calls = { getPublished: 0, settingsGet: 0, listPublishedPaths: 0 };
  const store = {
    listPublishedPaths: async (...args) => {
      calls.listPublishedPaths += 1;
      return listPublishedPaths ? listPublishedPaths(...args) : paths;
    },
    getPublished: async (site, p) => {
      calls.getPublished += 1;
      return paths.includes(p) ? { page: { path: p, layout: 'home' }, blocks: [], versionId: ver } : null;
    },
    getPublishedVersionId: async () => ver,
    getSiteSettings: async () => ({}),
  };
  const state = { on };
  const settings = {
    get: async (k) => {
      calls.settingsGet += 1;
      return k === 'cms.servePages' ? state.on : undefined;
    },
  };
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

test('assets and APIs never touch settings or the page list', async () => {
  const h = harness();
  assert.equal((await h.call('/landing.css')).next, true);
  assert.equal((await h.call('/intro-video.mp4')).next, true);
  assert.equal((await h.call('/api/leads')).next, true);
  assert.equal(h.calls.settingsGet, 0);
  assert.equal(h.calls.listPublishedPaths, 0);
});

test('unknown block type falls through and is logged with the path and version', async () => {
  const h = harness({ render: () => { throw new Error('unknown block type "gone"'); } });
  assert.equal((await h.call('/')).next, true);
  assert.deepEqual(h.logs, ['cms: / fell back to the file: version 1: unknown block type "gone"']);
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

test('a failing page list is retried once per window', async () => {
  const h = harness({ on: true, listPublishedPaths: () => { throw new Error('down'); } });

  for (let i = 0; i < 5; i++) {
    assert.equal((await h.call('/')).next, true);
  }
  assert.equal(h.calls.listPublishedPaths, 1);
  assert.equal(h.logs.length, 1);
  assert.match(h.logs[0], /^cms: page list unavailable, serving files for 5s: down$/);

  h.tick(6000);
  assert.equal((await h.call('/')).next, true);
  assert.equal(h.calls.listPublishedPaths, 2);
});

test('concurrent requests share one page-list refresh', async () => {
  let resolveList;
  const deferred = new Promise((resolve) => { resolveList = resolve; });
  const h = harness({ on: true, listPublishedPaths: () => deferred });

  const p1 = h.call('/');
  const p2 = h.call('/');
  const p3 = h.call('/');

  // Flush every pending microtask without resolving the store call, so all
  // three requests get the chance to reach publishedPaths() first.
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(h.calls.listPublishedPaths, 1);

  resolveList(['/', '/404']);
  const results = await Promise.all([p1, p2, p3]);
  for (const r of results) assert.equal(r.sent, '<p>db</p>');
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

test('canPreview: a valid token passes only for an active admin, and only while valid', async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-only-secret';
  const jwt = require('jsonwebtoken');
  const { SECRET_KEY } = require('../../server/middleware/auth');
  const { createCanPreview } = require('../../server/cms/preview');
  const users = {
    1: { role: 'admin', isActive: true },
    2: { role: 'admin', isActive: false },
    3: { role: 'user', isActive: true },
  };
  const prisma = { user: { findUnique: async ({ where: { id } }) => users[id] || null } };
  const can = createCanPreview(prisma, { NODE_ENV: 'production' });
  const withToken = (token) => can({ cookies: { token }, headers: {} });

  assert.equal(await withToken(jwt.sign({ id: 1 }, SECRET_KEY)), true, 'active admin');
  assert.equal(await withToken(jwt.sign({ id: 2 }, SECRET_KEY)), false, 'inactive admin');
  assert.equal(await withToken(jwt.sign({ id: 3 }, SECRET_KEY)), false, 'non-admin');
  assert.equal(await withToken(jwt.sign({ id: 1 }, SECRET_KEY, { expiresIn: -10 })), false, 'expired');
  assert.equal(await withToken(jwt.sign({ id: 1 }, SECRET_KEY + '-other')), false, 'another secret');
});
