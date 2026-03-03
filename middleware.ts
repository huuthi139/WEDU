import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiter (per-IP, per-route)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;
  return entry.count > maxRequests;
}

// Periodically clean up old entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 60_000);

// Helper: extract user from cookie for admin checks
function getUserFromCookie(request: NextRequest): { role?: string } | null {
  try {
    const cookie = request.cookies.get('wepower-user');
    if (!cookie?.value) return null;
    const decoded = Buffer.from(cookie.value, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

  // --- Rate limiting ---
  // Strict limits for auth endpoints (prevent brute force)
  if (pathname.startsWith('/api/auth/login')) {
    const key = `login:${ip}`;
    if (isRateLimited(key, 10, 60_000)) { // 10 requests/minute
      return NextResponse.json(
        { success: false, error: 'Quá nhiều lần thử. Vui lòng đợi 1 phút.' },
        { status: 429 }
      );
    }
  }

  if (pathname.startsWith('/api/auth/register')) {
    const key = `register:${ip}`;
    if (isRateLimited(key, 5, 60_000)) { // 5 requests/minute
      return NextResponse.json(
        { success: false, error: 'Quá nhiều lần đăng ký. Vui lòng đợi 1 phút.' },
        { status: 429 }
      );
    }
  }

  // General API rate limiting
  if (pathname.startsWith('/api/')) {
    const key = `api:${ip}`;
    if (isRateLimited(key, 100, 60_000)) { // 100 requests/minute
      return NextResponse.json(
        { success: false, error: 'Quá nhiều request. Vui lòng thử lại sau.' },
        { status: 429 }
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
