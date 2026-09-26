const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const express = require('express');

// The route talks to Prisma and Settings; both are stubbed before it loads.
const created = [];
const stub = (rel, exports) => {
  const file = require.resolve(path.join(__dirname, '../../server', rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};
stub('prisma', { lead: { create: async ({ data }) => { created.push(data); return { id: created.length, ...data }; } } });
stub('lib/settings', { get: async (key) => (key === 'leads.interestMap' ? { crm: 'crm_request' } : undefined) });
const webhooks = require('../../server/routes/webhooks');

// Mounted as server.js mounts it: JSON parsed for the whole app, then the router.
async function post(body, type) {
  const app = express();
  app.use(express.json());
  app.use('/api/webhooks', webhooks);
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    return await fetch(`http://127.0.0.1:${server.address().port}/api/webhooks/form-lead`, {
      method: 'POST', headers: { 'Content-Type': type }, body, redirect: 'manual',
    });
  } finally {
    server.close();
  }
}

test('a browser posting the form itself (no script) creates the lead and goes back to the form', async () => {
  created.length = 0;
  const res = await post('name=Ann+Lee&email=ann%40example.com&interest=crm&message=Hello+there',
    'application/x-www-form-urlencoded');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/#contact');
  assert.deepEqual(created, [{
    fullName: 'Ann Lee', email: 'ann@example.com', phone: null, source: 'crm_request', status: 'new', notes: 'Hello there',
  }]);
});

test("the page's script posts JSON and gets 201 back, as other callers always have", async () => {
  created.length = 0;
  const res = await post(JSON.stringify({ name: 'Ann', email: 'ann@example.com', interest: 'crm', message: 'Hi' }),
    'application/json');
  assert.equal(res.status, 201);
  assert.equal((await res.json()).success, true);
  assert.equal(created.length, 1);
});

test('no email and no phone is refused, and nothing is created', async () => {
  created.length = 0;
  const res = await post(JSON.stringify({ name: 'Ann', message: 'Hi' }), 'application/json');
  assert.equal(res.status, 400);
  assert.equal(created.length, 0);
});
