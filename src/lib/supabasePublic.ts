import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '../config/env';

let client: SupabaseClient | null = null;

export function getSupabasePublicClient(): SupabaseClient {
  if (!publicEnv.isSupabaseConfigured) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local.');
  }

  if (!client) {
    client = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return client;
}
