-- Teacher profile workspace: extended identity, multiple schools, timetable and avatar storage.
alter table public.teacher_profiles
  add column if not exists avatar_url text,
  add column if not exists bio text not null default '';

create table if not exists public.teacher_schools (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (teacher_id, name)
);

create table if not exists public.teacher_schedule (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  starts_at time not null,
  ends_at time,
  school_id uuid references public.teacher_schools(id) on delete set null,
  school_name text not null default '',
  class_name text not null default '',
  subject text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists teacher_schools_teacher_idx on public.teacher_schools(teacher_id);
create index if not exists teacher_schedule_teacher_day_idx on public.teacher_schedule(teacher_id, day_of_week, starts_at);

alter table public.teacher_schools enable row level security;
alter table public.teacher_schedule enable row level security;

drop policy if exists "Teachers manage own schools" on public.teacher_schools;
create policy "Teachers manage own schools" on public.teacher_schools for all
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists "Teachers manage own schedule" on public.teacher_schedule;
create policy "Teachers manage own schedule" on public.teacher_schedule for all
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('teacher-avatars', 'teacher-avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880;

drop policy if exists "Teachers upload own avatar" on storage.objects;
create policy "Teachers upload own avatar" on storage.objects for insert to authenticated
with check (bucket_id = 'teacher-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Teachers update own avatar" on storage.objects;
create policy "Teachers update own avatar" on storage.objects for update to authenticated
using (bucket_id = 'teacher-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Public reads teacher avatars" on storage.objects;
create policy "Public reads teacher avatars" on storage.objects for select to public
using (bucket_id = 'teacher-avatars');
