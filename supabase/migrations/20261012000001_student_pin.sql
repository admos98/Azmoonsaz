-- T7: student 6-digit exam PIN (hash only — the plaintext PIN is never stored).
--
-- `pin_hash` holds an HMAC (same pepper as national_id_hash, domain-separated
-- with 'student_pin:'), so verification recomputes and compares. `pin_set_at`
-- lets the teacher roster show "PIN set / not set" and timestamp resets.
-- `pin_must_change` forces the set-PIN screen on next login after a teacher reset.
alter table public.students
  add column if not exists pin_hash text,
  add column if not exists pin_set_at timestamptz,
  add column if not exists pin_must_change boolean not null default false;

-- Race guard for first-PIN-set and one-session-per-exam: two concurrent
-- start-session inserts for the same (exam, student) must not both succeed.
create unique index if not exists uq_student_exam_sessions_exam_student
  on public.student_exam_sessions (exam_id, student_id);
