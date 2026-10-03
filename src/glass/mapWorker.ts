/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Liquid-glass map worker — off-main-thread map builds + PNG encode.
 *
 * The controller posts one MapBuildRequest per unique panel geometry; this
 * builds the displacement + specular ImageData via mapMath (DOM-free) and
 * PNG-encodes both on an OffscreenCanvas, posting back Blobs. The controller
 * turns them into blob: object URLs for feImage (Chromium resolves blob:
 * inside backdrop-filter; CSP img-src already allows blob:).
 *
 * Pixel-identical to the sync path: same mapMath, same inputs. A failure
 * here only costs the fallback — the panel keeps its CSS blur base.
 */

import {
  buildDisplacementMap,
  buildSpecularMap,
  computeProfile,
} from './mapMath';

export interface MapBuildRequest {
  key: string;
  kind: 'lens' | 'pane' | 'drop';
  w: number;
  h: number;
  radius: number;
  bezel: number;
  thickness: number;
  specAngle: number;
  specPeak: number;
  cornerExp: number;
  scale: number;
}

export interface MapBuildResponse {
  key: string;
  ok: boolean;
  maxAbs: number;
  dispBlob: Blob | null;
  specBlob: Blob | null;
}

async function encodePNG(img: ImageData): Promise<Blob> {
  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('mapWorker: 2d context unavailable');
  ctx.putImageData(img, 0, 0);
  return await canvas.convertToBlob({ type: 'image/png' });
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage(msg: unknown): void;
};

scope.onmessage = async (e: MessageEvent) => {
  const req = e.data as MapBuildRequest;
  const done = (res: MapBuildResponse) => scope.postMessage(res);
  try {
    const prof = computeProfile(req.bezel, req.thickness);
    let dispBlob: Blob | null = null;
    let maxAbs = 1;
    if (req.kind !== 'pane') {
      const dm = buildDisplacementMap(
        req.w,
        req.h,
        req.radius,
        req.bezel,
        prof,
        req.scale,
        req.cornerExp,
      );
      maxAbs = dm.maxAbs;
      dispBlob = await encodePNG(dm.img);
    }
    const specImg = buildSpecularMap(
      req.w,
      req.h,
      req.radius,
      req.specAngle,
      req.scale,
      req.specPeak,
      req.cornerExp,
    );
    const specBlob = await encodePNG(specImg);
    done({ key: req.key, ok: true, maxAbs, dispBlob, specBlob });
  } catch {
    done({ key: req.key, ok: false, maxAbs: 1, dispBlob: null, specBlob: null });
  }
};
