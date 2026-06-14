-- ============================================================================
-- Safety #1 — per-content reporting auto-takedown (recap/comment).
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(9);

insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select ('90000000-0000-4000-a000-00000000000'||g)::uuid,
       '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
       '9199100000'||g, now(), now(), now()
from generate_series(1,4) g;
insert into users (id,name,handle,neighbourhood,dob,gender)
select ('90000000-0000-4000-a000-00000000000'||g)::uuid,'U'||g,'@u15_'||g,'HSR',date '1990-01-01','man'
from generate_series(1,4) g;
create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims', json_build_object('sub',p,'role','authenticated')::text, true);
$FN$;

-- author (001) hosts a started plan and posts two recaps + a comment
select test_login('90000000-0000-4000-a000-000000000001');
create temporary table _p as select create_plan('food','Coffee','Cafe',12.9,77.6,
  now() + interval '90 minutes', 5::smallint,'open','free','all') as plan;
select set_config('request.jwt.claims', null, true);
update plans set starts_at = now() - interval '1 hour' where id=(select (plan).id from _p);
select test_login('90000000-0000-4000-a000-000000000001');
create temporary table _r1 as select (post_recap((select (plan).id from _p), array['a.jpg'], 'r1')).id as rid;
create temporary table _r2 as select (post_recap((select (plan).id from _p), array['b.jpg'], 'r2')).id as rid;
select set_config('request.jwt.claims', null, true);
select approve_recap((select rid from _r1));
select approve_recap((select rid from _r2));
select test_login('90000000-0000-4000-a000-000000000001');
create temporary table _c as select (comment_recap((select rid from _r2), 'a comment')).id as cid;

-- ── recap report: 2 reports → still approved; 3rd → rejected ───────────────
select test_login('90000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select submit_report('recap',(select rid from _r1),'inappropriate_content') $SQL$, 'recap report 1');
select test_login('90000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select submit_report('recap',(select rid from _r1),'inappropriate_content') $SQL$, 'recap report 2');
select results_eq($SQL$ select moderation from recaps where id=(select rid from _r1) $SQL$,
  array['approved'], 'recap still approved after 2 distinct reports');
select test_login('90000000-0000-4000-a000-000000000004');
select lives_ok($SQL$ select submit_report('recap',(select rid from _r1),'inappropriate_content') $SQL$, 'recap report 3 ⇒ takedown');
select results_eq($SQL$ select moderation from recaps where id=(select rid from _r1) $SQL$,
  array['rejected'], '#1: recap auto-rejected after 3 distinct reports');

-- ── comment report: 3 distinct → soft-deleted ──────────────────────────────
select test_login('90000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select submit_report('comment',(select cid from _c),'harassment') $SQL$, 'comment report 1');
select test_login('90000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select submit_report('comment',(select cid from _c),'harassment') $SQL$, 'comment report 2');
select test_login('90000000-0000-4000-a000-000000000004');
select lives_ok($SQL$ select submit_report('comment',(select cid from _c),'harassment') $SQL$, 'comment report 3 ⇒ takedown');
select results_eq($SQL$ select is_deleted from recap_comments where id=(select cid from _c) $SQL$,
  array[true], '#1: comment auto-soft-deleted after 3 distinct reports');

select * from finish();
rollback;
