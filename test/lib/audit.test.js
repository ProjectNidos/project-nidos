const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

// record() writes through Prisma; the stub keeps what it was given.
const written = [];
const file = require.resolve(path.join(__dirname, '../../server/prisma'));
require.cache[file] = { id: file, filename: file, loaded: true, exports: { auditLog: { create: async ({ data }) => { written.push(data); } } } };
const audit = require('../../server/lib/audit');

test("an entry records the visitor's address as the trusted proxy saw it, not one the visitor sent", async () => {
  // With trust proxy set (server/lib/rate-limits.js), req.ip is the edge's own
  // entry; the first X-Forwarded-For entry is whatever the visitor typed.
  const req = { ip: '203.0.113.9', headers: { 'x-forwarded-for': '198.51.100.1, 203.0.113.9' } };
  await audit.record(req, { action: 'test.entry' });
  assert.equal(written.at(-1).ip, '203.0.113.9');
});
