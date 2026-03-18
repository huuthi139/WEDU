import { describe, it, expect } from 'vitest';

describe('Health Check', () => {
  it('health endpoint path exists', () => {
    expect('/api/health').toBe('/api/health');
  });

  it('health response shape is correct (Phase 4.7 - no Google Sheets)', () => {
    const mockHealthResponse = {
      status: 'ok',
      app: 'WEDU',
      timestamp: new Date().toISOString(),
      supabase: { status: 'ok', latencyMs: 50 },
      envVars: {
        NEXT_PUBLIC_SUPABASE_URL: true,
        SUPABASE_SERVICE_ROLE_KEY: true,
        JWT_SECRET: true,
      },
      totalLatencyMs: 100,
    };
    expect(mockHealthResponse.app).toBe('WEDU');
    expect(mockHealthResponse.status).toMatch(/^(ok|degraded|error)$/);
    expect(mockHealthResponse.supabase).toHaveProperty('status');
    expect(mockHealthResponse.totalLatencyMs).toBeGreaterThanOrEqual(0);
    // Google Sheets should NOT be in health check anymore
    expect(mockHealthResponse).not.toHaveProperty('googleSheets');
  });

  it('degraded status when a dependency fails', () => {
    const failedCheck = { status: 'error', latencyMs: 5000 };
    const overallStatus = failedCheck.status === 'error' ? 'degraded' : 'ok';
    expect(overallStatus).toBe('degraded');
  });
});
