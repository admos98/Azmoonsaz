/**
 * A/B the three optimization variables on the same build:
 *  default        — worker maps + blob URLs + superellipse corners
 *  noWorker       — sync fallback (data URIs) — isolates blob vs data
 *  roundCorners   — corner-shape forced back to round — isolates the curve
 *  noWorker+round — old pipeline entirely
 * Measures scroll FPS after the engine fully settles.
 */
import { chromium } from '@playwright/test';

const url = process.argv[3] || 'http://127.0.0.1:4173/dev/fixtures';
const variant = process.argv[2] || 'default';

const browser = await chromium.launch({
  executablePath: '/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
if (variant === 'noWorker' || variant === 'noWorker+round') {
  await page.addInitScript(() => {
    // @ts-expect-error kill the worker path → controller sync fallback
    window.Worker = undefined;
  });
}
await page.goto(url, { waitUntil: 'load' });
if (variant === 'roundCorners' || variant === 'noWorker+round') {
  await page.addStyleTag({ content: `*,*::before,*::after{corner-shape:round!important}` });
}
// settle: wait until no lg- filter mutations for ~1s
await page.waitForFunction(
  () => {
    const n = document.querySelectorAll('filter[id^="lg-"]').length;
    if (n === window.__lastN) window.__stable = (window.__stable || 0) + 1;
    else window.__stable = 0;
    window.__lastN = n;
    return window.__stable > 50;
  },
  null,
  { timeout: 15000 },
).catch(() => {});
await page.waitForTimeout(800);

const r = await page.evaluate(async () => {
  const fpsP = new Promise((res) => {
    let frames = 0;
    const start = performance.now();
    // fixed distance per frame — fps-independent scroll distance
    let y = 0, dir = 1;
    const step = () => {
      frames++;
      y += dir * 14;
      if (y > 2600) dir = -1;
      if (y < 0) { dir = 1; y = 0; }
      window.scrollTo(0, y);
      if (performance.now() - start < 3000) requestAnimationFrame(step);
      else res((frames / 3).toFixed(1));
    };
    requestAnimationFrame(step);
  });
  const fps = await fpsP;
  window.scrollTo(0, 0);
  return {
    fps: Number(fps),
    filters: document.querySelectorAll('filter[id^="lg-"]').length,
    blobHrefs: [...document.querySelectorAll('feImage')].filter((i) => i.getAttribute('href')?.startsWith('blob:')).length,
    dataHrefs: [...document.querySelectorAll('feImage')].filter((i) => i.getAttribute('href')?.startsWith('data:')).length,
  };
});
console.log(variant, JSON.stringify(r));
await browser.close();
