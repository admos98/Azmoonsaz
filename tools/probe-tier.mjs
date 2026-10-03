import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: '/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173/dev/fixtures', { waitUntil: 'load' });
await page.waitForTimeout(2500);
const run = async (label) => {
  const fps = await page.evaluate(async () => {
    let frames = 0; const start = performance.now();
    await new Promise((res) => { const step = () => { frames++; window.scrollTo(0, (performance.now()-start)*1.2); if (performance.now()-start < 2000) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    window.scrollTo(0,0);
    return +(frames/2).toFixed(1);
  });
  console.log(label, fps);
};
await run('full(live-url):');
await page.evaluate(() => { document.documentElement.dataset.glass = 'lite'; });
await page.waitForTimeout(600);
await run('lite(no-bf):');
await page.evaluate(() => { delete document.documentElement.dataset.glass;
  // keep blur+saturate but strip url() from every inline chain (GPU tier sim)
  document.querySelectorAll('[style*="url("]').forEach(el => { el.style.backdropFilter = el.style.backdropFilter.replace(/\s*url\([^)]*\)/,''); });
});
await page.waitForTimeout(600);
await run('gpu-tier(blur only):');
await browser.close();
