import '@testing-library/jest-dom/vitest';

// Node >= 26 ships an experimental, flag-gated global `localStorage` whose
// getter warns and resolves to undefined, and it shadows the jsdom one —
// every suite touching Web Storage then fails with
// "Cannot read properties of undefined (reading 'removeItem')".
// Re-point the global at jsdom's implementation (falls back to an in-memory
// Storage when the jsdom origin has none).
if (typeof window !== 'undefined') {
  try {
    const source =
      window.localStorage ??
      (() => {
        let m: Record<string, string> = {};
        return {
          get length() {
            return Object.keys(m).length;
          },
          key: (i: number) => Object.keys(m)[i] ?? null,
          getItem: (k: string) => (k in m ? m[k] : null),
          removeItem: (k: string) => {
            delete m[k];
          },
          setItem: (k: string, v: string) => {
            m[k] = String(v);
          },
          clear: () => {
            m = {};
          },
        } as Storage;
      })();
    if (globalThis.localStorage !== source) {
      Object.defineProperty(globalThis, 'localStorage', {
        value: source,
        configurable: true,
        writable: true,
      });
    }
  } catch {
    // leave whatever the environment provides
  }
}
