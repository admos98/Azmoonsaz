-- Azmoonsaz security-first schema draft.
-- Review before running in Supabase. This is a foundation, not the final full schema.

create extension if not exists pgcrypto;

create table if not exists public.teacher_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  school_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.class_groups (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  name text not null,
  grade text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  class_group_id uuid references public.class_groups(id) on delete set null,
  full_name text not null,
  grade text not null,
  national_id_hash text not null,
  national_id_last4 text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  unique (teacher_id, national_id_hash)
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  exam_code text not null unique,
  title text not null,
  grade text not null,
  subject text not null,
  status text not null default 'draft' check (status in ('draft','scheduled','active','completed','archived')),
  mode text not null default 'official' check (mode in ('official','practice')),
  starts_at timestamptz,
  ends_at timestamptz,
  duration_minutes integer not null default 45 check (duration_minutes > 0 and duration_minutes <= 360),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_allowed_classes (
  exam_id uuid not null references public.exams(id) on delete cascade,
  class_group_id uuid not null references public.class_groups(id) on delete cascade,
  primary key (exam_id, class_group_id)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher_profiles(id) on delete cascade,
  type text not null,
  grade text not null,
  subject text not null,
  title text not null,
  body jsonb not null,
  answer_key jsonb not null,
  points numeric(6,2) not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.exam_questions (
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  section_title text,
  position integer not null default 0,
  points numeric(6,2),
  primary key (exam_id, question_id)
);

create table if not exists public.student_exam_sessions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'ongoing' check (status in ('ongoing','submitted','graded','expired','invalidated')),
  variant_seed text,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  client_info jsonb not null default '{}'::jsonb,
  unique (exam_id, student_id)
);

create table if not exists public.student_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.student_exam_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_type text not null check (actor_type in ('teacher','student','system')),
  actor_id text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.teacher_profiles enable row level security;
alter table public.class_groups enable row level security;
alter table public.students enable row level security;
alter table public.exams enable row level security;
alter table public.exam_allowed_classes enable row level security;
alter table public.questions enable row level security;
alter table public.exam_questions enable row level security;
alter table public.student_exam_sessions enable row level security;
alter table public.student_answers enable row level security;
alter table public.audit_logs enable row level security;

create policy "teacher can read own profile" on public.teacher_profiles for select using (id = auth.uid());
create policy "teacher can update own profile" on public.teacher_profiles for update using (id = auth.uid());

create policy "teacher owns classes" on public.class_groups for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "teacher owns students" on public.students for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "teacher owns exams" on public.exams for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "teacher owns questions" on public.questions for all using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- Session/answer/audit writes should primarily be done with service-role backend APIs.
