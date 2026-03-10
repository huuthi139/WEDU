import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getLoginLimiter, getRegisterLimiter, getApiLimiter, checkRateLimit } from '@/lib/rate-limit';

const SESSION_COOKIE = 'wepower-token';

// Helper: verify JWT token from cookie
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // --- Rate limiting (Upstash Redis) ---
  if (pathname.startsWith('/api/auth/login')) {
    const result = await checkRateLimit(getLoginLimiter(), ip);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều lần thử. Vui lòng đợi 1 phút.', retryAfter: result.retryAfter },
        { status: 429 }
      );
    }
  }

  if (pathname.startsWith('/api/auth/register')) {
    const result = await checkRateLimit(getRegisterLimiter(), ip);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều lần đăng ký. Vui lòng đợi 1 phút.', retryAfter: result.retryAfter },
        { status: 429 }
      );
    }
  }

  // General API rate limiting
  if (pathname.startsWith('/api/')) {
    const result = await checkRateLimit(getApiLimiter(), ip);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Quá nhiều request. Vui lòng thử lại sau.', retryAfter: result.retryAfter },
        { status: 429 }
      );
    }
  }

  // --- Admin-only endpoints (JWT verification) ---
  if (pathname === '/api/auth/users') {
    const session = await verifySessionToken(request);
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Không có quyền truy cập' },
        { status: 403 }
      );
    }
  }

  // --- Block test endpoint in production ---
  if (pathname === '/api/chapters/test') {
    return NextResponse.json(
      { success: false, error: 'Endpoint không khả dụng' },
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
      "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://docs.google.com https://sheets.googleapis.com",
    ].join('; ')
  );

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
