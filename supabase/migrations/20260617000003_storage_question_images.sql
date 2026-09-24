-- Migration for Supabase Storage bucket 'question-images'
insert into storage.buckets (id, name, public) values ('question-images', 'question-images', true) on conflict (id) do nothing;
drop policy if exists "Anyone can read question images" on storage.objects;
create policy "Anyone can read question images" on storage.objects for select using ( bucket_id = 'question-images' );
drop policy if exists "Authenticated teachers can upload question images" on storage.objects;
create policy "Authenticated teachers can upload question images" on storage.objects for insert with check ( bucket_id = 'question-images' and auth.role() = 'authenticated' );