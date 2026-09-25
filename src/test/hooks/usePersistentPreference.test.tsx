import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  resetWorkspacePreferences,
  usePersistentPreference,
} from '../../hooks/usePersistentPreference';

beforeEach(() => window.localStorage.clear());

describe('usePersistentPreference', () => {
  it('restores, updates, and resets a browser preference', () => {
    window.localStorage.setItem('azmoonsaz:preference:questions:view', JSON.stringify('table'));
    const { result } = renderHook(() =>
      usePersistentPreference<'card' | 'table'>(
        'questions:view',
        'card',
        (value): value is 'card' | 'table' => value === 'card' || value === 'table',
      ),
    );

    expect(result.current[0]).toBe('table');
    act(() => result.current[1]('card'));
    expect(window.localStorage.getItem('azmoonsaz:preference:questions:view')).toBe('"card"');

    act(() => result.current[2]());
    expect(result.current[0]).toBe('card');
  });

  it('resets all mounted workspace preferences together', () => {
    const first = renderHook(() => usePersistentPreference('questions:view', 'table'));
    const second = renderHook(() => usePersistentPreference('students:grade', 'دهم'));

    act(() => first.result.current[1]('card'));
    act(() => second.result.current[1]('نهم'));
    act(() => resetWorkspacePreferences());

    expect(first.result.current[0]).toBe('table');
    expect(second.result.current[0]).toBe('دهم');
  });

  it('falls back safely when stored data is malformed or invalid', () => {
    window.localStorage.setItem('azmoonsaz:preference:density', '{broken');
    const malformed = renderHook(() => usePersistentPreference('density', 'comfortable'));
    expect(malformed.result.current[0]).toBe('comfortable');
    malformed.unmount();

    window.localStorage.setItem('azmoonsaz:preference:view', JSON.stringify('unknown'));
    const invalid = renderHook(() =>
      usePersistentPreference<'card' | 'table'>(
        'view',
        'card',
        (value): value is 'card' | 'table' => value === 'card' || value === 'table',
      ),
    );
    expect(invalid.result.current[0]).toBe('card');
  });
});
