/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Report types for the ?perf=1 frame-timing recorder — extracted verbatim
 * from perfRecorder.ts. Types only; the recorder builds the payload, the
 * overlay UI renders it.
 */

export interface SlowFrame {
  t: number; // ms since recording started
  d: number; // frame duration ms
  f: number; // live filter[id^="lg-"] count
  scrollV: number; // px/s at this frame
  scrolling: boolean; // scroll event within SCROLL_IDLE_MS
  longOverlap: boolean; // a JS longtask covered this frame
  visArea: number; // visible filtered px (last 1s census)
  urlArea: number; // …of which carrying url() bend
  blurArea: number; // …of which blur-only
  nested: number; // visible nested-in-glass surfaces (pure cost)
  tr: number; // elements mid-transition
  an: number; // elements mid-keyframe-animation
  anims: string; // top animation names (max 3, comma-joined)
  p: string; // pathname
  /** Page advance (px) since the previous frame — the one-frame visual
   *  trail bound: the fixed glass canvas paints at rAF-time scroll, so on
   *  a frame-step of N px the panels sit up to N px behind the compositor's
   *  display position at display time. High + no longtask = cadence-bound. */
  step: number;
}

export interface BinSample {
  t: number;
  fps: number;
  filters: number;
  maps: number;
  posted: number; // engine.posted delta this bin (map churn)
  hits: number;
  worker: number;
  sync: number;
  scrollPx: number;
  longMs: number; // longtask ms landing in this bin
  mutAdded: number; // DOM nodes added this bin (React storm detector)
  tr: number;
  an: number;
  /** Cumulative panel staleness at this bin's close (drift.maxStale, px) —
   *  flat bins mean the glass kept up; a jump marks the bin where it fell
   *  behind. */
  stale: number;
}

export interface SurfaceInfo {
  cls: string;
  w: number;
  h: number;
  r: number;
  n: number;
  bf: string; // computed backdrop-filter, truncated
  hasUrl: boolean;
  nested: boolean;
  inView: boolean;
  area: number;
  /** Flow family (.lens/.pane/.drop) — the families the WebGL shader draws.
   *  A flow surface with glassPaint 'webgl' is transparent BY DESIGN (the
   *  canvas paints it); one WITHOUT means it fell back to the CSS material. */
  flow?: boolean;
  /** data-glass-paint as set by the controller. */
  glassPaint?: string | null;
}

export interface AnimInfo {
  name: string;
  tag: string;
  cls: string;
  n: number;
  /** Likely a loading/entrance tell rather than real motion — skeletons,
   *  pulses, spinners, fade-ins. Timer-driven fps can never idle while one
   *  runs (iPhone Safari measures this), so the reader must be able to
   *  discount them. */
  isLoading?: boolean;
}

export interface PerfReport {
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
    fpsScroll: number; // avg fps on frames with recent scroll input
    fpsStill: number; // avg fps on frames sitting still
    scrollPx: number; // total scroll distance during the run
    mutAdded: number; // total DOM nodes added (re-render storm detector)
  };
  /** Binned over the run so a slow PERIOD is visible, not just a slow frame. */
  timeline: BinSample[];
  /** The frames that hurt, with their context. This is the payload. */
  worst: SlowFrame[];
  /** Glass elements at end of run — ties cost to concrete elements. */
  surfaces: SurfaceInfo[];
  /** Running animations grouped by name+target — the keep-dirty suspects. */
  anims: AnimInfo[];
  /** Whether the engine's map table grew over the run — the churn detector. */
  filterCountStart: number;
  filterCountEnd: number;
  /** Map-pipeline oracle: posted/hit/worker/sync counts + table sizes. */
  engine: GlassEngineStats;
  /** M1 chrome surface dump — every tracked floating panel's live rect,
   *  content height, attr state, opacity, animation; plus the chrome
   *  plate/renderer state. The attempt-4 dig payload. */
  chromePanels: unknown;
  /** Panel-position drift — the "panels fall behind / slide / bounce"
   *  payload. Measured in the glass frame loop itself:
   *    maxStale   — worst |paint_y − prevPaint_y| seen at paint time (px):
   *                 how far the page advanced between two glass paints while
   *                 the older paint's pixels were still displayed. Since the
   *                 compositor scroll-sync landed this is the CONTENT
   *                 freshness bound (the glass BOX tracks the DOM exactly at
   *                 display time; the internal backdrop sample is this many
   *                 px stale until the next paint);
   *    meanStale  — average of nonzero staleness across the run;
   *    staleFrames— frames where the painted position was > 0.5px stale;
   *    ring       — the last 32 frames as [driftPx, stalePx, dtMs]:
   *                 driftPx = page movement seen BETWEEN paints (the
   *                 compositor-vs-rAF gap; a slide-back/bounce shows as
   *                 sign flips on consecutive nonzero rows), dtMs = frame
   *                 interval. Read the ring during a flick: drift ≈ one
   *                 frame of motion means the trail is cadence-bound. */
  drift: {
    ring: Array<[number, number, number]>;
    maxStale: number;
    meanStale: number;
    staleFrames: number;
  };
}

// Moved verbatim from glassController.ts (2026-10-20) — shared engine snapshot shape.
export interface GlassEngineStats {
  posted: number;
  hits: number;
  worker: number;
  sync: number;
  maps: number;
  inflight: number;
  filters: number;
  /** Active paint path and panels drawn in the last WebGL frame. */
  mode: 'webgl' | 'css';
  drawn: number;
  /** M2-A: how many of those were glass children riding a canvas parent. */
  drawnChildren: number;
  /** M1 chrome pass — the second plane (#glass-chrome). `boot: 'ok'` only
   *  means the renderer exists; `ready` means the plate texture landed and
   *  panels actually draw (the pair isolates a plate stall from a draw
   *  bug in a ?perf=1 report). */
  chrome: {
    drawn: number;
    boot: 'pending' | 'ok' | 'broken' | 'off';
    ready: boolean;
  };
  /** Boot triage — WHY the active path is what it is. Travels into the
   *  ?perf=1 report (engine.boot) so a field run on an engine the dev
   *  machine cannot reproduce (iPhone/iPad Safari, Lockdown Mode, Reduce
   *  Transparency) still answers: probe vs tier vs lost context vs plate. */
  boot: {
    /** html[data-paint] as published by public/boot.js before first paint. */
    probe: string | null;
    /** The controller's resolved WebGL2 capability (probe first, own context after). */
    supported: boolean;
    /** A context failed or was lost this session — WebGL is off until reload. */
    broken: boolean;
    /** html[data-glass] tier (full | lite | off | '(unset)'). */
    tier: string;
    /** html[data-lens] — the classic url() bend gate (Chromium >= 138 only). */
    lens: string | null;
    /** The draw canvas exists. */
    canvas: boolean;
    /** The atomic swap landed (plate texture uploaded, canvas visible). */
    ready: boolean;
    /** Plate-load pipeline stage: 'ok' once the texture is up; 'img-err' /
     *  'timeout' / 'no-2d' / 'raster-err' / 'tex-err' name the failing step
     *  when the swap never lands. null = no renderer yet. */
    plate: string | null;
    /** Plate retries consumed this session (bounded backoff). */
    plateRetries: number;
    /** Which plate source landed the texture: 'svg' (vector decode) or
     *  'raster' (the .2x.webp twin — the iPhone path), 'bitmap' (the
     *  fetch→createImageBitmap escape hatch). null = none yet. */
    plateSrc: 'svg' | 'raster' | 'bitmap' | null;
    /** Chain trail of the last load cycle: which source died at which stage,
     *  e.g. ['svg:img-err', 'raster:img-err', 'bitmap:ok']. */
    plateTried: string[];
    /** Final-failure forensics (empty unless the whole chain failed):
     *  per URL `name:status:bytes:decode` — separates network/server/decode. */
    plateProbe: string[];
    /** Last raw computed --page-plate (the engine's exact serialization). */
    plateRaw: string;
    /** True when that serialization needed CSS-escape decoding — the iOS
     *  26.6 case (`bg-d-light\.svg`), which silently corrupted every plate
     *  request until decoded. */
    plateEsc: boolean;
    /** The teacher shell exists on this route (the shader needs it). */
    shell: boolean;
  };
}
