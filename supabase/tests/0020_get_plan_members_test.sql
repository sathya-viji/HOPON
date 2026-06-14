-- ============================================================================
-- get_plan_members (host-only member list). Run: supabase test db
-- Proves: host sees joined+requested members (with public profile), the synthetic
-- is_host_row is excluded, and a non-host / unauthenticated / unknown-plan caller
-- is rejected with the typed error codes.
-- ============================================================================
begin;
select plan(11);

-- ── Fixtures: auth shells + profiles ──────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
       v.phone, now(), now(), now()
from (values
  ('50000000-0000-4000-a000-000000000001','918000000001'),  -- host
  ('50000000-0000-4000-a000-000000000002','918000000002'),  -- joined member
  ('50000000-0000-4000-a000-000000000003','918000000003'),  -- requested member
  ('50000000-0000-4000-a000-000000000004','918000000004')   -- non-host outsider
) as v(id, phone);

create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims',
    json_build_object('sub', p, 'role','authenticated')::text, true);
$FN$;

select test_login('50000000-0000-4000-a000-000000000001');
select complete_signup('Host Harry','@host_h','1990-01-01','man','HSR');
select test_login('50000000-0000-4000-a000-000000000002');
select complete_signup('Joiner Jane','@joiner_j','1991-01-01','woman','HSR');
select test_login('50000000-0000-4000-a000-000000000003');
select complete_signup('Reqi Ray','@reqi_r','1992-01-01','man','HSR');
select test_login('50000000-0000-4000-a000-000000000004');
select complete_signup('Outsider Omar','@outsider_o','1993-01-01','man','HSR');

-- Plan hosted by Harry, with two members + the synthetic host-attended row.
insert into public.plans
  (id, host_id, category_id, activity, description, location_label, lat, lng,
   starts_at, capacity, spots_remaining, plan_type, status, cost, cost_note, gender_pref)
values
  ('50000000-0000-4000-b000-000000000001','50000000-0000-4000-a000-000000000001',
   'food','Member-read test','desc','Church Street',12.97,77.60,
   now() + interval '2 days', 6, 5, 'closed'::plan_type_t, 'active'::plan_status_t,
   'free'::cost_t, null, 'all'::gender_pref_t);

insert into public.plan_members (plan_id, user_id, status, is_host_row) values
  ('50000000-0000-4000-b000-000000000001','50000000-0000-4000-a000-000000000002','joined',    false),
  ('50000000-0000-4000-b000-000000000001','50000000-0000-4000-a000-000000000003','requested', false),
  -- synthetic host row (as end_plan would write) — must be excluded from results
  ('50000000-0000-4000-b000-000000000001','50000000-0000-4000-a000-000000000001','attended',  true);

-- helpers
create or replace function _has_member(res jsonb, uid text, st text) returns boolean language sql as $FN$
  select exists (select 1 from jsonb_array_elements(res) e
                 where e->>'user_id' = uid and e->>'status' = st);
$FN$;
create or replace function _has_uid(res jsonb, uid text) returns boolean language sql as $FN$
  select exists (select 1 from jsonb_array_elements(res) e where e->>'user_id' = uid);
$FN$;
create or replace function _name_of(res jsonb, uid text) returns text language sql as $FN$
  select e->>'name' from jsonb_array_elements(res) e where e->>'user_id' = uid limit 1;
$FN$;

-- ── Contract ──────────────────────────────────────────────────────────────
select has_function('get_plan_members', array['uuid'], 'get_plan_members(uuid) exists');
select ok(not has_function_privilege('anon','get_plan_members(uuid)','EXECUTE'),
  'anon cannot execute get_plan_members');
select ok(has_function_privilege('authenticated','get_plan_members(uuid)','EXECUTE'),
  'authenticated can execute get_plan_members');

-- ── Host view ───────────────────────────────────────────────────────────────
select test_login('50000000-0000-4000-a000-000000000001');
select is(jsonb_array_length(get_plan_members('50000000-0000-4000-b000-000000000001')), 2,
  'host sees exactly the two non-host members');
select ok(_has_member(get_plan_members('50000000-0000-4000-b000-000000000001'),
  '50000000-0000-4000-a000-000000000002','joined'), 'joined member present');
select ok(_has_member(get_plan_members('50000000-0000-4000-b000-000000000001'),
  '50000000-0000-4000-a000-000000000003','requested'), 'requested member present');
select ok(not _has_uid(get_plan_members('50000000-0000-4000-b000-000000000001'),
  '50000000-0000-4000-a000-000000000001'), 'synthetic host row excluded');
select is(_name_of(get_plan_members('50000000-0000-4000-b000-000000000001'),
  '50000000-0000-4000-a000-000000000002'), 'Joiner Jane', 'public profile name joined in');

-- ── Authorization ─────────────────────────────────────────────────────────
select test_login('50000000-0000-4000-a000-000000000004');
select throws_ok($SQL$ select get_plan_members('50000000-0000-4000-b000-000000000001') $SQL$,
  'P0001', 'not_authorized', 'non-host caller is rejected (not_authorized)');

select test_login('50000000-0000-4000-a000-000000000001');
select throws_ok($SQL$ select get_plan_members('50000000-0000-4000-b000-0000000000ff') $SQL$,
  'P0001', 'plan_not_found', 'unknown plan id raises plan_not_found');

select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select throws_ok($SQL$ select get_plan_members('50000000-0000-4000-b000-000000000001') $SQL$,
  'P0001', 'not_authenticated', 'unauthenticated call raises not_authenticated');

select * from finish();
rollback;
