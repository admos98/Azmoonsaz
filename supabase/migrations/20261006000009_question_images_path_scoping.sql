-- Wave D (N-10): path-scoped storage policies for question images.
-- Bucket-wide `to authenticated` let ANY teacher list/download every
-- object in the bucket (cross-tenant read within the teacher tier).
-- Scope reads and uploads to each teacher's own folder — the same
-- `storage.foldername(name)[1] = auth.uid()` shape the avatars bucket
-- already uses, with N-05's `(select auth.uid())` per-row evaluation.
--
-- No UPDATE/DELETE policy exists (overwrite/delete stay impossible), and
-- the bucket has no live producer yet (per 20261006000002's NOTE), so
-- there are no existing objects to migrate; root-level leftovers would
-- only be reachable via service_role.
drop policy if exists "Teachers can read question images" on storage.objects;
create policy "Teachers can read question images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'question-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Authenticated teachers can upload question images" on storage.objects;
create policy "Authenticated teachers can upload question images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'question-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
