-- BE-5 fix: the teacher UI (create / edit / bulk import) collects student
-- email and phone number and the API contract maps them back, but no columns
-- existed — the values were silently dropped on every write. Add the columns
-- the API now persists (bounded at the edge: email <= 200, phone <= 32 chars,
-- via boundedOptionalText in api/_lib/utils.js).
alter table public.students
  add column if not exists email text;

alter table public.students
  add column if not exists phone_number text;
