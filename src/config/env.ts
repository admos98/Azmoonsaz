export interface PublicEnv {
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  enableMockMode: boolean;
  isSupabaseConfigured: boolean;
  isProduction: boolean;
}

function readEnv(name: string): string {
  return String(import.meta.env[name] || '').trim();
}

function readBooleanEnv(name: string, defaultValue = false): boolean {
  const value = readEnv(name).toLowerCase();
  if (!value) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value);
}

export const publicEnv: PublicEnv = {
  appUrl: readEnv('VITE_APP_URL') || 'http://localhost:3000',
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
  enableMockMode: readBooleanEnv('VITE_ENABLE_MOCK_MODE', false),
  isSupabaseConfigured: Boolean(readEnv('VITE_SUPABASE_URL') && readEnv('VITE_SUPABASE_ANON_KEY')),
  isProduction: Boolean(import.meta.env.PROD),
};

export function assertPublicSupabaseConfigured(): void {
  if (!publicEnv.isSupabaseConfigured) {
    throw new Error('Supabase public env is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
}
