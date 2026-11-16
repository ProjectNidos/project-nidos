import { createHash } from 'node:crypto';
import { eventSource, isEventName } from '@/lib/analytics';
import { clientIp, rateLimit } from '@/lib/rateLimit';
import { serviceClient } from '@/lib/supabase';
import { SITE_HOST } from '@/lib/env';
import { log } from '@/lib/log';

/**
 * Analytics ingest. Answers 204 to anything plausible, including bad input:
 * a beacon fires during navigation and an error would only reach the console.
 */
const noContent = () => new Response(null, { status: 204 });
const DEVICES = new Set(['mobile', 'tablet', 'desktop']);
const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview/i;

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export async function POST(req: Request) {
  const salt = process.env.ANALYTICS_SALT;
  if (!salt || !process.env.SUPABASE_URL) return noContent();

  // Only our own pages may report.
  const origin = req.headers.get('origin');
  if (origin) {
    let host = '';
    try {
      host = new URL(origin).host;
    } catch {}
    if (host !== SITE_HOST && host !== req.headers.get('host')) return noContent();
  }

  const ip = clientIp(req.headers);
  if (!rateLimit(`t:${ip}`, 60, 60_000)) return new Response(null, { status: 429 });
  const ua = req.headers.get('user-agent') ?? '';
  if (!ua || BOTS.test(ua)) return noContent();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return noContent();
  }
  if (!isEventName(body.name)) return noContent();

  // Daily-rotating visitor code: counts today's visitors, stores no IP, links nothing across days.
  const day = new Date().toISOString().slice(0, 10);
  const visitor = createHash('sha256').update(`${ip}|${ua}|${day}|${salt}`).digest('hex').slice(0, 32);
  const locale = body.locale === 'en' ? 'en' : body.locale === 'lv' ? 'lv' : null;

  const { error } = await serviceClient()
    .from('site_events')
    .insert({
      name: body.name,
      visitor,
      path: str(body.path, 300),
      locale,
      detail: str(body.detail, 60),
      source: eventSource({ referrer: str(body.referrer, 500), utmSource: str(body.utm_source, 120), selfHost: SITE_HOST }),
      campaign: str(body.utm_campaign, 120),
      device: DEVICES.has(String(body.device)) ? String(body.device) : null,
    });
  if (error) log('warn', 'event_insert_failed', { code: error.code });
  return noContent();
}
