import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta: { requestId: string };
}

export interface ApiErrorResponse {
  success: false;
  error: { code: string; message: string };
  meta: { requestId: string };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

function requestId(): string {
  return `req_${randomUUID().slice(0, 12)}`;
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    { success: true as const, data, meta: { requestId: requestId() } },
    { status }
  );
}

export function apiError(code: string, message: string, status: number): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { success: false as const, error: { code, message }, meta: { requestId: requestId() } },
    { status }
  );
}

// Standard error codes
export const ERR = {
  UNAUTHORIZED: (msg = 'Bạn cần đăng nhập để tiếp tục') => apiError('AUTH_UNAUTHORIZED', msg, 401),
  FORBIDDEN: (msg = 'Bạn không có quyền thực hiện hành động này') => apiError('AUTH_FORBIDDEN', msg, 403),
  INVALID_CREDENTIALS: () => apiError('AUTH_INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng', 401),
  SESSION_EXPIRED: () => apiError('AUTH_SESSION_EXPIRED', 'Phiên đăng nhập đã hết hạn', 401),
  VALIDATION: (msg: string) => apiError('VALIDATION_ERROR', msg, 422),
  NOT_FOUND: (msg = 'Không tìm thấy tài nguyên') => apiError('RESOURCE_NOT_FOUND', msg, 404),
  CONFLICT: (msg = 'Xung đột dữ liệu') => apiError('RESOURCE_CONFLICT', msg, 409),
  RATE_LIMITED: (msg = 'Quá nhiều request, vui lòng thử lại sau') => apiError('RATE_LIMITED', msg, 429),
  INTERNAL: (msg = 'Lỗi hệ thống, vui lòng thử lại') => apiError('INTERNAL_ERROR', msg, 500),
} as const;
