import { json, requireMethod, getSupabaseConfigStatus } from '../_lib/http.js';
import { normalizeNationalId, maskNationalId } from '../_lib/crypto.js';

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
      hasStudentIdPepper: Boolean(process.env.STUDENT_ID_PEPPER && process.env.STUDENT_ID_PEPPER.length >= 32),
    },
    warning: 'This endpoint reports only boolean configuration status. It never returns secret values.',
  });
}

async function handleStudentIdDemo(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const { nationalId } = req.body || {};
  const normalized = normalizeNationalId(nationalId);
  if (!normalized) return json(res, 400, { error: 'invalid_national_id' });
  try {
    const { nationalIdHash } = await import('../_lib/crypto.js');
    json(res, 200, { ok: true, masked: maskNationalId(normalized), hashPreview: nationalIdHash(normalized).slice(0, 12) + '...' });
  } catch {
    json(res, 500, { error: 'server_secret_not_configured' });
  }
}

export { handleHealth, handleSecurityCheck, handleStudentIdDemo };
