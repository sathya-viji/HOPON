-- ============================================================================
-- G1 — users.interests column, exposure, self-edit, constraint.
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(6);

select has_column('users', 'interests', 'users.interests exists');
select col_type_is('users', 'interests', 'text[]', 'interests is text[]');
select ok(
  exists (select 1 from information_schema.columns
          where table_name='users_public' and column_name='interests'),
  'users_public exposes interests');
select ok(has_column_privilege('authenticated','users','interests','UPDATE'),
  'interests is self-editable (whitelist)');

-- >20 interests rejected
insert into auth.users (id, instance_id, aud, role, created_at, updated_at)
values ('a0000000-0000-4000-a000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated',now(),now());
select throws_ok($SQL$
  insert into users (id,name,handle,neighbourhood,dob,gender,interests)
  values ('a0000000-0000-4000-a000-000000000001','I','@int1','HSR','1990-01-01','man',
          (select array_agg('x'||g) from generate_series(1,21) g))
$SQL$, '23514', null, 'CHECK rejects >20 interests');

select lives_ok($SQL$
  insert into users (id,name,handle,neighbourhood,dob,gender,interests)
  values ('a0000000-0000-4000-a000-000000000001','I','@int1','HSR','1990-01-01','man',
          array['sports','food','outdoors'])
$SQL$, 'valid interests accepted');

select * from finish();
rollback;
