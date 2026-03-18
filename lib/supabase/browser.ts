/**
 * Supabase Client - Browser-side (anon key) for public data access
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseBrowser: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (supabaseBrowser) return supabaseBrowser;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('[Supabase Browser] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }

  supabaseBrowser = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseBrowser;
}
