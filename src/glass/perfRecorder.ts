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
 * every frame with what was on screen and what was moving, so a spike reads
 * as "menu open · lens--menu x1 · 74ms" instead of a meaningless timestamp.
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
 *      things that feel slow for a couple of minutes (open the hamburger,
 *      hover the pills, open notifications, navigate routes, scroll).
 *   3. Press **Stop**, then **Copy report** (or **Download**).
 *   4. Paste / attach the report back in chat.
 *
 * The report is aggregates + worst frames, not raw 60fps x 120s — a 2-minute
 * run stays well under ~150 KB, so it pastes into a chat message.
 */

import { glassStats, type GlassEngineStats } from './glassController';

/** A frame slower than this is below 60fps. */
const JANK_MS = 16.7;
/** A frame slower than this is a hard stutter. */
const STUTTER_MS = 33;
/** Rolling window used for the live readout (frames). */
const WINDOW = 60;
/** Only frames at/over this are kept in the per-frame log (keeps the report small). */
const KEEP_FRAME_MS = 20;
/** Cap the kept frames so a pathological run cannot produce a giant file. */
const MAX_KEPT = 1200;

interface FrameSample {
  t: number; // ms since recording started
  d: number; // frame duration ms
  /** what the glass engine had attached at that instant */
  f: number; // live filter[id^="lg-"] count
  g: number; // visible glass surfaces (backdrop-filter users)
  /** what was animating — the labels that make a spike actionable */
  tr: number; // elements mid-transition (getAnimations on transitions)
  an: number; // elements mid-keyframe-animation
  /** route + open overlays, when we can read them */
  p: string; // pathname
}

interface PerfReport {
  meta: {
    url: string;
    ua: string;
    dpr: number;
    viewport: string;
    startedAt: string;
    durationMs: number;
    frames: number;
  };
  summary: {
    avgFps: number;
    p1Fps: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    worstMs: number;
    jankFrames: number; // > 16.7ms
    stutterFrames: number; // > 33ms
    droppedEstimate: number; // frames a 60fps budget would have shown but did not
    longTasks: { count: number; totalMs: number; worstMs: number };
  };
  /** Binned over the run so a slow PERIOD is visible, not just a slow frame. */
  timeline: { t: number; fps: number; filters: number; anim: number }[];
  /** The frames that hurt, with their context. This is the payload. */
  worst: FrameSample[];
  /** Glass surfaces the engine had attached, deduped by size, at end of run. */
  surfaces: { cls: string; w: number; h: number; r: number; n: number }[];
  /** Whether the engine's map table grew over the run — the churn detector. */
  filterCountStart: number;
  filterCountEnd: number;
  /** Map-pipeline oracle: posted/hit/worker/sync counts + table sizes. */
  engine: GlassEngineStats;
}

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
  let startT = 0;
  const deltas: number[] = [];
  const worst: FrameSample[] = [];
  const timeline: PerfReport['timeline'] = [];
  const longTasks: number[] = [];
  let filterCountStart = 0;
  let binFrames = 0;
  let binSum = 0;
  let binStart = 0;
  let frames = 0;

  // Long tasks are the other half of "it feels slow" — a 120ms task blocks
  // paint entirely, and no rAF delta alone tells you it was JavaScript.
  try {
    new PerformanceObserver((list) => {
      if (!recording) return;
      for (const e of list.getEntries()) longTasks.push(e.duration);
    }).observe({ entryTypes: ['longtask'] });
  } catch {
    /* Safari/Firefox: no longtask entry type. Frame deltas still work. */
  }

  const countFilters = () => document.querySelectorAll('filter[id^="lg-"]').length;

  /** Elements with a running transition/animation right now — the "what moved". */
  const countAnimating = (): { tr: number; an: number } => {
    let tr = 0;
    let an = 0;
    for (const a of document.getAnimations()) {
      if (a.playState !== 'running') continue;
      if (a.constructor.name === 'CSSTransition') tr++;
      else an++;
    }
    return { tr, an };
  };

  /** Visible elements that carry a backdrop-filter — the material budget. */
  const countGlassSurface = (): number => {
    let n = 0;
    for (const el of document.querySelectorAll<HTMLElement>('.lens, .pane, .drop, .glx, .glx-strong, .glx-dark')) {
      const cs = getComputedStyle(el);
      if (cs.backdropFilter && cs.backdropFilter !== 'none') n++;
    }
    return n;
  };

  const tick = (now: number) => {
    if (!recording) return;
    rafId = requestAnimationFrame(tick);
    if (!last) {
      last = now;
      binStart = now;
      return;
    }
    const d = now - last;
    last = now;
    frames++;
    deltas.push(d);
    binFrames++;
    binSum += d;

    // a 1s bin of the run: this is what shows a slow PERIOD vs a slow frame
    if (now - binStart >= 1000) {
      timeline.push({
        t: Math.round(binStart - startT),
        fps: Math.round((binFrames * 1000) / Math.max(1, binSum)),
        filters: countFilters(),
        anim: countAnimating().tr,
      });
      binStart = now;
      binFrames = 0;
      binSum = 0;
    }

    if (d >= KEEP_FRAME_MS && worst.length < MAX_KEPT) {
      const a = countAnimating();
      worst.push({
        t: Math.round(now - startT),
        d: Math.round(d * 10) / 10,
        f: countFilters(),
        g: countGlassSurface(),
        tr: a.tr,
        an: a.an,
        p: location.pathname,
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
    binStart = startT;
    binFrames = 0;
    binSum = 0;
    filterCountStart = countFilters();
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
          totalMs: Math.round(longTasks.reduce((a, b) => a + b, 0)),
          worstMs: Math.round(Math.max(0, ...longTasks)),
        },
      },
      timeline,
      worst: worst.sort((a, b) => b.d - a.d).slice(0, 80),
      surfaces: collectSurfaces(),
      filterCountStart,
      filterCountEnd: countFilters(),
      engine: glassStats(),
    };
    window.__perf!.report = report;
    return report;
  };

  /** Every glass surface's class + box at end of run — ties a slow frame to a shape. */
  const collectSurfaces = (): PerfReport['surfaces'] => {
    const seen = new Map<string, PerfReport['surfaces'][number]>();
    for (const el of document.querySelectorAll<HTMLElement>('.lens, .pane, .drop, .glx, .glx-strong')) {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w < 2 || h < 2) continue;
      const cls = [...el.classList].filter((c) => /^(lens|pane|drop|glx|glx-strong|glx-dark|lens--)/.test(c)).join(' ');
      const key = `${cls}|${w}x${h}`;
      const hit = seen.get(key);
      if (hit) hit.n++;
      else
        seen.set(key, {
          cls,
          w,
          h,
          r: Math.round(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0),
          n: 1,
        });
    }
    return [...seen.values()].sort((a, b) => b.n - a.n).slice(0, 40);
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
  console.info('[perf] recorder armed — press Record, or use __perf.start() / __perf.stop()');
}

/* ───────────────────────── minimal UI ───────────────────────── */
/* Plain DOM, no JSX: the a11y button gate walks every TSX file under src and
   this must not be a lint liability — a dev-only overlay has no business in
   the design system. Styled inline so it cannot affect the token gates. */

interface UiOps {
  start: () => void;
  stop: () => PerfReport;
  copy: () => Promise<void>;
  download: () => void;
}

function buildUi(ops: UiOps): void {
  if (document.getElementById('__perf_ui')) return;
  const box = document.createElement('div');
  box.id = '__perf_ui';
  box.setAttribute(
    'style',
    'position:fixed;right:12px;bottom:12px;z-index:2147483647;' +
      'font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;color:#e8e8ea;' +
      'background:rgba(18,18,20,.92);border:1px solid rgba(255,255,255,.16);' +
      'border-radius:10px;padding:10px 12px;width:236px;backdrop-filter:blur(8px);' +
      'box-shadow:0 8px 30px rgba(0,0,0,.4)',
  );
  const title = document.createElement('div');
  title.textContent = 'perf recorder';
  title.setAttribute('style', 'font-weight:600;margin-bottom:8px;opacity:.85');
  const out = document.createElement('div');
  out.setAttribute('style', 'min-height:34px;margin-bottom:8px;white-space:pre;opacity:.9');
  out.textContent = 'idle — press Record';
  const row = document.createElement('div');
  row.setAttribute('style', 'display:flex;gap:6px;flex-wrap:wrap');
  const mk = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.setAttribute(
      'style',
      'font:inherit;color:#e8e8ea;background:rgba(255,255,255,.09);border:1px solid ' +
        'rgba(255,255,255,.18);border-radius:7px;padding:4px 9px;cursor:pointer',
    );
    b.onclick = fn;
    return b;
  };
  let interval = 0;

  const show = (r: PerfReport) => {
    const e = r.engine;
    out.textContent =
      `fps avg ${r.summary.avgFps}  p1 ${r.summary.p1Fps}\n` +
      `p95 ${r.summary.p95Ms}ms  worst ${r.summary.worstMs}ms\n` +
      `jank ${r.summary.jankFrames}  longtasks ${r.summary.longTasks.count}\n` +
      `filters ${r.filterCountStart}->${r.filterCountEnd}\n` +
      `maps ${e.maps} infl ${e.inflight} post ${e.posted} hit ${e.hits} wrk ${e.worker} sync ${e.sync}`;
  };

  const bRec = mk('Record', () => {
    ops.start();
    if (interval) clearInterval(interval);
    interval = window.setInterval(() => {
      const t = performance.now();
      out.textContent = `● recording\n${(t / 1000).toFixed(1)}s  filters ${document.querySelectorAll('filter[id^="lg-"]').length}`;
    }, 250);
    setUi();
  });
  const bStop = mk('Stop', () => {
    if (interval) clearInterval(interval);
    interval = 0;
    show(ops.stop());
    setUi();
  });
  const bCopy = mk('Copy report', () => void ops.copy());
  const bDown = mk('Download', () => ops.download());
  row.append(bRec, bStop, bCopy, bDown);
  box.append(title, out, row);
  document.body.appendChild(box);

  function setUi(): void {
    const recording = interval !== 0;
    const hasReport = window.__perf?.report != null;
    bRec.disabled = recording;
    bStop.disabled = !recording;
    bCopy.disabled = !hasReport;
    bDown.disabled = !hasReport;
  }
  setUi();
}
