/**
 * M1 chrome pass — static contract gates (attempt 3).
 *
 * The floating glass (topbar lenses, menus, notification dropdown) draws
 * on a SECOND shader plane (#glass-chrome, fixed above the content) so the
 * bend ships on every engine — WebKit throws url() inside backdrop-filter
 * away (bug 245510); the shader cannot be thrown away. Pins the plane's
 * shape and the attempt-1/2 postmortem lessons:
 *
 * attempt 1 (b5413fa): half-applied material divorce — kept the DOM fill +
 * rim over a shader that paints both (double rim). Fixed by adopting the
 * main plane's strip recipe verbatim.
 * attempt 2 (cf5011b): strip fired at TRACK time — panels went naked while
 * the chrome plate loaded (naked menu explosion, desktop) and stranded
 * flat/stripped when the plate stalled (phone). Fixed by strip-on-first-
 * successful-draw with a per-panel rollback, and by giving chrome its own
 * draw clock (not folded into the main canvas's idle gate).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot as root } from '../sourceReader';
import { readBundledCss } from '../cssConcat';

const src = (p: string) => readFileSync(join(root, p), 'utf8');
const chrome = src('src/glass/glassChrome.ts');
const controller = src('src/glass/glassController.ts');
const flush = src('src/glass/glassFlush.ts');
const reportTypes = src('src/glass/perfReporterTypes.ts');
const css = (() => {
  const s = readBundledCss();
  return s.replace(/\/\*[\s\S]*?\*\//g, '');
})();

describe('M1 chrome pass (floating glass on the same shader)', () => {
  it('the second plane exists: fixed canvas, above content, lvh-sized', () => {
    // #glass-canvas is z-1 UNDER the content — a floating panel's backdrop
    // includes the content over the plate, so the chrome must paint ABOVE
    // it: z-29, and lvh (the iOS URL-bar-buffer-realloc law).
    expect(css).toMatch(/#glass-chrome\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/#glass-chrome\s*\{[^}]*z-index:\s*29/);
    expect(css).toMatch(/#glass-chrome\s*\{[^}]*height:\s*100lvh/);
    expect(css).toMatch(/#glass-chrome\s*\{[^}]*pointer-events:\s*none/);
    // Same atomic-swap semantics as the main plane: hidden until the plate
    // texture is up, gated by the html attribute.
    expect(css).toMatch(
      /:root\[data-glass-chrome='webgl'\]\s*#glass-chrome\s*\{[^}]*display:\s*block/,
    );
  });

  it('the material divorce is the MAIN recipe: filter + box-shadow + background + ::after', () => {
    // Attempt-1 lesson: filter-only stripping left the DOM rim + fill over
    // the shader's rim + fill — double rim, the "menu rims broken" revert.
    const strip = css.match(
      /:root\[data-glass-chrome='webgl'\]\s*\[data-glass-chrome='webgl'\]\s*\{[^}]*\}/,
    );
    expect(strip).toBeTruthy();
    const body = strip?.[0] ?? '';
    expect(body).toMatch(/-webkit-backdrop-filter:\s*none\s*!important/);
    expect(body).toMatch(/backdrop-filter:\s*none\s*!important/);
    expect(body).toMatch(/box-shadow:\s*none\s*!important/);
    // The DOM body goes transparent (non-glx) — fill comes from the shader.
    expect(css).toMatch(
      /:root\[data-glass-chrome='webgl'\]\s*\[data-glass-chrome='webgl'\]:not\(\.glx\):not\(\.glx-strong\)\s*\{[^}]*background:\s*transparent\s*!important/,
    );
    // The static rim pseudo is the no-engine fallback; the shader owns it.
    expect(css).toMatch(
      /:root\[data-glass-chrome='webgl'\]\s*\[data-glass-chrome='webgl'\]::after\s*\{[^}]*display:\s*none/,
    );
  });

  it('the pass reuses the GlassRenderer and boots behind the main plane', () => {
    expect(chrome).toContain('import { GlassRenderer }');
    expect(chrome).toContain('new GlassRenderer(canvas)');
    // Chrome context loss is non-fatal and must never take the main pass
    // down (independent shutdown).
    expect(chrome).toMatch(/webglcontextlost/);
    expect(chrome).toMatch(/function shutdownChrome[\s\S]{0,700}untrackChrome/);
    // The controller drives exactly the three lifecycle calls.
    expect(controller).toContain('bootChrome()');
    expect(controller).toMatch(/tickChrome\(\);/);
    expect(controller).toMatch(/shutdownChrome\(lost\)/);
    expect(controller).toContain('refreshChromePlate()');
  });

  it('the strip fires on FIRST SUCCESSFUL DRAW, with draw-failure rollback', () => {
    // Attempt-2 lesson: track-time stripping went naked while the plate
    // loaded. The attr flips to 'webgl' only after drawPanel succeeded for
    // THAT panel this frame.
    expect(chrome).toMatch(
      /if \(ok\) \{[\s\S]{0,300}el\.dataset\.glassChrome = 'webgl';[\s\S]{0,200}applyPaintKill\(el\);/,
    );
    // And rolls BACK when a draw stops succeeding (context dying).
    expect(chrome).toMatch(
      /else if \(el\.dataset\.glassChrome === 'webgl'\) \{[\s\S]{0,200}el\.dataset\.glassChrome = 'pending';[\s\S]{0,100}clearPaintKill\(el\);/,
    );
    // Track lands 'pending' — never strip at track time.
    expect(chrome).toMatch(
      /function trackChrome[\s\S]{0,400}el\.dataset\.glassChrome = 'pending'/,
    );
  });

  it('the floating gate: ancestry decides, dialogs excluded', () => {
    // Static OWN position is fine (menu lenses are static children of the
    // fixed contain-menu anchor) but a scrolled in-flow ANCESTOR is not.
    const gate = chrome.slice(chrome.indexOf('function chromeEligible'));
    expect(
      /p !== 'fixed' && p !== 'sticky' && p !== 'absolute' && p !== 'relative'/.test(gate),
    ).toBe(true);
    // Modals are out by construction: their lens sits over the veil, not
    // the plate.
    expect(chrome).toMatch(/chromeEligible[\s\S]{0,400}\[role="dialog"\]/);
    // The same no-occlusion/no-clip rules the main webglPlaceable applies.
    expect(gate.slice(0, 1400)).toMatch(/overflowX/);
    expect(gate.slice(0, 1600)).toMatch(/backgroundImage/);
  });

  it('flush routes: main plane first, chrome for floating chains, css fall-through', () => {
    // Order is load-bearing: the main gate before the chrome gate keeps
    // in-flow panels off the second plane.
    expect(flush).toMatch(
      /webglPlaceable\(el, cs\)\)[\s\S]{0,500}chromeEligible\(el, cs\)/,
    );
    // Cross-transitions clean up both attrs (a panel moved between planes
    // must not keep a stale station).
    expect(flush).toMatch(/untrackChrome\(el\)/);
    expect(flush).toMatch(/chromeEligible\(el, cs\)\)?[\s\S]{0,400}untrackWebgl\(el\)/);
    expect(flush).toContain('for (const t of chromeTodo) trackChrome(');
  });

  it('chrome keeps its own draw clock — NOT folded into the main idle gate', () => {
    // Attempt-2 freeze-by-thrash: chrome panel motion forced the MAIN
    // full-viewport canvas to repaint every frame too. The main gate may
    // consider only its own draw set; tickChrome self-gates.
    expect(controller).not.toMatch(/chromePending/);
    expect(chrome).toMatch(/function chromeAlphaMoving/);
    expect(chrome).toMatch(/!dirty && !chromeAlphaMoving\(\)/);
  });

  it('the lever and counters ship (?glxf=0 and ?perf=1 chrome block)', () => {
    expect(chrome).toMatch(/glxf'\) === '0'/);
    expect(chrome).toMatch(/function chromeStats/);
    expect(reportTypes).toMatch(
      /chrome:\s*\{\s*drawn:\s*number;\s*boot:\s*'pending'\s*\|\s*'ok'\s*\|\s*'broken'\s*\|\s*'off'\s*;\s*ready:\s*boolean;\s*\}/,
    );
    expect(controller).toMatch(/chrome:\s*chromeStats\(\)/);
  });
});
