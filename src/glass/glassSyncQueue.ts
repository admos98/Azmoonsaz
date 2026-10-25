/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Batched dress pipeline for the liquid-glass engine — extracted verbatim from
 * glassController.ts. Owns the dress path (dressPanel → commit) and the map
 * worker plumbing (worker → requestBucketAsync → onWorkerMessage). Engine
 * state lives in glassController; everything the pipeline reaches back for is
 * declared by SyncQueueHost and bound once at engine boot via bindSyncQueue().
 */
import {
  buildFilterMarkup,
  mapCornerExp,
  mapDPR,
  mapScaleFor,
  type LensParams,
} from './lensEngine';
import { CORNER_SHAPE_SUPPORTED, isNestedGlass } from './glassTokens';
import { buildBucketSync, type BucketEntry } from './glassMaps';
import type { MapBuildRequest, MapBuildResponse } from './mapWorker';

export interface PendingPanel {
  el: HTMLElement;
  kind: 'lens' | 'pane' | 'drop';
  w: number;
  h: number;
  radius: number;
  p: LensParams;
  chainBase: string;
  withDim: boolean;
  quickKey: string;
}

/** Engine affordances the dress pipeline reaches back for. Refs stay owned
 *  by glassController and are bound once at mount. */
export interface SyncQueueHost {
  /** dress-shared engine state (owned by glassController; passed at bind). */
  stats: { posted: number; hits: number; worker: number; sync: number };
  MAP_TABLE: Map<string, BucketEntry>;
  FILTERS: Map<string, string>;
  byEl: WeakMap<HTMLElement, string>;
  /** next lg-N filter markup id. */
  filterUid(): string;
  /** boot params, once (identical to the engine's cached read). */
  getParams(): LensParams;
  ensuredContainer(): SVGDefsElement;
  /** chain + de-nest + park engine affordances. */
  chainOf(el: Element, cs: CSSStyleDeclaration): string;
  applyChain(el: HTMLElement, chain: string): void;
  undressNested(el: HTMLElement): void;
  parkOffscreen(el: HTMLElement): void;
  isInExtendedViewport(el: HTMLElement): boolean;
  /** prune dead panels — the engine owns observers/tracked/webglDrawSet. */
  pruneDead(): void;
}

let host: SyncQueueHost;

/** Called by glassController at mount; identity is fixed for the session. */
export function bindSyncQueue(h: SyncQueueHost): void {
  host = h;
}

/** Fire the dress path from outside (the engine's flushSync calls commit). */
export { };
/** Dress one panel from a cached bucket: filter graph + inline chain. */
export function dressPanel(t: PendingPanel, entry: BucketEntry): void {
  const { el, kind, w, h, radius, p, chainBase, withDim, quickKey } = t;
  // Race guard: the panel may have BECOME nested while its maps were building
  // off-thread (a DOM move nests it; the requeue undresses it; then the worker
  // message lands). Dressing here would resurrect a stale inline url() over
  // the stylesheet de-nest rule — undress instead.
  if (isNestedGlass(el)) {
    host.undressNested(el);
    return;
  }
  // Lever A twin: worker maps may resolve while the panel scrolled offscreen
  // (the request posted in-view, the message lands out-of-view). Dressing now
  // would burn a filter on invisible pixels — park (cache stays, re-entry
  // re-dresses from the hit path) instead.
  if (!host.isInExtendedViewport(el)) {
    host.parkOffscreen(el);
    return;
  }
  const mapKey = `${kind}|${w}x${h}|${Math.round(radius)}`;
  const filterKey = `${mapKey}|${withDim ? 1 : 0}|${p.specOpacity}|${p.specSaturation}|${p.dim.toFixed(3)}|${(p.dimLift ?? 0).toFixed(3)}`;
  let id = host.FILTERS.get(filterKey);
  if (!id || !document.getElementById(id)) {
    id = host.filterUid();
    const markup = buildFilterMarkup(id, entry.dispURL, entry.specURL, entry.maxAbs, p, withDim, w, h);
    host.ensuredContainer().insertAdjacentHTML('beforeend', markup);
    host.FILTERS.set(filterKey, id);
  }
  host.byEl.set(el, id);
  host.applyChain(el, `${chainBase} url(#${id})`);
  el.dataset.lastQuickKey = quickKey;
}

/** Apply one panel: cached maps + cached filter graph + inline chain. */
export function commit(t: PendingPanel): void {
  const { kind, w, h, radius } = t;
  const mapKey = `${kind}|${w}x${h}|${Math.round(radius)}`;

  // Cache hit: dress immediately (string ops only — sub-frame).
  const hit = host.MAP_TABLE.get(mapKey);
  if (hit) {
    host.stats.hits++;
    dressPanel(t, hit);
    return;
  }

  // Cache miss: build off the main thread. The panel keeps its CSS
  // blur() + saturate() base until the maps arrive — one repaint, no flash.
  if (requestBucketAsync(t, mapKey)) return;

  // No Worker (very old browser): sync data-URI fallback. Pixel-identical,
  // main-thread cost — the only path that still pays it.
  try {
    host.stats.sync++;
    dressPanel(t, buildBucketSync(kind, w, h, radius));
  } catch {
    /* keep the plain CSS chain */
  }
}

/* ───────────────────── map worker ───────────────────── */

let mapWorker: Worker | null = null;
let workerDead = false;

/** Panels waiting on a map build, by map key. */
const inflight = new Map<string, PendingPanel[]>();

export function worker(): Worker | null {
  if (workerDead) return null;
  if (mapWorker) return mapWorker;
  try {
    const w = new Worker(new URL('./mapWorker.ts', import.meta.url), { type: 'module' });
    w.onmessage = onWorkerMessage;
    // A dead worker must never leave panels lens-less forever: fall back to
    // the sync build once, instead of janking or hanging.
    w.onerror = () => {
      workerDead = true;
      const waiting = Array.from(inflight.values()).flat();
      inflight.clear();
      mapWorker = null;
      for (const t of waiting) {
        try {
          host.stats.sync++;
          dressPanel(t, buildBucketSync(t.kind, t.w, t.h, t.radius));
        } catch {
          /* keep the plain CSS chain */
        }
      }
    };
    mapWorker = w;
    return w;
  } catch {
    workerDead = true;
    return null;
  }
}

/** Post one map build to the worker. Returns false when no Worker exists. */
export function requestBucketAsync(t: PendingPanel, mapKey: string): boolean {
  const queued = inflight.get(mapKey);
  if (queued) {
    queued.push(t);
    return true;
  }
  const w = worker();
  if (!w) return false;
  const p = host.getParams();
  const r =
    t.radius >= 9999
      ? Math.min(t.w, t.h) / 2
      : Math.min(t.radius, Math.min(t.w, t.h) / 2 - 1);
  const req: MapBuildRequest = {
    key: mapKey,
    kind: t.kind,
    w: t.w,
    h: t.h,
    radius: r,
    bezel: p.bezel,
    thickness: p.thickness,
    specAngle: p.specAngle,
    specPeak: p.specPeak,
    cornerExp: mapCornerExp(p.cornerExp, CORNER_SHAPE_SUPPORTED),
    scale: mapDPR() * mapScaleFor(t.w, t.h),
    girihAmp: p.girihAmp ?? 0,
    girihFold: p.girihFold ?? 10,
  };
  try {
    inflight.set(mapKey, [t]);
    w.postMessage(req);
    host.stats.posted++;
  } catch {
    inflight.delete(mapKey);
    return false;
  }
  return true;
}

export function onWorkerMessage(e: MessageEvent): void {
  const res = e.data as MapBuildResponse;
  const waiting = inflight.get(res.key);
  if (!waiting) return;
  inflight.delete(res.key);
  // A failed build falls back to sync — rare, and only for these panels.
  const needDisp = waiting[0]?.kind !== 'pane';
  if (!res.ok || !res.specBlob || (needDisp && !res.dispBlob)) {
    for (const t of waiting) {
      try {
        host.stats.sync++;
        dressPanel(t, buildBucketSync(t.kind, t.w, t.h, t.radius));
      } catch {
        /* keep the plain CSS chain */
      }
    }
    return;
  }
  const entry: BucketEntry = {
    dispURL: res.dispBlob ? URL.createObjectURL(res.dispBlob) : null,
    specURL: URL.createObjectURL(res.specBlob),
    maxAbs: res.maxAbs,
  };
  host.MAP_TABLE.set(res.key, entry);
  for (const t of waiting) {
    if (!t.el.isConnected) continue;
    try {
      host.stats.worker++;
      dressPanel(t, entry);
    } catch {
      /* keep the plain CSS chain */
    }
  }
  host.pruneDead();
}

/** Inflight map size for the ?perf=1 glassStats snapshot. */
export function inflightCount(): number {
  return inflight.size;
}

/** Unmount cleanup: kill the worker, clear the per-key waiters. */
export function terminateWorker(): void {
  mapWorker?.terminate();
  mapWorker = null;
  workerDead = false;
  inflight.clear();
}
