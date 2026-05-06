import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyEdge } from '@/lib/auth-session-edge';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/auth/result',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/approve',
  '/api/auth/deny',
  '/api/email/poll',
  '/api/health',
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith('/_next/')) return true;
  if (pathname === '/favicon.ico') return true;
  if (pathname.startsWith('/downloads/')) return true;
  // /api/alerts POST is auth'd via its own Bearer-token check (see app/api/alerts/route.ts)
  // so external scripts (cron wrappers, watchdogs) can reach it without the mc_auth cookie.
  // Settings endpoint + the UI page stay behind cookie auth.
  if (pathname === '/api/alerts') return true;
  // AWS SNS calls this unauthenticated from their servers when SES bounces
  // happen — the endpoint itself validates it's from SNS by verifying the
  // SigningCertURL origin before acting.
  if (pathname === '/api/ses-bounce') return true;
  return false;
}

function sameOriginRequest(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
  const pathname = request.nextUrl.pathname;
  // External machine-to-machine endpoints validate their own tokens/signatures.
  if (pathname === '/api/alerts' || pathname === '/api/ses-bounce') return true;

  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') return false;

  const origin = request.headers.get('origin');
  if (!origin) return true; // curl/local cron usually has no Origin header.
  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get('host') || request.nextUrl.host;
    return originHost === requestHost;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Same-origin guard for browser write requests ────────────────────────────
  if (pathname.startsWith('/api/') && !sameOriginRequest(request)) {
    return NextResponse.json({ error: 'cross-origin write blocked' }, { status: 403 });
  }

  // ── Auth check ──────────────────────────────────────────────────────────────
  if (!isPublicPath(pathname)) {
    const secret   = process.env.MC_COOKIE_SECRET;
    const cookieVal = request.cookies.get('mc_auth')?.value;

    let authenticated = false;
    if (secret && cookieVal) {
      const session = await verifyEdge(cookieVal, secret);
      authenticated = !!session;
    }

    if (!authenticated) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'authentication required' }, { status: 401 });
      }
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.search = '';
      const next = encodeURIComponent(pathname + request.nextUrl.search);
      loginUrl.searchParams.set('next', next);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── HQ subdomain rewrite ────────────────────────────────────────────────────
  // (Per-user role-based page gating is handled server-side in app/layout.tsx,
  // which can read the users store. Middleware runs on Edge and can't see
  // isAdmin without inflating the cookie. Page gating there is sufficient
  // because every page render passes through the root layout.)
  const hostname = request.headers.get('host') || '';
  const isHQ = hostname.startsWith('hq.');

  if (isHQ) {
    const url = request.nextUrl.clone();
    if (
      !url.pathname.startsWith('/hq') &&
      !url.pathname.startsWith('/api') &&
      !url.pathname.startsWith('/_next')
    ) {
      url.pathname = '/hq' + url.pathname;
      return NextResponse.rewrite(url);
    }
  }

  // Surface the pathname to server components (root layout uses this for
  // role-based page gating).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
