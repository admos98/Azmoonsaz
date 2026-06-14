export interface PublicEnv {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  isSupabaseConfigured: boolean;
}

function readEnv(name: string): string {
  return String(import.meta.env[name] || '').trim();
}

export const publicEnv: PublicEnv = {
  appUrl: readEnv('VITE_APP_URL') || 'http://localhost:3000',
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
  isSupabaseConfigured: Boolean(readEnv('VITE_SUPABASE_URL') && readEnv('VITE_SUPABASE_ANON_KEY')),
};

export function assertPublicSupabaseConfigured(): void {
  if (!publicEnv.isSupabaseConfigured) {
    throw new Error('Supabase public env is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
}
