import { json } from '../_lib/http.js';
import { requireTeacher } from '../_lib/teacherAuth.js';
import { auditLog } from '../_lib/auditLog.js';

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
  // F-20: DB columns are plain text — bound the edge input.
  if (schoolName.length > 200) return json(res, 400, { error: 'school_name_too_long' });
  if (subject.length > 100) return json(res, 400, { error: 'subject_too_long' });

  const { error } = await teacher.admin
    .from('teacher_profiles')
    .update({
      school_name: schoolName,
      subject,
      is_onboarded: true,
    })
    .eq('id', teacher.id);

  if (error) return json(res, 500, { error: 'onboarding_update_failed' });

  await auditLog(teacher.admin, {
    actorType: 'teacher',
    actorId: teacher.id,
    action: 'onboarding_complete',
    entityType: 'teacher_profile',
    entityId: teacher.id,
    metadata: { schoolName, subject },
  });
  return json(res, 200, { ok: true });
}
