-- ============================================================================
-- Phase 4 schema tests — trust tables, guard, audit_logs, silent notif class.
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(21);

select has_table('attendance_marks');
select has_table('endorsements');
select has_table('host_noshow_votes');
select has_table('familiar_faces');
select has_table('audit_logs');

select col_is_unique('attendance_marks', array['plan_id','subject_id'], 'one mark per subject per plan');
select col_is_unique('endorsements', array['plan_id','giver_id','receiver_id'], 'D6: one endorsement per giver→receiver per plan');
select col_is_pk('familiar_faces', array['user_a_id','user_b_id'], 'familiar_faces canonical pair PK');
select has_trigger('endorsements', 'trg_endorsement_guard', 'endorsement guard present');

-- familiar_faces canonical ordering enforced
select throws_ok($SQL$
  insert into familiar_faces (user_a_id, user_b_id, last_met_at)
  values ('00000000-0000-4000-a000-000000000002','00000000-0000-4000-a000-000000000001', now())
$SQL$, '23514', null, 'familiar_faces rejects a>b (canonical ordering)');

-- ── RLS enabled ──────────────────────────────────────────────────────────
select results_eq($SQL$
  select count(*)::int from pg_tables where schemaname='public'
   and tablename in ('attendance_marks','endorsements','host_noshow_votes','familiar_faces','audit_logs')
   and not rowsecurity
$SQL$, array[0], 'RLS enabled on all Phase 4 tables');

-- ── Grants: explicit service_role; client reads only ─────────────────────
select ok(has_table_privilege('service_role','attendance_marks','INSERT'), 'service_role INSERT attendance_marks');
select ok(has_table_privilege('service_role','endorsements','INSERT'), 'service_role INSERT endorsements');
select ok(has_table_privilege('service_role','familiar_faces','INSERT'), 'service_role INSERT familiar_faces');
select ok(has_table_privilege('service_role','audit_logs','INSERT'), 'service_role INSERT audit_logs');
select ok(not has_table_privilege('authenticated','attendance_marks','INSERT'), 'authenticated cannot INSERT attendance_marks (RPC only)');
select ok(not has_table_privilege('authenticated','endorsements','INSERT'), 'authenticated cannot INSERT endorsements (RPC only)');
select ok(not has_table_privilege('authenticated','audit_logs','SELECT'), 'audit_logs invisible to clients (F5)');

-- ── Silent notification class (matrix) ───────────────────────────────────
select ok(not notif_push_allowed('00000000-0000-4000-a000-000000000001','plan_posted'),
  'Silent: plan_posted never pushes');
select ok(not notif_push_allowed('00000000-0000-4000-a000-000000000001','attendance_score_improved'),
  'Silent: attendance_score_improved never pushes');
select ok(notif_push_allowed('00000000-0000-4000-a000-000000000001','attendance_score_dropped'),
  'attendance_score_dropped pushes (preference-controlled, default on)');

select * from finish();
rollback;
