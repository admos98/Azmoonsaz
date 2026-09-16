import { describe, it, expect } from 'vitest';
import { publicEnv } from '../../config/env';

describe('publicEnv', () => {
  it('has expected properties', () => {
    expect(publicEnv).toHaveProperty('appUrl');
    expect(publicEnv).toHaveProperty('supabaseUrl');
    expect(publicEnv).toHaveProperty('supabaseAnonKey');
    expect(publicEnv).toHaveProperty('isSupabaseConfigured');
    expect(publicEnv).toHaveProperty('isProduction');
  });

  it('isSupabaseConfigured is boolean', () => {
    expect(typeof publicEnv.isSupabaseConfigured).toBe('boolean');
  });

  it('isProduction is boolean', () => {
    expect(typeof publicEnv.isProduction).toBe('boolean');
  });
});
