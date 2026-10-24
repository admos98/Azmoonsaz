import { json, requireMethod, getClientIp } from '../_lib/http.js';
import { checkRateLimit } from '../_lib/rateLimit.js';
import { getSupabaseConfigStatus } from '../_lib/supabaseAdmin.js';

async function handleHealth(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  json(res, 200, { ok: true, service: 'azmoonsaz-api', timestamp: new Date().toISOString() });
}

async function handleSecurityCheck(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const supabase = getSupabaseConfigStatus();
  // F-22: one aggregate boolean instead of a per-component posture map —
  // a public config-status oracle tells an attacker which piece is missing.
  const configured = Boolean(
    supabase.hasUrl &&
      supabase.hasAnonKey &&
      supabase.hasServiceRoleKey &&
      process.env.STUDENT_ID_PEPPER &&
      process.env.STUDENT_ID_PEPPER.length >= 32,
  );
  json(res, 200, {
    ok: true,
    configured,
    warning:
      'This endpoint reports only aggregate configuration status. It never returns secret values.',
  });
}

// F-15: `student-id-demo` (unauthenticated HMAC-prefix oracle for arbitrary
// national IDs) was removed — no frontend flow called it, and a rate limit
// on an oracle is not a fix. The oracle itself is gone.

/**
 * SEC-5 fix: CSP violation collector. The Content-Security-Policy in
 * vercel.json now carries `report-uri /api/public/csp-report`, so style-src
 * injection attempts (and any other policy breach) become visible instead of
 * silent. Bounded: 16 KB body cap, one rate-limited log line per violation,
 * counts only — never raw cookies/tokens from the report shape. Always
 * answers 204: a failing collector must never produce console noise for the
 * browser or leak whether it persisted anything.
 */
async function handleCspReport(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  // Unauthenticated endpoint — bound it per IP. A limited reporter still gets
  // 204 so the response reveals nothing about our internals.
  const rate = await checkRateLimit(`csp-report:${getClientIp(req)}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (rate.ok) {
    try {
      let report = req.body;
      if (typeof report === 'string') {
        try {
          report = JSON.parse(report.slice(0, 16_384));
        } catch {
          report = null;
        }
      }
      if (!report || typeof report !== 'object') {
        report = await new Promise((resolve) => {
          const chunks = [];
          let size = 0;
          req.on('data', (chunk) => {
            size += chunk.length;
            if (size > 16_384) {
              req.destroy();
              resolve(null);
              return;
            }
            chunks.push(chunk);
          });
          req.on('end', () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
              resolve(null);
            }
          });
          req.on('error', () => resolve(null));
        });
      }
      const v = (report && typeof report === 'object' ? report['csp-report'] : null) || report;
      if (v && typeof v === 'object') {
        console.warn(
          'csp_violation ' +
            JSON.stringify({
              directive: v.violatedDirective || v['violated-directive'],
              blocked: v['blocked-uri'] || v['blockedURI'],
              source: v['source-file'] || v['sourceFile'],
            }).slice(0, 500),
        );
      }
    } catch {
      /* reporting must never throw */
    }
  }
  res.status(204).end();
}

export { handleHealth, handleSecurityCheck, handleCspReport };
