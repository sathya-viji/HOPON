-- ============================================================================
-- Phase 1 schema tests — run with: supabase test db
-- Verifies migrations 0001–0004 + 0012a structure and privilege lockdown.
-- ============================================================================
begin;
select plan(26);

-- ── Extensions ───────────────────────────────────────────────────────────
select has_extension('pg_trgm',  'pg_trgm installed');
select has_extension('postgis',  'postgis installed');
select has_extension('pgcrypto', 'pgcrypto installed');

-- ── Enums ────────────────────────────────────────────────────────────────
select has_enum('gender_t', 'gender_t enum exists');
select enum_has_labels('gender_t', array['man','woman','nonbinary','prefer_not'],
  'gender_t labels frozen');
select has_enum('verification_level', 'verification_level enum exists');
select has_enum('notif_type', 'notif_type enum exists');
select ok(
  (select count(*) from unnest(enum_range(null::notif_type))) = 41,
  'notif_type has all 41 frozen labels');

-- ── Reference data ───────────────────────────────────────────────────────
select has_table('categories');
select results_eq('select count(*)::int from categories', array[8],
  'all 8 categories seeded by migration');

-- ── users table ──────────────────────────────────────────────────────────
select has_table('users');
select col_not_null('users', 'gender',  'gender required');
select col_not_null('users', 'dob',     'dob required');
select has_index('users', 'users_name_trgm', 'trigram name index exists');

-- F1: underage rejected at DB level
select lives_ok($SQL$
  insert into auth.users (id, instance_id, aud, role, phone, created_at, updated_at)
  values ('10000000-0000-4000-a000-000000000001',
          '00000000-0000-0000-0000-000000000000',
          'authenticated','authenticated','911234500001', now(), now())
$SQL$, 'auth shell user created');

select throws_ok($SQL$
  insert into users (id, name, handle, neighbourhood, dob, gender)
  values ('10000000-0000-4000-a000-000000000001', 'Kid', '@kid', 'HSR',
          current_date - interval '17 years', 'man')
$SQL$, '23514', null, 'F1: under-18 dob violates CHECK');

-- handle format enforced
select throws_ok($SQL$
  insert into users (id, name, handle, neighbourhood, dob, gender)
  values ('10000000-0000-4000-a000-000000000001', 'Bad', 'no-at-sign', 'HSR',
          '1990-01-01', 'man')
$SQL$, '23514', null, 'handle must match frozen regex');

-- ── users_public view: D11 privacy ───────────────────────────────────────
select has_view('users_public');
select ok(
  not exists (select 1 from information_schema.columns
              where table_name = 'users_public' and column_name in ('gender','dob')),
  'D11: users_public exposes neither gender nor dob');

-- base table column privileges: gender/dob NOT selectable by authenticated
select ok(
  not has_column_privilege('authenticated', 'users', 'gender', 'SELECT'),
  'authenticated cannot SELECT users.gender');
select ok(
  not has_column_privilege('authenticated', 'users', 'dob', 'SELECT'),
  'authenticated cannot SELECT users.dob');
select ok(
  not has_column_privilege('authenticated', 'users', 'handle', 'UPDATE'),
  'handle is not self-editable (not in update whitelist)');

-- ── contact_hashes lockdown ──────────────────────────────────────────────
select has_table('contact_hashes');
select ok(
  not has_table_privilege('authenticated', 'contact_hashes', 'SELECT'),
  'contact_hashes invisible to clients (service-role only)');
select ok(
  has_table_privilege('service_role', 'contact_hashes', 'INSERT')
  and has_table_privilege('service_role', 'contact_hashes', 'DELETE'),
  'service_role retains DML on contact_hashes (Edge Function writes)');

-- RLS enabled everywhere Phase 1 touches
select results_eq($SQL$
  select count(*)::int from pg_tables
  where schemaname = 'public'
    and tablename in ('users','categories','contact_hashes')
    and not rowsecurity
$SQL$, array[0], 'RLS enabled on all Phase 1 tables');

select * from finish();
rollback;
