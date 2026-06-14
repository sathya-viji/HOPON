-- ============================================================================
-- Phase 2 schema tests — plans, plan_members, triggers, RLS, grants.
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(27);

-- ── Tables / columns ─────────────────────────────────────────────────────
select has_table('plans');
select has_table('plan_members');
select col_not_null('plans', 'host_id', 'host_id required');
select col_not_null('plans', 'spots_remaining', 'spots_remaining required');
select has_column('plans', 'search_vector', 'generated search_vector present');
select has_column('plan_members', 'is_host_row', 'is_host_row present (D5)');
select has_column('plan_members', 'idempotency_key', 'idempotency_key present');

-- ── Constraints ──────────────────────────────────────────────────────────
select col_has_check('plans', 'capacity', 'capacity has CHECK (2..10)');
-- 14-day advance window
select throws_ok($SQL$
  insert into plans (host_id, category_id, activity, location_label, lat, lng,
                     starts_at, capacity, spots_remaining)
  values ('00000000-0000-4000-a000-000000000001','food','X','L',1,1,
          now() + interval '20 days', 4, 3)
$SQL$, '23514', null, 'D8: starts_at > 14 days violates CHECK');
-- capacity range
select throws_ok($SQL$
  insert into plans (host_id, category_id, activity, location_label, lat, lng,
                     starts_at, capacity, spots_remaining)
  values ('00000000-0000-4000-a000-000000000001','food','X','L',1,1,
          now() + interval '1 day', 1, 0)
$SQL$, '23514', null, 'capacity below 2 violates CHECK');

-- unique (plan_id, user_id)
select col_is_unique('plan_members', array['plan_id','user_id'], 'one membership per user per plan');
select col_is_unique('plan_members', array['idempotency_key'], 'idempotency_key unique');

-- ── Indexes ──────────────────────────────────────────────────────────────
select has_index('plans', 'plans_geo', 'gist geo index');
select has_index('plans', 'plans_search', 'gin search index');
select has_index('plans', 'plans_starts_at', 'partial active starts_at index');
select has_index('plan_members', 'plan_members_plan', 'members by plan');
select has_index('plan_members', 'plan_members_user', 'members by user');

-- ── Triggers ─────────────────────────────────────────────────────────────
select has_trigger('plan_members', 'trg_block_host_self_join', 'host self-join guard');
select has_trigger('plan_members', 'trg_sync_spots', 'spot sync trigger');

-- ── spot trigger correctness (seed p0: cap 5, 3 joiners ⇒ remaining 1) ─────
select results_eq(
  $SQL$ select spots_remaining from plans where id='00000000-0000-4000-b000-000000000000' $SQL$,
  array[1::smallint], 'spots trigger: cap5 - host - 3 joiners = 1');

-- host self-join blocked (u2 hosts p0)
select throws_ok($SQL$
  insert into plan_members (plan_id, user_id)
  values ('00000000-0000-4000-b000-000000000000','00000000-0000-4000-a000-000000000002')
$SQL$, 'P0001', 'host_cannot_join_own_plan', 'trigger blocks host self-join');

-- ── RLS + grants ─────────────────────────────────────────────────────────
select results_eq($SQL$
  select count(*)::int from pg_tables
  where schemaname='public' and tablename in ('plans','plan_members') and not rowsecurity
$SQL$, array[0], 'RLS enabled on plans + plan_members');

select ok(has_table_privilege('authenticated','plans','SELECT'),
  'authenticated can SELECT plans (RLS filters rows)');
select ok(not has_table_privilege('authenticated','plans','INSERT'),
  'authenticated CANNOT INSERT plans directly (RPC-only)');
select ok(has_table_privilege('service_role','plans','INSERT')
      and has_table_privilege('service_role','plans','UPDATE'),
  'service_role has explicit DML on plans');
select ok(has_table_privilege('service_role','plan_members','DELETE'),
  'service_role has explicit DML on plan_members');
select ok(not has_table_privilege('authenticated','plan_members','INSERT'),
  'authenticated CANNOT INSERT plan_members directly (join_plan RPC only)');

select * from finish();
rollback;
