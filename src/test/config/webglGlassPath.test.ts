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

  it('the compositor scroll-sync: timeline keyframes + glass-only canvas', () => {
    // The canvas paints on the rAF clock, the DOM scrolls on the compositor
    // clock — in-motion the glass trailed by up to a frame (maxStale 17px at
    // 60fps/0 longtasks in the field report). The fix: a scroll() timeline
    // translates the canvas by (painted − live) so painted pixels display
    // where the DOM is. Both the animation and the two vars it reads are
    // load-bearing; the @supports guard keeps the fallback engines inert.
    expect(css).toMatch(/#glass-canvas\s*\{[^}]*animation:\s*glass-sync\s+linear\s+both/);
    expect(css).toMatch(/#glass-canvas\s*\{[^}]*animation-timeline:\s*scroll\(root\s+block\)/);
    expect(css).toMatch(/@keyframes\s+glass-sync/);
    expect(css).toMatch(
      /glass-sync[^@]*?from\s*\{[^}]*translateY\(var\(--glass-sync,\s*0px\)\)/s,
    );
    expect(css).toMatch(
      /glass-sync[^@]*?to\s*\{[^}]*translateY\(calc\(var\(--glass-sync,\s*0px\)\s*-\s*var\(--glass-range,\s*0px\)\)\)/s,
    );
    // The canvas is GLASS-ONLY: the plate must stay VISIBLE as the DOM layer
    // under it (a translated canvas would drag a painted plate), and the
    // controller must not draw the backdrop pass into the canvas anymore.
    const plateBlock = css.match(/:root\[data-glass-render='webgl'\]\s*#app-teacher-shell::before\s*\{([^}]*)\}/);
    expect(plateBlock).not.toBeNull();
    expect(plateBlock![1]).toMatch(/display:\s*block/);
    expect(code(controller)).not.toMatch(/r\.drawBackdrop\(\)/);
    // The sync vars are published from the frame loop, only past the paint
    // gate (the var claims "the pixels on screen correspond to this scroll
    // offset" — a var written on a skipped frame would translate the canvas
    // against pixels that were never repainted).
    expect(controller).toMatch(/canvas\.style\.setProperty\('--glass-sync'/);
    expect(controller).toMatch(/canvas\.style\.setProperty\('--glass-range'/);
    expect(controller).toContain('SCROLL_SYNC_SUPPORTED');
    expect(controller).toMatch(/CSS\.supports\('animation-timeline',\s*'scroll\(\)'\)/);
    // Alpha compositing: glass-only canvas must be transparent outside panels.
    expect(renderer).toMatch(/alpha:\s*true/);
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

  it('draws only panels whose true backdrop is the plate (glx served, floating stay CSS)', () => {
    // glx/glx-strong are shader-served (their Skia url() graph was the
    // dominant scroll cost); glx-dark stays CSS (fixed ink field).
    expect(controller).toMatch(
      /glx-dark'\)\)\s*return null;[\s\S]{0,600}GLX_ON_CSS\)\s*return null;[\s\S]{0,300}return 'lens';/,
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
    // remaining blur would double-glass the already-bent canvas pixels. The
    // sheet rule is belt-and-braces only: the load-bearing kill is INLINE
    // (applyPaintKill), because production minification drops this rule's
    // standard declaration and Chrome ignores the -webkit- form — measured
    // double-paint on every drawn panel before the inline kill.
    const paintBlock = css.match(
      /:root\[data-glass-render='webgl'\]\s*\[data-glass-paint='webgl'\]\s*\{([^}]*)\}/,
    );
    expect(paintBlock).not.toBeNull();
    expect(paintBlock![1]).toMatch(/backdrop-filter:\s*none\s*!important/);
    expect(controller).toContain("setProperty('backdrop-filter', 'none', 'important')");
    expect(controller).toContain("setProperty('-webkit-backdrop-filter', 'none', 'important')");
    // applied at the atomic swap and on post-swap tracks; removed on untrack
    expect(controller).toMatch(/for \(const el of webglDrawSet\) applyPaintKill\(el\)/);
    expect(controller).toMatch(/if \(glReady\) applyPaintKill\(el\)/);
    expect(controller).toMatch(/function untrackWebgl[\s\S]{0,120}clearPaintKill\(el\)/);
    // Backgrounds: transparent for lens/pane/drop (the shader carries their
    // body); glx/glx-strong KEEP theirs — the shader must not invent a fill
    // the cascade may have overridden per element (measured +6/255).
    const bgBlock = css.match(
      /:root\[data-glass-render='webgl'\]\s*\[data-glass-paint='webgl'\]:not\(\.glx\):not\(\.glx-strong\)\s*\{([^}]*)\}/,
    );
    expect(bgBlock).not.toBeNull();
    expect(bgBlock![1]).toMatch(/background:\s*transparent\s*!important/);
    expect(css).toMatch(
      /\.glx\[data-glass-paint='webgl'\]\s*\{[\s\S]{0,300}box-shadow:/,
    );
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
    for (const stage of ['img-err', 'timeout', 'no-2d', 'raster-err', 'tex-err', 'bitmap-err', 'ok']) {
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

  it('the plate load escapes a refused <img> path via the raster/bitmap chain', () => {
    // Field report: iPhone Safari fires onerror for the plate SVG with
    // correct width/height on the root, while the SAME SVG paints fine as a
    // CSS background — and then refused the .2x.webp twin through <img> too.
    // The loader must chain SVG → twin → fetch⇒createImageBitmap (a decode
    // queue separate from <img>), and telemetry must name the stage each
    // source died at plus final-failure forensics — or the next field report
    // is blind again.
    expect(renderer).toContain('plateSources(url: string): string[]');
    expect(renderer).toMatch(/url\.slice\(0, -4\) \+ '\.2x\.webp'/);
    expect(renderer).toContain('loadPlateSource');
    expect(renderer).toContain('loadPlateBitmap');
    expect(renderer).toMatch(/createImageBitmap\(blob\)/);
    expect(renderer).toContain('plateSrc');
    expect(renderer).toMatch(/this\.plateSrc = srcName/);
    // Chain trail + forensics both surface in the report.
    expect(renderer).toContain('plateTried');
    expect(renderer).toContain('probePlate');
    expect(renderer).toMatch(/plateProbe/);
    // A stage-tagged failure must not be clobbered to 'raster-err'.
    expect(renderer).toMatch(/if \(e instanceof Error && 'stage' in e\)/);
    // The twins are COMMITTED artifacts next to each plate (public/).
    for (const f of ['bg-d-light.2x.webp', 'bg-d-dark.2x.webp']) {
      expect(existsSync(join(root, 'public/backgrounds', f)), `${f} must be committed`).toBe(true);
    }
    // And the generator tool exists so a plate regen can re-render them.
    expect(existsSync(join(root, 'tools/render-plate-rasters.mjs'))).toBe(true);
  });

  it('the plate URL is decoded out of the computed property (iOS escape round-trip)', () => {
    // Field (azmoon-perf-1792181900728): iOS 26.6 serializes the computed
    // --page-plate with CSS escapes applied (`bg-d-light\.svg`). Taken
    // verbatim that is not a fetchable URL — the `\` reads as a path
    // separator, so EVERY chain rung died before the network (img-err on
    // both <img> sources, fetch-err on the probes) while the file itself was
    // fine. The lab page bends on the same iPhone precisely because it
    // never crosses the getComputedStyle boundary. Extraction must decode;
    // clean serializations pass through byte-identical.
    expect(controller).toContain("from './cssUrl'");
    expect(controller).toContain('plateURLFromComputed');
    expect(controller).not.toMatch(/return m \? m\[2\]/);
    expect(existsSync(join(root, 'src/glass/cssUrl.ts'))).toBe(true);
  });

  it('boot triage carries the plate stage into the perf report', () => {
    expect(controller).toMatch(/plate: renderer \? renderer\.plateStage : null/);
    expect(controller).toMatch(/plateRetries: renderer \? renderer\.plateRetryCount : 0/);
    expect(controller).toMatch(/plateSrc: renderer \? renderer\.plateSrc : null/);
    expect(controller).toMatch(/plateTried: renderer \? renderer\.plateTried : \[\]/);
    expect(controller).toMatch(/plateProbe: renderer \? renderer\.plateProbe : \[\]/);
    expect(controller).toMatch(/plateRaw: plateRaw/);
    expect(controller).toMatch(/plateEsc: plateEsc/);
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

  it('glx panels keep a painted bend on every engine (CSS chain or shader)', () => {
    // Shader path: glx draws through the same chain as lens (fills + rim).
    // CSS path (no WebGL2 / lite-off / unplaceable): the engine's dress path
    // still attaches the url() filter graph for glx fall-through panels.
    expect(controller).toMatch(/function chainOf[\s\S]{0,900}glx-strong/);
    expect(controller).toContain('url(#');
    // …and the shader fills glx's body with the theme's own tint (a
    // hardcoded white would flip its dark appearance).
    expect(renderer).toContain('u_fillTint');
  });
});
