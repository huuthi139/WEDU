import { NextResponse } from 'next/server';

// Handle traditional form POST submission (no JS required)
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return redirectWithError('Vui lòng nhập email và mật khẩu');
    }

    // Call the main login API internally
    const loginUrl = new URL('/api/auth/login', request.url);
    const loginRes = await fetch(loginUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await loginRes.json();

    if (data.success && data.user) {
      // Set user data as cookie so dashboard can read it
      const userJson = JSON.stringify(data.user);
      const encodedUser = Buffer.from(userJson).toString('base64');

      const response = NextResponse.redirect(new URL('/dashboard', request.url));
      response.cookies.set('wedu-user', encodedUser, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        httpOnly: false, // needs to be readable by JS for SPA hydration
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });
      return response;
    }

    return redirectWithError(data.error || 'Đăng nhập thất bại', request.url);
  } catch (error) {
    console.error('Form login error:', error);
    return redirectWithError('Lỗi hệ thống', request.url);
  }
}

function redirectWithError(error: string, baseUrl?: string) {
  const url = new URL('/login.html', baseUrl || 'http://localhost:3000');
  url.searchParams.set('error', error);
  return NextResponse.redirect(url);
}
