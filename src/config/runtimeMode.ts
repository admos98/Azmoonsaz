import { publicEnv } from './env';

export function isSecureBackendMode(): boolean {
  return publicEnv.isSupabaseConfigured;
}

export function getRuntimeModeLabel(): string {
  return isSecureBackendMode() ? 'متصل به بک‌اند امن' : 'حالت آزمایشی محلی';
}

export function shouldUseMockFallback(): boolean {
  return !isSecureBackendMode();
}
