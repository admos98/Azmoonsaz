import { publicEnv } from './env';

export function isSecureBackendMode(): boolean {
  return publicEnv.isSupabaseConfigured && !publicEnv.enableMockMode;
}

export function getRuntimeModeLabel(): string {
  if (isSecureBackendMode()) return 'متصل به بک‌اند امن';
  if (publicEnv.enableMockMode) return 'حالت آزمایشی محلی';
  return 'بک‌اند تنظیم نشده';
}

export function shouldUseMockFallback(): boolean {
  return publicEnv.enableMockMode || !publicEnv.isSupabaseConfigured;
}

export function assertProductionSafeRuntime(): void {
  if (publicEnv.isProduction && !isSecureBackendMode()) {
    throw new Error('Production requires secure backend mode. Configure Supabase env variables and keep VITE_ENABLE_MOCK_MODE=false.');
  }
}
