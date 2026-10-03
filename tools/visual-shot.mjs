import { chromium } from '@playwright/test';

const target = process.argv[2] || 'http://127.0.0.1:4173/dev/fixtures';
const out = process.argv[3] || 'shot';
const browser = await chromium.launch({
  executablePath: '/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['--no-sandbox', '--enable-gpu', '--use-gl=angle', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(target, { waitUntil: 'load' });
await page.evaluate(() => {
  document.documentElement.dataset.theme = 'light';
});
await page.waitForFunction(
  () => {
    const n = document.querySelectorAll('filter[id^="lg-"]').length;
    if (n === window.__lastN) window.__stable = (window.__stable || 0) + 1;
    else window.__stable = 0;
    window.__lastN = n;
    return window.__stable > 60;
  },
  null,
  { timeout: 15000 },
).catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: `/home/z/my-project/scripts/${out}_full.png` });
// zoom on the first big card's top-left corner + left edge
const box = await page.evaluate(() => {
  const el = document.querySelector('.lens');
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y + window.scrollY, w: r.width, h: r.height };
});
await page.screenshot({
  path: `/home/z/my-project/scripts/${out}_corner.png`,
  clip: { x: box.x - 20, y: box.y - 20, width: 160, height: 160 },
});
await page.screenshot({
  path: `/home/z/my-project/scripts/${out}_edge.png`,
  clip: { x: box.x - 12, y: box.y + 60, width: 48, height: 120 },
});
console.log(out, JSON.stringify(box));
await browser.close();
