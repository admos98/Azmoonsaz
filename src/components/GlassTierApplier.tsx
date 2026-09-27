/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Glass tier applier — the runtime half of the material-tier system.
 *
 * The boot probe in index.html resolves <html data-glass> once, before first
 * paint, by reading the RAW `azmoonsaz-glass` localStorage key. This module
 * owns that exact key (read AND write, plain string values) so the user's
 * explicit choice actually survives a reload — the previous implementation
 * wrote through usePersistentPreference, which prefixes and JSON-encodes,
 * so the probe never saw the saved tier.
 *
 * 'auto' means "trust the probe" and leaves the attribute untouched.
 */

import { useEffect, useState } from 'react';

/** Shared with the pre-paint boot probe in index.html — deliberately raw
 * (no `azmoonsaz:preference:` prefix, no JSON encoding). Kept module-private:
 * the probe reads it via localStorage, nothing else may touch it. */
const GLASS_TIER_KEY = 'azmoonsaz-glass';

export type GlassTier = 'auto' | 'full' | 'lite' | 'off';

// eslint-disable-next-line react-refresh/only-export-components -- validator travels with the type it guards
export function isGlassTier(value: unknown): value is GlassTier {
  return value === 'auto' || value === 'full' || value === 'lite' || value === 'off';
}

function readGlassTier(): GlassTier {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = window.localStorage.getItem(GLASS_TIER_KEY);
    return isGlassTier(raw) ? raw : 'auto';
  } catch {
    return 'auto';
  }
}

/** Preference hook for the glass tier, backed by the raw boot-probe key. */
// eslint-disable-next-line react-refresh/only-export-components -- consumed by Settings' glass section
export function useGlassTierPreference(): [GlassTier, (tier: GlassTier) => void] {
  const [tier, setTier] = useState<GlassTier>(readGlassTier);

  useEffect(() => {
    try {
      window.localStorage.setItem(GLASS_TIER_KEY, tier);
    } catch {
      // Storage can be unavailable in private/restricted browser contexts;
      // the in-session attribute still applies.
    }
  }, [tier]);

  return [tier, setTier];
}

export default function GlassTierApplier() {
  const [tier] = useGlassTierPreference();

  useEffect(() => {
    if (tier === 'auto') {
      // 'auto' means the boot probe owns the attribute. Without this delete,
      // an explicit lite/off could never be un-chosen: the attribute survived
      // and every later reload re-applied it (the probe only writes when no
      // override key exists — and the override key WAS the lite/off choice).
      delete document.documentElement.dataset.glass;
    } else {
      document.documentElement.dataset.glass = tier;
    }
  }, [tier]);

  return null;
}
