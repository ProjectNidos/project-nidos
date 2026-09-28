const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { applyRateLimits } = require('../../server/lib/rate-limits');

// n requests in a row from one address, through the limits as server.js mounts them.
async function statuses(url, n) {
  const app = express();
  applyRateLimits(app);
  app.use((req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const out = [];
    for (let i = 0; i < n; i += 1) out.push((await fetch(`http://127.0.0.1:${server.address().port}${url}`)).status);
    return out;
  } finally {
    server.close();
  }
}

test("the admin's requests count against its own allowance, not the public API's 100", async () => {
  const seen = await statuses('/api/admin/pages', 150);
  assert.equal(seen.filter((s) => s === 429).length, 0);
});

test('the public API still stops after 100 in the window', async () => {
  const seen = await statuses('/api/leads', 101);
  assert.deepEqual([seen[99], seen[100]], [200, 429]);
});

// Behind Railway's edge the connection is the proxy's, so keying on it put every
// visitor in one bucket. The edge's own entry, last in X-Forwarded-For, is the
// visitor's address; anything a visitor sends in that header comes before it.
async function replies(n, { ip, type = 'application/json', body = '{}' } = {}) {
  const app = express();
  applyRateLimits(app, { behindProxy: true });
  app.use((req, res) => res.json({ ok: true }));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  try {
    const out = [];
    for (let i = 0; i < n; i += 1) {
      const headers = { 'Content-Type': type, 'X-Forwarded-For': typeof ip === 'function' ? ip(i) : ip };
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/webhooks/form-lead`, { method: 'POST', headers, body });
      out.push({ status: res.status, type: res.headers.get('content-type') || '', text: await res.text() });
    }
    return out;
  } finally {
    server.close();
  }
}

test('visitors are limited one by one, not all together behind the proxy', async () => {
  const seen = await replies(11, { ip: (i) => `203.0.113.${i + 1}` });
  assert.equal(seen.filter((r) => r.status === 429).length, 0);
});

test('one visitor is still stopped after 10 messages in the window', async () => {
  const seen = await replies(11, { ip: '203.0.113.7' });
  assert.deepEqual([seen[9].status, seen[10].status], [200, 429]);
});

test("a visitor cannot pick their own address to get round the limit", async () => {
  const seen = await replies(11, { ip: (i) => `198.51.100.${i + 1}, 203.0.113.9` });
  assert.equal(seen[10].status, 429);
});

test('a plain post that is refused gets a sentence with another way to reach us', async () => {
  const seen = await replies(11, { ip: '203.0.113.8', type: 'application/x-www-form-urlencoded', body: 'email=a%40b.c' });
  const refused = seen[10];
  assert.equal(refused.status, 429);
  assert.match(refused.type, /^text\/plain/);
  assert.match(refused.text, /support@projectnidos\.eu/);
});
