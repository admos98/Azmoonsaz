-- Wave 2 (F-07): atomic rate-limit counter. The previous read-modify-write in
-- the serverless handler raced under concurrency (two requests could read the
-- same count and both write count+1, undercounting).
--
-- SECURITY INVOKER (default): the function runs with the caller's rights, so
-- anon/authenticated are still blocked by rate_limits' deny-all RLS even if
-- they hold EXECUTE. EXECUTE is additionally revoked from PUBLIC/anon/
-- authenticated as defense in depth — only service_role (the API) can call it.
-- Replay-safe: create or replace.

create or replace function public.bump_rate_limit(p_key text, p_window_ms integer)
returns table (bumped_count integer, reset_at timestamptz)
language sql
as $$
  insert into public.rate_limits as rl (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_ms / 1000.0))
  on conflict (key) do update
    set count = case when rl.reset_at <= now() then 1 else rl.count + 1 end,
        reset_at = case when rl.reset_at <= now()
                        then now() + make_interval(secs => p_window_ms / 1000.0)
                        else rl.reset_at end
  returning rl.count, rl.reset_at;
$$;

revoke execute on function public.bump_rate_limit(text, integer) from public, anon, authenticated;
