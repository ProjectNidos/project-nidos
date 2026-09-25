#!/usr/bin/env node
/*
 * Apply the schema, and import the CMS pages, from inside Railway, where the
 * internal database host resolves and no credential has to leave the
 * platform.
 *
 * Both steps are inert unless their own variable is set:
 *
 *   RUN_DB_PUSH=1     runs `prisma db push`.
 *   RUN_CMS_IMPORT=1  runs scripts/cms-import.js --on-deploy.
 *
 * That is deliberate: this runs on the container's way up, and a step that
 * fires on every boot - including every autoscale and every crash-restart -
 * is not something to leave switched on. Set the variable, deploy once, watch
 * the log, unset it.
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

function pushSchema() {
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
}

if (process.env.RUN_DB_PUSH === '1') pushSchema();
else console.log('· RUN_DB_PUSH is not set — skipping the schema push.');

/* The page import (scripts/cms-import.js) runs here for the same reason the
   push does: inside Railway the database is reachable and no credential leaves
   the platform. It never overwrites (no --replace), so a second run with the
   flag still set only reports that the pages exist. Unlike the push, a refused
   import does not stop the app: the switch is off until someone reads the log,
   and the files keep serving. The timeout is for the same reason: a hung
   import must not hold the app's boot, and the import writes in one
   transaction, so killing it part-way leaves nothing behind. */
if (process.env.RUN_CMS_IMPORT === '1') {
  try {
    execFileSync('node', ['scripts/cms-import.js', '--on-deploy'], { stdio: 'inherit', timeout: 120000 });
    console.log('✓ page import finished. Unset RUN_CMS_IMPORT now.');
  } catch (err) {
    const why = err.code === 'ETIMEDOUT' ? 'timed out after 2 minutes' : 'see above';
    console.error(`✗ page import failed — ${why}. The site keeps serving its files.`);
  }
} else {
  console.log('· RUN_CMS_IMPORT is not set — skipping the page import.');
}
