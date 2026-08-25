/*
 * Environment loading, in one place.
 *
 * dotenv has no notion of `.env.local` - that convention comes from Next.js
 * and Vite. Left to itself, `require('dotenv').config()` reads `.env` and
 * nothing else, so a DATABASE_URL sitting in `.env.local` would be silently
 * ignored and you would spend a while wondering why the placeholder was still
 * winning.
 *
 * Order matters: `.env` first for the shared defaults, then `.env.local` with
 * override, so the local file wins on any key it defines and stays silent on
 * the rest.
 *
 * Requiring this module has the side effect. That is the point - `require
 * ('./scripts/env')` replaces `require('dotenv').config()`.
 */
const path = require('path');
const dotenv = require('dotenv');

const ROOT = path.join(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.local'), override: true });

/*
 * Railway's Postgres service publishes two connection strings, and pasting
 * both is the natural thing to do - they sit next to each other on the same
 * screen. DATABASE_URL points at postgres.railway.internal, which resolves
 * only inside Railway; DATABASE_PUBLIC_URL goes through the TCP proxy and is
 * the one that works from a laptop.
 *
 * So: if .env.local names a public URL, that is what a local process should
 * connect with. Scoped to .env.local deliberately - that file is gitignored
 * and excluded from the Docker image, so this can never redirect production
 * traffic out through the public proxy.
 */
const local = dotenv.config({ path: path.join(ROOT, '.env.local') }).parsed || {};

if (local.DATABASE_PUBLIC_URL && local.DATABASE_PUBLIC_URL.trim()) {
  process.env.DATABASE_URL = local.DATABASE_PUBLIC_URL.trim();
}

module.exports = { ROOT };
