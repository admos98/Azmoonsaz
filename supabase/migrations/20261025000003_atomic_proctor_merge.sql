-- BE-10 fix: proctor-flag ingestion was a stale read-modify-write. The server
-- read proctor_flags at request start, merged counters in JS, and wrote the
-- whole object back — two concurrent saves (autosave racing the submit
-- piggyback) interleaved and the LOWER counter won, permanently undercounting
-- flags. This function performs the per-key max-merge in ONE atomic statement.
--
-- Semantics preserved from the JS merge (waveB):
--   per key: stored = greatest(existing, incoming)
--   keys are the union of both sides; non-numeric/empty values count as 0.
--
-- (2026-10-24 fix: the shipped draft referenced the update target `s`
--  inside an aggregate over a FROM-clause join — Postgres rejects that
--  with `invalid reference to FROM-clause entry for table "s"`. The union
--  key set is now expanded in a scalar subquery instead of a lateral
--  join, so the aggregate reads `s.proctor_flags` as a plain column.)
create or replace function public.bump_proctor_flags(p_session_id uuid, p_flags jsonb)
returns void
language sql
set search_path = public
as $$
  update student_exam_sessions s
  set proctor_flags = coalesce(
    (
      select jsonb_object_agg(
        kv.key,
        greatest(
          coalesce(nullif(s.proctor_flags ->> kv.key, '')::numeric, 0),
          coalesce(nullif(kv.value, '')::numeric, 0)
        )
      )
      from jsonb_each_text(coalesce(s.proctor_flags, '{}'::jsonb) || p_flags) as kv
    ),
    '{}'::jsonb
  )
  where s.id = p_session_id;
$$;

-- Defense in depth, mirroring bump_rate_limit: only the server (service_role)
-- may execute it; students/anon must never touch proctor counters.
revoke execute on function public.bump_proctor_flags(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.bump_proctor_flags(uuid, jsonb)
  to service_role;
