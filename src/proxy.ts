import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

const intl = createIntlMiddleware(routing);

function contentSecurityPolicy(nonce: string): string {
  const dev = process.env.NODE_ENV === 'development';
  const https = (process.env.SITE_URL ?? 'https://projectnidos.eu').startsWith('https://');
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? ` 'unsafe-eval'` : ''}`,
    // Inline style attributes only; no inline scripts can run without the nonce.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `media-src 'self'`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    ...(https && !dev ? ['upgrade-insecure-requests'] : []),
  ].join('; ');
}

export async function proxy(request: NextRequest) {
  // Per-request CSP nonce: Next reads it from the request header and stamps its scripts.
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  request.headers.set('x-nonce', nonce);
  request.headers.set('content-security-policy', csp);
  request.headers.set('x-request-id', requestId);

  const { pathname } = request.nextUrl;
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  const response = isAdmin ? NextResponse.next({ request: { headers: request.headers } }) : intl(request);
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Request-Id', requestId);
  // NOINDEX=1 on preview deploys keeps them out of search results.
  if (isAdmin || process.env.NOINDEX === '1') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  if (!isAdmin) return response;

  response.headers.set('Cache-Control', 'no-store');
  // Server Actions check the admin themselves; skip the extra round trip.
  if (request.method === 'POST' && request.headers.has('next-action')) return response;

  // Refresh the Supabase session cookies onto this response (browser-session scoped).
  // No database configured or reachable: treated as signed out.
  let signedIn = false;
  try {
    const supabase = createServerClient(process.env.SUPABASE_URL ?? '', process.env.SUPABASE_PUBLISHABLE_KEY ?? '', {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, { ...options, maxAge: undefined, expires: undefined }),
          ),
      },
    });
    signedIn = Boolean((await supabase.auth.getUser()).data.user);
  } catch {
    signedIn = false;
  }
  if (!signedIn && pathname !== '/admin/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Pages only: not API routes, Next assets, or files with an extension.
  // Prefetches must pass too: next-intl maps "/" to the Latvian page for them as well.
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
