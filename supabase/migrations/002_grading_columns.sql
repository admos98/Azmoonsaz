-- Optional grading hardening migration.
-- Safe to run after schema-security-draft.sql.

alter table public.student_answers
  add column if not exists score_gained numeric(6,2),
  add column if not exists teacher_comment text,
  add column if not exists is_correct boolean;

alter table public.student_exam_sessions
  add column if not exists score numeric(6,2),
  add column if not exists max_score numeric(6,2),
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid references public.teacher_profiles(id);

create index if not exists idx_student_answers_session_id on public.student_answers(session_id);
create index if not exists idx_student_sessions_exam_id on public.student_exam_sessions(exam_id);
create index if not exists idx_students_teacher_hash on public.students(teacher_id, national_id_hash);
create index if not exists idx_exams_teacher_code on public.exams(teacher_id, exam_code);
