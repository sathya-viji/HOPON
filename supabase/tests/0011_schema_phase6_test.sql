-- ============================================================================
-- Phase 6 schema tests — blocks, reports, escalation, suspension triggers.
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(18);

select has_table('blocks');
select has_table('reports');
select col_is_pk('blocks', array['blocker_id','blocked_id'], 'blocks PK');
select has_index('reports', 'reports_target', 'reports target index');

-- emergency reason in enum + escalation triggers
select has_trigger('reports', 'trg_report_set_escalated', 'emergency sets status=escalated');
select has_trigger('reports', 'trg_report_dispatch', 'emergency dispatches edge');

-- suspension enforcement triggers on content tables
select has_trigger('recaps', 'trg_active_recaps', 'recaps suspension gate');
select has_trigger('messages', 'trg_active_messages', 'messages suspension gate');
select has_trigger('follows', 'trg_active_follows', 'follows suspension gate');

-- RLS + grants
select results_eq($SQL$
  select count(*)::int from pg_tables where schemaname='public'
   and tablename in ('blocks','reports') and not rowsecurity
$SQL$, array[0], 'RLS enabled on blocks + reports');
select ok(has_table_privilege('service_role','reports','INSERT'), 'service_role INSERT reports');
select ok(not has_table_privilege('authenticated','reports','SELECT'), 'reports not client-readable (admin only)');
select ok(not has_table_privilege('authenticated','reports','INSERT'), 'reports insert via RPC only');
select ok(has_table_privilege('authenticated','blocks','SELECT'), 'blocker can read own blocks');
select ok(not has_table_privilege('authenticated','blocks','INSERT'), 'blocks managed via RPC only');

-- is_blocked_pair now backed by real data
select has_function('is_blocked_pair', array['uuid','uuid'], 'is_blocked_pair helper exists');

-- audit_logs still admin-only (F5)
select ok(not has_table_privilege('authenticated','audit_logs','SELECT'), 'audit_logs invisible to clients');

-- Phase 1 privacy intact
select ok(not has_column_privilege('authenticated','users','gender','SELECT'), 'D11 intact');

select * from finish();
rollback;
