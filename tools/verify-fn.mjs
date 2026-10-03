import { chromium } from '@playwright/test';

const target = process.argv[2] || 'http://127.0.0.1:4173/dev/fixtures';
const browser = await chromium.launch({
  executablePath: '/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome',
  args: ['no-sandbox', '--enable-gpu', '--use-gl=angle', '--enable-unsafe-swiftshader'].map((a) => (a === 'no-sandbox' ? '--no-sandbox' : a)),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(target, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const initial = await page.evaluate(() => ({
  filters: document.querySelectorAll('filter[id^="lg-"]').length,
  hrefs: [...document.querySelectorAll('feImage')].map((i) => i.getAttribute('href').slice(0, 5)),
  glassEls: document.querySelectorAll('.lens,.pane,.drop,.glx,.glx-strong,.glx-dark').length,
}));

// 1) far panels keep plain chain until scrolled near
const scrolled = await page.evaluate(async () => {
  window.scrollTo(0, 99999);
  await new Promise((r) => setTimeout(r, 1800));
  return {
    filtersAfterScroll: document.querySelectorAll('filter[id^="lg-"]').length,
    chained: [...document.querySelectorAll('.lens,.pane,.drop,.glx,.glx-strong,.glx-dark')].filter((el) => (el.style.backdropFilter || '').includes('url(#lg-')).length,
  };
});

// 2) theme flip must NOT rebuild maps — same blob URLs survive
const flip = await page.evaluate(async () => {
  const hrefsBefore = new Set([...document.querySelectorAll('feImage')].map((i) => i.getAttribute('href')));
  const filtersBefore = document.querySelectorAll('filter[id^="lg-"]').length;
  document.documentElement.dataset.theme = 'dark';
  await new Promise((r) => setTimeout(r, 1500));
  const hrefsAfter = new Set([...document.querySelectorAll('feImage')].map((i) => i.getAttribute('href')));
  let reused = 0, fresh = 0;
  hrefsAfter.forEach((h) => (hrefsBefore.has(h) ? reused++ : fresh++));
  return { reused, fresh, filtersBefore, filtersAfter: document.querySelectorAll('filter[id^="lg-"]').length };
});

// 3) circles stay circles
const circles = await page.evaluate(() => {
  const fulls = [...document.querySelectorAll("[class*='rounded-full']")].slice(0, 4);
  const panel = document.querySelector('.lens:not(.lens--menu)');
  return {
    fullShape: fulls.map((el) => getComputedStyle(el).cornerShape),
    panelShape: panel ? getComputedStyle(panel).cornerShape : null,
    panelRadius: panel ? getComputedStyle(panel).borderRadius : null,
  };
});

await page.evaluate(() => window.scrollTo(0, 0));
console.log(JSON.stringify({ initial, scrolled, flip, circles, errors: errors.slice(0, 5) }, null, 2));
await browser.close();
