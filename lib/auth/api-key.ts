/**
 * API Key authentication for REST API v1.
 * Validates Bearer token from Authorization header against WEDU_API_KEY env var.
 */
import { NextRequest } from 'next/server';

export interface ApiKeyResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate API key from Authorization header.
 * Expected format: Authorization: Bearer <api-key>
 */
export function validateApiKey(request: NextRequest): ApiKeyResult {
  const apiKey = process.env.WEDU_API_KEY;
  if (!apiKey || apiKey.length < 16) {
    return { valid: false, error: 'API key not configured on server' };
  }

  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Missing or invalid Authorization header. Expected: Bearer <api-key>' };
  }

  const token = authHeader.slice(7);
  if (token !== apiKey) {
    return { valid: false, error: 'Invalid API key' };
  }

  return { valid: true };
}
