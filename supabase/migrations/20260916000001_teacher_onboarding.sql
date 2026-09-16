-- Add subject and onboarding flag to teacher_profiles.
-- is_onboarded tracks whether the teacher has completed first-time setup.
-- Default false: every new signup needs to enter school name + subject before accessing dashboard.

alter table public.teacher_profiles
  add column if not exists subject text not null default '',
  add column if not exists is_onboarded boolean not null default false;
