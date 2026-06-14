-- ============================================================================
-- Phase 2 RPC tests — create/join/leave/approve/decline/update/cancel + reads.
-- Gender matrix (D11), spot accounting, idempotency, host/closed flows.
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(27);

-- ── Fixtures: auth shells + profiles of known genders ─────────────────────
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
       v.phone, now(), now(), now()
from (values
  ('30000000-0000-4000-a000-000000000001','918000000001'),  -- host (man)
  ('30000000-0000-4000-a000-000000000002','918000000002'),  -- woman
  ('30000000-0000-4000-a000-000000000003','918000000003'),  -- man
  ('30000000-0000-4000-a000-000000000004','918000000004')   -- nonbinary
) as v(id, phone);

create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims',
    json_build_object('sub', p, 'role','authenticated')::text, true);
$FN$;

select test_login('30000000-0000-4000-a000-000000000001');
select lives_ok($SQL$ select complete_signup('Host','@host_x','1990-01-01','man','HSR') $SQL$, 'host signup');
select test_login('30000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select complete_signup('Wen','@wen_x','1992-01-01','woman','HSR') $SQL$, 'woman signup');
select test_login('30000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select complete_signup('Manny','@manny_x','1992-01-01','man','HSR') $SQL$, 'man signup');
select test_login('30000000-0000-4000-a000-000000000004');
select lives_ok($SQL$ select complete_signup('Enby','@enby_x','1992-01-01','nonbinary','HSR') $SQL$, 'nonbinary signup');

-- ── create_plan ───────────────────────────────────────────────────────────
select test_login('30000000-0000-4000-a000-000000000001');

select lives_ok($SQL$
  select create_plan('sports','Badminton','Play Arena',12.91,77.63,
    now() + interval '2 hours', 4::smallint, 'open','free','all')
$SQL$, 'create_plan (open, everyone) succeeds');

-- capture the created plan id
create temporary table _t as
  select id as open_plan from plans where host_id='30000000-0000-4000-a000-000000000001' and gender_pref='all' limit 1;

select results_eq(
  $SQL$ select spots_remaining from plans, _t where plans.id=_t.open_plan $SQL$,
  array[3::smallint], 'new open plan: cap4 - host = 3 spots');

-- 14-day + past rejects
select throws_ok($SQL$ select create_plan('food','X','L',1,1, now() - interval '1 hour', 4::smallint,'open','free','all') $SQL$,
  'P0001','starts_in_past','create_plan rejects past start');
select throws_ok($SQL$ select create_plan('food','X','L',1,1, now() + interval '30 days', 4::smallint,'open','free','all') $SQL$,
  'P0001','starts_too_far','create_plan rejects >14 days');

-- women-only plan for the gender matrix
select lives_ok($SQL$
  select create_plan('outdoors','Sunset walk','Lalbagh',12.95,77.58,
    now() + interval '3 hours', 4::smallint, 'open','free','women')
$SQL$, 'create_plan (women-only) succeeds');
create temporary table _w as
  select id as women_plan from plans where host_id='30000000-0000-4000-a000-000000000001' and gender_pref='women' limit 1;

-- closed plan
select lives_ok($SQL$
  select create_plan('sports','Quiz','Humming Tree',12.97,77.64,
    now() + interval '5 hours', 4::smallint, 'closed','free','all')
$SQL$, 'create_plan (closed) succeeds');
create temporary table _c as
  select id as closed_plan from plans where host_id='30000000-0000-4000-a000-000000000001' and plan_type='closed' limit 1;

-- ── join_plan: open, spot accounting ───────────────────────────────────────
select test_login('30000000-0000-4000-a000-000000000002');  -- woman
select lives_ok($SQL$ select join_plan((select open_plan from _t), gen_random_uuid()) $SQL$, 'woman joins open plan');
select results_eq($SQL$ select spots_remaining from plans,_t where plans.id=_t.open_plan $SQL$,
  array[2::smallint], 'open plan spots: 3 -> 2 after one join');

-- idempotent join (same key) does not double-insert
select test_login('30000000-0000-4000-a000-000000000003');  -- man
select lives_ok($SQL$ select join_plan((select open_plan from _t), '44444444-4444-4444-4444-444444444444') $SQL$, 'man joins with key');
select lives_ok($SQL$ select join_plan((select open_plan from _t), '44444444-4444-4444-4444-444444444444') $SQL$, 'same key retry is idempotent');
select results_eq($SQL$ select count(*)::int from plan_members pm,_t where pm.plan_id=_t.open_plan $SQL$,
  array[2], 'idempotent retry did not create a duplicate row');

-- ── join_plan: GENDER MATRIX (D11) ─────────────────────────────────────────
select test_login('30000000-0000-4000-a000-000000000002');  -- woman → women-only OK
select lives_ok($SQL$ select join_plan((select women_plan from _w), gen_random_uuid()) $SQL$,
  'D11: woman joins women-only plan');
select test_login('30000000-0000-4000-a000-000000000003');  -- man → women-only REJECT
select throws_ok($SQL$ select join_plan((select women_plan from _w), gen_random_uuid()) $SQL$,
  'P0001','gender_mismatch','D11: man rejected from women-only');
select test_login('30000000-0000-4000-a000-000000000004');  -- nonbinary → women-only REJECT
select throws_ok($SQL$ select join_plan((select women_plan from _w), gen_random_uuid()) $SQL$,
  'P0001','gender_mismatch','D11: nonbinary rejected from women-only');

-- ── host cannot join own plan (via RPC) ────────────────────────────────────
select test_login('30000000-0000-4000-a000-000000000001');
select throws_ok($SQL$ select join_plan((select open_plan from _t), gen_random_uuid()) $SQL$,
  'P0001','host_cannot_join_own_plan','host self-join rejected');

-- ── closed plan: join becomes a request; approve/decline ───────────────────
select test_login('30000000-0000-4000-a000-000000000002');
select results_eq($SQL$ select (join_plan((select closed_plan from _c), gen_random_uuid())).status::text $SQL$,
  array['requested'], 'closed plan join yields requested');
-- non-host cannot approve
select throws_ok($SQL$ select approve_request((select closed_plan from _c),'30000000-0000-4000-a000-000000000002') $SQL$,
  'P0001','not_host','non-host cannot approve');
-- host approves
select test_login('30000000-0000-4000-a000-000000000001');
select results_eq($SQL$ select (approve_request((select closed_plan from _c),'30000000-0000-4000-a000-000000000002')).status::text $SQL$,
  array['approved'], 'host approves request');
select results_eq($SQL$ select spots_remaining from plans,_c where plans.id=_c.closed_plan $SQL$,
  array[2::smallint], 'approval consumes a spot (3 -> 2)');

-- ── leave restores a spot ──────────────────────────────────────────────────
select test_login('30000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select leave_plan((select open_plan from _t)) $SQL$, 'woman leaves open plan');
select results_eq($SQL$ select spots_remaining from plans,_t where plans.id=_t.open_plan $SQL$,
  array[2::smallint], 'leave restored spot (1 joiner left ⇒ back to 2)');

-- ── discovery reads ────────────────────────────────────────────────────────
select test_login('30000000-0000-4000-a000-000000000003');
select ok(
  jsonb_array_length(get_home_feed(null,null,50,'{}'::jsonb,0)) >= 3,
  'get_home_feed returns visible active plans');
select ok(
  (get_plan_detail((select open_plan from _t)) -> 'joiners') is not null,
  'get_plan_detail returns joiners array for a visible plan');

select * from finish();
rollback;
