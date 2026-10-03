/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Map worker — builds displacement + specular maps OFF the main thread and
 * encodes them to PNG blobs on an OffscreenCanvas.
 *
 * Why: the 2026-10 audit measured 30-80ms of MAIN-THREAD PNG encoding per
 * big panel (canvas.toDataURL) — a cold route with 12 unique geometries
 * blocked first paint for hundreds of ms. The worker returns blob: object
 * URLs, which Chromium resolves inside feImage/backdrop-filter (verified
 * empirically; CSP img-src already allows blob: — see vercel.json).
 *
 * Vite bundles this module via `new Worker(new URL('./mapWorker.ts',
 * import.meta.url))` — a same-origin file, satisfying script-src 'self'.
 * If Worker/OffscreenCanvas are unavailable the controller falls back to
 * the synchronous in-page path (lensEngine.imageDataToURL, data URIs).
 */

import {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
} from './mapMath';

export interface MapRequest {
  reqId: number;
  kind: 'lens' | 'pane' | 'drop';
  /** Element CSS px — feImage sizes must match these exactly (audit C1/C2). */
  w: number;
  h: number;
  radius: number;
  bezel: number;
  thickness: number;
  /** Refraction level + scale ratio — not used by the map pixels themselves,
   *  but part of the controller's cache signature (the feDisplacementMap
   *  scale = 2·maxAbs·refraction·scaleRatio is applied at markup time). */
  refraction: number;
  scaleRatio: number;
  specAngle: number;
  specPeak: number;
  cornerExp: number;
  /** map px per CSS px (already resolved against MAX_MAP_SIDE). */
  scale: number;
}

export interface MapResponse {
  reqId: number;
  /** null for `pane` — the nested material never bends (playground parity). */
  dispBlob: Blob | null;
  specBlob: Blob;
  maxAbs: number;
  error?: string;
}

function encodePNG(img: ImageData): Promise<Blob> {
  const canvas = new OffscreenCanvas(img.width, img.height);
  canvas.getContext('2d')!.putImageData(img, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<MapRequest>) => void) | null;
  postMessage: (m: MapResponse) => void;
};

ctx.onmessage = async (e: MessageEvent<MapRequest>) => {
  const q = e.data;
  try {
    const prof = computeProfile(q.bezel, q.thickness);
    let dispBlob: Blob | null = null;
    let maxAbs = 1;
    if (q.kind !== 'pane') {
      const radius = q.kind === 'drop' ? Math.min(q.w, q.h) / 2 : q.radius;
      const dm = buildDisplacementMap(q.w, q.h, radius, q.bezel, prof, q.scale, q.cornerExp);
      maxAbs = dm.maxAbs;
      dispBlob = await encodePNG(dm.img);
    }
    const specBlob = await encodePNG(
      buildSpecularMap(q.w, q.h, q.radius, q.specAngle, q.scale, q.specPeak, q.cornerExp),
    );
    ctx.postMessage({ reqId: q.reqId, dispBlob, specBlob, maxAbs });
  } catch (err) {
    ctx.postMessage({ reqId: q.reqId, dispBlob: null, specBlob: null as unknown as Blob, maxAbs: 1, error: String(err) });
  }
};

export {};
