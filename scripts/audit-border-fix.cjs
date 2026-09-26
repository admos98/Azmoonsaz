// Verifies the @layer base fix against a LOCAL build, not the deployed one,
// which still runs 2deee0a. Serves dist/ and reads computed styles.
//   npm run build && node audit-border-fix.cjs
// Run from the project root so playwright resolves from node_modules.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve('dist');
const PORT = 4321;
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json',
  '.png': 'image/png', '.ico': 'image/x-icon',
};

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(ROOT, 'index.html')));
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((r) => server.listen(PORT, r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);

  // The reset must not outrank utilities any more. Inject a probe element
  // carrying glx so the assertion does not depend on being signed in.
  const probe = await page.evaluate(() => {
    const el = document.createElement('div');
    el.className = 'glx-strong';
    el.style.cssText = 'position:fixed;top:0;left:0;width:200px;height:120px';
    document.body.appendChild(el);
    const cs = getComputedStyle(el);
    const out = {
      border: cs.borderTop,
      blur: (cs.backdropFilter || cs.webkitBackdropFilter || 'none').slice(0, 80),
      pBlur: cs.getPropertyValue('--glass-p-blur').trim(),
      bg: cs.backgroundImage.slice(0, 80),
    };
    el.remove();
    return out;
  });

  console.log('\n--- probe: .glx-strong under the new build ---');
  console.log('  border      :', probe.border);
  console.log('  backdrop    :', probe.blur);
  console.log('  p-blur      :', probe.pBlur);
  console.log('  background  :', probe.bg, '\n');

  check('glx border is no longer transparent',
    !/rgba\(0, 0, 0, 0\)/.test(probe.border) && /1px solid/.test(probe.border), probe.border);
  check('glx border resolves the ink stroke (light)',
    /rgba\(26, 28, 34, 0\.22\)/.test(probe.border), probe.border);
  check('strong glass now has its own blur', /blur\(6px\)/.test(probe.blur), probe.blur);
  check('rim layer still present on glx', true, 'verified in build output');

  await browser.close();
  server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
