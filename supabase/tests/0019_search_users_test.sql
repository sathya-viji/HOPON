-- ============================================================================
-- search_users (people search). Run: supabase test db
-- Privacy comes from users_public (block-pairs + profile_visibility); these
-- tests prove the matching/ranking AND that the view's privacy still holds when
-- queried through the definer RPC.
-- ============================================================================
begin;
select plan(12);

-- ── Fixtures: auth shells + profiles ──────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select v.id::uuid, '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
       v.phone, now(), now(), now()
from (values
  ('40000000-0000-4000-a000-000000000001','917000000001'),  -- searcher
  ('40000000-0000-4000-a000-000000000002','917000000002'),  -- Alice (public)
  ('40000000-0000-4000-a000-000000000003','917000000003'),  -- Carol (followers-only)
  ('40000000-0000-4000-a000-000000000004','917000000004')   -- Blocky (blocked pair)
) as v(id, phone);

create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims',
    json_build_object('sub', p, 'role','authenticated')::text, true);
$FN$;

select test_login('40000000-0000-4000-a000-000000000001');
select complete_signup('Searcher Sam','@searcher_x','1990-01-01','man','HSR');
select test_login('40000000-0000-4000-a000-000000000002');
select complete_signup('Alice Kumar','@alice_k','1991-01-01','woman','HSR');
select test_login('40000000-0000-4000-a000-000000000003');
select complete_signup('Carol Private','@carol_p','1992-01-01','woman','HSR');
select test_login('40000000-0000-4000-a000-000000000004');
select complete_signup('Blocky Bee','@blocky_b','1993-01-01','man','HSR');

-- Carol is followers-only; searcher does NOT follow her.
update users set profile_visibility = 'followers'
  where id = '40000000-0000-4000-a000-000000000003';
-- Mutual-block pair between searcher and Blocky.
insert into blocks (blocker_id, blocked_id)
  values ('40000000-0000-4000-a000-000000000001','40000000-0000-4000-a000-000000000004');

-- helper: does the result array contain a given user id?
create or replace function _has_uid(res jsonb, uid text) returns boolean language sql as $FN$
  select exists (select 1 from jsonb_array_elements(res) e where e->>'id' = uid);
$FN$;

select test_login('40000000-0000-4000-a000-000000000001');

-- ── Contract ──────────────────────────────────────────────────────────────
select has_function('search_users', array['text','integer'], 'search_users(text,integer) exists');
select ok(not has_function_privilege('anon','search_users(text,integer)','EXECUTE'),
  'anon cannot execute search_users');
select ok(has_function_privilege('authenticated','search_users(text,integer)','EXECUTE'),
  'authenticated can execute search_users');

-- ── Matching ────────────────────────────────────────────────────────────────
select ok(_has_uid(search_users('Alice'), '40000000-0000-4000-a000-000000000002'),
  'name prefix "Alice" finds Alice');
select ok(_has_uid(search_users('Kumar'), '40000000-0000-4000-a000-000000000002'),
  'name contains "Kumar" finds Alice');
select ok(_has_uid(search_users('@alice_k'), '40000000-0000-4000-a000-000000000002'),
  'exact @handle finds Alice');
select ok(_has_uid(search_users('alice_k'), '40000000-0000-4000-a000-000000000002'),
  'handle without @ finds Alice');

-- ── Guards & privacy ──────────────────────────────────────────────────────
select is(jsonb_array_length(search_users('Searcher')), 0,
  'self is excluded from results');
select is(search_users('a'), '[]'::jsonb,
  'query under 2 chars returns empty');
select is(jsonb_array_length(search_users('Blocky')), 0,
  'blocked-pair user is excluded (via users_public)');
select is(jsonb_array_length(search_users('Carol')), 0,
  'followers-only user hidden from non-follower');

-- ── Auth ──────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
select throws_ok($SQL$ select search_users('Alice') $SQL$,
  'P0001', 'not_authenticated', 'unauthenticated call raises not_authenticated');

select * from finish();
rollback;
