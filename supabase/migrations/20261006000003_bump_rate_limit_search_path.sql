-- Advisor fix: pin the function's search_path (function_search_path_mutable).
-- bump_rate_limit is SECURITY INVOKER with EXECUTE revoked to postgres +
-- service_role only, so this is defense in depth rather than an escalation
-- path — but a fixed search_path keeps future DDL/order changes from
-- redirecting its unqualified references.
-- Signature: public.bump_rate_limit(p_key text, p_window_ms integer)

alter function public.bump_rate_limit(text, integer)
  set search_path = public, pg_temp;
