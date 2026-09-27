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
