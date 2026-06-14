-- ============================================================================
-- Migration 0014m — phone_has_profile (pre-OTP registration check)
-- Integration-driven addition: lets the phone-entry screens tell, BEFORE sending
-- an OTP, whether a number already has a completed account — so signup can block
-- a registered number and login can catch an unknown one without a wasted OTP.
--
-- anon-executable (the phone screens are pre-auth). Returns only a boolean for
-- the exact number queried. Note: this is an existence-enumeration surface by
-- nature; GoTrue already rate-limits the OTP step, and we can add an explicit
-- rate limit here later if abused. Compares against GoTrue's stored phone, which
-- has no '+'.
-- ============================================================================
create or replace function phone_has_profile(p_phone text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from auth.users au
    join public.users u on u.id = au.id
    where au.phone = replace(p_phone, '+', '')
      and u.deleted_at is null
  );
$$;
revoke execute on function phone_has_profile(text) from public;
grant execute on function phone_has_profile(text) to anon, authenticated;
