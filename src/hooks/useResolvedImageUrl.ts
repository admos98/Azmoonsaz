/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useEffect, useState } from 'react';
import {
  isImageStoreKey,
  isLegacyImageValue,
  resolveTeacherImageUrls,
} from '../services/imageStoreClient';

/** Module-level cache: key → signed URL (refreshed per mount when missing). */
const urlCache = new Map<string, string>();
const pending = new Map<string, Promise<Record<string, string>>>();

function batchResolve(keys: string[]): Promise<Record<string, string>> {
  const batchKey = [...keys].sort().join('|');
  const existing = pending.get(batchKey);
  if (existing) return existing;
  const promise = resolveTeacherImageUrls(keys)
    .then((urls) => {
      for (const [key, url] of Object.entries(urls)) urlCache.set(key, url);
      return urls;
    })
    .finally(() => {
      pending.delete(batchKey);
    });
  pending.set(batchKey, promise);
  return promise;
}

/**
 * Resolve one image value to a displayable src.
 * - Storage keys → signed URL (cached, fetched once).
 * - Legacy data:/https: values → passed through (grandfathered rows).
 * - Empty → null.
 */
export function useResolvedImageUrl(value: string | undefined | null): {
  src: string | null;
  loading: boolean;
  isLegacy: boolean;
} {
  const key = isImageStoreKey(value) ? value : null;
  // Async fill only — every synchronous case is derived during render below,
  // so the effect body never calls setState directly.
  const [fetchResult, setFetchResult] = useState<{ key: string; url: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (!key || urlCache.has(key)) return;
    let cancelled = false;
    batchResolve([key])
      .then((urls) => {
        if (!cancelled) setFetchResult({ key, url: urls[key] || null });
      })
      .catch(() => {
        if (!cancelled) setFetchResult({ key, url: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!value) return { src: null, loading: false, isLegacy: false };
  if (isLegacyImageValue(value)) return { src: value, loading: false, isLegacy: true };
  if (!key) return { src: null, loading: false, isLegacy: false };
  const cached = urlCache.get(key);
  if (cached) return { src: cached, loading: false, isLegacy: false };
  if (fetchResult && fetchResult.key === key)
    return { src: fetchResult.url, loading: false, isLegacy: false };
  return { src: null, loading: true, isLegacy: false };
}

/** Prefetch signed URLs for a set of keys (list views). */
export function prefetchImageUrls(keys: string[]): void {
  const missing = keys.filter((k) => isImageStoreKey(k) && !urlCache.has(k)).slice(0, 50);
  if (missing.length === 0) return;
  void batchResolve(missing).catch(() => {});
}
