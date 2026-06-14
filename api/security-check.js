import { json, requireMethod } from './_lib/http.js';

export default function handler(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;

  const checks = {
    hasSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL),
    hasSupabaseAnonKey: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasStudentIdPepper: Boolean(process.env.STUDENT_ID_PEPPER && process.env.STUDENT_ID_PEPPER.length >= 32)
  };

  json(res, 200, {
    ok: true,
    checks,
    warning: 'Do not expose server-only environment variable values. This endpoint only reports boolean presence.'
  });
}
