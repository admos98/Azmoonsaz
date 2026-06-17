import { getSupabaseAdmin, getSupabasePublicServerClient } from './supabaseAdmin.js';

export function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header === 'string' && header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  return '';
}

function displayNameFromUser(user) {
  const meta = user?.user_metadata || {};
  return (
    meta.full_name ||
    meta.name ||
    user?.email?.split('@')[0] ||
    'Teacher'
  );
}

async function ensureTeacherProfile(admin, user) {
  // Several tables have a FK to teacher_profiles(id). Supabase Auth users do not
  // automatically create that row, so teacher-owned inserts can fail with FK errors.
  // This upsert is idempotent and keeps teacher onboarding friction-free.
  const fullName = displayNameFromUser(user);
  const schoolName = user?.user_metadata?.school_name || '';

  const { error } = await admin
    .from('teacher_profiles')
    .upsert({
      id: user.id,
      full_name: fullName,
      school_name: schoolName,
    }, { onConflict: 'id' });

  if (error) {
    // Do not block login in rare cases, but inserts may fail if this stays broken.
    console.error('teacher_profile_upsert_failed', error.message);
  }
}

export async function requireTeacher(req, res) {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'missing_teacher_token' });
    return null;
  }

  const publicClient = getSupabasePublicServerClient();
  const { data, error } = await publicClient.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: 'invalid_teacher_token' });
    return null;
  }

  const admin = getSupabaseAdmin();
  await ensureTeacherProfile(admin, data.user);

  return {
    id: data.user.id,
    email: data.user.email || '',
    admin,
  };
}
