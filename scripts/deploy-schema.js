#!/usr/bin/env node
/*
 * Apply the schema from inside Railway, where the internal database host
 * resolves and no credential has to leave the platform.
 *
 * Inert unless RUN_DB_PUSH=1 is set. That is deliberate: this runs on the
 * container's way up, and a schema push that fires on every boot - including
 * every autoscale and every crash-restart - is not something to leave switched
 * on. Set the variable, deploy once, watch the log, unset it.
 *
 * Wire it up as the start command:
 *
 *   node scripts/deploy-schema.js && npm start
 *
 * `prisma db push` is additive here: every column this release adds is either
 * nullable or has a default, so existing rows are untouched. It is not a
 * migration tool and will not drop anything without --accept-data-loss, which
 * is deliberately not passed.
 */
const { execFileSync } = require('child_process');

if (process.env.RUN_DB_PUSH !== '1') {
  console.log('· RUN_DB_PUSH is not set — skipping the schema push.');
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error('✗ RUN_DB_PUSH=1 but DATABASE_URL is not set. Refusing to guess.');
  process.exit(1);
}

const host = (process.env.DATABASE_URL.match(/@([^/?]+)/) || [, 'unknown'])[1];
console.log(`· applying the schema to ${host}`);

try {
  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'], { stdio: 'inherit' });
  console.log('✓ schema is up to date. Unset RUN_DB_PUSH now.');
} catch (err) {
  console.error('✗ schema push failed — the app will not start with a stale schema.');
  process.exit(1);
}
