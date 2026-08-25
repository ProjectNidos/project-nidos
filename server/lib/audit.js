/*
 * The audit trail.
 *
 * Every mutating route calls record() with what it just did. The one rule that
 * shapes this file: an audit write must never break the action it describes.
 * A logging failure is an operator problem, not a user problem - so everything
 * here swallows its errors and reports to the console instead of throwing.
 */
const prisma = require('../prisma');

// Never copy these into before/after, whatever a caller passes.
const REDACTED = ['password', 'token', 'secret'];

function scrub(obj) {
  if (!obj || typeof obj !== 'object') return obj ?? null;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACTED.some((word) => k.toLowerCase().includes(word))) continue;
    // Dates do not survive JSON columns as Dates; store them readable.
    out[k] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

/*
 * Express sees Railway's proxy, so req.ip is the proxy unless trust proxy is
 * set. x-forwarded-for's first entry is the client. Neither is trustworthy
 * enough to make a decision on - it is recorded for human reading only.
 */
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim().slice(0, 45);
  return (req.ip || '').slice(0, 45) || null;
}

/**
 * @param {object} req            the Express request (for actor + ip)
 * @param {object} entry
 * @param {string} entry.action     dotted verb, e.g. "lead.status"
 * @param {string} [entry.entityType]
 * @param {number} [entry.entityId]
 * @param {string} [entry.summary]  human-readable one-liner
 * @param {object} [entry.before]
 * @param {object} [entry.after]
 */
async function record(req, entry) {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType || null,
        entityId: entry.entityId ?? null,
        summary: entry.summary ? String(entry.summary).slice(0, 500) : null,
        before: scrub(entry.before),
        after: scrub(entry.after),
        // entry.actorId is for the routes that know who acted before the auth
        // middleware would: sign-in, most of all.
        actorId: entry.actorId ?? (req && req.user ? req.user.id : null),
        ip: req ? clientIp(req) : null,
      },
    });
  } catch (err) {
    console.error(`Audit write failed (${entry && entry.action}):`, err.message);
  }
}

/*
 * The shape most routes actually want: what changed between two versions of a
 * record, ignoring everything that did not. Returns null when nothing did, so
 * callers can skip writing a no-op entry.
 */
function diff(before, after, fields) {
  const keys = fields || Object.keys({ ...before, ...after });
  const b = {};
  const a = {};
  let changed = false;

  for (const key of keys) {
    const from = before ? before[key] : undefined;
    const to = after ? after[key] : undefined;
    if (from === undefined && to === undefined) continue;

    const norm = (v) => (v instanceof Date ? v.getTime() : v);
    if (norm(from) === norm(to)) continue;

    b[key] = from ?? null;
    a[key] = to ?? null;
    changed = true;
  }

  return changed ? { before: b, after: a } : null;
}

module.exports = { record, diff };
