-- PIN-reset session revocation (follow-up to 20261012000001_student_pin.sql).
--
-- `reset-pin` marks the student's ONGOING sessions invalidated with reason
-- 'pin_reset' so a squatter's bearer dies with the reset. start-session
-- re-admits exactly those rows (UPDATE in place — status/started_at reset,
-- invalidated_reason cleared — and the prior answers explicitly deleted) so
-- the student resumes on the same session row rather than a fresh mint.
-- Proctor invalidations (NULL/legacy reason) stay permanently blocked — the
-- second-strike policy is unchanged.
alter table public.student_exam_sessions
  add column if not exists invalidated_reason text;
