-- Wave B (exam hardening), 2026-10-06:
--  * attempt tracking — invalidation policy is warning-first, block-second:
--    first teacher invalidation resets the session for a clean retake and
--    bumps warning_count; a session with warning_count >= 1 that is
--    invalidated again flips to status 'invalidated' (permanent block).
--  * proctor_flags — counters ONLY (tabHidden/copyAttempt/...), no IP/UA,
--    no free text (F-21 PII lesson). Client sends cumulative totals;
--    server max-merges so reloads stay idempotent.
alter table public.student_exam_sessions
  add column if not exists attempt_count smallint not null default 1,
  add column if not exists warning_count smallint not null default 0,
  add column if not exists proctor_flags jsonb not null default '{}'::jsonb;
