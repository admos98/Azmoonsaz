/**
 * WebGL paint path — static contract gates.
 *
 * The glass panels' primary renderer is the WebGL2 fragment shader
 * (src/glass/webglRenderer.ts, driven by glassController.ts). It exists
 * because url(#…) inside backdrop-filter has no GPU-compositor path in
 * Chromium: Chrome snapshots the backdrop and runs the whole SVG graph
 * through Skia on the raster path, per surface, per frame — measured
 * 27fps / 59% janky frames on a real settings screen, 15.5fps at 30 panels.
 * The lab renderer that replaces it holds 60fps at 45 panels.
 *
 * These tests pin the SHAPE of that integration so it cannot silently rot:
 * the renderer ships, the controller mounts it, the CSS swap is atomic and
 * scoped, the boot probe exists, and the shader keeps the three defects the
 * lab cost us a day to find from coming back.
 *
 * They are static (source reads) on purpose: the shader itself is covered by
 * tests/e2e/webgl-glass.spec.ts, which needs a real GL context.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot as root } from '../sourceReader';
import { readBundledCss } from '../cssConcat';

const renderer = readFileSync(join(root, 'src/glass/webglRenderer.ts'), 'utf8');
const controller = readFileSync(join(root, 'src/glass/glassController.ts'), 'utf8');
const boot = readFileSync(join(root, 'public/boot.js'), 'utf8');
/** Comments stripped: the doc blocks discuss the very strings these gates
 *  assert, so comment text would satisfy an "it exists" check on its own. */
const code = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/^\s*\/\/.*$/, ''))
    .join('\n');
const css = cssNoComments(readBundledCss());

function cssNoComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('webgl glass renderer (primary paint path)', () => {
  it('the renderer module ships with its full public surface', () => {
    for (const member of [
      'setPlate',
      'beginFrame',
      'drawBackdrop',
      'drawPanel',
      'dispose',
      'maskProbe',
      'get hasPlate',
      'export class GlassRenderer',
      "export type GlassKind",
      'export interface GlassPaintParams',
    ]) {
      expect(renderer, `webglRenderer.ts must export/declare ${member}`).toContain(member);
    }
  });

  it('one canvas, two programs — never a context per panel', () => {
    // Chrome caps live WebGL contexts (~16, evicting the OLDEST), so a
    // per-panel context model silently kills the first panels drawn.
    expect((code(renderer).match(/getContext\('webgl2'/g) || []).length).toBe(1);
    expect(renderer).toContain('bgProg');
    expect(renderer).toContain('glassProg');
  });

  it('carries the three lab defects fixed: mask sign, canvas CSS size, DPR-aware textures', () => {
    // 1. Border SDF sign: the corner branch must match the flat branches'
    //    ANTI-symmetric convention (negative inside). (1 - seMetric) paints
    //    four square corner patches on every panel.
    expect(renderer).toContain('(seMetric(t.x, t.y, n) - 1.0) * r');
    expect(renderer).not.toContain('(1.0 - seMetric');
    // 2. Texture raster must scale by DPR (and the plate raster is capped).
    expect(renderer).toMatch(/dpr/);
    expect(renderer).toContain('MAX_SIDE');
    // 3. A missing uniform stores NaN and paints an opaque black panel with
    //    no GL error — every scalar goes through the finite guard.
    expect(renderer).toContain('Number.isFinite(v) ? v : 0');
  });

  it('the canvas CSS size is owned by the stylesheet (replaced element)', () => {
    // `inset: 0` alone does not stretch a <canvas>: the DPR-sized buffer gets
    // magnified by dpr (lab: backdrop HF energy 0.26× vs CSS).
    expect(css).toMatch(/#glass-canvas\s*\{[^}]*width:\s*100%/);
    expect(css).toMatch(/#glass-canvas\s*\{[^}]*height:\s*100%/);
    expect(css).toMatch(/#glass-canvas\s*\{[^}]*z-index:\s*1/);
  });

  it('the fixed layers pin to the LARGE viewport (iOS 26 URL-bar re-scale)', () => {
    // A fixed layer sized by the DYNAMIC viewport re-scales on iOS 26 while
    // the URL bar collapses mid-scroll: the plate's `cover` crop visibly
    // slides and the canvas buffer re-allocates every frame (WebKit #297779
    // family). Both fixed layers must carry an lvh height; the plain 100%
    // precedes it so engines without lvh keep the inset-stretch behavior.
    expect(css).toMatch(/#glass-canvas\s*\{[^}]*height:\s*100lvh/);
    expect(css).toMatch(/#app-teacher-shell::before\s*\{[^}]*height:\s*100lvh/);
  });

  it('the controller mounts the renderer as the FIRST choice, CSS as fallback', () => {
    expect(controller).toContain("from './webglRenderer'");
    expect(controller).toContain('new GlassRenderer(');
    // Path arbitration must be per-flush and tier-aware, and a lost context
    // must permanently revert the session to the classic path.
    expect(controller).toMatch(/renderMode\s*=\s*useWebgl\s*\?\s*'webgl'\s*:\s*'css'/);
    expect(controller).toContain('webglcontextlost');
    expect(controller).toContain('webglBroken = true');
    // Fallback: the CSS dress path must still be reachable in the same flush.
    expect(controller).toContain('function commit(');
    expect(controller).toContain('requestBucketAsync');
  });

  it('draws only panels whose true backdrop is the plate (glx* + floating stay CSS)', () => {
    // glx* families keep their CSS bloom lines and url() bend.
    expect(controller).toMatch(
      /function webglKindOf[\s\S]{0,400}glx-strong[\s\S]{0,200}return null;/,
    );
    // Floating/sticky/absolute and clipped backdrops are excluded in code.
    expect(controller).toMatch(/function webglPlaceable[\s\S]{0,400}'fixed'/);
    expect(controller).toMatch(/function webglPlaceable[\s\S]{0,800}overflowX/);
    // Fall-through: a panel the shader cannot serve must reach the CSS path.
    expect(controller).toMatch(/if \(el\.dataset\.glassPaint\) untrackWebgl\(el\);/);
  });

  it('the CSS swap is atomic and scoped to drawn panels', () => {
    // The attribute lands only after the plate texture exists, so the canvas
    // (an alpha-less opaque black backbuffer) is never shown early.
    expect(controller).toMatch(/if \(!glReady && r\.hasPlate\)/);
    expect(controller).toMatch(/dataset\.glassRender = 'webgl'/);
    // Canvas shown ⇔ DOM plate hidden ⇔ drawn panels transparent.
    expect(css).toMatch(/:root\[data-glass-render='webgl'\]\s*#glass-canvas/);
    expect(css).toMatch(/:root\[data-glass-render='webgl'\]\s*#app-teacher-shell::before/);
    expect(css).toMatch(/:root\[data-glass-render='webgl'\]\s*\[data-glass-paint='webgl'\]/);
    // The transparent frame must kill the backdrop-filter COMPLETELY — a
    // remaining blur would double-glass the already-bent canvas pixels.
    const paintBlock = css.match(
      /:root\[data-glass-render='webgl'\]\s*\[data-glass-paint='webgl'\]\s*\{([^}]*)\}/,
    );
    expect(paintBlock).not.toBeNull();
    expect(paintBlock![1]).toMatch(/backdrop-filter:\s*none\s*!important/);
    expect(paintBlock![1]).toMatch(/background:\s*transparent\s*!important/);
    // Teardown clears the swap, so the classic path resumes cleanly.
    expect(controller).toContain("document.documentElement.removeAttribute('data-glass-render')");
  });

  it('the boot probe publishes the capability before first paint', () => {
    // script-src 'self' blocks inline scripts — the probe lives in boot.js,
    // which must stay synchronous (no defer/async) and same-origin.
    expect(boot).toContain("getContext('webgl2')");
    expect(boot).toMatch(/dataset\.paint = gl \? 'gl' : 'css'/);
    // The probe must not leak a live context (Chrome caps ~16).
    expect(boot).toContain('WEBGL_lose_context');
    // The controller reads the probe, and can also fall back to its own.
    expect(controller).toMatch(/documentElement\.dataset\.paint/);
  });

  it('the data-glass tier wins: lite/off never boot the shader', () => {
    expect(controller).toMatch(/function tierAllowsGlass[\s\S]{0,220}'lite'[\s\S]{0,120}'off'/);
    expect(controller).toMatch(/const wantWebgl = tierAllowsGlass\(\)/);
  });

  it('motion fades reach the shader (inline opacity feeds the paint alpha)', () => {
    // Panels fade in/out with motion; the canvas copy must follow the same
    // curve, and wrapper opacity counts too (the animated node is often an
    // ancestor, and computed opacity is per-element).
    expect(controller).toContain('function effectiveAlpha');
    expect(controller).toMatch(/effectiveAlpha\(el\)/);
    expect(renderer).toMatch(/drawPanel\([\s\S]{0,200}alpha = 1/);
    expect(renderer).toContain("f1('u_alpha', alpha)");
  });

  it('theme flips reload the plate behind the swap guard', () => {
    expect(controller).toContain('function refreshPlate');
    expect(controller).toContain('setPlate(');
    // setPlate's own load-id race guard (a stale flip must not win).
    expect(renderer).toContain('plateLoadId');
    expect(renderer).toMatch(/if \(id !== this\.plateLoadId\)/);
  });

  it('plate load is deadline-guarded and retried, stage-telemetered', () => {
    // A stalled plate fetch (cold/evicted cache, engine never fires
    // onload/onerror) must not park the atomic swap forever: the load has a
    // deadline, and a failure hands off to a bounded retry.
    expect(renderer).toContain('PLATE_LOAD_TIMEOUT_MS');
    expect(renderer).toMatch(/setTimeout\(\(\) => \{[\s\S]{0,240}plate load timed out/);
    expect(renderer).toContain('retryPlate(url: string): void');
    expect(renderer).toContain('PLATE_MAX_RETRIES');
    // The stage must survive into the report — no more silent swallow.
    expect(renderer).toContain('plateStage');
    for (const stage of ['img-err', 'timeout', 'no-2d', 'raster-err', 'tex-err', 'ok']) {
      expect(renderer, `plateStage must distinguish '${stage}'`).toContain(`'${stage}'`);
    }
    // The controller consumes the retry instead of swallowing (both sites).
    expect(controller).toMatch(/catch\(\(\) => r\.retryPlate\(url\)\)/);
    expect(controller).toMatch(/catch\(\(\) => renderer\?\.retryPlate\(url\)\)/);
    // The swap still flips only on a real texture.
    expect(renderer).toContain("this.plateStage = 'ok'");
    // Teardown stops pending retries (dead renderer must not resurrect).
    expect(controller).toMatch(/renderer\.plateURL = ''/);
  });

  it('the plate load falls back to the raster twin (iOS refuses the SVG <img>)', () => {
    // Field report: iPhone Safari fires onerror for the plate SVG with
    // correct width/height on the root, while the SAME SVG paints fine as a
    // CSS background. The loader must therefore try the SVG first and fall
    // through to the committed .2x.webp twin — and telemetry must name the
    // source that won, or the next field report is blind again.
    expect(renderer).toContain('plateSources(url: string): string[]');
    expect(renderer).toMatch(/url\.slice\(0, -4\) \+ '\.2x\.webp'/);
    expect(renderer).toContain('loadPlateSource');
    expect(renderer).toContain('plateSrc');
    expect(renderer).toMatch(/plateSrc = isRaster \? 'raster' : 'svg'/);
    // A stage-tagged failure must not be clobbered to 'raster-err'.
    expect(renderer).toMatch(/if \(e instanceof Error && 'stage' in e\)/);
    // The twins are COMMITTED artifacts next to each plate (public/).
    for (const f of ['bg-d-light.2x.webp', 'bg-d-dark.2x.webp']) {
      expect(existsSync(join(root, 'public/backgrounds', f)), `${f} must be committed`).toBe(true);
    }
    // And the generator tool exists so a plate regen can re-render them.
    expect(existsSync(join(root, 'tools/render-plate-rasters.mjs'))).toBe(true);
  });

  it('boot triage carries the plate stage into the perf report', () => {
    expect(controller).toMatch(/plate: renderer \? renderer\.plateStage : null/);
    expect(controller).toMatch(/plateRetries: renderer \? renderer\.plateRetryCount : 0/);
    expect(controller).toMatch(/plateSrc: renderer \? renderer\.plateSrc : null/);
  });

  it('a single shared draw list drives the frame, culled by rect', () => {
    expect(controller).toContain('const webglDrawSet = new Set<HTMLElement>()');
    expect(controller).toContain('function glFrame');
    expect(controller).toMatch(/webglDrawSet\.delete\(el\)/); // dead nodes drop out
    // Offscreen culling happens in the loop; drawn panels must NOT be parked
    // (the attribute churn would invalidate style every scroll frame).
    expect(controller).toMatch(/renderMode === 'webgl' && webglDrawSet\.has\(el\)/);
  });

  it('the perf oracle reports the active path', () => {
    expect(controller).toMatch(/mode: renderMode/);
    expect(controller).toMatch(/drawn: lastDrawCount/);
  });

  it('glx* families keep their CSS url() bend (not silently de-lensed)', () => {
    // A glx panel falls through to the engine's CSS dress path, which
    // attaches the url() filter graph exactly as before the migration.
    expect(controller).toMatch(/function chainOf[\s\S]{0,900}glx-strong/);
    expect(controller).toContain('url(#');
  });
});
