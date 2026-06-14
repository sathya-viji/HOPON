-- ============================================================================
-- Migration 0011 — notifications, notification_prefs, push_tokens
-- Execution doc Part 1 Migration 0011 + Part 3 RLS + Part 8 (notification arch).
--
-- recap_id is added as a plain uuid column WITHOUT its FK: recaps lands in
-- Phase 5 (migration 0009). Phase 5 adds the FK via ALTER. No Phase 3
-- notification populates recap_id, so this is inert until then.
--
-- Writes are RPC-only: mark_notifications_read, register_push_token,
-- set_notification_pref (migration 0014c). Clients read own rows (RLS) and
-- subscribe to user:{id}:notifications realtime. In-app notifications always
-- deliver; only PUSH is preference-gated (notification_prefs.push_enabled).
-- ============================================================================

create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       notif_type not null,
  is_read    boolean not null default false,
  plan_id    uuid references plans(id) on delete set null,
  actor_id   uuid references users(id) on delete set null,
  recap_id   uuid,                                   -- FK added in Phase 5
  body       text not null,
  created_at timestamptz not null default now()
);
create index if not exists notifs_user_time   on notifications (user_id, created_at desc);
create index if not exists notifs_user_unread on notifications (user_id, created_at desc) where is_read = false;

create table if not exists notification_prefs (
  user_id      uuid not null references users(id) on delete cascade,
  event_type   notif_type not null,
  push_enabled boolean not null default true,
  primary key (user_id, event_type)
);

create table if not exists push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('ios','android')),
  created_at timestamptz not null default now(),
  last_seen  timestamptz not null default now()
);
create index if not exists push_tokens_user on push_tokens (user_id);

-- ── Push gate: single source of truth for "should we push?" ────────────────
-- Six frozen types are non-configurable (always push, prefs ignored).
create or replace function notif_push_allowed(p_user uuid, p_type notif_type) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_type in ('request_approved','request_declined','plan_cancelled',
                    'host_marked_absent','marked_noshow','welcome') then true
    else coalesce(
      (select push_enabled from notification_prefs where user_id = p_user and event_type = p_type),
      true)
  end;
$$;
revoke execute on function notif_push_allowed(uuid, notif_type) from anon, public;
grant execute on function notif_push_allowed(uuid, notif_type) to service_role;

-- ── Privileges ─────────────────────────────────────────────────────────────
alter table notifications      enable row level security;
alter table notification_prefs enable row level security;
alter table push_tokens        enable row level security;

grant select on notifications to authenticated;                       -- RLS: own rows
grant select on notification_prefs to authenticated;                  -- RLS: own rows
grant select, delete on push_tokens to authenticated;                 -- RLS: own rows
grant select, insert, update, delete on notifications      to service_role;
grant select, insert, update, delete on notification_prefs to service_role;
grant select, insert, update, delete on push_tokens        to service_role;

-- ── RLS: own-row reads; writes are RPC-only ────────────────────────────────
drop policy if exists notifications_select_own on notifications;
create policy notifications_select_own on notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notification_prefs_select_own on notification_prefs;
create policy notification_prefs_select_own on notification_prefs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists push_tokens_select_own on push_tokens;
create policy push_tokens_select_own on push_tokens
  for select to authenticated using (user_id = auth.uid());

-- Logout: a client may delete its own token directly.
drop policy if exists push_tokens_delete_own on push_tokens;
create policy push_tokens_delete_own on push_tokens
  for delete to authenticated using (user_id = auth.uid());
