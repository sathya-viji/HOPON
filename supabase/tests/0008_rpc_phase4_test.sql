-- ============================================================================
-- Phase 4 RPC tests — Trust v2 primitives: end_plan (no host auto-present),
-- submit_endorsements (stages marks; default-present; guards; self-no-show drops
-- tags), get_endorsement_summary. The peer-corroborated RESOLVER + scoring +
-- familiar faces + endorsement finalization are covered in 0022. Run: supabase test db
-- ============================================================================
begin;
select plan(24);

-- ── Fixtures: host H + attendees A,B,C + outsider E ───────────────────────
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select v.id::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',v.phone,now(),now(),now()
from (values
  ('50000000-0000-4000-a000-000000000001','918200000001'),
  ('50000000-0000-4000-a000-000000000002','918200000002'),
  ('50000000-0000-4000-a000-000000000003','918200000003'),
  ('50000000-0000-4000-a000-000000000004','918200000004'),
  ('50000000-0000-4000-a000-000000000005','918200000005')
) as v(id,phone);

create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims', json_build_object('sub',p,'role','authenticated')::text, true);
$FN$;

select test_login('50000000-0000-4000-a000-000000000001');
select lives_ok($SQL$ select complete_signup('Hostie','@hostie','1990-01-01','man','HSR') $SQL$, 'H signup');
select test_login('50000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select complete_signup('Ava','@ava','1992-01-01','woman','HSR') $SQL$, 'A signup');
select test_login('50000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select complete_signup('Ben','@ben','1992-01-01','man','HSR') $SQL$, 'B signup');
select test_login('50000000-0000-4000-a000-000000000004');
select lives_ok($SQL$ select complete_signup('Cee','@cee','1992-01-01','man','HSR') $SQL$, 'C signup');
select test_login('50000000-0000-4000-a000-000000000005');
select lives_ok($SQL$ select complete_signup('Eve','@evee','1992-01-01','woman','HSR') $SQL$, 'E signup');

-- H creates plan; A,B,C join
select test_login('50000000-0000-4000-a000-000000000001');
create temporary table _p as select create_plan('sports','Badminton','Arena',12.9,77.6,
  now() + interval '90 minutes', 6::smallint,'open','free','all') as plan;
create temporary table _p2 as select create_plan('sports','Cricket','Arena',12.9,77.6,
  now() + interval '90 minutes', 6::smallint,'open','free','all') as plan;  -- stays active (plan_not_ended)
select test_login('50000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select join_plan((select (plan).id from _p), gen_random_uuid()) $SQL$, 'A joins');
select test_login('50000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select join_plan((select (plan).id from _p), gen_random_uuid()) $SQL$, 'B joins');
select test_login('50000000-0000-4000-a000-000000000004');
select lives_ok($SQL$ select join_plan((select (plan).id from _p), gen_random_uuid()) $SQL$, 'C joins');

-- ── end_plan (v2: NO host auto-present, NO synthetic host row) ─────────────
select test_login('50000000-0000-4000-a000-000000000001');
select lives_ok($SQL$ select end_plan((select (plan).id from _p)) $SQL$, 'host ends plan');
select results_eq($SQL$ select status::text from plans, _p where plans.id=(_p.plan).id $SQL$,
  array['ended'], 'plan status ended');
select is((select count(*)::int from plan_members pm,_p where pm.plan_id=(_p.plan).id and pm.is_host_row), 0,
  'v2: NO synthetic host row at end (resolver writes it)');
select is((select count(*)::int from attendance_marks am,_p where am.plan_id=(_p.plan).id), 0,
  'v2: NO host auto-present mark at end');
select results_eq($SQL$ select plans_hosted from users where id='50000000-0000-4000-a000-000000000001' $SQL$,
  array[1], 'host plans_hosted bumped');
select is((select count(*)::int from notifications where user_id='50000000-0000-4000-a000-000000000001' and type='plan_ended_host'), 1,
  'host notified plan_ended_host');
select is((select count(*)::int from notifications where user_id='50000000-0000-4000-a000-000000000002' and type='plan_ended_joiner'), 1,
  'joiner A notified plan_ended_joiner');

-- ── submit_endorsements (v2: stages marks; verdict deferred to resolver) ──
select lives_ok($SQL$
  select submit_endorsements((select (plan).id from _p), jsonb_build_array(
    jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000002','result','present','tag','Punctual'),
    jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000003','result','present','tag','Good energy'),
    jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000004','result','noshow')
  )) $SQL$, 'host submits marks (staged)');
select is((select count(*)::int from attendance_marks am,_p where am.plan_id=(_p.plan).id and am.marked_by='50000000-0000-4000-a000-000000000001'), 3,
  'v2: host''s 3 marks staged in attendance_marks');
select results_eq($SQL$ select status::text from plan_members pm,_p
   where pm.plan_id=(_p.plan).id and pm.user_id='50000000-0000-4000-a000-000000000002' $SQL$,
  array['joined'], 'v2: verdict deferred — A still joined (not yet resolved)');

-- ── Guards ─────────────────────────────────────────────────────────────────
select test_login('50000000-0000-4000-a000-000000000005');  -- E: not a participant
select throws_ok($SQL$ select submit_endorsements((select (plan).id from _p),
  jsonb_build_array(jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000002','result','present'))) $SQL$,
  'P0001','not_member','non-participant cannot submit');
select test_login('50000000-0000-4000-a000-000000000001');
select throws_ok($SQL$ select submit_endorsements((select (plan).id from _p2),
  jsonb_build_array(jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000002','result','present'))) $SQL$,
  'P0001','plan_not_ended','cannot submit on a plan that has not ended');

-- ── Self-no-show drops the submitter's endorsement tags ───────────────────
select test_login('50000000-0000-4000-a000-000000000004');  -- C self-flags no-show + tries to tag A
select lives_ok($SQL$ select submit_endorsements((select (plan).id from _p), jsonb_build_array(
  jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000004','result','noshow'),
  jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000002','result','present','tag','Reliable')
)) $SQL$, 'C submits self-no-show + a tag');
select is((select tag from attendance_marks am,_p where am.plan_id=(_p.plan).id
   and am.marked_by='50000000-0000-4000-a000-000000000004' and am.subject_id='50000000-0000-4000-a000-000000000002'), null,
  'self-no-show caller''s endorsement tag is dropped');

-- ── get_endorsement_summary structure (no endorsements until resolution) ──
select is(get_endorsement_summary('50000000-0000-4000-a000-000000000003'), '[]'::jsonb,
  'get_endorsement_summary empty pre-resolution');

-- ── Endorsement window (0019): closed once the plan has been RESOLVED ──────
-- (was a fixed +48h; now the window closes when the morning resolver runs.)
select set_config('request.jwt.claims', null, true);
update plans set status='ended', ended_at = now() - interval '49 hours' where id=(select (plan).id from _p);
select fn_resolve_attendance();  -- ended >6h ago → resolves, closing the window
select test_login('50000000-0000-4000-a000-000000000001');
select throws_ok($SQL$ select submit_endorsements((select (plan).id from _p),
  jsonb_build_array(jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000002','result','present','tag','late'))) $SQL$,
  'P0001','endorsement_window_closed','submit blocked after the plan is resolved');

select * from finish();
rollback;
