-- ============================================================================
-- Phase 3 RPC tests — notify() fanout activation, send_message + chat-lock,
-- notification RPCs, prefs gate, cron logic functions. Run: supabase test db
-- ============================================================================
begin;
select plan(28);

-- ── Fixtures: host + joiner with profiles ─────────────────────────────────
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select v.id::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',v.phone,now(),now(),now()
from (values
  ('40000000-0000-4000-a000-000000000001','918100000001'),
  ('40000000-0000-4000-a000-000000000002','918100000002')
) as v(id,phone);

create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims', json_build_object('sub',p,'role','authenticated')::text, true);
$FN$;

select test_login('40000000-0000-4000-a000-000000000001');
select lives_ok($SQL$ select complete_signup('Host3','@host3','1990-01-01','man','HSR') $SQL$, 'host signup');

-- complete_signup now seeds notification_prefs (Phase 1 forward-ref activated)
select ok(
  (select count(*) from notification_prefs where user_id='40000000-0000-4000-a000-000000000001')
   = (select count(*) from unnest(enum_range(null::notif_type))),
  'complete_signup seeds a prefs row for every notif_type');

-- welcome notification created at signup
select results_eq(
  $SQL$ select count(*)::int from notifications
        where user_id='40000000-0000-4000-a000-000000000001' and type='welcome' $SQL$,
  array[1], 'welcome notification written at signup');

select test_login('40000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select complete_signup('Joiner3','@joiner3','1992-01-01','woman','HSR') $SQL$, 'joiner signup');

-- ── notify() FANOUT now active: join → host gets new_joiner ────────────────
select test_login('40000000-0000-4000-a000-000000000001');
create temporary table _p as select create_plan('food','Coffee','Cafe',12.9,77.6,
  now() + interval '90 minutes', 4::smallint,'open','free','all') as plan;

select test_login('40000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select join_plan((select (plan).id from _p), gen_random_uuid()) $SQL$, 'joiner joins');

select results_eq(
  $SQL$ select count(*)::int from notifications
        where user_id='40000000-0000-4000-a000-000000000001' and type='new_joiner' $SQL$,
  array[1], 'notify() fanout: host received new_joiner (Phase 2 RPC now writes rows)');

-- ── send_message + RLS membership + chat-lock ──────────────────────────────
select lives_ok($SQL$ select send_message((select (plan).id from _p), 'On my way!') $SQL$,
  'active member can send a message');
select results_eq(
  $SQL$ select count(*)::int from messages where plan_id=(select (plan).id from _p) $SQL$,
  array[1], 'message row persisted');

-- prepare_chat_push: @mention resolution creates a mention notification
create temporary table _m as
  select (send_message((select (plan).id from _p), '@host3 you coming?')).id as mid;
select set_config('request.jwt.claims', null, true);   -- service context
select ok( (prepare_chat_push((select mid from _m)) ->> 'found')::boolean,
  'prepare_chat_push resolves the message');
select results_eq(
  $SQL$ select count(*)::int from notifications
        where user_id='40000000-0000-4000-a000-000000000001' and type='mention' $SQL$,
  array[1], 'prepare_chat_push created a mention notification (members only)');
select test_login('40000000-0000-4000-a000-000000000002');

-- non-member cannot send
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values ('40000000-0000-4000-a000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','918100000003',now(),now(),now());
select test_login('40000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select complete_signup('Outsider','@outsider3','1992-01-01','man','HSR') $SQL$, 'outsider signup');
select throws_ok($SQL$ select send_message((select (plan).id from _p), 'let me in') $SQL$,
  'P0001','not_member','non-member cannot send a message');

-- chat-lock: cancel the plan, sends rejected
select test_login('40000000-0000-4000-a000-000000000001');
select lives_ok($SQL$ select cancel_plan((select (plan).id from _p)) $SQL$, 'host cancels plan');
select test_login('40000000-0000-4000-a000-000000000002');
select throws_ok($SQL$ select send_message((select (plan).id from _p), 'still there?') $SQL$,
  'P0001','chat_closed','D3: chat-lock blocks sends on cancelled plan');

-- ── notification RPCs ──────────────────────────────────────────────────────
select test_login('40000000-0000-4000-a000-000000000001');
-- host had new_joiner (+ plan_cancelled_confirm from cancel). mark all read.
select ok( (select mark_notifications_read(null)) >= 1, 'mark_notifications_read marks unread rows');
select results_eq(
  $SQL$ select count(*)::int from notifications
        where user_id='40000000-0000-4000-a000-000000000001' and not is_read $SQL$,
  array[0], 'no unread notifications remain after mark-all');

-- register_push_token upsert
select lives_ok($SQL$ select register_push_token('ExponentPushToken[abc123]','ios') $SQL$, 'register push token');
select lives_ok($SQL$ select register_push_token('ExponentPushToken[abc123]','android') $SQL$, 'same token upserts (platform change)');
select results_eq(
  $SQL$ select count(*)::int from push_tokens where token='ExponentPushToken[abc123]' $SQL$,
  array[1], 'token upsert did not duplicate');
select throws_ok($SQL$ select register_push_token('t','windows') $SQL$,
  'P0001','invalid_platform','register_push_token rejects bad platform');

-- ── prefs gate (notif_push_allowed) ────────────────────────────────────────
-- non-configurable type always allowed regardless of pref
select ok( notif_push_allowed('40000000-0000-4000-a000-000000000001','welcome'),
  'welcome always push-allowed (non-configurable)');
-- configurable type honours a disabled pref
select lives_ok($SQL$ select set_notification_pref('new_joiner', false) $SQL$, 'disable new_joiner push');
select ok( not notif_push_allowed('40000000-0000-4000-a000-000000000001','new_joiner'),
  'disabled configurable pref suppresses push');
-- but the 6 non-configurable types ignore prefs even if a row says false
select lives_ok($SQL$ select set_notification_pref('plan_cancelled', false) $SQL$, 'try disabling plan_cancelled');
select ok( notif_push_allowed('40000000-0000-4000-a000-000000000001','plan_cancelled'),
  'non-configurable plan_cancelled ignores the pref (always push)');

-- ── cron logic: starting-60 creates notifications, idempotent ──────────────
select test_login('40000000-0000-4000-a000-000000000001');
-- _p was cancelled; make a fresh plan ~60 min out with a joiner
create temporary table _p2 as select create_plan('sports','Run','Park',12.9,77.6,
  now() + interval '60 minutes', 5::smallint,'open','free','all') as plan;
select test_login('40000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select join_plan((select (plan).id from _p2), gen_random_uuid()) $SQL$, 'joiner joins 60-min plan');
-- run cron (service context)
select set_config('request.jwt.claims', null, true);
select ok( fn_notify_starting_60() >= 2, 'fn_notify_starting_60 notifies host + joiner');
select results_eq( $SQL$ select fn_notify_starting_60() $SQL$, array[0],
  'fn_notify_starting_60 is idempotent (no duplicate notifications)');

select * from finish();
rollback;
