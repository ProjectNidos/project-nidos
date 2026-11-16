import 'server-only';

// ponytail: per-process fixed window. Correct for one Railway instance; move to
// Postgres or Redis if the service ever runs more than one replica.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (now >= b.resetAt) buckets.delete(k);
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

/**
 * Client IP. Railway's edge APPENDS the real peer to X-Forwarded-For, so the
 * rightmost entry is the trustworthy one; the leftmost is whatever the client sent.
 */
export function clientIp(h: Headers): string {
  const xff = h.get('x-forwarded-for');
  if (xff) return xff.split(',').pop()!.trim();
  return h.get('x-real-ip') ?? 'unknown';
}
