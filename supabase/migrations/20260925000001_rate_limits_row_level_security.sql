-- Wave-1 fix (F-04): `rate_limits` lives in the exposed `public` schema but had
-- no row policies, so any Data API role holding the default GRANT (anon /
-- authenticated) could read and reset counters — a full rate-limit bypass.
--
-- Enable + FORCE RLS with zero policies = deny-all for every Data API role.
-- Server code keeps using the service_role key, which bypasses RLS, so the
-- limiter is unaffected. FORCE also binds the table owner.
-- Enable is idempotent, so the migration is replay-safe.

alter table public.rate_limits enable row level security;
alter table public.rate_limits force row level security;
