/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * In-page frame-timing recorder — the "you drive the app, it measures" probe.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every performance claim about the liquid-glass engine so far has been a
 * guess. The headless tools/*.mjs probes run in Playwright with no GPU url()
 * paint, so they cannot see what a human sees. This runs in the REAL browser,
 * in the REAL session, while the user actually drives the app — and it labels
 * every slow frame with what was on screen and what was moving, so a spike
 * reads as "scrolling 2400px/s · 18 filters · 2.1M url-px · no longtask"
 * instead of a meaningless timestamp.
 *
 * COST WHEN OFF
 * -------------
 * Zero. Nothing is installed unless the URL carries ?perf=1, so the production
 * bundle pays one `new URLSearchParams` at import time and nothing else. No
 * observer, no rAF loop, no listeners.
 *
 * HOW TO USE
 * ----------
 *   1. Open the deployed app with `?perf=1` appended:
 *        https://azmoon-three.vercel.app/?perf=1
 *   2. A small panel appears bottom-right. Press **Record**, then do the
 *      things that feel slow for a couple of minutes (scroll the questions
 *      list, sit still on it, open the hamburger, navigate routes).
 *   3. Press **Stop**, then **Copy report** (or **Download**).
 *   4. Paste / attach the report back in chat.
 *
 *   ON IPHONE/IPAD SAFARI (no console, no Web Inspector without a Mac):
 *   the same panel works — open the app URL with ?perf=1 (e.g. the teacher
 *   dashboard you use), tap Record, drive the app, tap Stop, then **Copy
 *   report** and paste it into a message, or **Download** (saves to Files).
 *   The report's `engine.boot` block settles the WebGL-fallback question in
 *   one run: `probe` (html[data-paint] as resolved pre-paint — 'css' here
 *   means WebGL2 context creation failed at boot on this device),
 *   `tier` ('lite'/'off' = the device/user setting chose it), `broken`
 *   (a context died — off until reload), `shell` (route has the teacher
 *   shell at all), `canvas`/`ready` (the swap), `plate` (the last plate-load
 *   stage: 'ok', or img-err/timeout/no-2d/raster-err/tex-err naming the step
 *   that failed; plateRetries = bounded retry attempts consumed;
 *   plateSrc = which source landed — 'svg', the .2x.webp twin ('raster'),
 *   or the fetch→createImageBitmap escape hatch ('bitmap');
 *   plateEsc/plateRaw = the computed --page-plate arrived CSS-escaped and
 *   was decoded on read (the iOS `bg-d-light\.svg` case; raw kept verbatim).
 *   `mode:'css'` plus the
 *   matching flag names the cause; `surfaces[]` rows with `flow:true` and
 *   `glassPaint:null` are panels that fell back to the CSS material.
 *
 * HOW TO READ THE REPORT
 * ----------------------
 *   summary.fpsScroll vs fpsStill — the first split. Slow only while
 *     scrolling = Chromium re-sampling backdrops every frame (raster-bound).
 *     Slow while sitting still = an infinite animation keeps the compositor
 *     dirty, or main-thread churn (longTasks high, engine.posted climbing).
 *   worst[].longOverlap — true means a JS longtask covered that frame
 *     (main-thread). False with high urlArea means the SVG graph itself.
 *   worst[].scrollV — px/s at that frame. High + no longtask = scroll raster.
 *   engine.posted vs maps — posted >> maps means key churn: same panels
 *     rebuilding maps repeatedly instead of settling (sizes oscillating).
 *     sync > 0 means the Worker path failed and panels paid main-thread builds.
 *   surfaces[] — every glass element at end of run: computed backdrop-filter
 *     (truncated), hasUrl (bend attached?), nested (inside another glass
 *     root = blur of a flat fill = pure cost), inView, area.
 *   drift — the panel-position payload (the "panels fall behind / slide /
 *     bounce" complaint): maxStale px is how far behind the scroll the glass
 *     was painted at its worst; ring is the last 32 frames as
 *     [driftPx, stalePx, dtMs] — during a flick, driftPx ≈ one frame of
 *     motion means the trail is cadence-bound (compositor outran the rAF
 *     loop), sign flips = bounce. timeline[].stale shows WHERE it fell
 *     behind; worst[].step is the one-frame advance bound per slow frame.
 *   anims[] — running animations grouped by name+target. One infinite entry
 *     (shimmer/spin) present on every slow frame is the keep-dirty suspect.
 *
 * PROBE COST WHILE RECORDING
 * --------------------------
 * The per-frame tick reads only rAF delta + scrollY (no layout). Expensive
 * labeling (getAnimations, filter count) runs ONLY on slow frames (>= 20ms);
 * the full element census (computed style + rects, read-only batch = one
 * forced layout) runs once per second bin. The report keeps slow frames
 * (cap 120) + 1s bins, so a minutes-long run stays pastable.
 */

import { glassStats } from './glassController';
import { chromeDebug } from './glassChrome';
import { glassDriftStats, resetGlassDrift } from './glassDrift';
import {
  type PerfReport,
  type SurfaceInfo,
  type AnimInfo,
  type SlowFrame,
  type BinSample,
} from './perfReporterTypes';
import { buildUi } from './perfRecorderUi';

/** A frame slower than this is below 60fps. */
const JANK_MS = 16.7;
/** A frame slower than this is a hard stutter. */
const STUTTER_MS = 33;
/** Only frames at/over this are kept in the per-frame log (keeps the report small). */
const KEEP_FRAME_MS = 20;
/** Cap the kept frames so a pathological run cannot produce a giant file. */
const MAX_KEPT = 120;
/** One timeline bin per this many ms. */
const BIN_MS = 1000;
/** No scroll event within this long = the user is sitting still. */
const SCROLL_IDLE_MS = 150;
/** Backdrop-filter value truncation in the surfaces list. */
const BF_TRUNC = 140;

const GLASS_SEL = '.lens, .pane, .drop, .glx, .glx-strong, .glx-dark';
const GLASS_CLASS_RE = /^(lens|pane|drop|glx|glx-strong|glx-dark|lens--)/;
/** The families the WebGL shader serves — used for the surfaces-list flow flag. */
const FLOW_SEL = '.lens, .pane, .drop, .glx, .glx-strong';
/** A running animation matching this is a loading/entrance tell, not motion. */
const LOADING_ANIM_RE = /pulse|shimmer|skeleton|spin|progress|fade|appear|enter/i;


declare global {
  interface Window {
    __perf?: {
      start: () => void;
      stop: () => PerfReport;
      dump: () => PerfReport | null;
      copy: () => Promise<void>;
      download: () => void;
      report: PerfReport | null;
    };
  }
}

export function installPerfRecorder(): void {
  if (typeof window === 'undefined') return;
  if (window.__perf) return; // idempotent — StrictMode double-invoke safe

  let recording = false;
  let rafId = 0;
  let last = 0;
  let lastScrollY = 0;
  let lastScrollT = -1e9;
  let startT = 0;
  const deltas: number[] = [];
  const worst: SlowFrame[] = [];
  const timeline: BinSample[] = [];
  const longTasks: { s: number; d: number }[] = [];
  let filterCountStart = 0;
  let binFrames = 0;
  let binSum = 0;
  let binStart = 0;
  let binScrollPx = 0;
  let binMutAdded = 0;
  let mutAdded = 0;
  let mutObserver: MutationObserver | null = null;
  let prevEngine = glassStats();
  let frames = 0;
  let scrollFrames = 0;
  let scrollDur = 0;
  let stillFrames = 0;
  let stillDur = 0;
  let totalScrollPx = 0;
  // Last 1s element census — slow frames attach these aggregates instead of
  // measuring per frame (per-frame getComputedStyle forces style recalc and
  // perturbs exactly what is being measured).
  let census = { visArea: 0, urlArea: 0, blurArea: 0, nested: 0 };

  // Long tasks are the other half of "it feels slow" — a 120ms task blocks
  // paint entirely, and no rAF delta alone tells you it was JavaScript.
  // Stored with start times so each slow frame can test overlap.
  try {
    new PerformanceObserver((list) => {
      if (!recording) return;
      for (const e of list.getEntries()) longTasks.push({ s: e.startTime, d: e.duration });
    }).observe({ entryTypes: ['longtask'] });
  } catch {
    /* Safari/Firefox: no longtask entry type. Frame deltas still work. */
  }

  const onScroll = () => {
    lastScrollT = performance.now();
  };

  const countFilters = () => document.querySelectorAll('filter[id^="lg-"]').length;

  /** Running animations + transitions — called ONLY on slow frames / bin close. */
  const animSnapshot = (): { tr: number; an: number; names: string[] } => {
    let tr = 0;
    let an = 0;
    const names: string[] = [];
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running') continue;
      if (a.constructor.name === 'CSSTransition') {
        tr++;
        if (names.length < 3) names.push(`transition:${(a as CSSTransition).transitionProperty}`);
      } else {
        an++;
        if (names.length < 3) names.push((a as CSSAnimation).animationName || 'keyframes?');
      }
    }
    return { tr, an, names };
  };

  /** Read-only element census: one forced layout per call, no writes inside. */
  const runCensus = () => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    let visArea = 0;
    let urlArea = 0;
    let blurArea = 0;
    let nested = 0;
    for (const el of document.querySelectorAll<HTMLElement>(GLASS_SEL)) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w < 2 || h < 2) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.right <= 0 || r.top >= vh || r.left >= vw) continue;
      const cs = getComputedStyle(el);
      const bf = cs.backdropFilter;
      if (!bf || bf === 'none') continue;
      const area = w * h;
      visArea += area;
      if (bf.includes('url(')) urlArea += area;
      else blurArea += area;
      if (el.parentElement?.closest?.(GLASS_SEL)) nested++;
    }
    census = { visArea, urlArea, blurArea, nested };
  };

  const tick = (now: number) => {
    if (!recording) return;
    rafId = requestAnimationFrame(tick);
    if (!last) {
      last = now;
      lastScrollY = window.scrollY;
      binStart = now;
      return;
    }
    const d = now - last;
    last = now;
    frames++;
    deltas.push(d);
    binFrames++;
    binSum += d;

    // Scroll bookkeeping — window.scrollY is a cheap read, no layout.
    const y = window.scrollY;
    const dy = Math.abs(y - lastScrollY);
    const step = dy; // one-frame page advance — the trail bound (see SlowFrame.step)
    lastScrollY = y;
    binScrollPx += dy;
    totalScrollPx += dy;
    const scrolling = now - lastScrollT < SCROLL_IDLE_MS;
    if (scrolling) {
      scrollFrames++;
      scrollDur += d;
    } else {
      stillFrames++;
      stillDur += d;
    }

    // a 1s bin of the run: this is what shows a slow PERIOD vs a slow frame
    if (now - binStart >= BIN_MS) {
      runCensus();
      const anim = animSnapshot();
      const eng = glassStats();
      let binLongMs = 0;
      for (const lt of longTasks) {
        // longtask window [lt.s, lt.s+lt.d] vs bin window [binStart, now]
        const s = Math.max(lt.s, binStart);
        const e = Math.min(lt.s + lt.d, now);
        if (e > s) binLongMs += e - s;
      }
      timeline.push({
        t: Math.round(binStart - startT),
        fps: Math.round((binFrames * 1000) / Math.max(1, binSum)),
        filters: countFilters(),
        maps: eng.maps,
        posted: eng.posted - prevEngine.posted,
        hits: eng.hits - prevEngine.hits,
        worker: eng.worker - prevEngine.worker,
        sync: eng.sync - prevEngine.sync,
        scrollPx: Math.round(binScrollPx),
        longMs: Math.round(binLongMs),
        mutAdded: binMutAdded,
        tr: anim.tr,
        an: anim.an,
        stale: glassDriftStats().maxStale,
      });
      prevEngine = eng;
      binStart = now;
      binFrames = 0;
      binSum = 0;
      binScrollPx = 0;
      binMutAdded = 0;
    }

    if (d >= KEEP_FRAME_MS && worst.length < MAX_KEPT) {
      const anim = animSnapshot();
      const frameS = now - d;
      let longOverlap = false;
      for (const lt of longTasks) {
        if (lt.s < now && lt.s + lt.d > frameS) {
          longOverlap = true;
          break;
        }
      }
      worst.push({
        t: Math.round(now - startT),
        d: Math.round(d * 10) / 10,
        f: countFilters(),
        scrollV: Math.round((dy / Math.max(1, d)) * 1000),
        scrolling,
        longOverlap,
        visArea: census.visArea,
        urlArea: census.urlArea,
        blurArea: census.blurArea,
        nested: census.nested,
        tr: anim.tr,
        an: anim.an,
        anims: anim.names.join(','),
        p: location.pathname,
        step: Math.round(step * 10) / 10,
      });
    }
  };

  const start = () => {
    if (recording) return;
    recording = true;
    deltas.length = 0;
    worst.length = 0;
    timeline.length = 0;
    longTasks.length = 0;
    frames = 0;
    last = 0;
    startT = performance.now();
    lastScrollT = -1e9;
    binStart = startT;
    binFrames = 0;
    binSum = 0;
    binScrollPx = 0;
    binMutAdded = 0;
    mutAdded = 0;
    scrollFrames = 0;
    scrollDur = 0;
    stillFrames = 0;
    stillDur = 0;
    totalScrollPx = 0;
    census = { visArea: 0, urlArea: 0, blurArea: 0, nested: 0 };
    prevEngine = glassStats();
    resetGlassDrift();
    filterCountStart = countFilters();
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    try {
      mutObserver = new MutationObserver((muts) => {
        if (!recording) return;
        for (const m of muts) {
          binMutAdded += m.addedNodes.length;
          mutAdded += m.addedNodes.length;
        }
      });
      mutObserver.observe(document.body, { childList: true, subtree: true });
    } catch {
      mutObserver = null;
    }
    rafId = requestAnimationFrame(tick);
  };

  const pct = (arr: number[], p: number): number => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  };

  const stop = (): PerfReport => {
    recording = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    window.removeEventListener('scroll', onScroll, { capture: true });
    mutObserver?.disconnect();
    mutObserver = null;
    const dur = Math.max(1, performance.now() - startT);
    const sorted = [...deltas].sort((a, b) => a - b);
    const jank = deltas.filter((d) => d > JANK_MS).length;
    const stutter = deltas.filter((d) => d > STUTTER_MS).length;
    // a 60fps budget would have painted dur/16.7 frames; we painted deltas.length
    const budget = Math.round(dur / JANK_MS);
    const report: PerfReport = {
      meta: {
        url: location.href,
        ua: navigator.userAgent,
        dpr: window.devicePixelRatio,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        startedAt: new Date().toISOString(),
        durationMs: Math.round(dur),
        frames,
      },
      summary: {
        avgFps: Math.round((frames * 1000) / dur),
        p1Fps: sorted.length ? Math.round(1000 / pct(sorted, 99)) : 0,
        p50Ms: Math.round(pct(deltas, 50) * 10) / 10,
        p95Ms: Math.round(pct(deltas, 95) * 10) / 10,
        p99Ms: Math.round(pct(deltas, 99) * 10) / 10,
        worstMs: Math.round((sorted[sorted.length - 1] || 0) * 10) / 10,
        jankFrames: jank,
        stutterFrames: stutter,
        droppedEstimate: Math.max(0, budget - frames),
        longTasks: {
          count: longTasks.length,
          totalMs: Math.round(longTasks.reduce((a, b) => a + b.d, 0)),
          worstMs: Math.round(Math.max(0, ...longTasks.map((l) => l.d))),
        },
        fpsScroll: scrollDur > 0 ? Math.round((scrollFrames * 1000) / scrollDur) : 0,
        fpsStill: stillDur > 0 ? Math.round((stillFrames * 1000) / stillDur) : 0,
        scrollPx: Math.round(totalScrollPx),
        mutAdded,
      },
      timeline,
      worst: worst.sort((a, b) => b.d - a.d).slice(0, 80),
      surfaces: collectSurfaces(),
      anims: collectAnims(),
      filterCountStart,
      filterCountEnd: countFilters(),
      engine: glassStats(),
      chromePanels: chromeDebug(),
      drift: glassDriftStats(),
    };
    window.__perf!.report = report;
    return report;
  };

  /** Every glass element at end of run — ties cost to concrete elements. */
  const collectSurfaces = (): SurfaceInfo[] => {
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const out: SurfaceInfo[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(GLASS_SEL)) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w < 2 || h < 2) continue;
      const cs = getComputedStyle(el);
      const bfRaw = cs.backdropFilter || 'none';
      if (bfRaw === 'none') continue;
      const r = el.getBoundingClientRect();
      const inView = r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw;
      const cls = [...el.classList].filter((c) => GLASS_CLASS_RE.test(c)).join(' ');
      out.push({
        cls,
        w,
        h,
        r: Math.round(parseFloat(cs.borderTopLeftRadius) || 0),
        n: 1,
        bf: bfRaw.length > BF_TRUNC ? `${bfRaw.slice(0, BF_TRUNC)}…` : bfRaw,
        hasUrl: bfRaw.includes('url('),
        nested: !!el.parentElement?.closest?.(GLASS_SEL),
        inView,
        area: w * h,
        flow: el.matches(FLOW_SEL),
        glassPaint: el.dataset.glassPaint ?? null,
      });
    }
    // Dedup identical twins (card grids) so the list stays pastable.
    const seen = new Map<string, SurfaceInfo>();
    for (const s of out) {
      const key = `${s.cls}|${s.w}x${s.h}|${s.hasUrl ? 1 : 0}|${s.nested ? 1 : 0}|${s.inView ? 1 : 0}`;
      const hit = seen.get(key);
      if (hit) hit.n++;
      else seen.set(key, { ...s });
    }
    return [...seen.values()].sort((a, b) => b.area * b.n - a.area * a.n).slice(0, 40);
  };

  /** Running animations grouped by name+target — the keep-dirty suspects. */
  const collectAnims = (): AnimInfo[] => {
    const seen = new Map<string, AnimInfo>();
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running') continue;
      const isTrans = a.constructor.name === 'CSSTransition';
      const name = isTrans
        ? `transition:${(a as CSSTransition).transitionProperty}`
        : (a as CSSAnimation).animationName || 'keyframes?';
      const t = (a.effect as KeyframeEffect | null)?.target as Element | null;
      const tag = t?.tagName?.toLowerCase() ?? '?';
      const cls = t ? [...t.classList].slice(0, 2).join('.') : '';
      const key = `${name}|${tag}|${cls}`;
      const hit = seen.get(key);
      if (hit) hit.n++;
      else seen.set(key, { name, tag, cls, n: 1, isLoading: LOADING_ANIM_RE.test(name) });
    }
    return [...seen.values()].sort((a, b) => b.n - a.n).slice(0, 20);
  };

  const copy = async () => {
    const r = window.__perf!.report ?? stop();
    await navigator.clipboard.writeText(JSON.stringify(r));
  };

  const download = () => {
    const r = window.__perf!.report ?? stop();
    const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `azmoon-perf-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  window.__perf = {
    start,
    stop,
    dump: () => window.__perf!.report,
    copy,
    download,
    report: null,
  };

  buildUi({ start, stop, copy, download });

  // A global "record everything from now" for the impatient:
  //   __perf.start()   ... do things ...   __perf.dump()
  // plus the panel for the point-and-click path.
  // Intentional single log: the recorder only installs behind ?perf=1 and this
  // tells the operator how to drive it. No PII, no hot path.
  // eslint-disable-next-line no-console -- dev-only armed notice, not a stray log
  console.info('[perf] recorder armed — press Record, or use __perf.start() / __perf.stop()');
}

