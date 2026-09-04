/*
 * Runtime settings, with the previously-hardcoded values as defaults.
 *
 * Nothing here is required to exist in the database. An empty Setting table
 * behaves exactly like the constants that used to live in gate.js and
 * webhooks.js, so this can ship before anyone touches the admin panel.
 *
 * Values are cached in-process and invalidated on write. On a multi-instance
 * deploy each instance would carry its own copy for up to TTL - hence the TTL,
 * which is the cheap version of a cache-invalidation channel.
 */
const prisma = require('../prisma');

const TTL_MS = 30 * 1000;

const DEFAULTS = {
  /* The public-site gate. Client-side only: whatever password is set here is
     served to every visitor in plaintext (see gate.js). It is a deterrent for
     casual visitors while the site is unfinished, and nothing more. */
  'gate.enabled': true,
  'gate.password': '0607',

  /* Keyed on the <select> option VALUES the public form emits, never on its
     labels - the labels are translated per language, the values are not. This
     mapping has already broken once by drifting from the form (commit ca75b95),
     which is exactly why it is editable and visible now. */
  'leads.interestMap': {
    crm: 'digitalisation',
    pardosana: 'digitalisation',
    'klientu-apkalposana': 'digitalisation',
    integracijas: 'digitalisation',
    ai: 'digitalisation',
    'e-komercija': 'digitalisation',
    cits: 'general',
  },

  /* Pipeline stages. Order is display order; the ids are what the database
     stores and what crm.css keys its status pills on, so renaming an id needs
     a data migration - the admin UI only lets labels change. */
  'leads.statuses': [
    { id: 'new', label: 'New' },
    { id: 'contacted', label: 'Contacted' },
    { id: 'qualified', label: 'Qualified' },
    { id: 'proposal_sent', label: 'Proposal Sent' },
    { id: 'won', label: 'Won' },
    { id: 'lost', label: 'Lost' },
  ],

  /* Reserved: addresses to notify when a website enquiry lands. Nothing sends
     mail yet - the setting exists so the wiring has somewhere to read from. */
  'notify.emails': [],
};

let cache = null;
let cachedAt = 0;

async function load() {
  const fresh = Date.now() - cachedAt < TTL_MS;
  if (cache && fresh) return cache;

  try {
    const rows = await prisma.setting.findMany();
    const stored = {};
    for (const row of rows) stored[row.key] = row.value;
    cache = { ...DEFAULTS, ...stored };
  } catch (err) {
    // A missing table (fresh database, db push not yet run) must not take the
    // site down - the defaults are the values the code shipped with anyway.
    console.error('Settings load failed, using defaults:', err.message);
    cache = { ...DEFAULTS };
  }

  cachedAt = Date.now();
  return cache;
}

async function get(key) {
  const all = await load();
  return all[key];
}

async function all() {
  return { ...(await load()) };
}

async function set(key, value, actorEmail) {
  if (!Object.prototype.hasOwnProperty.call(DEFAULTS, key)) {
    throw new Error(`Unknown setting: ${key}`);
  }
  await prisma.setting.upsert({
    where: { key },
    update: { value, updatedBy: actorEmail || null },
    create: { key, value, updatedBy: actorEmail || null },
  });
  invalidate();
}

function invalidate() {
  cache = null;
  cachedAt = 0;
}

module.exports = { get, all, set, invalidate, DEFAULTS };
