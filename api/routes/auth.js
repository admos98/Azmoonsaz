import { getSupabaseAdmin } from '../_lib/supabaseAdmin.js';
import { json } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';

/**
 * POST /api/auth/signup
 * Body: { email, password }
 * Creates a Supabase Auth user with email_confirm: false.
 * Supabase sends the verification email automatically.
 */
export async function handleSignup(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const body = req.body || {};
  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  if (!email || !password) return json(res, 400, { error: 'missing_fields' });
  if (password.length < 6) return json(res, 400, { error: 'password_too_short' });

  const admin = getSupabaseAdmin();

  // Check if user already exists
  const { data: existing } = await admin.auth.admin.listUsers({ filter: email });
  if (existing?.users?.length > 0) {
    return json(res, 409, { error: 'email_already_registered' });
  }

  // Create auth user — Supabase sends verification email automatically
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: false,
  });

  if (error) return json(res, 400, { error: error.message });

  // Upsert teacher profile with is_onboarded = false
  await admin.from('teacher_profiles').upsert({
    id: data.user.id,
    full_name: email.split('@')[0],
    school_name: '',
    subject: '',
    is_onboarded: false,
  }, { onConflict: 'id' });

  return json(res, 200, { ok: true, message: 'verification_email_sent' });
}

/**
 * GET /api/auth/onboarding-status
 * Returns whether the current teacher has completed onboarding.
 */
export async function handleOnboardingStatus(req, res) {
  if (req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' });

  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  const { data, error } = await teacher.admin
    .from('teacher_profiles')
    .select('is_onboarded, school_name, subject')
    .eq('id', teacher.id)
    .maybeSingle();

  if (error) return json(res, 500, { error: 'profile_fetch_failed' });

  return json(res, 200, {
    ok: true,
    isOnboarded: data?.is_onboarded ?? false,
    schoolName: data?.school_name || '',
    subject: data?.subject || '',
  });
}

/**
 * POST /api/auth/onboarding
 * Body: { schoolName, subject }
 * Sets the teacher's school name and subject, marks as onboarded.
 */
export async function handleOnboarding(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });

  const teacher = await requireTeacher(req, res);
  if (!teacher) return;

  const body = req.body || {};
  const schoolName = String(body.schoolName || '').trim();
  const subject = String(body.subject || '').trim();

  if (!schoolName) return json(res, 400, { error: 'missing_school_name' });
  if (!subject) return json(res, 400, { error: 'missing_subject' });

  const { error } = await teacher.admin
    .from('teacher_profiles')
    .update({
      school_name: schoolName,
      subject,
      is_onboarded: true,
    })
    .eq('id', teacher.id);

  if (error) return json(res, 500, { error: 'onboarding_update_failed' });

  return json(res, 200, { ok: true });
}
