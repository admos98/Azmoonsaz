import { json, requireMethod } from './_lib/http.js';

export default function handler(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  json(res, 200, {
    ok: true,
    service: 'azmoonsaz-api',
    timestamp: new Date().toISOString()
  });
}
