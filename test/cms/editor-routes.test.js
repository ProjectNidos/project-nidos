const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const editorRoutes = require('../../server/routes/admin/editor');
const { EditorError } = require('../../server/cms/editor');

// The routes are thin: a fake editor stands in for the database, and the
// audit log is recorded in memory.
function serve(editor) {
  const logged = [];
  let cleared = 0;
  const app = express();
  app.use(express.json());
  app.locals.cms = { clear: () => { cleared += 1; } };
  app.use((req, res, next) => { req.user = { id: 7, name: 'Owner' }; next(); });
  app.use(editorRoutes({ editor, getCategories: async () => ['crm'], audit: { record: async (req, e) => logged.push(e.action) } }));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const base = `http://127.0.0.1:${server.address().port}`;
      const call = async (method, url, body) => {
        const res = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
        return { status: res.status, body: await res.json() };
      };
      resolve({ call, logged, cleared: () => cleared, close: () => server.close() });
    });
  });
}

test('a good save answers with the new draft and is logged', async () => {
  const s = await serve({ saveDraft: async (id, body, userId, categories) => {
    assert.deepEqual([id, body.baseVersionId, userId, categories], [3, 10, 7, ['crm']]);
    return { id: 11, path: '/nidos/pricing.html' };
  } });
  try {
    const r = await s.call('PUT', '/pages/3/draft', { baseVersionId: 10, meta: {}, blocks: [] });
    assert.deepEqual([r.status, r.body], [200, { versionId: 11 }]);
    assert.deepEqual(s.logged, ['page.draft.save']);
  } finally { s.close(); }
});

test('invalid fields answer 422 with each path; a conflict 409; a missing page 404', async () => {
  const errors = [{ path: 'blocks[1].heading', message: 'Heading is 81 characters; the limit is 80.' }];
  const cases = [
    [new EditorError(422, 'Some fields need attention.', errors), 422, errors],
    [new EditorError(409, 'Changed elsewhere.'), 409, undefined],
    [new EditorError(404, 'No such page.'), 404, undefined],
  ];
  for (const [err, status, expected] of cases) {
    const s = await serve({ saveDraft: async () => { throw err; } });
    try {
      const r = await s.call('PUT', '/pages/3/draft', {});
      assert.equal(r.status, status);
      assert.deepEqual(r.body.errors, expected);
      assert.deepEqual(s.logged, []);
    } finally { s.close(); }
  }
});

test('a database failure says so, without details', async () => {
  const s = await serve({ openPage: async () => { throw new Error('connect ECONNREFUSED 10.0.0.1:5432'); } });
  try {
    const r = await s.call('GET', '/pages/3');
    assert.equal(r.status, 500);
    assert.equal(r.body.error, 'The page editor could not reach the database.');
  } finally { s.close(); }
});

test('publishing a page or the menu and footer clears the page cache', async () => {
  const s = await serve({
    publish: async () => ({ id: 12, path: '/' }),
    publishSite: async () => ({ before: { nav: 1 }, after: { nav: 2 } }),
  });
  try {
    assert.equal((await s.call('POST', '/pages/3/publish', { baseVersionId: 11 })).status, 200);
    assert.equal((await s.call('POST', '/site/publish', { base: 'draft:1:1' })).status, 200);
    assert.equal(s.cleared(), 2);
    assert.deepEqual(s.logged, ['page.publish', 'site.publish']);
  } finally { s.close(); }
});

test('the form definitions carry every block, the menu and footer, and the categories', async () => {
  const s = await serve({});
  try {
    const r = await s.call('GET', '/blocks');
    assert.equal(r.status, 200);
    assert.equal(r.body.blocks['pricing-table'].label, 'Pricing table');
    assert.ok(r.body.site.nav && r.body.meta.seoTitle);
    assert.deepEqual(r.body.categories, ['crm']);
  } finally { s.close(); }
});
