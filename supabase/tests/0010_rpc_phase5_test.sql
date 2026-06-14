-- ============================================================================
-- Phase 5 RPC tests — recaps (post/approve/like/comment/delete), stories,
-- follows (S1), fan-out, batched likes, follower visibility. supabase test db
-- ============================================================================
begin;
select plan(31);

insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select v.id::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',v.phone,now(),now(),now()
from (values
  ('60000000-0000-4000-a000-000000000001','918300000001'),  -- author/host
  ('60000000-0000-4000-a000-000000000002','918300000002'),  -- follower F
  ('60000000-0000-4000-a000-000000000003','918300000003')   -- other O (followers-only)
) as v(id,phone);
create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims', json_build_object('sub',p,'role','authenticated')::text, true);
$FN$;

select test_login('60000000-0000-4000-a000-000000000001');
select lives_ok($SQL$ select complete_signup('Auth','@auth5','1990-01-01','man','HSR') $SQL$, 'author signup');
select test_login('60000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select complete_signup('Fee','@fee5','1992-01-01','woman','HSR') $SQL$, 'F signup');
select test_login('60000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select complete_signup('Owen','@owen5','1992-01-01','man','HSR') $SQL$, 'O signup');

-- ── follow (public ⇒ accepted, new_follower) ───────────────────────────────
select test_login('60000000-0000-4000-a000-000000000002');
select results_eq($SQL$ select (follow_user('60000000-0000-4000-a000-000000000001')).status::text $SQL$,
  array['accepted'], 'S1: follow public profile ⇒ accepted');
select results_eq($SQL$ select count(*)::int from notifications
   where user_id='60000000-0000-4000-a000-000000000001' and type='new_follower' $SQL$,
  array[1], 'new_follower delivered to followee');

-- ── plan + recap ───────────────────────────────────────────────────────────
select test_login('60000000-0000-4000-a000-000000000001');
create temporary table _p as select create_plan('food','Coffee','Cafe',12.9,77.6,
  now() + interval '90 minutes', 5::smallint,'open','free','all') as plan;
select test_login('60000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select join_plan((select (plan).id from _p), gen_random_uuid()) $SQL$, 'F joins plan');

-- make the plan "started" so recaps are allowed
select set_config('request.jwt.claims', null, true);
update plans set starts_at = now() - interval '1 hour' where id = (select (plan).id from _p);

-- post_recap: 6 images rejected
select test_login('60000000-0000-4000-a000-000000000001');
select throws_ok($SQL$ select post_recap((select (plan).id from _p), array['a','b','c','d','e','f'], 'x') $SQL$,
  'P0001','invalid_image_count','>5 images rejected by RPC');

-- post a valid recap (pending)
create temporary table _r as select (post_recap((select (plan).id from _p), array['img1.jpg','img2.jpg'], 'great coffee')).id as rid;
select results_eq($SQL$ select moderation from recaps r,_r where r.id=_r.rid $SQL$,
  array['pending'], 'new recap is pending moderation');

-- approve_recap (simulates image-moderator pass) → notifications + feed_event
select set_config('request.jwt.claims', null, true);
select lives_ok($SQL$ select approve_recap((select rid from _r)) $SQL$, 'approve_recap');
select results_eq($SQL$ select count(*)::int from notifications
   where user_id='60000000-0000-4000-a000-000000000002' and type='new_recap_from_following' $SQL$,
  array[1], 'follower F received new_recap_from_following');
select results_eq($SQL$ select count(*)::int from feed_events where event_type='recap_created' $SQL$,
  array[1], 'feed_event recap_created written');

-- ── like (batched) ─────────────────────────────────────────────────────────
select test_login('60000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select like_recap((select rid from _r)) $SQL$, 'F likes recap');
select results_eq($SQL$ select like_count from recaps r,_r where r.id=_r.rid $SQL$,
  array[1], 'like_count incremented by trigger');
select set_config('request.jwt.claims', null, true);
select results_eq($SQL$ select fn_flush_like_batches(1) $SQL$, array[1], 'like-batch flush emits recap_liked');
select results_eq($SQL$ select count(*)::int from notifications
   where user_id='60000000-0000-4000-a000-000000000001' and type='recap_liked' $SQL$,
  array[1], 'author received batched recap_liked');
-- unlike decrements
select test_login('60000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select unlike_recap((select rid from _r)) $SQL$, 'F unlikes');
select results_eq($SQL$ select like_count from recaps r,_r where r.id=_r.rid $SQL$,
  array[0], 'like_count back to 0');

-- ── comments + reply fanout ────────────────────────────────────────────────
select lives_ok($SQL$ select comment_recap((select rid from _r), 'so good') $SQL$, 'F comments');
select test_login('60000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select comment_recap((select rid from _r), 'agreed') $SQL$, 'O comments (recaps public)');
select results_eq($SQL$ select count(*)::int from notifications
   where user_id='60000000-0000-4000-a000-000000000002' and type='recap_comment_replied' $SQL$,
  array[1], 'prior commenter F got recap_comment_replied');
select results_eq($SQL$ select comment_count from recaps r,_r where r.id=_r.rid $SQL$,
  array[2], 'comment_count = 2');

-- ── reads ──────────────────────────────────────────────────────────────────
select test_login('60000000-0000-4000-a000-000000000002');
select ok( jsonb_array_length(get_recaps_feed(0,20)) >= 1, 'get_recaps_feed returns the public recap');
select ok( (get_recap_detail((select rid from _r)) -> 'comments') is not null, 'get_recap_detail returns comments');

-- ── stories ────────────────────────────────────────────────────────────────
select test_login('60000000-0000-4000-a000-000000000001');
create temporary table _s as select (post_story('story1.jpg','my day', null, null)).id as sid;
select set_config('request.jwt.claims', null, true);
select lives_ok($SQL$ select approve_story((select sid from _s)) $SQL$, 'approve_story');
select test_login('60000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select record_story_view((select sid from _s)) $SQL$, 'F views story');
select results_eq($SQL$ select count(*)::int from story_views v,_s where v.story_id=_s.sid $SQL$,
  array[1], 'story_view recorded');

-- ── follow request → accept (S1) + follower visibility ─────────────────────
select set_config('request.jwt.claims', null, true);
update users set profile_visibility='followers' where id='60000000-0000-4000-a000-000000000003';
-- non-follower cannot see O in users_public
select test_login('60000000-0000-4000-a000-000000000001');
select is_empty($SQL$ select 1 from users_public where id='60000000-0000-4000-a000-000000000003' $SQL$,
  'followers-only profile hidden from non-follower');
-- author requests to follow O ⇒ pending + follow_request
select results_eq($SQL$ select (follow_user('60000000-0000-4000-a000-000000000003')).status::text $SQL$,
  array['pending'], 'S1: follow followers-only ⇒ pending');
select results_eq($SQL$ select count(*)::int from notifications
   where user_id='60000000-0000-4000-a000-000000000003' and type='follow_request' $SQL$,
  array[1], 'O received follow_request');
-- O accepts ⇒ follow_accepted to author + author can now see O
select test_login('60000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select accept_follow('60000000-0000-4000-a000-000000000001') $SQL$, 'O accepts');
select test_login('60000000-0000-4000-a000-000000000001');
select isnt_empty($SQL$ select 1 from users_public where id='60000000-0000-4000-a000-000000000003' $SQL$,
  'accepted follower now sees the followers-only profile');

select * from finish();
rollback;
