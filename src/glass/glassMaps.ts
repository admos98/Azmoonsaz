/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Panel map tables for the liquid-glass engine — extracted verbatim from
 * glassController.ts. Owns the lazily-built exact-size map cache (MAP_TABLE)
 * and the filter-markup cache (FILTERS). Pure data + build functions; the
 * engine (glassController) and the sync queue (glassSyncQueue) read from here.
 */
import {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
  imageDataToURL,
  mapCornerExp,
  mapDPR,
  mapScaleFor,
  type LensParams,
} from './lensEngine';
import { CORNER_SHAPE_SUPPORTED, readParams } from './glassTokens';

export interface BucketEntry {
  dispURL: string | null; // null for 'pane' (rim-only by design)
  specURL: string;
  maxAbs: number;
}

export const MAP_TABLE = new Map<string, BucketEntry>();

/** `${kind}|${w}x${h}|${radius}|${withDim}|${specOpacity}|${specSat}|${dim…}` -> dressed filter markup */
export const FILTERS = new Map<string, string>();

/** Params read once from the document root — identical to the engine's boot read. */
let defaultParams: LensParams | null = null;

/** Build one panel's exact-size map pair once; reuse thereafter. Cheap —
 *  a 200x400 panel is one 80k px loop, sub-frame. Cards/rows of the same
 *  size share the single cached entry.
 *
 *  ASYNC path: posts to mapWorker, resolves with blob: URLs when the maps
 *  arrive. The sync data-URI build below is the no-Worker fallback only —
 *  pixels are identical (same mapMath, same inputs). */
export function buildBucketSync(kind: 'lens' | 'pane' | 'drop', w: number, h: number, radius: number): BucketEntry {
  // key on exact size — every panel gets the rim and corners at its own
  // geometry (playground contract). Tween-storm on resize is already killed
  // by the quantized idempotent key in sync().
  const key = `${kind}|${w}x${h}|${Math.round(radius)}`;
  const hit = MAP_TABLE.get(key);
  if (hit) return hit;
  const p = defaultParams ?? (defaultParams = readParams());
  const cornerExp = mapCornerExp(p.cornerExp, CORNER_SHAPE_SUPPORTED);
  const prof = computeProfile(p.bezel, p.thickness);
  const r = radius >= 9999 ? Math.min(w, h) / 2 : Math.min(radius, Math.min(w, h) / 2 - 1);
  // Map resolution contract (playground parity): build the maps at the
  // display DPR (1..2 device px per CSS px), capped by MAX_MAP_SIDE. feImage
  // then paints them at W×H CSS px, so the rim lands exactly on the border at
  // full density. Building at scale 1 made every rim a 1x bitmap upscaled by
  // the browser on a 2x display — the soft, "low quality" ring.
  const scale = mapDPR() * mapScaleFor(w, h);
  let dispURL: string | null = null;
  let maxAbs = 1;
  if (kind !== 'pane') {
    const dm = buildDisplacementMap(w, h, r, p.bezel, prof, scale, cornerExp);
    maxAbs = dm.maxAbs;
    dispURL = imageDataToURL(dm.img);
  }
  const specURL = imageDataToURL(
    buildSpecularMap(w, h, r, p.specAngle, scale, p.specPeak, cornerExp),
  );
  const entry: BucketEntry = { dispURL, specURL, maxAbs };
  MAP_TABLE.set(key, entry);
  return entry;
}

/** Revoke every blob: URL the map table owns (engine teardown). */
export function revokeAllBlobs(): void {
  for (const entry of MAP_TABLE.values()) {
    if (entry.dispURL?.startsWith('blob:')) URL.revokeObjectURL(entry.dispURL);
    if (entry.specURL.startsWith('blob:')) URL.revokeObjectURL(entry.specURL);
  }
  FILTERS.clear();
  MAP_TABLE.clear();
}
