import { json, requireMethod } from '../_lib/http.js';
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

export { handleHealth, handleSecurityCheck };
