#!/usr/bin/env node
/**
 * Plate raster twins — public/backgrounds/*.2x.webp
 *
 * The WebGL glass engine loads the page plate through `new Image()`
 * (src/glass/webglRenderer.ts → setPlate). iPhone Safari refuses to decode
 * this artwork through the <img> path — measured live: ?perf=1 reports
 * `plate:"img-err"` on every retry while the SAME SVG paints fine as a CSS
 * background and desktop WebKit decodes it without complaint. So the engine
 * falls back to a raster twin next to each SVG, and a raster decode is a
 * path every engine supports.
 *
 * The twins are committed artifacts: re-run after ANY regen of
 * tools/gen-backgrounds.py.
 *
 *     node tools/render-plate-rasters.mjs
 *
 * Each SVG is rendered in Chromium at 2x the artwork size (3200x2000; the
 * engine caps plate textures at MAX_SIDE 4096, and 3200 keeps the decode
 * comfortably inside mobile image budgets while staying ~1:1 with what a
 * DPR-3 phone actually displays) and WebP-encoded at q=0.86 via canvas.
 * Requires `npx playwright install chromium` once.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('../', import.meta.url)), '.');
const dir = join(root, 'public', 'backgrounds');
const W = 3200;
const H = 2000;
const PORT = 4399;

// Same-origin serving so the canvas stays untainted and toDataURL works.
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><title>plate raster</title>');
    return;
  }
  try {
    const data = readFileSync(join(dir, path.split('/').pop()));
    res.writeHead(200, { 'content-type': 'image/svg+xml' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto(`http://127.0.0.1:${PORT}/`);

let failed = false;
for (const f of readdirSync(dir).filter((n) => n.endsWith('.svg')).sort()) {
  try {
    const dataUrl = await page.evaluate(
      async ({ url, W, H }) => {
        const img = new Image();
        img.src = url;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, W, H);
        return c.toDataURL('image/webp', 0.86);
      },
      { url: `/${f}`, W, H },
    );
    const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    if (buf.length < 4096) throw new Error(`suspiciously small encode (${buf.length} B)`);
    const out = join(dir, f.replace(/\.svg$/, '.2x.webp'));
    writeFileSync(out, buf);
    console.log(`${f} -> ${f.replace(/\.svg$/, '.2x.webp')}  ${(buf.length / 1024).toFixed(0)} KB`);
  } catch (e) {
    failed = true;
    console.error(`FAILED ${f}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

await browser.close();
server.close();
process.exit(failed ? 1 : 0);
