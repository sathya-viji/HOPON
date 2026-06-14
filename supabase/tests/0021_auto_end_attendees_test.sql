-- ============================================================================
-- Wave 4 follow-up: fn_auto_end_plans, get_plan_attendees, score progression.
-- (Core Phase-4 trust logic is covered by 0008.) Run: supabase test db
-- ============================================================================
begin;
select plan(17);

-- ── Fixtures: host + 3 members + outsider + score user ────────────────────
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
       v.phone, now(), now(), now()
from (values
  ('60000000-0000-4000-a000-000000000001','919000000001'),  -- host
  ('60000000-0000-4000-a000-000000000002','919000000002'),  -- member 1
  ('60000000-0000-4000-a000-000000000003','919000000003'),  -- member 2
  ('60000000-0000-4000-a000-000000000004','919000000004'),  -- member 3
  ('60000000-0000-4000-a000-000000000005','919000000005'),  -- outsider (non-member)
  ('60000000-0000-4000-a000-000000000006','919000000006')   -- score progression subject
) as v(id, phone);

create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims', json_build_object('sub', p, 'role','authenticated')::text, true);
$FN$;

select test_login('60000000-0000-4000-a000-000000000001');
select complete_signup('Host H','@h_host','1990-01-01','man','HSR');
select test_login('60000000-0000-4000-a000-000000000002');
select complete_signup('Mem One','@m_one','1991-01-01','woman','HSR');
select test_login('60000000-0000-4000-a000-000000000003');
select complete_signup('Mem Two','@m_two','1992-01-01','man','HSR');
select test_login('60000000-0000-4000-a000-000000000004');
select complete_signup('Mem Three','@m_three','1993-01-01','woman','HSR');
select test_login('60000000-0000-4000-a000-000000000005');
select complete_signup('Out Sider','@o_sider','1994-01-01','man','HSR');
select test_login('60000000-0000-4000-a000-000000000006');
select complete_signup('Score Subj','@s_subj','1995-01-01','man','HSR');

-- pAuto: started 2h ago (auto-end target). pFuture: tomorrow (must NOT end).
insert into plans (id, host_id, category_id, activity, description, location_label, lat, lng,
   starts_at, capacity, spots_remaining, plan_type, status, cost, cost_note, gender_pref)
values
  ('60000000-0000-4000-b000-000000000001','60000000-0000-4000-a000-000000000001','sports','Auto end test','d','Loc',12.9,77.6,
   now() - interval '2 hours', 6, 3, 'open'::plan_type_t,'active'::plan_status_t,'free'::cost_t,null,'all'::gender_pref_t),
  ('60000000-0000-4000-b000-000000000002','60000000-0000-4000-a000-000000000001','sports','Future plan','d','Loc',12.9,77.6,
   now() + interval '1 day', 6, 5, 'open'::plan_type_t,'active'::plan_status_t,'free'::cost_t,null,'all'::gender_pref_t);
insert into plan_members (plan_id, user_id, status) values
  ('60000000-0000-4000-b000-000000000001','60000000-0000-4000-a000-000000000002','joined'),
  ('60000000-0000-4000-b000-000000000001','60000000-0000-4000-a000-000000000003','joined'),
  ('60000000-0000-4000-b000-000000000001','60000000-0000-4000-a000-000000000004','joined');

-- ── fn_auto_end_plans ──────────────────────────────────────────────────────
select has_function('fn_auto_end_plans', 'fn_auto_end_plans() exists');
select ok((select fn_auto_end_plans()) >= 1, 'auto-end ended at least the 2h-old plan');
select results_eq($SQL$ select status::text from plans where id='60000000-0000-4000-b000-000000000001' $SQL$,
  array['ended'], 'pAuto flipped to ended');
select ok((select ended_at from plans where id='60000000-0000-4000-b000-000000000001') is not null,
  'pAuto ended_at set');
select results_eq($SQL$ select status::text from plans where id='60000000-0000-4000-b000-000000000002' $SQL$,
  array['active'], 'future plan NOT auto-ended');
select ok(not exists(select 1 from plan_members where plan_id='60000000-0000-4000-b000-000000000001' and is_host_row),
  'v2: NO synthetic host row at auto-end (resolver writes it later)');
select is((select count(*)::int from attendance_marks where plan_id='60000000-0000-4000-b000-000000000001'), 0,
  'v2: NO host auto-present mark at auto-end');
select ok(exists(select 1 from notifications where user_id='60000000-0000-4000-a000-000000000001'
  and plan_id='60000000-0000-4000-b000-000000000001' and type='plan_ended_host'),
  'plan_ended_host notification fired');
select ok(exists(select 1 from notifications where user_id='60000000-0000-4000-a000-000000000002'
  and plan_id='60000000-0000-4000-b000-000000000001' and type='plan_ended_joiner'),
  'plan_ended_joiner notification fired');

-- ── get_plan_attendees (on the now-ended pAuto) ────────────────────────────
select has_function('get_plan_attendees', array['uuid'], 'get_plan_attendees(uuid) exists');
select ok(not has_function_privilege('anon','get_plan_attendees(uuid)','EXECUTE'), 'anon cannot execute');
select ok(has_function_privilege('authenticated','get_plan_attendees(uuid)','EXECUTE'), 'authenticated can execute');
select test_login('60000000-0000-4000-a000-000000000001');  -- host
select is(jsonb_array_length(get_plan_attendees('60000000-0000-4000-b000-000000000001')), 4,
  'v2: host sees full participant set (host + 3 members)');
select ok(exists(select 1 from jsonb_array_elements(get_plan_attendees('60000000-0000-4000-b000-000000000001')) e
  where e->>'user_id'='60000000-0000-4000-a000-000000000001' and (e->>'is_host')::boolean),
  'v2: host included and flagged is_host');
select test_login('60000000-0000-4000-a000-000000000002');  -- a member
select is(jsonb_array_length(get_plan_attendees('60000000-0000-4000-b000-000000000001')), 4,
  'v2: a member also sees the full participant set (incl self + host)');
select test_login('60000000-0000-4000-a000-000000000005');  -- outsider
select throws_ok($SQL$ select get_plan_attendees('60000000-0000-4000-b000-000000000001') $SQL$,
  'P0001', 'not_member', 'non-member is rejected');
select test_login('60000000-0000-4000-a000-000000000001');
select throws_ok($SQL$ select get_plan_attendees('60000000-0000-4000-b000-000000000002') $SQL$,
  'P0001', 'plan_not_ended', 'non-ended plan rejected (privacy: no live attendee list)');

-- (Score progression now lives in 0022, driven by RESOLVED verdicts — Trust v2's
--  compute_attendance_score reads plan_members, not raw attendance_marks.)

select * from finish();
rollback;
