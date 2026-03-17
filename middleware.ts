import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getLoginLimiter, getRegisterLimiter, getApiLimiter, checkRateLimit } from '@/lib/rate-limit';

const SESSION_COOKIE = 'wedu-token';

// Routes that require authentication (redirect to /login if no session)
const PROTECTED_PREFIXES = ['/dashboard', '/profile', '/my-courses', '/learn', '/certificates', '/checkout'];
const ADMIN_PREFIXES = ['/admin'];

// Public routes that should redirect to dashboard if already logged in
const AUTH_PAGES = ['/login', '/register'];

async function verifySessionToken(request: NextRequest): Promise<{ email: string; role: string; name: string; level: string } | null> {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) return null;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as { email: string; role: string; name: string; level: string };
  } catch {
    return null;
  }
}

function isAdminRole(role: string): boolean {
  const r = role.toLowerCase().trim();
  return r === 'admin' || r === 'sub_admin';
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // --- Rate limiting ---
  if (pathname.startsWith('/api/auth/login')) {
    const result = await checkRateLimit(getLoginLimiter(), ip);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Quá nhiều lần thử. Vui lòng đợi 1 phút.' }, meta: { requestId: `req_${Date.now()}` } },
        { status: 429 }
      );
    }
  }

  if (pathname.startsWith('/api/auth/register')) {
    const result = await checkRateLimit(getRegisterLimiter(), ip);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Quá nhiều lần đăng ký. Vui lòng đợi 1 phút.' }, meta: { requestId: `req_${Date.now()}` } },
        { status: 429 }
      );
    }
  }

  if (pathname.startsWith('/api/')) {
    const result = await checkRateLimit(getApiLimiter(), ip);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: 'Quá nhiều request. Vui lòng thử lại sau.' }, meta: { requestId: `req_${Date.now()}` } },
        { status: 429 }
      );
    }
  }

  // --- Route protection ---
  const isProtectedPage = PROTECTED_PREFIXES.some(p => pathname.startsWith(p));
  const isAdminPage = ADMIN_PREFIXES.some(p => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some(p => pathname === p);

  if (isProtectedPage || isAdminPage || isAuthPage) {
    const session = await verifySessionToken(request);
    const hasSession = !!session;

    // Protected page without session -> redirect to login
    if ((isProtectedPage || isAdminPage) && !hasSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Admin page: verify admin role from JWT
    if (isAdminPage && hasSession && !isAdminRole(session!.role)) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    // Auth page while logged in -> redirect to dashboard
    if (isAuthPage && hasSession) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // --- Block test endpoint in production ---
  if (pathname === '/api/chapters/test') {
    return NextResponse.json(
      { success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Endpoint không khả dụng' } },
      { status: 404 }
    );
  }

  // --- Security headers ---
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  );
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://images.unsplash.com https://*.googleusercontent.com",
      "frame-src 'self' https://iframe.mediadelivery.net https://player.mediadelivery.net https://video.bunnycdn.com",
      "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://docs.google.com https://sheets.googleapis.com https://*.supabase.co",
    ].join('; ')
  );

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
