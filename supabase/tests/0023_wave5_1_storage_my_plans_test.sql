-- ============================================================================
-- Wave 5.1 tests — gap #1 (get_my_plans) + gap #2 (storage.objects own-folder
-- RLS for avatars/recaps/stories). Run: supabase test db
-- ============================================================================
begin;
select plan(17);

-- ── Fixtures: host H, members A, B, loner C ───────────────────────────────
insert into auth.users (id, instance_id, aud, role, phone, phone_confirmed_at, created_at, updated_at)
select v.id::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',v.phone,now(),now(),now()
from (values
  ('60000000-0000-4000-a000-000000000001','918300000001'),
  ('60000000-0000-4000-a000-000000000002','918300000002'),
  ('60000000-0000-4000-a000-000000000003','918300000003'),
  ('60000000-0000-4000-a000-000000000004','918300000004')
) as v(id,phone);

create or replace function test_login(p uuid) returns void language sql as $FN$
  select set_config('request.jwt.claims', json_build_object('sub',p,'role','authenticated')::text, true);
$FN$;

select test_login('60000000-0000-4000-a000-000000000001');
select lives_ok($SQL$ select complete_signup('Hostit','@hostit51','1990-01-01','man','HSR') $SQL$, 'H signup');
select test_login('60000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select complete_signup('Amy','@amy51','1992-01-01','woman','HSR') $SQL$, 'A signup');
select test_login('60000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select complete_signup('Bob','@bob51','1992-01-01','man','HSR') $SQL$, 'B signup');
select test_login('60000000-0000-4000-a000-000000000004');
select lives_ok($SQL$ select complete_signup('Cleo','@cleo51','1992-01-01','woman','HSR') $SQL$, 'C signup');

-- H hosts P1 (sooner) and P2 (later); A joins P1, B joins P2.
select test_login('60000000-0000-4000-a000-000000000001');
create temporary table _p1 as select create_plan('sports','Tennis','Court',12.9,77.6,
  now() + interval '60 minutes', 6::smallint,'open','free','all') as plan;
create temporary table _p2 as select create_plan('social','Picnic','Park',12.9,77.6,
  now() + interval '120 minutes', 6::smallint,'open','free','all') as plan;
select test_login('60000000-0000-4000-a000-000000000002');
select lives_ok($SQL$ select join_plan((select (plan).id from _p1), gen_random_uuid()) $SQL$, 'A joins P1');
select test_login('60000000-0000-4000-a000-000000000003');
select lives_ok($SQL$ select join_plan((select (plan).id from _p2), gen_random_uuid()) $SQL$, 'B joins P2');

-- ── get_my_plans (gap #1) ─────────────────────────────────────────────────
select test_login('60000000-0000-4000-a000-000000000001');
select is((select count(*)::int from get_my_plans()), 2, 'host sees both hosted plans');
select is((select id from get_my_plans() limit 1), (select (plan).id from _p2),
  'ordered soonest-started last (P2 starts later → first)');

select test_login('60000000-0000-4000-a000-000000000002');
select is((select count(*)::int from get_my_plans()), 1, 'member A sees only joined P1');
select is((select id from get_my_plans() limit 1), (select (plan).id from _p1), 'A''s plan is P1');

select test_login('60000000-0000-4000-a000-000000000004');
select is((select count(*)::int from get_my_plans()), 0, 'loner C sees no plans');

-- grants
select ok(has_function_privilege('authenticated','get_my_plans()','execute'),
  'authenticated may execute get_my_plans');
select ok(not has_function_privilege('anon','get_my_plans()','execute'),
  'anon may NOT execute get_my_plans');

-- ── storage.objects own-folder RLS (gap #2) ───────────────────────────────
select is((select count(*)::int from pg_policies
   where schemaname='storage' and tablename='objects'
     and policyname in ('app_own_folder_insert','app_own_folder_update','app_own_folder_delete')), 3,
  'three own-folder storage policies exist');

-- Ensure buckets exist for the FK (idempotent — normally provisioned by config.toml).
insert into storage.buckets (id, name, public) values
  ('avatars','avatars',true), ('recaps','recaps',true), ('stories','stories',true)
on conflict (id) do nothing;

-- Functional RLS: must run as the `authenticated` role (postgres bypasses RLS).
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub','60000000-0000-4000-a000-000000000002','role','authenticated')::text, true);

select lives_ok($SQL$
  insert into storage.objects (bucket_id, name)
  values ('recaps', '60000000-0000-4000-a000-000000000002/ok.jpg') $SQL$,
  'A may upload to recaps under own folder');
select lives_ok($SQL$
  insert into storage.objects (bucket_id, name)
  values ('avatars', '60000000-0000-4000-a000-000000000002/me.jpg') $SQL$,
  'A may upload own avatar');
select throws_ok($SQL$
  insert into storage.objects (bucket_id, name)
  values ('stories', '60000000-0000-4000-a000-000000000003/nope.jpg') $SQL$,
  '42501', null,
  'A may NOT upload under another user''s folder');

reset role;

select * from finish();
rollback;
