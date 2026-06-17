-- ============================================================================
-- Trust v2 — peer-corroborated attendance resolver (docs/TRUST_V2_DESIGN.md).
-- Covers: N=1 / N=2 / N≥3, self-no-show (floor-exempt), single vs two flaggers,
-- credibility floor gating, score progression, familiar-faces rebuild,
-- endorsement eligibility, idempotent re-resolution, late-submission rejection,
-- participation metrics. Run: supabase test db
-- ============================================================================
begin;
select plan(28);

-- ── helpers ────────────────────────────────────────────────────────────────
create or replace function _su(uid text, h text) returns void language plpgsql as $FN$
begin
  insert into auth.users (id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
  values (uid::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
          '9'||right(replace(uid,'-',''),11), now(),now(),now()) on conflict (id) do nothing;
  perform set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true);
  perform complete_signup(h, h, '1990-01-01','man','HSR');
end $FN$;
create or replace function _plan(id text, host text) returns void language sql as $FN$
  insert into plans (id,host_id,category_id,activity,description,location_label,lat,lng,
    starts_at,capacity,spots_remaining,plan_type,status,cost,gender_pref,ended_at)
  values (id::uuid, host::uuid,'sports',id,'d','L',12.9,77.6, now()-interval '3 hours',
    9,8,'open','ended','free','all', now()-interval '49 hours') on conflict (id) do nothing;
$FN$;
create or replace function _mem(plan text, u text) returns void language sql as $FN$
  insert into plan_members(plan_id,user_id,status) values(plan::uuid,u::uuid,'joined')
  on conflict (plan_id,user_id) do nothing;
$FN$;
create or replace function _present(plan text, marker text, subjects text[]) returns void language plpgsql as $FN$
declare s text; begin
  foreach s in array subjects loop
    insert into attendance_marks(plan_id,marked_by,subject_id,result)
    values(plan::uuid,marker::uuid,s::uuid,'present')
    on conflict (plan_id,marked_by,subject_id) do update set result='present';
  end loop;
end $FN$;
create or replace function _flag(plan text, marker text, subject text) returns void language sql as $FN$
  insert into attendance_marks(plan_id,marked_by,subject_id,result)
  values(plan::uuid,marker::uuid,subject::uuid,'noshow')
  on conflict (plan_id,marked_by,subject_id) do update set result='noshow';
$FN$;
create or replace function _status(plan text, u text) returns text language sql as $FN$
  select status::text from plan_members where plan_id=plan::uuid and user_id=u::uuid;
$FN$;

-- ── Fixtures (distinct users per scenario to isolate familiar-faces) ────────
select _su('70000000-0000-4000-a000-000000000001','@hA');  -- pA host
select _su('70000000-0000-4000-a000-000000000002','@aA');
select _su('70000000-0000-4000-a000-000000000003','@bA');
select _su('70000000-0000-4000-a000-000000000004','@cA');
select _su('70000000-0000-4000-a000-000000000005','@hB');  -- pB host
select _su('70000000-0000-4000-a000-000000000006','@dB');
select _su('70000000-0000-4000-a000-000000000007','@eB');
select _su('70000000-0000-4000-a000-000000000008','@fB');
select _su('70000000-0000-4000-a000-000000000009','@hC');  -- pC host
select _su('70000000-0000-4000-a000-000000000010','@gC');  -- self-no-show
select _su('70000000-0000-4000-a000-000000000011','@iC');
select _su('70000000-0000-4000-a000-000000000012','@hD');  -- pD dyad host
select _su('70000000-0000-4000-a000-000000000013','@jD');
select _su('70000000-0000-4000-a000-000000000014','@hE');  -- pE dyad host
select _su('70000000-0000-4000-a000-000000000015','@kE');
select _su('70000000-0000-4000-a000-000000000016','@hF');  -- pF host-only
select _su('70000000-0000-4000-a000-000000000017','@hG');  -- pG floor host
select _su('70000000-0000-4000-a000-000000000018','@lG');  -- sub-floor user
select _su('70000000-0000-4000-a000-000000000019','@mG');
select _su('70000000-0000-4000-a000-000000000020','@nG');
select _su('70000000-0000-4000-a000-000000000021','@sc');  -- score subject
-- make user 18 sub-floor (score 0%, unverified → weight 0.4 < 0.5)
update users set attendance_score=0, verification_level='none' where id='70000000-0000-4000-a000-000000000018';

-- pA: N=4, single no-show flag (B flags A); host tags A
select _plan('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000001');
select _mem('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000002');
select _mem('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000003');
select _mem('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000004');
select _present('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000001',
  array['70000000-0000-4000-a000-000000000001','70000000-0000-4000-a000-000000000002','70000000-0000-4000-a000-000000000003','70000000-0000-4000-a000-000000000004']);
select _present('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000002',
  array['70000000-0000-4000-a000-000000000001','70000000-0000-4000-a000-000000000003','70000000-0000-4000-a000-000000000004']);
select _present('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000003',
  array['70000000-0000-4000-a000-000000000001','70000000-0000-4000-a000-000000000004']);
select _present('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000004',
  array['70000000-0000-4000-a000-000000000001','70000000-0000-4000-a000-000000000002','70000000-0000-4000-a000-000000000003']);
select _flag('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000003','70000000-0000-4000-a000-000000000002'); -- B flags A
update attendance_marks set tag='Punctual' where plan_id='70000000-0000-4000-b000-00000000000a'::uuid
  and marked_by='70000000-0000-4000-a000-000000000001' and subject_id='70000000-0000-4000-a000-000000000002'; -- host tags A

-- pB: N=4, two flaggers (D,E flag F)
select _plan('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000005');
select _mem('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000006');
select _mem('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000007');
select _mem('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000008');
select _present('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000005',
  array['70000000-0000-4000-a000-000000000006','70000000-0000-4000-a000-000000000007','70000000-0000-4000-a000-000000000008']);
select _present('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000006',array['70000000-0000-4000-a000-000000000005','70000000-0000-4000-a000-000000000007']);
select _present('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000007',array['70000000-0000-4000-a000-000000000005','70000000-0000-4000-a000-000000000006']);
select _flag('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000006','70000000-0000-4000-a000-000000000008');
select _flag('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000007','70000000-0000-4000-a000-000000000008');

-- pC: N=3, self-no-show (G self-flags; G tags I — must be dropped)
select _plan('70000000-0000-4000-b000-00000000000c','70000000-0000-4000-a000-000000000009');
select _mem('70000000-0000-4000-b000-00000000000c','70000000-0000-4000-a000-000000000010');
select _mem('70000000-0000-4000-b000-00000000000c','70000000-0000-4000-a000-000000000011');
select _present('70000000-0000-4000-b000-00000000000c','70000000-0000-4000-a000-000000000009',array['70000000-0000-4000-a000-000000000010','70000000-0000-4000-a000-000000000011']);
select _present('70000000-0000-4000-b000-00000000000c','70000000-0000-4000-a000-000000000011',array['70000000-0000-4000-a000-000000000009']);
select _flag('70000000-0000-4000-b000-00000000000c','70000000-0000-4000-a000-000000000010','70000000-0000-4000-a000-000000000010'); -- G self-no-show
select _present('70000000-0000-4000-b000-00000000000c','70000000-0000-4000-a000-000000000010',array['70000000-0000-4000-a000-000000000011']);
update attendance_marks set tag='Good energy' where plan_id='70000000-0000-4000-b000-00000000000c'::uuid
  and marked_by='70000000-0000-4000-a000-000000000010' and subject_id='70000000-0000-4000-a000-000000000011';

-- pD: dyad, both submit
select _plan('70000000-0000-4000-b000-00000000000d','70000000-0000-4000-a000-000000000012');
select _mem('70000000-0000-4000-b000-00000000000d','70000000-0000-4000-a000-000000000013');
select _present('70000000-0000-4000-b000-00000000000d','70000000-0000-4000-a000-000000000012',array['70000000-0000-4000-a000-000000000013']);
select _present('70000000-0000-4000-b000-00000000000d','70000000-0000-4000-a000-000000000013',array['70000000-0000-4000-a000-000000000012']);

-- pE: dyad, only host submits
select _plan('70000000-0000-4000-b000-00000000000e','70000000-0000-4000-a000-000000000014');
select _mem('70000000-0000-4000-b000-00000000000e','70000000-0000-4000-a000-000000000015');
select _present('70000000-0000-4000-b000-00000000000e','70000000-0000-4000-a000-000000000014',array['70000000-0000-4000-a000-000000000015']);

-- pF: host-only (N=1)
select _plan('70000000-0000-4000-b000-00000000000f','70000000-0000-4000-a000-000000000016');

-- pG: floor — sub-floor user 18 self-no-show (exempt) + flags 19 (ignored)
select _plan('70000000-0000-4000-b000-0000000000bb'::text,'70000000-0000-4000-a000-000000000017');
select _mem('70000000-0000-4000-b000-0000000000bb','70000000-0000-4000-a000-000000000018');
select _mem('70000000-0000-4000-b000-0000000000bb','70000000-0000-4000-a000-000000000019');
select _mem('70000000-0000-4000-b000-0000000000bb','70000000-0000-4000-a000-000000000020');
select _present('70000000-0000-4000-b000-0000000000bb','70000000-0000-4000-a000-000000000017',array['70000000-0000-4000-a000-000000000018','70000000-0000-4000-a000-000000000019','70000000-0000-4000-a000-000000000020']);
select _present('70000000-0000-4000-b000-0000000000bb','70000000-0000-4000-a000-000000000020',array['70000000-0000-4000-a000-000000000017','70000000-0000-4000-a000-000000000019']);
select _flag('70000000-0000-4000-b000-0000000000bb','70000000-0000-4000-a000-000000000018','70000000-0000-4000-a000-000000000018'); -- self no-show (sub-floor)
select _flag('70000000-0000-4000-b000-0000000000bb','70000000-0000-4000-a000-000000000018','70000000-0000-4000-a000-000000000019'); -- flags 19 (must be ignored, sub-floor)

-- ── Resolve everything ─────────────────────────────────────────────────────
select set_config('request.jwt.claims', null, true);  -- service context
select ok((select fn_resolve_attendance()) >= 7, 'resolver processed the eligible plans');

-- pA: single flag → A present; others present; host endorsed A
select is(_status('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000002'),'attended','pA: single no-show flag ignored → A present');
select is(_status('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000003'),'attended','pA: B present');
select is((select status::text from plan_members where plan_id='70000000-0000-4000-b000-00000000000a'::uuid and user_id='70000000-0000-4000-a000-000000000001' and is_host_row),'attended','pA: host resolved present (host row)');
select is(jsonb_array_length(get_endorsement_summary('70000000-0000-4000-a000-000000000002')),1,'pA: A received host endorsement');
select is((select count(*)::int from familiar_faces where '70000000-0000-4000-a000-000000000001' in (user_a_id::text,user_b_id::text)),3,'pA: host has 3 familiar faces (4 present)');

-- pB: two flaggers → F no-show
select is(_status('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000008'),'noshow','pB: 2 credible flaggers → F no-show');
select is(_status('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000006'),'attended','pB: D present');
select ok(not exists(select 1 from familiar_faces where
     (user_a_id='70000000-0000-4000-a000-000000000006' and user_b_id='70000000-0000-4000-a000-000000000008')
  or (user_a_id='70000000-0000-4000-a000-000000000007' and user_b_id='70000000-0000-4000-a000-000000000008')),
  'pB: F dropped from both flaggers'' faces (pairwise; host edge may remain)');
select is((select count(*)::int from notifications where user_id='70000000-0000-4000-a000-000000000008' and type='marked_noshow'),1,'pB: F notified marked_noshow');

-- pC: self-no-show G → noshow; G excluded from endorsements + faces; I present
select is(_status('70000000-0000-4000-b000-00000000000c','70000000-0000-4000-a000-000000000010'),'noshow','pC: self-no-show → G noshow');
select is(_status('70000000-0000-4000-b000-00000000000c','70000000-0000-4000-a000-000000000011'),'attended','pC: I present');
select is(jsonb_array_length(get_endorsement_summary('70000000-0000-4000-a000-000000000011')),0,'pC: self-no-show G''s tag dropped → I has no endorsement');
select ok(not exists(select 1 from familiar_faces where '70000000-0000-4000-a000-000000000010' in (user_a_id::text,user_b_id::text)),'pC: self-no-show G excluded from familiar faces');

-- pD: dyad both submit → both present
select is(_status('70000000-0000-4000-b000-00000000000d','70000000-0000-4000-a000-000000000013'),'attended','pD: dyad both submit → member present');
select is((select status::text from plan_members where plan_id='70000000-0000-4000-b000-00000000000d'::uuid and user_id='70000000-0000-4000-a000-000000000012' and is_host_row),'attended','pD: dyad host present');

-- pE: dyad one submits → both UNRESOLVED
select is(_status('70000000-0000-4000-b000-00000000000e','70000000-0000-4000-a000-000000000015'),'joined','pE: dyad one-submit → member UNRESOLVED (stays joined)');
select ok(not exists(select 1 from plan_members where plan_id='70000000-0000-4000-b000-00000000000e'::uuid and is_host_row),'pE: dyad one-submit → host UNRESOLVED (no host row)');

-- pF: host-only → UNRESOLVED
select ok(not exists(select 1 from plan_members where plan_id='70000000-0000-4000-b000-00000000000f'::uuid and is_host_row),'pF: host-only → UNRESOLVED');

-- pG: sub-floor self-no-show still NOSHOW (floor-exempt); their flag of 19 ignored
select is(_status('70000000-0000-4000-b000-0000000000bb','70000000-0000-4000-a000-000000000018'),'noshow','pG: sub-floor self-no-show → noshow (floor-exempt)');
select is(_status('70000000-0000-4000-b000-0000000000bb','70000000-0000-4000-a000-000000000019'),'attended','pG: sub-floor flagger ignored → 19 present');

-- Participation metrics
select results_eq($SQL$ select eligible_marker_count, submission_count from attendance_resolutions where plan_id='70000000-0000-4000-b000-00000000000a' $SQL$,
  $SQL$ values (4,4) $SQL$, 'metrics: pA eligible=4, submissions=4');
select results_eq($SQL$ select eligible_marker_count, submission_count from attendance_resolutions where plan_id='70000000-0000-4000-b000-00000000000e' $SQL$,
  $SQL$ values (2,1) $SQL$, 'metrics: pE eligible=2, submissions=1');

-- Idempotent re-resolution
select is((select fn_resolve_attendance()), 0, 'idempotent: re-run resolves nothing');

-- Score progression via resolved verdicts (direct compute, fresh subject)
insert into plan_members (plan_id,user_id,status,is_host_row,resolved_at) values
  ('70000000-0000-4000-b000-00000000000a','70000000-0000-4000-a000-000000000021','attended',false,now());
select compute_attendance_score('70000000-0000-4000-a000-000000000021');
select ok((select attendance_score from users where id='70000000-0000-4000-a000-000000000021') is null,'score: 1 event → New');
insert into plan_members (plan_id,user_id,status,is_host_row,resolved_at) values
  ('70000000-0000-4000-b000-00000000000b','70000000-0000-4000-a000-000000000021','attended',false,now());
select compute_attendance_score('70000000-0000-4000-a000-000000000021');
select ok((select attendance_score from users where id='70000000-0000-4000-a000-000000000021') is null,'score: 2 events → New');
insert into plan_members (plan_id,user_id,status,is_host_row,resolved_at) values
  ('70000000-0000-4000-b000-00000000000c','70000000-0000-4000-a000-000000000021','attended',false,now()),
  ('70000000-0000-4000-b000-00000000000d','70000000-0000-4000-a000-000000000021','noshow',false,now());
select compute_attendance_score('70000000-0000-4000-a000-000000000021');
select results_eq($SQL$ select attendance_score from users where id='70000000-0000-4000-a000-000000000021' $SQL$,
  array[75::smallint],'score: 4 events (3 present/1 noshow) → 75%');

-- Late submission rejected (>48h after ended_at)
select set_config('request.jwt.claims', json_build_object('sub','70000000-0000-4000-a000-000000000001','role','authenticated')::text, true);
select throws_ok($SQL$ select submit_endorsements('70000000-0000-4000-b000-00000000000a'::uuid,
  jsonb_build_array(jsonb_build_object('subject_id','70000000-0000-4000-a000-000000000003','tag','late'))) $SQL$,
  'P0001','endorsement_window_closed','late submission (>48h) rejected');

select * from finish();
rollback;
