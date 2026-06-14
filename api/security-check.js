import { json, requireMethod } from './_lib/http.js';
import { getSupabaseConfigStatus } from './_lib/supabaseAdmin.js';

export default function handler(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;

  const supabase = getSupabaseConfigStatus();
  const checks = {
    hasSupabaseUrl: supabase.hasUrl,
    hasSupabaseAnonKey: supabase.hasAnonKey,
    hasServiceRoleKey: supabase.hasServiceRoleKey,
    hasStudentIdPepper: Boolean(process.env.STUDENT_ID_PEPPER && process.env.STUDENT_ID_PEPPER.length >= 32),
  };

  json(res, 200, {
    ok: true,
    checks,
    warning: 'This endpoint reports only boolean configuration status. It never returns secret values.',
  });
}
