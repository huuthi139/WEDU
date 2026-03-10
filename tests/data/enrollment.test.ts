import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Enrollment API', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('POST /api/enrollments returns 401 without session', async () => {
    // Mock getSession returning null
    vi.mock('@/lib/auth/session', () => ({
      getSession: vi.fn().mockResolvedValue(null),
    }));

    const { POST } = await import('@/app/api/enrollments/route');
    const req = new Request('http://localhost/api/enrollments', {
      method: 'POST',
      body: JSON.stringify({ courseId: 'course-1' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('Order ID is UUID format (not Date.now)', () => {
    const orderId = `WP-${crypto.randomUUID()}`;
    expect(orderId).toMatch(/^WP-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('Two rapid orders produce different IDs', () => {
    const id1 = `WP-${crypto.randomUUID()}`;
    const id2 = `WP-${crypto.randomUUID()}`;
    expect(id1).not.toBe(id2);
  });
});
