-- Wave 4 (F-13 / N-06): track public.audit_logs in migrations.
--
-- Background: the table exists only on the remote database (created outside
-- the repo), which is why it has no policies in repo history — advisors
-- report it under rls_enabled_no_policy and drift scans miss it entirely.
--
-- Reproducible setup (idempotent against the live table):
--   * create-if-missing for fresh environments,
--   * ENABLE + FORCE RLS with ZERO policies = deny-all for anon/authenticated
--     (same pattern as rate_limits / F-04; service_role bypasses RLS),
--   * revoke table privileges from the API-facing roles so the Data API
--     surface stays minimal even if a policy were added by mistake later.
--
-- Writers: api/_lib/auditLog.js through the service-role client only.
-- audit_logs has no foreign keys, so creation order vs. other tables does
-- not matter. `create table if not exists` never alters an existing remote
-- table — column drift against the original dashboard-created shape is
-- checked by the read-back after `supabase db push`.

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_type text not null check (actor_type in ('teacher', 'student', 'system')),
  actor_id text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.audit_logs is
  'Security audit trail. Deny-all RLS (zero policies); service-role writers only.';

alter table public.audit_logs enable row level security;
alter table public.audit_logs force row level security;

revoke all on public.audit_logs from anon, authenticated;
