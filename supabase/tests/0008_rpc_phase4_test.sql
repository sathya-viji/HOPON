-- ============================================================================
-- Phase 4 RPC tests — end_plan (S3), submit_endorsements (host+peer),
-- compute_attendance_score (D4), rebuild_familiar_faces (DA, host incl),
-- vote_host_noshow (D7 quorum), windows, get_endorsement_summary (DB top-5).
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(31);

-- ── Fixtures: host H + attendees A,B,C ────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select v.id::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',v.phone,now(),now(),now()
from (values
  ('50000000-0000-4000-a000-000000000001','918200000001'),
  ('50000000-0000-4000-a000-000000000002','918200000002'),
  ('50000000-0000-4000-a000-000000000003','918200000003'),
  ('50000000-0000-4000-a000-000000000004','918200000004')
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

-- H creates plan; A,B,C join
select test_login('50000000-0000-4000-a000-000000000001');
create temporary table _p as select create_plan('sports','Badminton','Arena',12.9,77.6,
  now() + interval '90 minutes', 6::smallint,'open','free','all') as plan;
select test_login('50000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select join_plan((select (plan).id from _p), gen_random_uuid()) $SQL$, 'A joins');
select test_login('50000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select join_plan((select (plan).id from _p), gen_random_uuid()) $SQL$, 'B joins');
select test_login('50000000-0000-4000-a000-000000000004');
select lives_ok($SQL$ select join_plan((select (plan).id from _p), gen_random_uuid()) $SQL$, 'C joins');

-- ── end_plan (S3) ─────────────────────────────────────────────────────────
select test_login('50000000-0000-4000-a000-000000000001');
select lives_ok($SQL$ select end_plan((select (plan).id from _p)) $SQL$, 'host ends plan');
select results_eq($SQL$ select status::text from plans, _p where plans.id=(_p.plan).id $SQL$,
  array['ended'], 'plan status ended');
select results_eq($SQL$ select count(*)::int from plan_members pm,_p
   where pm.plan_id=(_p.plan).id and pm.is_host_row and pm.user_id='50000000-0000-4000-a000-000000000001' $SQL$,
  array[1], 'S3.1: synthetic host member row created');
select results_eq($SQL$ select result::text from attendance_marks am,_p
   where am.plan_id=(_p.plan).id and am.subject_id='50000000-0000-4000-a000-000000000001' $SQL$,
  array['present'], 'S3.2: host attendance mark = present');
select results_eq($SQL$ select plans_hosted from users where id='50000000-0000-4000-a000-000000000001' $SQL$,
  array[1], 'S3.4: host plans_hosted bumped');

-- ── submit_endorsements (host): A present+tag, B present+tag, C no-show ────
select lives_ok($SQL$
  select submit_endorsements((select (plan).id from _p), jsonb_build_array(
    jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000002','result','present','tag','Punctual'),
    jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000003','result','present','tag','Good energy'),
    jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000004','result','noshow')
  ))
$SQL$, 'host submits attendance + endorsements');

select results_eq($SQL$ select status::text from plan_members pm,_p
   where pm.plan_id=(_p.plan).id and pm.user_id='50000000-0000-4000-a000-000000000002' $SQL$,
  array['attended'], 'A marked attended');
select results_eq($SQL$ select status::text from plan_members pm,_p
   where pm.plan_id=(_p.plan).id and pm.user_id='50000000-0000-4000-a000-000000000004' $SQL$,
  array['noshow'], 'C marked no-show');
select results_eq($SQL$ select count(*)::int from notifications
   where user_id='50000000-0000-4000-a000-000000000004' and type='marked_noshow' $SQL$,
  array[1], 'C received marked_noshow (mandatory)');
select results_eq($SQL$ select count(*)::int from endorsements e,_p
   where e.plan_id=(_p.plan).id and e.giver_id='50000000-0000-4000-a000-000000000001' $SQL$,
  array[2], 'host gave 2 endorsements (A,B)');
select results_eq($SQL$ select plans_attended from users where id='50000000-0000-4000-a000-000000000002' $SQL$,
  array[1], 'A plans_attended bumped');

-- ── familiar faces (DA, host included): present = H,A,B ⇒ 3 pairs ──────────
select results_eq($SQL$ select count(*)::int from familiar_faces ff
   where ff.user_a_id in ('50000000-0000-4000-a000-000000000001','50000000-0000-4000-a000-000000000002','50000000-0000-4000-a000-000000000003')
     and ff.user_b_id in ('50000000-0000-4000-a000-000000000001','50000000-0000-4000-a000-000000000002','50000000-0000-4000-a000-000000000003') $SQL$,
  array[3], 'DA+D5: 3 familiar-face pairs among present (host included)');

-- ── attendance score (D4): A has 1 present ⇒ null (<3 events) ──────────────
select ok( (select attendance_score from users where id='50000000-0000-4000-a000-000000000002') is null,
  'D4: score null until 3 attendance events');

-- score formula at ≥3: seed 2 present + 1 no-show for a fresh subject ⇒ 67
select set_config('request.jwt.claims', null, true);  -- service context
insert into attendance_marks (plan_id, marked_by, subject_id, result)
select (select (plan).id from _p), '50000000-0000-4000-a000-000000000001','50000000-0000-4000-a000-000000000004', 'present'
on conflict (plan_id,subject_id) do update set result='present';  -- flip C→present (now 1)
-- add two synthetic marks on other plans for C
insert into plans (id, host_id, category_id, activity, location_label, lat, lng, starts_at, capacity, spots_remaining, status, ended_at)
values ('50000000-0000-4000-b000-000000000001','50000000-0000-4000-a000-000000000001','sports','x','l',1,1, now()+interval '1 hour',4,3,'ended', now()),
       ('50000000-0000-4000-b000-000000000002','50000000-0000-4000-a000-000000000001','sports','y','l',1,1, now()+interval '1 hour',4,3,'ended', now());
insert into attendance_marks (plan_id, marked_by, subject_id, result) values
 ('50000000-0000-4000-b000-000000000001','50000000-0000-4000-a000-000000000001','50000000-0000-4000-a000-000000000004','present'),
 ('50000000-0000-4000-b000-000000000002','50000000-0000-4000-a000-000000000001','50000000-0000-4000-a000-000000000004','noshow');
select compute_attendance_score('50000000-0000-4000-a000-000000000004');
select results_eq($SQL$ select attendance_score from users where id='50000000-0000-4000-a000-000000000004' $SQL$,
  array[67::smallint], 'D4: 2 present / 3 total = 67%');

-- ── peer endorsement (D6): A endorses B (both present) ─────────────────────
select test_login('50000000-0000-4000-a000-000000000002');
select lives_ok($SQL$
  select submit_endorsements((select (plan).id from _p), jsonb_build_array(
    jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000003','tag','Would join again')))
$SQL$, 'D6: present peer A endorses B');
select results_eq($SQL$ select count(*)::int from endorsements e,_p
   where e.plan_id=(_p.plan).id and e.giver_id='50000000-0000-4000-a000-000000000002'
     and e.receiver_id='50000000-0000-4000-a000-000000000003' $SQL$,
  array[1], 'peer endorsement recorded');

-- peer who is NOT present cannot endorse (C is no-show in this plan)
-- (C was flipped to present above for scoring; flip back to no-show for this check)
select set_config('request.jwt.claims', null, true);
update attendance_marks set result='noshow'
  where plan_id=(select (plan).id from _p) and subject_id='50000000-0000-4000-a000-000000000004';
select test_login('50000000-0000-4000-a000-000000000004');
select throws_ok($SQL$
  select submit_endorsements((select (plan).id from _p), jsonb_build_array(
    jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000002','tag','x')))
$SQL$, 'P0001','not_present','no-show peer cannot endorse');

-- ── vote_host_noshow (D7): 2 present (A,B) ⇒ 1 vote = 50% quorum ───────────
select test_login('50000000-0000-4000-a000-000000000001');
select throws_ok($SQL$ select vote_host_noshow((select (plan).id from _p)) $SQL$,
  'P0001','host_cannot_vote','host cannot vote on own no-show');
select test_login('50000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select vote_host_noshow((select (plan).id from _p)) $SQL$, 'present attendee A votes host absent');
select results_eq($SQL$ select result::text from attendance_marks am,_p
   where am.plan_id=(_p.plan).id and am.subject_id='50000000-0000-4000-a000-000000000001' $SQL$,
  array['noshow'], 'D7: quorum resolved — host marked no-show');
select results_eq($SQL$ select count(*)::int from notifications
   where user_id='50000000-0000-4000-a000-000000000001' and type='host_marked_absent' $SQL$,
  array[1], 'host received host_marked_absent (mandatory)');
select results_eq($SQL$ select count(*)::int from audit_logs where action='host_noshow_resolved' $SQL$,
  array[1], 'F5: host_noshow_resolved audit row written');

-- ── get_endorsement_summary (DB top-5) for B ───────────────────────────────
select ok(
  jsonb_array_length(get_endorsement_summary('50000000-0000-4000-a000-000000000003')) >= 1,
  'DB: get_endorsement_summary returns B''s tags');

-- ── endorsement window (S2): >48h after ended_at ⇒ closed ──────────────────
select set_config('request.jwt.claims', null, true);
update plans set ended_at = now() - interval '49 hours' where id=(select (plan).id from _p);
select test_login('50000000-0000-4000-a000-000000000001');
select throws_ok($SQL$
  select submit_endorsements((select (plan).id from _p), jsonb_build_array(
    jsonb_build_object('subject_id','50000000-0000-4000-a000-000000000002','tag','late')))
$SQL$, 'P0001','endorsement_window_closed','S2: endorsement blocked after 48h');

select * from finish();
rollback;
