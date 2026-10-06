-- Wave 2 (F-06): question-images hardening.
-- The bucket was public with no size/MIME limits and a deprecated
-- auth.role() write predicate — every uploaded exam image was world-readable
-- by URL, and unbounded uploads were possible. Hardening:
--   * private bucket (no anonymous reads; teachers read via authenticated
--     session or server-signed URLs)
--   * 5 MB cap + image MIME allow-list (enforced by Storage on every upload)
--   * policies rewritten to `to authenticated` (replaces auth.role())
-- Replay-safe: `on conflict do nothing`, `drop policy if exists`.
--
-- NOTE: question bodies currently store base64/external URLs, not bucket
-- URLs, so no live flow breaks. When app flows start writing to this bucket,
-- student-facing reads must be issued as signed URLs from exam-payload
-- (service_role), never as public URLs.

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = '{image/jpeg,image/png,image/webp,image/gif}'
where id = 'question-images';

drop policy if exists "Anyone can read question images" on storage.objects;
create policy "Teachers can read question images"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'question-images');

drop policy if exists "Authenticated teachers can upload question images" on storage.objects;
create policy "Authenticated teachers can upload question images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'question-images');
