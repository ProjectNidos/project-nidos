const test = require('node:test');
const assert = require('node:assert/strict');
const { sameDatabaseAs } = require('../../scripts/lib/dev-db');

// Stub file contents only - never a real env file.
const DEV = 'dev.proxy.example:40001';
const file = (name, lines) => ({ name, text: lines.join('\n') });

test('a server env file on another database is no clash', () => {
  assert.equal(sameDatabaseAs(DEV, [
    file('.env.local', ['DATABASE_URL=postgresql://u:p@prod.internal:5432/db', 'DATABASE_PUBLIC_URL="postgresql://u:p@prod.proxy.example:40002/db"']),
    file('.env', ['JWT_SECRET=x']),
  ]), null);
});

test('DATABASE_URL or DATABASE_PUBLIC_URL on the same host:port names the file', () => {
  assert.equal(sameDatabaseAs(DEV, [file('.env.local', ['DATABASE_URL=postgresql://u:p@dev.proxy.example:40001/db'])]), '.env.local');
  assert.equal(sameDatabaseAs(DEV, [
    file('.env.local', ['JWT_SECRET=x']),
    file('.env', ["DATABASE_PUBLIC_URL='postgresql://other:creds@dev.proxy.example:40001/other'\r"]),
  ]), '.env');
});

test('the same host on another port is a different database', () => {
  assert.equal(sameDatabaseAs(DEV, [file('.env.local', ['DATABASE_URL=postgresql://u:p@dev.proxy.example:40009/db'])]), null);
});

test('a commented-out, empty or unparseable value is ignored', () => {
  assert.equal(sameDatabaseAs(DEV, [file('.env', [
    '# DATABASE_URL=postgresql://u:p@dev.proxy.example:40001/db',
    'DATABASE_URL=',
    'DATABASE_PUBLIC_URL=not a url',
  ])]), null);
});
