import { describe, it, expect } from 'vitest';
import { isSecureBackendMode, getRuntimeModeLabel } from '../../config/runtimeMode';

describe('runtimeMode', () => {
  it('isSecureBackendMode returns true', () => {
    expect(isSecureBackendMode()).toBe(true);
  });

  it('getRuntimeModeLabel returns Persian label', () => {
    const label = getRuntimeModeLabel();
    expect(label).toContain('امن');
  });
});
