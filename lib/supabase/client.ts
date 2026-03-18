/**
 * Supabase Client - Server-side (service role) for API routes
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | null = null;

/**
 * Create a proxy-aware fetch function if HTTPS_PROXY is set.
 * Node.js native fetch does not respect HTTP(S)_PROXY env vars,
 * so we use undici's ProxyAgent to route requests through the proxy.
 */
function createProxyFetch(): typeof globalThis.fetch | undefined {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxyUrl) return undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProxyAgent, fetch: undiciFetch } = require('undici');
    const agent = new ProxyAgent(proxyUrl);
    return ((url: RequestInfo | URL, init?: RequestInit) =>
      undiciFetch(url, { ...init, dispatcher: agent } as never)) as typeof globalThis.fetch;
  } catch {
    return undefined;
  }
}

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    const missing: string[] = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!serviceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    throw new Error(
      `[Supabase] Thiếu biến môi trường: ${missing.join(', ')}. ` +
      `Vui lòng cấu hình trong Vercel → Project Settings → Environment Variables rồi redeploy.`
    );
  }

  const proxyFetch = createProxyFetch();

  supabaseAdmin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(proxyFetch ? { global: { fetch: proxyFetch } } : {}),
  });

  return supabaseAdmin;
}
