#!/usr/bin/env node
// `prisma db push` against the development database only. Not `npm run db:push`,
// which goes through scripts/with-env.js and whatever it points at.
const { execFileSync } = require('child_process');
require('./lib/dev-db').useDevDatabase();
execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'], { stdio: 'inherit', env: process.env });
