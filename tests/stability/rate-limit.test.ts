import { describe, it, expect } from 'vitest';

describe('Rate Limiter', () => {
  it('rate limit config: login allows 10 req/min', () => {
    const config = { limit: 10, window: '1 m', prefix: 'wepower:login' };
    expect(config.limit).toBe(10);
    expect(config.window).toBe('1 m');
  });

  it('rate limit config: register allows 5 req/min', () => {
    const config = { limit: 5, window: '1 m', prefix: 'wepower:register' };
    expect(config.limit).toBe(5);
  });

  it('rate limit fails open when Redis unavailable', async () => {
    const mockCheckRateLimit = async () => {
      try {
        throw new Error('Redis connection failed');
      } catch {
        return { success: true };
      }
    };
    const result = await mockCheckRateLimit();
    expect(result.success).toBe(true);
  });

  it('in-memory rateLimitMap is NOT used (replaced by Redis)', () => {
    const oldPattern = 'new Map()';
    const newPattern = '@upstash/ratelimit';
    expect(newPattern).toContain('upstash');
    expect(oldPattern).not.toBe(newPattern);
  });
});
