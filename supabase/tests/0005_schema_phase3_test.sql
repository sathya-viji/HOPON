-- ============================================================================
-- Phase 3 schema tests — messages, notifications, prefs, push_tokens, realtime,
-- chat-lock, grants. Run with: supabase test db
-- ============================================================================
begin;
select plan(25);

-- ── Tables ───────────────────────────────────────────────────────────────
select has_table('messages');
select has_table('notifications');
select has_table('notification_prefs');
select has_table('push_tokens');
select has_table('pending_jobs');

-- ── Columns / constraints ────────────────────────────────────────────────
select col_not_null('messages', 'body', 'message body required');
select has_column('notifications', 'recap_id', 'recap_id present (FK added Phase 5)');
select col_is_pk('notification_prefs', array['user_id','event_type'], 'prefs PK is (user,event)');
select col_is_unique('push_tokens', array['token'], 'push token unique');

-- ── Indexes ──────────────────────────────────────────────────────────────
select has_index('messages', 'messages_plan_time', 'messages time index');
select has_index('notifications', 'notifs_user_unread', 'partial unread index');

-- ── chat-lock trigger ────────────────────────────────────────────────────
select has_trigger('messages', 'trg_chat_lock', 'chat lock trigger present');

-- ── Realtime publication membership ──────────────────────────────────────
select results_eq($SQL$
  select count(*)::int from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public'
    and tablename in ('messages','notifications','plan_members')
$SQL$, array[3], 'all three realtime channels published');

-- ── Webhook dispatch triggers ────────────────────────────────────────────
select has_trigger('notifications', 'trg_notification_dispatch', 'notification → push-sender webhook');
select has_trigger('messages', 'trg_message_dispatch', 'message → chat-push webhook');

-- ── RLS enabled ──────────────────────────────────────────────────────────
select results_eq($SQL$
  select count(*)::int from pg_tables
  where schemaname='public'
    and tablename in ('messages','notifications','notification_prefs','push_tokens','pending_jobs')
    and not rowsecurity
$SQL$, array[0], 'RLS enabled on all Phase 3 tables');

-- ── Grants: explicit service_role; client reads only ─────────────────────
select ok(has_table_privilege('service_role','notifications','INSERT'),
  'service_role INSERT on notifications (explicit)');
select ok(has_table_privilege('service_role','messages','INSERT'),
  'service_role INSERT on messages (explicit)');
select ok(has_table_privilege('service_role','pending_jobs','INSERT'),
  'service_role INSERT on pending_jobs (explicit)');
select ok(not has_table_privilege('authenticated','notifications','INSERT'),
  'authenticated CANNOT INSERT notifications (RPC/system only)');
select ok(not has_table_privilege('authenticated','messages','INSERT'),
  'authenticated CANNOT INSERT messages (send_message RPC only)');
select ok(not has_table_privilege('authenticated','pending_jobs','SELECT'),
  'pending_jobs invisible to clients');
select ok(has_table_privilege('authenticated','push_tokens','DELETE'),
  'authenticated may delete own push token (logout)');
select ok(not has_table_privilege('authenticated','notification_prefs','UPDATE'),
  'prefs updated via RPC only (no direct client UPDATE)');

-- ── Phase 1 privacy still intact ─────────────────────────────────────────
select ok(not has_column_privilege('authenticated','users','gender','SELECT'),
  'D11 intact: gender still unreadable by clients');

select * from finish();
rollback;
