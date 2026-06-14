-- ============================================================================
-- Migration 0014c — Phase 3 RPCs (chat writes, notification RPCs, cron logic)
-- Execution doc Part 4 (send_message, mark_notifications_read,
-- register_push_token, set_notification_pref) + Part 6 cron logic functions.
-- All security definer, pinned search_path, typed errors. RPC-only mutations.
-- ============================================================================

-- ─── send_message ───────────────────────────────────────────────────────────
-- Insert runs as owner (bypasses RLS); chat-lock trigger still fires. Realtime
-- broadcasts the INSERT; the messages-INSERT webhook drives chat-push (mentions
-- + backgrounded push).
create or replace function send_message(p_plan_id uuid, p_body text)
returns messages
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_msg messages;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if char_length(coalesce(trim(p_body),'')) = 0 then raise exception 'empty_message' using errcode='P0001'; end if;
  if not is_active_member(p_plan_id, v_uid) then raise exception 'not_member' using errcode='P0001'; end if;

  insert into messages (plan_id, author_id, body)
  values (p_plan_id, v_uid, trim(p_body))
  returning * into v_msg;     -- fn_chat_lock enforces D3 closed/archived rules
  return v_msg;
end $$;

-- ─── delete_message (soft delete own message) ──────────────────────────────
create or replace function delete_message(p_message_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  update messages set is_deleted = true, body = '[deleted]'
  where id = p_message_id and author_id = v_uid and not is_deleted;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'message_not_found' using errcode='P0001'; end if;
end $$;

-- ─── mark_notifications_read ────────────────────────────────────────────────
create or replace function mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_n integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  update notifications set is_read = true
  where user_id = v_uid and is_read = false
    and (p_ids is null or id = any(p_ids));
  get diagnostics v_n = row_count;
  return v_n;   -- count newly-read
end $$;

-- ─── register_push_token (upsert; one token row per device) ────────────────
create or replace function register_push_token(p_token text, p_platform text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_platform not in ('ios','android') then raise exception 'invalid_platform' using errcode='P0001'; end if;

  insert into push_tokens (user_id, token, platform, last_seen)
  values (v_uid, p_token, p_platform, now())
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, last_seen = now();
end $$;

-- ─── set_notification_pref ──────────────────────────────────────────────────
create or replace function set_notification_pref(p_event_type notif_type, p_push_enabled boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  insert into notification_prefs (user_id, event_type, push_enabled)
  values (v_uid, p_event_type, p_push_enabled)
  on conflict (user_id, event_type) do update set push_enabled = excluded.push_enabled;
end $$;

-- ─── get_notifications (feed for the Notifications screen) ───────────────────
create or replace function get_notifications(p_cursor integer default 0, p_limit integer default 30)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rows jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
             'id', n.id, 'type', n.type, 'is_read', n.is_read, 'body', n.body,
             'plan_id', n.plan_id, 'recap_id', n.recap_id, 'created_at', n.created_at,
             'actor', (select to_jsonb(up) from users_public up where up.id = n.actor_id)
           ) as item, n.created_at
    from notifications n
    where n.user_id = v_uid
    order by n.created_at desc
    offset greatest(p_cursor, 0) limit least(p_limit, 100)
  ) sub;
  return v_rows;
end $$;

-- ─── notify_mention — service-role wrapper used by chat-push ───────────────
-- Keeps the 'mention' enum + dedupe inside the DB (one mention notif per
-- author's message per recipient is naturally unique by row).
create or replace function notify_mention(p_user uuid, p_actor uuid, p_plan uuid, p_body text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  perform notify(p_user, 'mention', p_body, p_plan, p_actor);
end $$;
revoke execute on function notify_mention(uuid, uuid, uuid, text) from anon, authenticated, public;
grant execute on function notify_mention(uuid, uuid, uuid, text) to service_role;

-- ============================================================================
-- Cron logic functions (Part 6). Pure SQL logic — scheduled in 0015a (guarded
-- on pg_cron). Each is idempotent: it never re-notifies (dedupes on an existing
-- notification of the same type for the same plan+user).
-- ============================================================================

-- plan-starting-60: 55–65 min out → host + joiners
create or replace function fn_notify_starting_60() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; p record; m record;
begin
  for p in select * from plans where status in ('active','full')
           and starts_at between now() + interval '55 minutes' and now() + interval '65 minutes' loop
    if not exists (select 1 from notifications where user_id=p.host_id and plan_id=p.id and type='plan_starting_soon_host') then
      perform notify(p.host_id, 'plan_starting_soon_host', 'Your '||p.activity||' plan starts soon.', p.id);
      n := n + 1;
    end if;
    for m in select user_id from plan_members
             where plan_id=p.id and status in ('joined','approved') and not is_host_row loop
      if not exists (select 1 from notifications where user_id=m.user_id and plan_id=p.id and type='plan_starting_soon_joiner') then
        perform notify(m.user_id, 'plan_starting_soon_joiner', p.activity||' starts soon at '||p.location_label||'.', p.id);
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- plan-starting-15: 13–17 min out → joiners
create or replace function fn_notify_starting_15() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; p record; m record;
begin
  for p in select * from plans where status in ('active','full')
           and starts_at between now() + interval '13 minutes' and now() + interval '17 minutes' loop
    for m in select user_id from plan_members
             where plan_id=p.id and status in ('joined','approved') and not is_host_row loop
      if not exists (select 1 from notifications where user_id=m.user_id and plan_id=p.id and type='plan_starting_15') then
        perform notify(m.user_id, 'plan_starting_15', p.activity||' is about to begin at '||p.location_label||'.', p.id);
        n := n + 1;
      end if;
    end loop;
  end loop;
  return n;
end $$;

-- plan-started-5: started 3–7 min ago, still active → host
create or replace function fn_notify_started_5() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; p record;
begin
  for p in select * from plans where status in ('active','full')
           and starts_at between now() - interval '7 minutes' and now() - interval '3 minutes' loop
    if not exists (select 1 from notifications where user_id=p.host_id and plan_id=p.id and type='plan_started_host') then
      perform notify(p.host_id, 'plan_started_host', 'Your '||p.activity||' plan just started. Have fun.', p.id);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- plan-expiry: active & >10 min past start → expired; notify host + members
create or replace function fn_expire_plans() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; p record; m record;
begin
  for p in select * from plans where status in ('active','full')
           and starts_at < now() - interval '10 minutes' loop
    update plans set status='expired' where id = p.id;
    perform notify(p.host_id, 'plan_expired_host', 'Your '||p.activity||' plan expired.', p.id);
    for m in select user_id from plan_members
             where plan_id=p.id and status in ('joined','approved') and not is_host_row loop
      perform notify(m.user_id, 'plan_expired_joiner', p.activity||' started without being marked ended.', p.id);
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;

-- token-prune: drop tokens unseen for 90 days
create or replace function fn_prune_push_tokens() returns integer
language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  delete from push_tokens where last_seen < now() - interval '90 days';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ─── Grants ─────────────────────────────────────────────────────────────────
do $$
declare fn text;
begin
  -- client-callable RPCs
  foreach fn in array array[
    'send_message(uuid,text)',
    'delete_message(uuid)',
    'mark_notifications_read(uuid[])',
    'register_push_token(text,text)',
    'set_notification_pref(notif_type,boolean)',
    'get_notifications(integer,integer)'
  ] loop
    execute format('revoke execute on function %s from anon, public', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;

  -- cron logic: service_role only (invoked by pg_cron / job runner)
  foreach fn in array array[
    'fn_notify_starting_60()','fn_notify_starting_15()','fn_notify_started_5()',
    'fn_expire_plans()','fn_prune_push_tokens()'
  ] loop
    execute format('revoke execute on function %s from anon, authenticated, public', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
