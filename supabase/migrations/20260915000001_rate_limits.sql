-- Rate limiting table for cross-instance rate limiting.
-- Each Vercel function instance shares this table as the single source of truth.
create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 1,
  reset_at timestamptz not null
);

-- Auto-cleanup: pg_cron removes expired entries every 5 minutes.
-- If pg_cron is not available, the app handles eviction on read.
-- create extension if not exists pg_cron;
-- select cron.schedule('rate-limit-cleanup', '5 minutes',
--   $$ delete from public.rate_limits where reset_at < now() $$);

-- No RLS — this is a server-only table accessed via service_role key.
