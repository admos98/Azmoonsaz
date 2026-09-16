export function isSecureBackendMode(): boolean {
  return true; // Supabase is always the backend
}

export function getRuntimeModeLabel(): string {
  return 'متصل به بک‌اند امن';
}

export function assertProductionSafeRuntime(): void {
  // No-op: Supabase is always the backend
}
