-- ============================================================================
-- Migration 0006 — plan_members + spot/host triggers
-- Execution doc Part 1, Migration 0006 + Part 3 RLS (plan_members row).
--
-- is_host_row: the synthetic host membership inserted at end_plan (D5, Phase 4).
-- idempotency_key: retry-safe joins (offline resilience).
-- Members are inserted ONLY via the join_plan RPC (gender/capacity/lock checks);
-- there is no client INSERT policy. Direct table SELECT is limited to own row
-- or the plan's host — joiner avatars for prospective joiners come from the
-- definer read RPCs (get_home_feed / get_plan_detail), never direct table reads.
-- ============================================================================
create table if not exists plan_members (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references plans(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  status          member_status_t not null default 'joined',
  is_host_row     boolean not null default false,
  idempotency_key uuid unique,
  joined_at       timestamptz not null default now(),
  resolved_at     timestamptz,
  unique (plan_id, user_id)
);

create index if not exists plan_members_plan on plan_members (plan_id, status);
create index if not exists plan_members_user on plan_members (user_id, status);

-- ── Host may not self-join except via the synthetic host row ───────────────
create or replace function fn_block_host_self_join() returns trigger
language plpgsql as $$
begin
  if not new.is_host_row and exists
     (select 1 from plans where id = new.plan_id and host_id = new.user_id) then
    raise exception 'host_cannot_join_own_plan' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists trg_block_host_self_join on plan_members;
create trigger trg_block_host_self_join before insert on plan_members
  for each row execute function fn_block_host_self_join();

-- ── Maintain plans.spots_remaining + active/full transition ────────────────
-- joinable spots = capacity - 1 (host) - count(joined|approved, non-host)
create or replace function fn_sync_spots() returns trigger
language plpgsql as $$
declare
  pid       uuid := coalesce(new.plan_id, old.plan_id);
  cap       smallint;
  cur       plan_status_t;
  taken     integer;
  remaining integer;
begin
  select capacity, status into cap, cur from plans where id = pid;
  if cap is null then
    return coalesce(new, old);   -- plan row gone (cascade); nothing to sync
  end if;

  select count(*) into taken from plan_members
  where plan_id = pid and status in ('joined','approved') and not is_host_row;

  remaining := greatest(0, cap - 1 - taken);

  update plans
  set spots_remaining = remaining,
      status = case
                 when status = 'active' and remaining <= 0 then 'full'
                 when status = 'full'   and remaining >  0 then 'active'
                 else status
               end
  where id = pid;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_sync_spots on plan_members;
create trigger trg_sync_spots
  after insert or update of status or delete on plan_members
  for each row execute function fn_sync_spots();

-- ── Privileges ─────────────────────────────────────────────────────────────
alter table plan_members enable row level security;
grant select on plan_members to authenticated;                       -- RLS filters
grant select, insert, update, delete on plan_members to service_role;

-- ── RLS: SELECT own row or as the plan's host (writes are RPC-only) ────────
drop policy if exists plan_members_select on plan_members;
create policy plan_members_select on plan_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from plans where id = plan_id and host_id = auth.uid())
  );
