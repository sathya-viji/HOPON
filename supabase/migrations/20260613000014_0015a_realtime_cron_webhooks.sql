-- ============================================================================
-- Migration 0015a — realtime publication, webhook dispatch, cron scheduling
-- Execution doc Part 5 (realtime channels) + Part 8 (push webhook) + Part 6 cron.
--
-- All three pieces are environment-tolerant: they configure production wiring
-- but no-op cleanly on a local/CI stack that lacks pg_cron or edge config, so
-- `db reset` and pgTAP stay green.
-- ============================================================================

-- ── 1. Realtime: add tables to the supabase_realtime publication ───────────
-- Channels: user:{id}:notifications, plan:{id}:members, plan:{id}:chat.
-- Realtime enforces each subscriber's SELECT RLS, so users only receive rows
-- they are allowed to read.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
      alter publication supabase_realtime add table notifications;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='plan_members') then
      alter publication supabase_realtime add table plan_members;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
      alter publication supabase_realtime add table messages;
    end if;
  else
    raise notice 'supabase_realtime publication absent (non-Supabase Postgres?) — realtime not wired';
  end if;
end $$;

-- members channel emits UPDATE/DELETE; full replica identity carries old rows.
alter table plan_members replica identity full;

-- ── 2. Webhook dispatch: notifications/messages INSERT → Edge Functions ────
-- Uses pg_net + GUC config. In production set:
--   alter database postgres set app.settings.edge_base_url   = 'https://<ref>.supabase.co/functions/v1';
--   alter database postgres set app.settings.service_role_key = '<service-role-key>';
-- (or use Supabase Dashboard Database Webhooks / Vault). Unset ⇒ no-op.
create or replace function fn_dispatch_edge(p_fn text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_base text; v_key text; v_req bigint;
begin
  v_base := current_setting('app.settings.edge_base_url', true);
  v_key  := current_setting('app.settings.service_role_key', true);
  if v_base is null or v_base = '' then
    return;   -- unconfigured (local/CI) — no-op
  end if;
  if to_regproc('net.http_post') is null then
    return;   -- pg_net absent
  end if;
  select net.http_post(
    url     := v_base || '/' || p_fn,
    headers := jsonb_build_object('Content-Type','application/json',
                                  'Authorization','Bearer ' || coalesce(v_key,'')),
    body    := p_payload
  ) into v_req;
end $$;
revoke execute on function fn_dispatch_edge(text, jsonb) from anon, authenticated, public;
grant execute on function fn_dispatch_edge(text, jsonb) to service_role;

create or replace function fn_notification_dispatch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform fn_dispatch_edge('push-sender', jsonb_build_object('notification_id', new.id));
  return new;
end $$;
drop trigger if exists trg_notification_dispatch on notifications;
create trigger trg_notification_dispatch after insert on notifications
  for each row execute function fn_notification_dispatch();

create or replace function fn_message_dispatch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform fn_dispatch_edge('chat-push', jsonb_build_object('message_id', new.id));
  return new;
end $$;
drop trigger if exists trg_message_dispatch on messages;
create trigger trg_message_dispatch after insert on messages
  for each row execute function fn_message_dispatch();

-- ── 3. Cron scheduling (guarded on pg_cron; production only) ────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('hopon-starting-60', '*/5 * * * *', 'select fn_notify_starting_60()');
    perform cron.schedule('hopon-starting-15', '*/2 * * * *', 'select fn_notify_starting_15()');
    perform cron.schedule('hopon-started-5',   '*/5 * * * *', 'select fn_notify_started_5()');
    perform cron.schedule('hopon-expiry',      '*/10 * * * *','select fn_expire_plans()');
    perform cron.schedule('hopon-token-prune', '0 3 * * *',   'select fn_prune_push_tokens()');
  else
    raise notice 'pg_cron not available — Phase 3 cron jobs NOT scheduled (REQUIRED in production)';
  end if;
end $$;
