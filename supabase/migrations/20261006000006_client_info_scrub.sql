-- Wave 4 (F-21): scrub PII from existing rows.
--
-- The API stopped writing IP/User-Agent into student_exam_sessions.client_info
-- (nothing ever read it). Existing rows created before that change may still
-- hold captured identifiers — clear them once. The column keeps its '{}'
-- default and stays empty from now on.

update public.student_exam_sessions
set client_info = '{}'::jsonb
where client_info is distinct from '{}'::jsonb;
