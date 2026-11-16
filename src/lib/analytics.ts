/**
 * Cookieless first-party analytics, shared by the browser beacon and the
 * /api/t ingest route. Nothing is stored on the visitor's device.
 */

export const EVENT_NAMES = ['page_view', 'service_click', 'contact_start', 'contact_submit'] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const isEventName = (v: unknown): v is EventName =>
  typeof v === 'string' && (EVENT_NAMES as readonly string[]).includes(v);

/** Where a visit came from: campaign tag, else referrer host (no www), else null = direct. */
export function eventSource(o: { referrer?: string | null; utmSource?: string | null; selfHost: string }): string | null {
  const utm = o.utmSource?.trim().toLowerCase();
  if (utm) return utm.slice(0, 120);
  if (!o.referrer) return null;
  try {
    const host = new URL(o.referrer).host.toLowerCase().replace(/^www\./, '');
    return host && host !== o.selfHost.replace(/^www\./, '') ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
}

/** Fire-and-forget; measurement never delays or breaks the page. */
export function track(name: EventName, detail?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const w = window.innerWidth;
    const body = JSON.stringify({
      name,
      detail: detail ?? null,
      path: window.location.pathname,
      locale: document.documentElement.lang,
      // Must travel in the body: the request's own Referer is always our site.
      referrer: document.referrer,
      utm_source: params.get('utm_source'),
      utm_campaign: params.get('utm_campaign'),
      device: w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop',
    });
    if (!navigator.sendBeacon?.('/api/t', new Blob([body], { type: 'application/json' }))) {
      void fetch('/api/t', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(
        () => {},
      );
    }
  } catch {
    /* blocked or offline: skip */
  }
}
