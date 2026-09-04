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

/* Captured before any dotenv call, so it means "the caller exported this or
   put it on the command line" and not "a file set it". See the guard below. */
const SHELL_DATABASE_URL = process.env.DATABASE_URL;

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

/*
 * The guard: this used to be unconditional, which meant a deliberate
 * `DATABASE_URL=<dummy> npm run dev` was silently rewritten to the live
 * Railway database - the prefix is set before node starts, so it looked
 * respected right up until something wrote a row. An audit created two junk
 * leads in production that way on 2026-09-04.
 *
 * An explicitly exported DATABASE_URL now wins. `.env.local` still supplies the
 * public URL when the caller has not asked for anything in particular, which is
 * the ordinary case this was written for.
 */
const publicUrl = (local.DATABASE_PUBLIC_URL || '').trim();

if (SHELL_DATABASE_URL && SHELL_DATABASE_URL !== publicUrl) {
  process.env.DATABASE_URL = SHELL_DATABASE_URL;
  // Only worth saying when there was something to ignore. In production there
  // is no .env.local, and the caller's DATABASE_URL is simply the right answer.
  if (publicUrl) console.warn('[env] DATABASE_URL came from the shell; ignoring DATABASE_PUBLIC_URL in .env.local');
} else if (publicUrl) {
  process.env.DATABASE_URL = publicUrl;
  console.warn('[env] connecting via DATABASE_PUBLIC_URL from .env.local - this is the LIVE database');
}

module.exports = { ROOT };
