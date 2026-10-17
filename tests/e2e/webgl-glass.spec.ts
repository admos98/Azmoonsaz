import { test, expect } from '@playwright/test';

/**
 * WebGL glass paint path — browser-level contract.
 *
 * The primary glass renderer is a WebGL2 fragment shader driven by
 * src/glass/glassController.ts: one fixed canvas between the page plate and
 * the content, drawing the plate plus every in-flow lens/pane/drop panel.
 * The CSS path (url() bend on Chromium, blur + static rims elsewhere) stays
 * as the fallback.
 *
 * What must hold in a REAL browser:
 *   1. the probe publishes html[data-paint] before the app boots;
 *   2. on a WebGL2-capable engine the canvas mounts, and the swap
 *      (data-glass-render='webgl') makes the plate layer and the drawn panel
 *      frames disappear together — atomically;
 *   3. in-flow glx panels ARE shader-served (their Skia url() graph was the
 *      dominant scroll cost); floating/sticky, clipped, field and glx-dark
 *      panels keep their CSS material — no transparent hole;
 *   4. lite/off tiers never boot the shader;
 *   5. the frame loop actually runs (stats report mode + drawn count).
 *
 * /dev/topbar is the harness: it renders the REAL shell (#app-teacher-shell)
 * with real lens/pane/drop panels and needs no backend.
 */

const HARNESS = '/dev/topbar';

/** Frames the controller needs: mount → plate load → swap. */
async function waitForPath(page: import('@playwright/test').Page) {
  await page.waitForFunction(
    () => {
      const root = document.documentElement;
      return root.dataset.paint !== undefined;
    },
    undefined,
    { timeout: 15000 },
  );
}

test.describe('WebGL glass paint path', () => {
  test('the paint probe is published before the app boots', async ({ page }) => {
    await page.goto(HARNESS);
    const paint = await page.evaluate(() => document.documentElement.dataset.paint);
    expect(['gl', 'css']).toContain(paint);
    // A software-rasterized browser is allowed to report 'css' — that is the
    // fallback working. A hard failure here would mean the probe never ran.
  });

  test('the shader boots on a WebGL2 engine and swaps atomically', async ({ page }) => {
    await page.goto(HARNESS);
    await waitForPath(page);
    const paint = await page.evaluate(() => document.documentElement.dataset.paint);
    test.skip(paint !== 'gl', 'engine has no WebGL2 — the CSS fallback is the correct path');

    // Canvas must exist (the controller creates it under the shell) and the
    // swap must land: the attribute and the canvas appear together.
    const swapped = await page.waitForFunction(
      () => document.documentElement.dataset.glassRender === 'webgl',
      undefined,
      { timeout: 15000 },
    );
    expect(await swapped.jsonValue()).toBe(true);

    const state = await page.evaluate(() => {
      const canvas = document.getElementById('glass-canvas') as HTMLCanvasElement | null;
      const drawnPanel = document.querySelector('[data-glass-paint="webgl"]') as HTMLElement | null;
      const canvasStyle = canvas ? getComputedStyle(canvas) : null;
      const panelStyle = drawnPanel ? getComputedStyle(drawnPanel) : null;
      return {
        canvasPresent: !!canvas,
        canvasBufferW: canvas?.width ?? 0,
        canvasBufferH: canvas?.height ?? 0,
        canvasCssW: canvas ? Math.round(canvas.getBoundingClientRect().width) : 0,
        canvasDisplay: canvasStyle?.display ?? '',
        canvasZ: canvasStyle?.zIndex ?? '',
        drawnPanelPresent: !!drawnPanel,
        drawnPanelBackdrop: panelStyle?.backdropFilter ?? '',
        drawnPanelBackground: panelStyle?.backgroundColor ?? '',
      };
    });

    expect(state.canvasPresent).toBe(true);
    // Buffer is DPR-scaled, CSS box matches the viewport (the replaced-element
    // trap): buffer must never be smaller than the CSS box.
    expect(state.canvasBufferW).toBeGreaterThanOrEqual(state.canvasCssW);
    expect(state.canvasBufferW).toBeGreaterThan(0);
    expect(state.canvasBufferH).toBeGreaterThan(0);
    expect(state.canvasDisplay).toBe('block');
    expect(state.canvasZ).toBe('1');

    // The drawn panel is a transparent frame: no backdrop blur at all (a
    // surviving blur would double-glass the already-bent canvas pixels).
    expect(state.drawnPanelPresent).toBe(true);
    expect(state.drawnPanelBackdrop).toMatch(/none|^$/);
    expect(state.drawnPanelBackground).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
  });

  test('in-flow glx panels are served by the shader (DOM keeps painted material)', async ({ page }) => {
    await page.goto(HARNESS);
    await waitForPath(page);
    const paint = await page.evaluate(() => document.documentElement.dataset.paint);
    test.skip(paint !== 'gl', 'engine has no WebGL2 — the CSS fallback is the correct path');
    await page.waitForFunction(() => document.documentElement.dataset.glassRender === 'webgl', undefined, {
      timeout: 15000,
    });

    // The hero banner is an in-flow .glx card: formerly CSS-only (Skia url()
    // graph per frame — the questions-page scroll cost), now drawn by the
    // shader for its BACKDROP chain while the DOM keeps its own painted
    // material (fill gradient + bloom box-shadow) — the cascade owns the
    // fill, so the shader must not invent one (measured +6/255 otherwise).
    // Floating/sticky panels stay CSS-owned (webglPlaceable; pinned by the
    // unit suite).
    const glx = await page.evaluate(() => {
      const el = document.getElementById('dashboard-hero-banner') as HTMLElement | null;
      if (!el) return null;
      return {
        painted: el.dataset.glassPaint === 'webgl',
        backdrop: getComputedStyle(el).backdropFilter,
        // the bloom (painted material) survives the strip on the shader path
        shadow: getComputedStyle(el).boxShadow,
      };
    });
    expect(glx).not.toBeNull();
    expect(glx!.painted).toBe(true);
    expect(glx!.backdrop).toMatch(/none|^$/);
    expect(glx!.shadow).not.toBe('none');
  });

  test('lite/off tiers never boot the shader', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('azmoonsaz-glass', 'lite');
    });
    await page.goto(HARNESS);
    await waitForPath(page);
    // Give the controller its full boot window; the shader must not appear.
    await page.waitForTimeout(1200);
    const state = await page.evaluate(() => ({
      tier: document.documentElement.dataset.glass,
      render: document.documentElement.dataset.glassRender ?? null,
      canvas: !!document.getElementById('glass-canvas'),
    }));
    expect(state.tier).toBe('lite');
    expect(state.render).toBeNull();
    expect(state.canvas).toBe(false);
  });

  test('the frame loop runs: swap set, buffer sized, panels tracked', async ({ page }) => {
    await page.goto(HARNESS);
    await waitForPath(page);
    const paint = await page.evaluate(() => document.documentElement.dataset.paint);
    test.skip(paint !== 'gl', 'engine has no WebGL2 — the CSS fallback is the correct path');
    await page.waitForFunction(() => document.documentElement.dataset.glassRender === 'webgl', undefined, {
      timeout: 15000,
    });
    // Loop evidence without a pixel readback (the drawing buffer is cleared
    // after compositing — preserveDrawingBuffer is false by design): the swap
    // attribute is set BY the loop after the plate lands, the buffer was
    // sized by beginFrame/resize, and panels are tracked for drawing.
    const state = await page.evaluate(() => {
      const canvas = document.getElementById('glass-canvas') as HTMLCanvasElement | null;
      return {
        bufferW: canvas?.width ?? 0,
        bufferH: canvas?.height ?? 0,
        viewportW: window.innerWidth,
        tracked: document.querySelectorAll('[data-glass-paint="webgl"]').length,
      };
    });
    expect(state.bufferW).toBeGreaterThan(0);
    expect(state.bufferH).toBeGreaterThan(0);
    // DPR-scaled buffer at least covers the viewport in CSS px (DPR >= 1).
    expect(state.bufferW).toBeGreaterThanOrEqual(state.viewportW);
    expect(state.tracked).toBeGreaterThan(0);
  });
});
