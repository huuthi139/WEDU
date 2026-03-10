import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
let loginLimiter: Ratelimit | null = null;
let registerLimiter: Ratelimit | null = null;
let apiLimiter: Ratelimit | null = null;

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

export function getLoginLimiter(): Ratelimit {
  if (!loginLimiter) {
    loginLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      prefix: 'wepower:login',
    });
  }
  return loginLimiter;
}

export function getRegisterLimiter(): Ratelimit {
  if (!registerLimiter) {
    registerLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      prefix: 'wepower:register',
    });
  }
  return registerLimiter;
}

export function getApiLimiter(): Ratelimit {
  if (!apiLimiter) {
    apiLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      prefix: 'wepower:api',
    });
  }
  return apiLimiter;
}

export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; retryAfter?: number }> {
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
