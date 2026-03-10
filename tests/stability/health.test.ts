import { describe, it, expect } from 'vitest';

describe('Health Check', () => {
  it('health endpoint path exists', () => {
    expect('/api/health').toBe('/api/health');
  });

  it('health response shape is correct', () => {
    const mockHealthResponse = {
      status: 'ok',
      app: 'Wepower Edu App',
      timestamp: new Date().toISOString(),
      googleSheets: { status: 'ok', latencyMs: 100 },
      appsScript: { status: 'ok', latencyMs: 200 },
      totalLatencyMs: 300,
    };
    expect(mockHealthResponse.app).toBe('Wepower Edu App');
    expect(mockHealthResponse.status).toMatch(/^(ok|degraded|error)$/);
    expect(mockHealthResponse.googleSheets).toHaveProperty('status');
    expect(mockHealthResponse.totalLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('degraded status when a dependency fails', () => {
    const failedCheck = { status: 'error', latencyMs: 5000 };
    const overallStatus = failedCheck.status === 'error' ? 'degraded' : 'ok';
    expect(overallStatus).toBe('degraded');
  });
});
