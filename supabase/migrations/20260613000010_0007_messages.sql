-- ============================================================================
-- Migration 0007 — messages (plan group chat)
-- Execution doc Part 1 Migration 0007 + Part 3 RLS (messages row) + Part 5.1.
-- D3: chat is permanent; sends blocked on cancelled/expired plans and 30 days
-- after ended_at (chat-lock trigger). Writes are RPC-only (send_message) per the
-- RPC-only mutation model; clients read directly (RLS) for history + realtime.
-- ============================================================================
create table if not exists messages (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id) on delete cascade,
  author_id  uuid not null references users(id),
  body       text not null check (char_length(body) between 1 and 1000),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists messages_plan_time on messages (plan_id, created_at);

-- ── Membership helper (shared by messages RLS and read RPCs) ───────────────
create or replace function is_active_member(p_plan uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plan_members
    where plan_id = p_plan and user_id = p_user
      and status in ('joined','approved','attended')
  ) or exists (
    select 1 from plans where id = p_plan and host_id = p_user
  );
$$;
revoke execute on function is_active_member(uuid, uuid) from anon, public;
grant execute on function is_active_member(uuid, uuid) to authenticated, service_role;

-- ── Chat lock (D3): no sends on cancelled/expired; read-only after 30d ─────
create or replace function fn_chat_lock() returns trigger
language plpgsql set search_path = public as $$
declare p plans;
begin
  select * into p from plans where id = new.plan_id;
  if p.id is null then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if p.status in ('cancelled','expired') then
    raise exception 'chat_closed' using errcode='P0001';
  end if;
  if p.ended_at is not null and now() > p.ended_at + interval '30 days' then
    raise exception 'chat_archived' using errcode='P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_chat_lock on messages;
create trigger trg_chat_lock before insert on messages
  for each row execute function fn_chat_lock();

-- ── Privileges ─────────────────────────────────────────────────────────────
alter table messages enable row level security;
grant select on messages to authenticated;                       -- RLS filters
grant select, insert, update, delete on messages to service_role;

-- ── RLS: active members read; writes are RPC-only (send_message) ───────────
drop policy if exists messages_select on messages;
create policy messages_select on messages
  for select to authenticated
  using (is_active_member(plan_id, auth.uid()));
