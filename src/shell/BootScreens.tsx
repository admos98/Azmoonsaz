/**
 * @license SPDX-License-Identifier: Apache-2.0
 */

import { BubbleLoader } from '../components/BubbleLoader';

/** Full-page boot state. Used for the auth handshake and as the Suspense
 *  fallback on route-level code boundaries. */
export function BootScreen({ label }: { label: string }) {
  return (
    <div
      className="grid min-h-dvh place-items-center bg-[var(--color-page-bg)]"
      role="status"
      aria-label={label}
    >
      <div className="space-y-4 text-center">
        <BubbleLoader label={null} />
        <p className="text-label text-[var(--color-text-secondary)]">{label}</p>
      </div>
    </div>
  );
}

/** Route-level Suspense fallback: the page skeleton (topbar slot, hero card,
 *  five stat tiles, lower card) — keeps the shell rhythm while data loads. */
export function PageSkeleton() {
  return (
    <div className="space-y-6" id="page-skeleton">
      <div className="h-8 w-48 bg-[var(--color-glass-light-fill)] skeleton rounded-xl" />
      <div className="h-40 bg-[var(--color-glass-light-fill)] skeleton rounded-3xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-32 bg-[var(--color-glass-light-fill)] skeleton rounded-3xl"
          />
        ))}
      </div>
      <div className="h-60 bg-[var(--color-glass-light-fill)] skeleton rounded-3xl" />
    </div>
  );
}
