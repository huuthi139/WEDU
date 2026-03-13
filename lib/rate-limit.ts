import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
let loginLimiter: Ratelimit | null = null;
let registerLimiter: Ratelimit | null = null;
let apiLimiter: Ratelimit | null = null;
let redisConfigMissing = false;

function getRedis(): Redis | null {
  if (redisConfigMissing) return null;

  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      redisConfigMissing = true;
      console.warn('[RateLimit] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not configured. Rate limiting disabled.');
      return null;
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

export function getLoginLimiter(): Ratelimit | null {
  if (!loginLimiter) {
    const r = getRedis();
    if (!r) return null;
    loginLimiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'wepower:login',
    });
  }
  return loginLimiter;
}

export function getRegisterLimiter(): Ratelimit | null {
  if (!registerLimiter) {
    const r = getRedis();
    if (!r) return null;
    registerLimiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'wepower:register',
    });
  }
  return registerLimiter;
}

export function getApiLimiter(): Ratelimit | null {
  if (!apiLimiter) {
    const r = getRedis();
    if (!r) return null;
    apiLimiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      prefix: 'wepower:api',
    });
  }
  return apiLimiter;
}

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; retryAfter?: number }> {
  if (!limiter) return { success: true };

  try {
    const result = await limiter.limit(identifier);
    if (!result.success) {
      return {
        success: false,
        retryAfter: Math.round((result.reset - Date.now()) / 1000),
      };
    }
    return { success: true };
  } catch (error) {
    console.error('[RateLimit] Redis error, failing open:', error);
    return { success: true };
  }
}
