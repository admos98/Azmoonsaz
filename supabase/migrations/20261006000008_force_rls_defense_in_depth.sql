-- Wave D (N-08): owner-bypass defense-in-depth.
-- The 11 tables that only had ENABLE now get FORCE too, so a future owner
-- that is not a superuser must obey policies as well. Functionally inert
-- today (owner = superuser `postgres`, service_role carries BYPASSRLS —
-- proven by the FORCE'd `rate_limits` RPC working live since wave 2), so
-- this is safe to apply at any time.
alter table public.teacher_profiles force row level security;
alter table public.class_groups force row level security;
alter table public.students force row level security;
alter table public.exams force row level security;
alter table public.exam_allowed_classes force row level security;
alter table public.questions force row level security;
alter table public.exam_questions force row level security;
alter table public.student_exam_sessions force row level security;
alter table public.student_answers force row level security;
alter table public.teacher_schools force row level security;
alter table public.teacher_schedule force row level security;
