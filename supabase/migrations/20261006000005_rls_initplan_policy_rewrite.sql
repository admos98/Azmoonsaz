-- Wave 4 (N-05): auth_rls_initplan advisor warning.
--
-- Policies that reference auth.uid() directly inside USING/WITH CHECK
-- re-evaluate the function for every row scanned. Wrapping it as
-- (select auth.uid()) turns it into an initplan expression evaluated once
-- per statement. auth.uid() is STABLE (constant for the duration of a
-- statement), so this is semantics-preserving — only evaluation timing
-- changes.
--
-- Replay-safe: drop-if-exists + create for all 10 policies, same names,
-- same predicates, same roles.

-- public.teacher_profiles
drop policy if exists "teacher can read own profile" on public.teacher_profiles;
create policy "teacher can read own profile" on public.teacher_profiles
  for select using ((select auth.uid()) = id);

drop policy if exists "teacher can update own profile" on public.teacher_profiles;
create policy "teacher can update own profile" on public.teacher_profiles
  for update using ((select auth.uid()) = id);

-- public.class_groups
drop policy if exists "teacher owns classes" on public.class_groups;
create policy "teacher owns classes" on public.class_groups
  for all using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- public.students
drop policy if exists "teacher owns students" on public.students;
create policy "teacher owns students" on public.students
  for all using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- public.exams
drop policy if exists "teacher owns exams" on public.exams;
create policy "teacher owns exams" on public.exams
  for all using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- public.questions
drop policy if exists "teacher owns questions" on public.questions;
create policy "teacher owns questions" on public.questions
  for all using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- public.teacher_schools
drop policy if exists "Teachers manage own schools" on public.teacher_schools;
create policy "Teachers manage own schools" on public.teacher_schools
  for all using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- public.teacher_schedule
drop policy if exists "Teachers manage own schedule" on public.teacher_schedule;
create policy "Teachers manage own schedule" on public.teacher_schedule
  for all using (teacher_id = (select auth.uid()))
  with check (teacher_id = (select auth.uid()));

-- storage.objects (teacher-avatars)
drop policy if exists "Teachers upload own avatar" on storage.objects;
create policy "Teachers upload own avatar" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'teacher-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Teachers update own avatar" on storage.objects;
create policy "Teachers update own avatar" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'teacher-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
