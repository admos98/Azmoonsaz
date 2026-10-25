import { json, requireMethod } from '../../_lib/http.js';
import { requireTeacher } from '../../_lib/teacherAuth.js';
import { safeError } from '../../_lib/utils.js';

async function loadTeacherProfile(teacher) {
  const [
    { data: profile, error },
    { data: schools, error: schoolsError },
    { data: schedule, error: scheduleError },
  ] = await Promise.all([
    teacher.admin
      .from('teacher_profiles')
      .select('id, full_name, school_name, subject, avatar_url, bio, is_onboarded')
      .eq('id', teacher.id)
      .maybeSingle(),
    teacher.admin
      .from('teacher_schools')
      .select('id, name, is_primary')
      .eq('teacher_id', teacher.id)
      .order('is_primary', { ascending: false }),
    teacher.admin
      .from('teacher_schedule')
      .select('id, day_of_week, starts_at, ends_at, school_id, school_name, class_name, subject')
      .eq('teacher_id', teacher.id)
      .order('day_of_week')
      .order('starts_at'),
  ]);
  if (error || schoolsError || scheduleError) {
    // Deployment-safe fallback: authentication must continue to work if the API
    // reaches production a few seconds before the profile migration completes.
    const legacy = await teacher.admin
      .from('teacher_profiles')
      .select('id, full_name, school_name, subject, is_onboarded')
      .eq('id', teacher.id)
      .maybeSingle();
    if (legacy.error) throw error || schoolsError || scheduleError || legacy.error;
    return {
      id: teacher.id,
      email: teacher.email,
      name: legacy.data?.full_name || teacher.email || 'Teacher',
      schoolName: legacy.data?.school_name || '',
      subject: legacy.data?.subject || '',
      avatarUrl: '',
      bio: '',
      isOnboarded: legacy.data?.is_onboarded ?? false,
      schools: legacy.data?.school_name
        ? [{ id: 'legacy', name: legacy.data.school_name, isPrimary: true }]
        : [],
      schedule: [],
    };
  }
  return {
    id: teacher.id,
    email: teacher.email,
    name: profile?.full_name || teacher.email || 'Teacher',
    schoolName: profile?.school_name || '',
    subject: profile?.subject || '',
    avatarUrl: profile?.avatar_url || '',
    bio: profile?.bio || '',
    isOnboarded: profile?.is_onboarded ?? false,
    schools: (schools || []).map((row) => ({
      id: row.id,
      name: row.name,
      isPrimary: row.is_primary,
    })),
    schedule: (schedule || []).map((row) => ({
      id: row.id,
      day: row.day_of_week,
      startTime: String(row.starts_at).slice(0, 5),
      endTime: row.ends_at ? String(row.ends_at).slice(0, 5) : '',
      schoolId: row.school_id || undefined,
      schoolName: row.school_name,
      className: row.class_name,
      subject: row.subject,
    })),
  };
}

export async function handleTeacherMe(req, res) {
  if (!requireMethod(req, res, ['GET'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  try {
    return json(res, 200, { ok: true, teacher: await loadTeacherProfile(teacher) });
  } catch (error) {
    return json(res, 500, safeError(error, 'teacher_profile_failed'));
  }
}

export async function handleTeacherProfile(req, res) {
  if (!requireMethod(req, res, ['POST'])) return;
  const teacher = await requireTeacher(req, res);
  if (!teacher) return;
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const subject = String(body.subject || '')
    .trim()
    .slice(0, 200);
  const bio = String(body.bio || '')
    .trim()
    .slice(0, 1000);
  const avatarUrl = String(body.avatarUrl || '')
    .trim()
    .slice(0, 2000);
  const schools = Array.isArray(body.schools)
    ? body.schools
        .map((item) => String(item.name || item).trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const schedule = Array.isArray(body.schedule) ? body.schedule.slice(0, 100) : [];
  if (!name) return json(res, 400, { error: 'missing_teacher_name' });
  // BE-9 fix: full_name was the only profile text stored without a length cap
  // (subject/bio/schools all bound at the edge per N-07). Match the student
  // name cap so an arbitrarily large name cannot enter teacher_profiles.
  if (name.length > 128) return json(res, 400, { error: 'name_too_long' });
  try {
    const { error: profileError } = await teacher.admin
      .from('teacher_profiles')
      .update({
        full_name: name,
        subject,
        bio,
        avatar_url: avatarUrl || null,
        school_name: schools[0] || '',
      })
      .eq('id', teacher.id);
    if (profileError) throw profileError;
    // BE-4 fix — make the replace non-lossy. The delete-then-insert below is
    // NOT atomic (no cross-table transaction in PostgREST), so a failed insert
    // after the deletes used to permanently destroy the saved schools and
    // schedule. Snapshot the old rows first; on any insert failure, restore
    // them before answering. Restored schedule rows keep their text fields
    // but drop school_id — the restored schools get fresh ids, and
    // school_name is the display source of truth the UI reads.
    const [prevSchools, prevSchedule] = await Promise.all([
      teacher.admin
        .from('teacher_schools')
        .select('name, is_primary')
        .eq('teacher_id', teacher.id),
      teacher.admin
        .from('teacher_schedule')
        .select('day_of_week, starts_at, ends_at, school_name, class_name, subject')
        .eq('teacher_id', teacher.id),
    ]);
    try {
      // Schedule references schools, so remove it before replacing school rows.
      const { error: scheduleDeleteError } = await teacher.admin
        .from('teacher_schedule')
        .delete()
        .eq('teacher_id', teacher.id);
      if (scheduleDeleteError) throw scheduleDeleteError;
      const { error: schoolDeleteError } = await teacher.admin
        .from('teacher_schools')
        .delete()
        .eq('teacher_id', teacher.id);
      if (schoolDeleteError) throw schoolDeleteError;
      let insertedSchools = [];
      if (schools.length) {
        const result = await teacher.admin
          .from('teacher_schools')
          .insert(
            schools.map((schoolName, index) => ({
              teacher_id: teacher.id,
              name: schoolName,
              is_primary: index === 0,
            })),
          )
          .select('id, name, is_primary');
        if (result.error) throw result.error;
        insertedSchools = result.data || [];
      }
      if (schedule.length) {
        const schoolIdByName = new Map(insertedSchools.map((school) => [school.name, school.id]));
        const rows = schedule.map((item) => ({
          teacher_id: teacher.id,
          day_of_week: Math.max(0, Math.min(6, Number(item.day) || 0)),
          starts_at: item.startTime || '08:00',
          ends_at: item.endTime || null,
          school_id: schoolIdByName.get(String(item.schoolName || '')) || null,
          school_name: String(item.schoolName || '').slice(0, 160),
          class_name: String(item.className || '').slice(0, 160),
          subject: String(item.subject || subject).slice(0, 200),
        }));
        const { error: scheduleError } = await teacher.admin.from('teacher_schedule').insert(rows);
        if (scheduleError) throw scheduleError;
      }
    } catch (writeError) {
      // Compensating restore (mirrors compensateExam on the exam-create path):
      // never leave the teacher with LESS data than they started with.
      try {
        const oldSchools = prevSchools.data || [];
        if (oldSchools.length > 0) {
          await teacher.admin.from('teacher_schools').insert(
            oldSchools.map((school) => ({
              teacher_id: teacher.id,
              name: school.name,
              is_primary: school.is_primary,
            })),
          );
        }
        const oldSchedule = prevSchedule.data || [];
        if (oldSchedule.length > 0) {
          await teacher.admin.from('teacher_schedule').insert(
            oldSchedule.map((row) => ({
              teacher_id: teacher.id,
              day_of_week: row.day_of_week,
              starts_at: row.starts_at,
              ends_at: row.ends_at,
              school_id: null,
              school_name: row.school_name,
              class_name: row.class_name,
              subject: row.subject,
            })),
          );
        }
      } catch (restoreError) {
        console.error('teacher_profile_restore_failed', restoreError?.message || restoreError);
      }
      throw writeError;
    }
    // Return through a shared data helper. Never clone/spread IncomingMessage.
    return json(res, 200, { ok: true, teacher: await loadTeacherProfile(teacher) });
  } catch (error) {
    return json(res, 400, safeError(error, 'teacher_profile_update_failed'));
  }
}
