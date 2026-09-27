/**
 * Dev shim — runs the Vercel-style api/index.js handler on a plain Node HTTP
 * server for local Vite proxying (vite.config.ts proxies /api -> :3001).
 * Adds the res.status()/.json() helpers Vercel's runtime provides.
 */
import http from 'node:http';
import handler from '../api/index.js';

const PORT = 3001;

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    // api/[...path] parity: expose matched segments as req.query.path
    const path = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
    req.query = { ...Object.fromEntries(url.searchParams), path };

    // Buffer the body so handler receives text/json like Vercel does
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (raw) {
      req.body = raw;
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try { req.body = JSON.parse(raw); } catch { /* keep raw string */ }
      }
    }

    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (data) => {
      if (!res.getHeader('content-type')) res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };

    await handler(req, res);
  } catch (err) {
    console.error('[api-shim] handler error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
    }
    if (!res.writableEnded) res.end(JSON.stringify({ error: 'internal_error' }));
  }
});

server.listen(PORT, () => console.log(`[api-shim] listening on :${PORT}`));
