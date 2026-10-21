/**
 * M1 chrome pass — static contract gates (Stage 1).
 *
 * The floating glass (topbar lenses, menus, notification dropdown, search
 * pills, btn-glass circles) draws on a SECOND shader plane (#glass-chrome,
 * fixed above the content) so the bend ships on every engine — WebKit
 * throws url() inside backdrop-filter away (bug 245510); the shader cannot
 * be thrown away. These gates pin the plane's shape so it cannot rot; the
 * real pixels are covered by tests/e2e/webgl-glass.spec.ts.
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

describe('M1 chrome pass (stage 1 — floating glass on the same shader)', () => {
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
    expect(css).toMatch(/:root\[data-glass-chrome='webgl'\]\s*#glass-chrome\s*\{[^}]*display:\s*block/);
    expect(css).toMatch(
      /:root\[data-glass-chrome='webgl'\]\s*\[data-glass-chrome='webgl'\]\s*\{[^}]*backdrop-filter:\s*none\s*!important/,
    );
  });

  it('the pass reuses the GlassRenderer and boots behind the main plane', () => {
    expect(chrome).toContain('import { GlassRenderer }');
    expect(chrome).toContain('new GlassRenderer(canvas)');
    // Chrome context loss is non-fatal and must never take the main pass
    // down (independent shutdown, the contract's own test pin).
    expect(chrome).toMatch(/webglcontextlost/);
    expect(chrome).toMatch(/function shutdownChrome[\s\S]{0,600}untrackChrome/);
    // The controller drives exactly the three lifecycle calls.
    expect(controller).toContain('bootChrome()');
    expect(controller).toMatch(/tickChrome\(\);/);
    expect(controller).toMatch(/shutdownChrome\(lost\)/);
    expect(controller).toContain('refreshChromePlate()');
  });

  it('the floating gate refuses scrolling, occluded, and dialog panels', () => {
    // The ANCESTRY decides, not the panel's own position: the four menu
    // panels are STATIC children of the fixed contain-menu anchor, and a
    // static panel under a floating chain is as viewport-stable as the
    // anchor (only ownPos static/fixed/sticky/absolute enter the gate).
    expect(chrome).toMatch(
      /function chromeEligible[\s\S]{0,300}ownPos !== 'static'[\s\S]{0,100}return false/,
    );
    const gate = chrome.slice(chrome.indexOf('function chromeEligible'));
    // Static OWN position is fine but a scrolled in-flow ANCESTOR is not:
    // the ancestor walk still refuses plain static parents.
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

  it('flush routes: main plane first, chrome for missing placeability, css fall-through)', () => {
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

  it('the lever and counters ship (?glxf=0 and ?perf=1 chrome.boot)', () => {
    expect(chrome).toMatch(/glxf'\) === '0'/);
    expect(chrome).toMatch(/function chromeStats/);
    expect(reportTypes).toMatch(
      /chrome:\s*\{\s*drawn:\s*number;\s*boot:\s*'pending'\s*\|\s*'ok'\s*\|\s*'broken'\s*\|\s*'off'\s*;\s*ready:\s*boolean;\s*\}/,
    );
    expect(controller).toMatch(/chrome:\s*chromeStats\(\)/);
  });

  it('the shared idle gate repaints for chrome fades', () => {
    // An animating menu must repaint even when the main canvas is at rest.
    expect(controller).toMatch(/chromePending\(\)/);
  });
});
