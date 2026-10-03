/**
 * Liquid-glass load/perf probe for the Azmoonsaz app (preview build).
 * Measures, on /dev/fixtures (deterministic, no backend):
 *  1. FCP, DOM content loaded
 *  2. engineStart (first lg- filter in DOM) / engineIdle (last insertion)
 *  3. long tasks (>50ms) with total blocking time
 *  4. scroll FPS over 2s
 *  5. theme-flip settle cost
 * Usage: node tools/perf-probe.mjs <url> [outPrefix]
 */
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'http://localhost:4173/dev/fixtures';
const prefix = process.argv[3] || 'perf';

const browser = await chromium.launch({
  executablePath: '/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.addInitScript(() => {
  window.__lgProbe = { longTasks: [], tbt: 0 };
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__lgProbe.longTasks.push({ s: e.startTime, d: e.duration });
        window.__lgProbe.tbt += Math.max(0, e.duration - 50);
      }
    });
    po.observe({ entryTypes: ['longtask'] });
  } catch {}
  window.__engineStart = null;
  window.__engineIdle = null;
  const mo = new MutationObserver(() => {
    const n = document.querySelectorAll('filter[id^="lg-"]').length;
    const now = performance.now();
    if (n > 0 && window.__engineStart === null) window.__engineStart = now;
    if (n > 0) window.__engineIdle = now;
  });
  const attach = (root) =>
    root && root.nodeType === 1
      ? mo.observe(root, { childList: true, subtree: true })
      : setTimeout(() => attach(document.documentElement), 2);
  attach(document.documentElement);
});

await page.goto(url, { waitUntil: 'load' });
// settle: wait until filter count stable for ~0.5s
await page
  .waitForFunction(
    () => {
      const n = document.querySelectorAll('filter[id^="lg-"]').length;
      if (n > 0 && n === window.__lastN) window.__stableN = (window.__stableN || 0) + 1;
      else window.__stableN = 0;
      window.__lastN = n;
      return window.__stableN > 30;
    },
    null,
    { timeout: 20000 },
  )
  .catch(() => {});
await page.waitForTimeout(400);

const metrics = await page.evaluate(async () => {
  const paint = performance.getEntriesByType('paint').map((p) => [p.name, Math.round(p.startTime)]);
  const nav = performance.getEntriesByType('navigation')[0];
  const fpsP = new Promise((res) => {
    let frames = 0;
    const start = performance.now();
    const step = () => {
      frames++;
      window.scrollTo(0, (performance.now() - start) * 1.2);
      if (performance.now() - start < 2000) requestAnimationFrame(step);
      else res((frames / 2).toFixed(1));
    };
    requestAnimationFrame(step);
  });
  const fps = await fpsP;
  window.scrollTo(0, 0);
  const lt = window.__lgProbe.longTasks;
  return {
    fcp: paint.find(([n]) => n === 'first-contentful-paint')?.[1] ?? null,
    domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
    engineStart: window.__engineStart === null ? null : Math.round(window.__engineStart),
    engineIdle: window.__engineIdle === null ? null : Math.round(window.__engineIdle),
    fps: Number(fps),
    longTasks: lt.length,
    tbt: Math.round(window.__lgProbe.tbt),
    worstTask: lt.length ? Math.round(Math.max(...lt.map((t) => t.d))) : 0,
    glassCount: document.querySelectorAll('.lens,.pane,.drop,.glx,.glx-strong,.glx-dark').length,
    filterCount: document.querySelectorAll('filter[id^="lg-"]').length,
  };
});

const flip = await page.evaluate(async () => {
  const el = document.documentElement;
  el.dataset.theme = el.dataset.theme === 'dark' ? 'light' : 'dark';
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 700));
  return Math.round(performance.now() - t0);
});

console.log(JSON.stringify({ url, ...metrics, themeFlipSettleMs: flip }, null, 2));
await page.screenshot({ path: `/home/z/my-project/scripts/${prefix}_top.png` });
await browser.close();
