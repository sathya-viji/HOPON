-- ============================================================================
-- Phase 7 RPC tests — invites, feature flags, onboarding nudges.
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(12);

select has_table('invites');
select has_table('feature_flags');

-- fixtures: an existing user (so its phone hash is "already on hopon")
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values ('80000000-0000-4000-a000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','919900000001', now(), now(), now()),
       ('80000000-0000-4000-a000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','919900000002', now(), now(), now());
insert into users (id,name,handle,neighbourhood,dob,gender) values
 ('80000000-0000-4000-a000-000000000001','Inviter','@inviter7','HSR','1990-01-01','man'),
 ('80000000-0000-4000-a000-000000000002','Member','@member7','HSR','1990-01-01','man');

create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims', json_build_object('sub',p,'role','authenticated')::text, true);
$FN$;

-- ── create_invites: stores only hashes NOT already on hopon ────────────────
select test_login('80000000-0000-4000-a000-000000000001');
-- one hash matches an existing user (member, +919900000002), one is a stranger
select results_eq($SQL$
  select create_invites(array[
    encode(extensions.digest('+919900000002','sha256'),'hex'),   -- existing → skip
    encode(extensions.digest('+910000000099','sha256'),'hex')    -- stranger → store
  ])
$SQL$, array[1], 'create_invites stores only the not-yet-on-hopon hash');
select results_eq($SQL$ select count(*)::int from invites where inviter_id='80000000-0000-4000-a000-000000000001' $SQL$,
  array[1], 'exactly one invite row');

-- ── invite conversion on signup (complete_signup activates it) ─────────────
-- a brand-new auth user whose phone matches the stored invite hash
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
values ('80000000-0000-4000-a000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','910000000099', now(), now(), now());
select test_login('80000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select complete_signup('Newbie','@newbie7','1995-01-01','woman','HSR') $SQL$, 'invited user signs up');
select results_eq($SQL$ select status from invites where phone_hash=encode(extensions.digest('+910000000099','sha256'),'hex') $SQL$,
  array['joined'], 'invite converted to joined on signup');

-- ── feature flags + deterministic rollout ──────────────────────────────────
select set_config('request.jwt.claims', null, true);
insert into feature_flags (flag_name, enabled, rollout_pct) values
 ('on_100', true, 100), ('off_flag', false, 100), ('on_0', true, 0);
select test_login('80000000-0000-4000-a000-000000000001');
select ok( is_feature_enabled('on_100'), 'flag at 100% enabled');
select ok( not is_feature_enabled('off_flag'), 'disabled flag off regardless of pct');
select ok( not is_feature_enabled('on_0'), 'flag at 0% off');
select ok( not is_feature_enabled('missing'), 'unknown flag defaults off');

-- ── onboarding nudges ───────────────────────────────────────────────────────
select set_config('request.jwt.claims', null, true);
-- age the inviter to 49h with no avatar/bio → profile_incomplete
update users set created_at = now() - interval '49 hours', avatar_path=null, bio=null
 where id='80000000-0000-4000-a000-000000000001';
select ok( fn_notify_profile_incomplete() >= 1, 'profile_incomplete nudge fired');
select results_eq($SQL$ select count(*)::int from notifications
   where user_id='80000000-0000-4000-a000-000000000001' and type='profile_incomplete' $SQL$,
  array[1], 'profile_incomplete notification created (deduped)');

select * from finish();
rollback;
