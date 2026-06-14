-- ============================================================================
-- Phase 7 pen-check — security posture across the whole schema.
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(20);

-- Every public table has RLS enabled (no exceptions).
select results_eq($SQL$
  select count(*)::int from pg_tables where schemaname='public' and not rowsecurity
$SQL$, array[0], 'RLS enabled on EVERY public table');

-- Service-role-only tables: invisible to clients (anon + authenticated)
select ok(not has_table_privilege('authenticated','audit_logs','SELECT'),   'audit_logs hidden from authenticated');
select ok(not has_table_privilege('authenticated','reports','SELECT'),      'reports hidden from authenticated');
select ok(not has_table_privilege('authenticated','contact_hashes','SELECT'),'contact_hashes hidden');
select ok(not has_table_privilege('authenticated','pending_jobs','SELECT'), 'pending_jobs hidden');
select ok(not has_table_privilege('authenticated','feed_events','SELECT'),  'feed_events hidden');
select ok(not has_table_privilege('authenticated','recap_like_batches','SELECT'), 'recap_like_batches hidden');
select ok(not has_table_privilege('anon','users','SELECT'),                 'anon cannot touch base users');

-- D11 private columns locked
select ok(not has_column_privilege('authenticated','users','gender','SELECT'), 'gender locked');
select ok(not has_column_privilege('authenticated','users','dob','SELECT'),    'dob locked');

-- No client INSERT on content/identity tables (RPC-only mutation model)
select ok(not has_table_privilege('authenticated','plans','INSERT'),    'plans insert is RPC-only');
select ok(not has_table_privilege('authenticated','recaps','INSERT'),   'recaps insert is RPC-only');
select ok(not has_table_privilege('authenticated','notifications','INSERT'), 'notifications insert is system-only');

-- Privileged functions NOT executable by clients
select ok(not has_function_privilege('authenticated','approve_recap(uuid)','EXECUTE'),          'approve_recap service-only');
select ok(not has_function_privilege('authenticated','set_account_status(uuid,account_status,text,timestamptz)','EXECUTE'), 'set_account_status service-only');
select ok(not has_function_privilege('authenticated','fn_hard_delete_accounts()','EXECUTE'),    'hard-delete service-only');
select ok(not has_function_privilege('authenticated','match_contact_hashes(uuid,text[])','EXECUTE'), 'match_contact_hashes service-only');
select ok(not has_function_privilege('anon','complete_signup(text,text,date,gender_t,text)','EXECUTE'), 'complete_signup not anon');

-- Client-callable functions ARE executable (sanity)
select ok(has_function_privilege('authenticated','create_plan(text,text,text,numeric,numeric,timestamptz,smallint,plan_type_t,cost_t,gender_pref_t,text,text,text)','EXECUTE'), 'create_plan callable by authenticated');
select ok(has_function_privilege('authenticated','submit_report(report_target_t,uuid,report_reason_t,text)','EXECUTE'), 'submit_report callable by authenticated');

select * from finish();
rollback;
