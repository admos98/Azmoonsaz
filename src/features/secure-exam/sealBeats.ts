/**
 * @license SPDX-License-Identifier: Apache-2.0
 *
 * Beat map for the Sealing Ceremony (Meraj P1-a) — the ONE table the JS
 * timeline (SealCeremony.tsx) and the CSS keyframes (exam.css) both honor.
 * Pure data, in its own module so the component file stays a
 * react-refresh-clean component-only export.
 */

/** Stage start offsets in ms from mount. `fold` plays on mount. */
export const SEAL_BEATS: Readonly<{
  fold: 0;
  wax: number;
  stamp: number;
}> = {
  fold: 0,
  wax: 640,
  stamp: 1080,
};

/** stamp → fade-out hold, then the overlay-out keyframe duration. */
export const SEAL_SETTLE_MS = 300;
export const SEAL_FADE_MS = 320;
