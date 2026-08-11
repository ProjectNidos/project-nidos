/*
 * Create or reset the CRM admin account.
 *
 * /api/auth/register requires an authenticated admin, so a fresh database has
 * no way to make its first user through the UI - and a database whose admin
 * password is lost has no way to make its next one. This script is that door:
 * run it against the live DATABASE_URL, log in, then do everything else in the
 * CRM itself.
 *
 * Credentials come from the environment, never from a file, so nothing
 * sensitive can be committed by accident. The password is never printed.
 *
 *   DATABASE_URL=postgresql://...  \
 *   ADMIN_EMAIL=you@projectnidos.eu ADMIN_PASSWORD='...' node scripts/seed-admin.js
 *
 * On Railway, `railway run node scripts/seed-admin.js` supplies DATABASE_URL
 * for you - only the two ADMIN_* vars are yours to set.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const prisma = require('../server/prisma');

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const name = (process.env.ADMIN_NAME || 'Admin').trim();

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  if (!email || !password) {
    fail('ADMIN_EMAIL and ADMIN_PASSWORD must both be set.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('ADMIN_EMAIL is not a valid address.');
  }
  // Mirrors the check in server/routes/auth.js so this door is no weaker than
  // the front one.
  if (password.length < 8) {
    fail('ADMIN_PASSWORD must be at least 8 characters.');
  }

  const hashed = await bcrypt.hash(password, 10);

  // Upsert rather than create: the same command then covers both "there is no
  // admin yet" and "the admin password was lost", which are the only two
  // reasons to be running this at all. Role is forced to admin on both paths -
  // an existing non-admin being reset here is being promoted deliberately.
  const existing = await prisma.user.findUnique({ where: { email } });

  const user = await prisma.user.upsert({
    where: { email },
    update: { password: hashed, role: 'admin' },
    create: { email, password: hashed, name, role: 'admin' },
  });

  console.log(existing ? '✓ password reset' : '✓ admin created');
  console.log(`  id:    ${user.id}`);
  console.log(`  email: ${user.email}`);
  console.log(`  role:  ${user.role}`);
  console.log('\nLog in at /login.html. Add further users from the CRM, not from here.');
}

main()
  .catch((err) => {
    // A placeholder DATABASE_URL is the overwhelmingly likely failure, so name
    // it rather than dumping a bare connection error.
    console.error('✗ failed:', err.message);
    if (/ECONNREFUSED|P1001|getaddrinfo/i.test(err.message)) {
      console.error('\n  The database refused the connection. Check DATABASE_URL points at');
      console.error('  the live Railway Postgres, not the placeholder in .env.');
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
