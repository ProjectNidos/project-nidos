#!/usr/bin/env node
/*
 * Run a command with .env + .env.local loaded.
 *
 * The Prisma CLI reads `.env` by itself and knows nothing about `.env.local`,
 * so `npx prisma db push` would use the placeholder in `.env` rather than the
 * connection string you actually pasted. This wrapper loads both and hands the
 * merged environment to the child.
 *
 *   node scripts/with-env.js npx prisma db push
 */
require('./env');
const { spawn } = require('child_process');

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('usage: node scripts/with-env.js <command> [args...]');
  process.exit(1);
}

if (!process.env.DATABASE_URL || /^\s*$/.test(process.env.DATABASE_URL)) {
  console.error('✗ DATABASE_URL is empty.');
  console.error('  Paste Railway\'s DATABASE_PUBLIC_URL into .env.local, then try again.');
  process.exit(1);
}
if (process.env.DATABASE_URL.includes('${{')) {
  console.error('✗ DATABASE_URL is a Railway variable reference, not a connection string.');
  console.error('  ${{Postgres.DATABASE_URL}} only expands inside Railway. Copy the');
  console.error('  resolved DATABASE_PUBLIC_URL value into .env.local instead.');
  process.exit(1);
}

spawn(command, args, { stdio: 'inherit', shell: process.platform === 'win32' })
  .on('exit', (code) => process.exit(code ?? 1));
