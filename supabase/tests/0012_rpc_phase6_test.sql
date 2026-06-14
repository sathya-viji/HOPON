-- ============================================================================
-- Phase 6 RPC tests — blocks, reports, auto-moderation, suspension, hard-delete.
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(26);

-- Fixtures: 8 users created directly (service) — A, B, T, + reporters R1..R5
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select ('70000000-0000-4000-a000-00000000000'||g)::uuid,
       '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
       '9184000000'||g, now(), now(), now()
from generate_series(1,8) g;

insert into users (id, name, handle, neighbourhood, dob, gender)
select ('70000000-0000-4000-a000-00000000000'||g)::uuid,
       'U'||g, '@u6_'||g, 'HSR', date '1990-01-01', 'man'
from generate_series(1,8) g;

create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims', json_build_object('sub',p,'role','authenticated')::text, true);
$FN$;

-- A = ...001, B = ...002, T = ...003, reporters ...004..008
-- B posts a recap (host H = ...001 hosts a plan; B joins)
select test_login('70000000-0000-4000-a000-000000000001');
create temporary table _p as select create_plan('food','Coffee','Cafe',12.9,77.6,
  now() + interval '90 minutes', 5::smallint,'open','free','all') as plan;
select test_login('70000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select join_plan((select (plan).id from _p), gen_random_uuid()) $SQL$, 'B joins');
select set_config('request.jwt.claims', null, true);
update plans set starts_at = now() - interval '1 hour' where id=(select (plan).id from _p);
select test_login('70000000-0000-4000-a000-000000000002');
create temporary table _r as select (post_recap((select (plan).id from _p), array['x.jpg'], 'hi')).id as rid;
select set_config('request.jwt.claims', null, true);
select approve_recap((select rid from _r));

-- ── block_user severs follows + invisibility ───────────────────────────────
select test_login('70000000-0000-4000-a000-000000000002');  -- B follows A
select lives_ok($SQL$ select follow_user('70000000-0000-4000-a000-000000000001') $SQL$, 'B follows A');
select test_login('70000000-0000-4000-a000-000000000001');  -- A blocks B
select lives_ok($SQL$ select block_user('70000000-0000-4000-a000-000000000002') $SQL$, 'A blocks B');
select results_eq($SQL$ select count(*)::int from blocks
   where blocker_id='70000000-0000-4000-a000-000000000001' and blocked_id='70000000-0000-4000-a000-000000000002' $SQL$,
  array[1], 'block row created');
select results_eq($SQL$ select count(*)::int from follows
   where (follower_id='70000000-0000-4000-a000-000000000002' and following_id='70000000-0000-4000-a000-000000000001') $SQL$,
  array[0], 'block severed the follow');
select ok(is_blocked_pair('70000000-0000-4000-a000-000000000001','70000000-0000-4000-a000-000000000002'),
  'is_blocked_pair true after block');

-- A cannot see B's profile or recap
select is_empty($SQL$ select 1 from users_public where id='70000000-0000-4000-a000-000000000002' $SQL$,
  'blocked user profile hidden in users_public');
select throws_ok($SQL$ select get_recap_detail((select rid from _r)) $SQL$,
  'P0001','recap_not_found','blocked user recap hidden from blocker');

-- unblock restores visibility
select lives_ok($SQL$ select unblock_user('70000000-0000-4000-a000-000000000002') $SQL$, 'A unblocks B');
select isnt_empty($SQL$ select 1 from users_public where id='70000000-0000-4000-a000-000000000002' $SQL$,
  'profile visible again after unblock');

-- ── reports + rate limit ───────────────────────────────────────────────────
select test_login('70000000-0000-4000-a000-000000000004');
select lives_ok($SQL$ select submit_report('user','70000000-0000-4000-a000-000000000003','spam','x') $SQL$,
  'submit_report works');
select results_eq($SQL$ select count(*)::int from reports where target_id='70000000-0000-4000-a000-000000000003' $SQL$,
  array[1], 'report row created');

-- ── auto-suspend: 3 distinct safety_concern on T ⇒ suspended ───────────────
select test_login('70000000-0000-4000-a000-000000000004');
select lives_ok($SQL$ select submit_report('user','70000000-0000-4000-a000-000000000003','safety_concern') $SQL$, 'safety report 1');
select test_login('70000000-0000-4000-a000-000000000005');
select lives_ok($SQL$ select submit_report('user','70000000-0000-4000-a000-000000000003','safety_concern') $SQL$, 'safety report 2');
select test_login('70000000-0000-4000-a000-000000000006');
select lives_ok($SQL$ select submit_report('user','70000000-0000-4000-a000-000000000003','safety_concern') $SQL$, 'safety report 3 ⇒ suspend');
select results_eq($SQL$ select account_status::text from users where id='70000000-0000-4000-a000-000000000003' $SQL$,
  array['suspended'], 'auto-suspend after 3 distinct safety reports');

-- ── suspension enforcement: suspended user cannot post a recap ─────────────
select test_login('70000000-0000-4000-a000-000000000003');
select throws_ok($SQL$
  insert into recaps (plan_id, author_id, image_paths)
  values ((select (plan).id from _p),'70000000-0000-4000-a000-000000000003', array['y.jpg'])
$SQL$, 'P0001','account_suspended','suspended actor blocked from content insert');

-- ── emergency report ⇒ status escalated ────────────────────────────────────
select test_login('70000000-0000-4000-a000-000000000007');
select lives_ok($SQL$ select submit_report('user','70000000-0000-4000-a000-000000000003','emergency','help') $SQL$, 'emergency report');
select results_eq($SQL$ select status::text from reports where reason='emergency' $SQL$,
  array['escalated'], 'F4: emergency report auto-escalated');

-- ── suspension expiry reactivates ──────────────────────────────────────────
select set_config('request.jwt.claims', null, true);
update users set suspended_until = now() - interval '1 minute' where id='70000000-0000-4000-a000-000000000003';
select results_eq($SQL$ select fn_expire_suspensions() $SQL$, array[1], 'one suspension expired');
select results_eq($SQL$ select account_status::text from users where id='70000000-0000-4000-a000-000000000003' $SQL$,
  array['active'], 'suspension expiry reactivated the account');

-- ── F3 hard-delete: anonymise identity, delete content, preserve trust ─────
-- give B an attendance mark (trust contribution) then soft-delete + hard-delete
insert into attendance_marks (plan_id, marked_by, subject_id, result)
values ((select (plan).id from _p),'70000000-0000-4000-a000-000000000001','70000000-0000-4000-a000-000000000002','present')
on conflict do nothing;
update users set deleted_at = now() - interval '31 days' where id='70000000-0000-4000-a000-000000000002';
select results_eq($SQL$ select fn_hard_delete_accounts() $SQL$, array[1], 'one account hard-deleted');
select results_eq($SQL$ select name from users where id='70000000-0000-4000-a000-000000000002' $SQL$,
  array['[deleted]'], 'F3: identity anonymised in place');
select is_empty($SQL$ select 1 from recaps where author_id='70000000-0000-4000-a000-000000000002' $SQL$,
  'F3: personal content (recaps) hard-deleted');
select isnt_empty($SQL$ select 1 from attendance_marks where subject_id='70000000-0000-4000-a000-000000000002' $SQL$,
  'F3: trust-graph contribution (attendance_marks) preserved');

-- ── block-leak fixes (0014j): #3 familiar faces hidden after block ─────────
-- A(...001) and B(...002): create a familiar_faces pair, then A blocks B.
select set_config('request.jwt.claims', null, true);
insert into familiar_faces (user_a_id, user_b_id, plans_together, last_met_at)
values (least('70000000-0000-4000-a000-000000000001'::uuid,'70000000-0000-4000-a000-000000000002'::uuid),
        greatest('70000000-0000-4000-a000-000000000001'::uuid,'70000000-0000-4000-a000-000000000002'::uuid),
        1, now())
on conflict do nothing;
insert into blocks (blocker_id, blocked_id)
values ('70000000-0000-4000-a000-000000000001','70000000-0000-4000-a000-000000000002') on conflict do nothing;
select test_login('70000000-0000-4000-a000-000000000001');
set role authenticated;   -- table RLS is bypassed for the superuser test role
select is_empty($SQL$ select 1 from familiar_faces
   where (user_a_id='70000000-0000-4000-a000-000000000001' or user_b_id='70000000-0000-4000-a000-000000000001')
     and (user_a_id='70000000-0000-4000-a000-000000000002' or user_b_id='70000000-0000-4000-a000-000000000002') $SQL$,
  '#3: blocked counterpart hidden from Familiar Faces');
reset role;

select * from finish();
rollback;
