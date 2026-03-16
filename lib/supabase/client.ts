/**
 * Supabase Client - Server-side (service role) for API routes
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | null = null;

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

  supabaseAdmin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
}
