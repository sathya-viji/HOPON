-- ============================================================================
-- Phase 1 RPC tests — complete_signup, export_my_data, delete_account,
-- match_contact_hashes. Run with: supabase test db
-- auth.uid() is simulated via request.jwt.claims, the mechanism Supabase uses.
-- ============================================================================
begin;
select plan(16);

-- ── Fixtures: two auth shell users ────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values
  ('20000000-0000-4000-a000-000000000001','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','919876500001', now(), now(), now()),
  ('20000000-0000-4000-a000-000000000002','00000000-0000-0000-0000-000000000000',
   'authenticated','authenticated','919876500002', now(), now(), now());

create or replace function test_login(p_uid uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$FN$;

-- ── complete_signup: happy path ───────────────────────────────────────────
select test_login('20000000-0000-4000-a000-000000000001');

select lives_ok($SQL$
  select complete_signup('Asha', '@asha', '1994-05-01', 'woman', 'HSR Layout')
$SQL$, 'complete_signup creates a profile');

select results_eq(
  $SQL$ select handle from users where id = '20000000-0000-4000-a000-000000000001' $SQL$,
  array['@asha'], 'profile row persisted with handle');

select results_eq(
  $SQL$ select verification_level::text from users
        where id = '20000000-0000-4000-a000-000000000001' $SQL$,
  array['phone'], 'D1: OTP signup yields verification_level = phone');

-- Idempotent retry returns existing profile, no error
select lives_ok($SQL$
  select complete_signup('Asha Again', '@different', '1994-05-01', 'woman', 'HSR')
$SQL$, 'retried signup is idempotent');
select results_eq(
  $SQL$ select name from users where id = '20000000-0000-4000-a000-000000000001' $SQL$,
  array['Asha'], 'retry did not overwrite the original profile');

-- ── complete_signup: error codes ──────────────────────────────────────────
select test_login('20000000-0000-4000-a000-000000000002');

select throws_ok($SQL$
  select complete_signup('Teen', '@teen', (current_date - interval '17 years')::date, 'man', 'HSR')
$SQL$, 'P0001', 'underage', 'F1: underage raises typed error');

select throws_ok($SQL$
  select complete_signup('Dup', '@asha', '1990-01-01', 'man', 'HSR')
$SQL$, 'P0001', 'handle_taken', 'duplicate handle raises handle_taken');

select throws_ok($SQL$
  select complete_signup('Bad', 'asha', '1990-01-01', 'man', 'HSR')
$SQL$, 'P0001', 'invalid_handle', 'handle without @ raises invalid_handle');

select lives_ok($SQL$
  select complete_signup('Ravi', '@ravi', '1992-02-02', 'man', 'Koramangala')
$SQL$, 'second user signs up cleanly');

-- ── export_my_data ────────────────────────────────────────────────────────
select test_login('20000000-0000-4000-a000-000000000001');

select ok(
  (select export_my_data() -> 'profile' ->> 'handle') = '@asha',
  'export contains own profile');
select ok(
  (select export_my_data() -> 'profile' ? 'gender'),
  'export includes private fields — it is the user''s own data');
select ok(
  (select export_my_data() ? 'contact_hashes'),
  'export covers contact_hashes section');

-- ── match_contact_hashes (service-role helper) ───────────────────────────
-- Hash of Ravi's phone '+919876500002' should match.
select set_config('request.jwt.claims', null, true);  -- service context

select results_eq($SQL$
  select handle from match_contact_hashes(
    '20000000-0000-4000-a000-000000000001',
    array[encode(extensions.digest('+919876500002', 'sha256'), 'hex')])
$SQL$, array['@ravi'], 'contact hash matches existing user by E.164(+) convention');

select is_empty($SQL$
  select * from match_contact_hashes(
    '20000000-0000-4000-a000-000000000002',
    array[encode(extensions.digest('+919876500002', 'sha256'), 'hex')])
$SQL$, 'self is excluded from matches');

-- ── delete_account ────────────────────────────────────────────────────────
select test_login('20000000-0000-4000-a000-000000000002');

select lives_ok($SQL$ select delete_account() $SQL$, 'delete_account succeeds');

select results_eq($SQL$
  select (deleted_at is not null and account_status = 'suspended')
  from users where id = '20000000-0000-4000-a000-000000000002'
$SQL$, array[true], 'F3: soft-deleted + suspended, awaiting 30-day hard delete');

select * from finish();
rollback;
