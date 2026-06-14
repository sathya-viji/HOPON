-- ============================================================================
-- phone_has_profile (pre-OTP registration check). Run: supabase test db
-- Uses the seeded u0 (phone 919999999991, completed profile).
-- ============================================================================
begin;
select plan(4);

select has_function('phone_has_profile', array['text'], 'phone_has_profile exists');
select ok(has_function_privilege('anon','phone_has_profile(text)','EXECUTE'),
  'anon can call it (pre-auth phone screen)');

-- seeded registered number → true (tolerates '+' or not)
select ok(phone_has_profile('+919999999991'), 'registered seed number → true');
-- unknown number → false
select ok(not phone_has_profile('+910000000001'), 'unknown number → false');

select * from finish();
rollback;
