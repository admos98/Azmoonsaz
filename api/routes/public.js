import { json, requireMethod, getClientIp } from '../_lib/http.js';
import { getSupabaseConfigStatus } from '../_lib/supabaseAdmin.js';
import { normalizeNationalId, maskNationalId } from '../_lib/crypto.js';
import { checkRateLimit } from '../_lib/rateLimit.js';

async function handleHealth(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  json(res, 200, { ok: true, service: 'azmoonsaz-api', timestamp: new Date().toISOString() });
}

async function handleSecurityCheck(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const supabase = getSupabaseConfigStatus();
  json(res, 200, {
    ok: true,
    checks: {
      hasSupabaseUrl: supabase.hasUrl,
      hasSupabaseAnonKey: supabase.hasAnonKey,
      hasServiceRoleKey: supabase.hasServiceRoleKey,
      hasStudentIdPepper: Boolean(
        process.env.STUDENT_ID_PEPPER && process.env.STUDENT_ID_PEPPER.length >= 32,
      ),
    },
    warning:
      'This endpoint reports only boolean configuration status. It never returns secret values.',
  });
}

async function handleStudentIdDemo(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  // F-08: capped oracle — 10 probes/minute/IP against the HMAC prefix leak.
  const rate = await checkRateLimit('student-id-demo:' + getClientIp(req), {
    limit: 10,
    windowMs: 60_000,
  });
  if (!rate.ok) return json(res, 429, { error: 'too_many_requests' });
  const { nationalId } = req.body || {};
  const normalized = normalizeNationalId(nationalId);
  if (!normalized) return json(res, 400, { error: 'invalid_national_id' });
  try {
    const { nationalIdHash } = await import('../_lib/crypto.js');
    json(res, 200, {
      ok: true,
      masked: maskNationalId(normalized),
      hashPreview: nationalIdHash(normalized).slice(0, 12) + '...',
    });
  } catch {
    json(res, 500, { error: 'server_secret_not_configured' });
  }
}

export { handleHealth, handleSecurityCheck, handleStudentIdDemo };
