-- ============================================================================
-- Migration 0010 — safety (blocks, reports, emergency escalation) + helpers
-- Execution doc Part 1 Migration 0010 + Part 3 RLS + F4 (emergency) + F5 (audit).
-- audit_logs already exists (0010a, early-landed); re-declared idempotently there.
-- Blocks activate is_blocked_pair() everywhere it's already wired (recaps,
-- stories, plans, follows, feeds, join). All mutations RPC-only.
-- ============================================================================

-- ── assert_active(): suspension/deletion chokepoint for content writes ─────
create or replace function assert_active(p_uid uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from users
                 where id = p_uid and deleted_at is null and account_status = 'active') then
    raise exception 'account_suspended' using errcode='P0001';
  end if;
end $$;
revoke execute on function assert_active(uuid) from anon, public;
grant execute on function assert_active(uuid) to authenticated, service_role;

-- ── blocks ──────────────────────────────────────────────────────────────────
create table if not exists blocks (
  blocker_id uuid not null references users(id) on delete cascade,
  blocked_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocker on blocks (blocker_id);
create index if not exists blocks_blocked on blocks (blocked_id);

alter table blocks enable row level security;
grant select on blocks to authenticated;                       -- RLS: own (blocker)
grant select, insert, update, delete on blocks to service_role;

drop policy if exists blocks_select_own on blocks;
create policy blocks_select_own on blocks for select to authenticated
  using (blocker_id = auth.uid());   -- you see who YOU blocked; writes via RPC

-- ── reports ─────────────────────────────────────────────────────────────────
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id),
  target_type report_target_t not null,
  target_id   uuid not null,
  reason      report_reason_t not null,
  notes       text check (char_length(notes) <= 500),
  status      report_status_t not null default 'pending',
  created_at  timestamptz not null default now()
);
create index if not exists reports_status on reports (status, created_at);
create index if not exists reports_target on reports (target_type, target_id);

alter table reports enable row level security;
-- No client SELECT (admin-only via service role). Inserts via submit_report RPC.
grant select, insert, update, delete on reports to service_role;

-- ── F4: emergency reports auto-escalate + page founder ──────────────────────
create or replace function fn_report_set_escalated() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.reason = 'emergency' then new.status := 'escalated'; end if;
  return new;
end $$;
drop trigger if exists trg_report_set_escalated on reports;
create trigger trg_report_set_escalated before insert on reports
  for each row execute function fn_report_set_escalated();

create or replace function fn_report_dispatch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reason = 'emergency' then
    perform fn_dispatch_edge('emergency-escalation', jsonb_build_object(
      'report_id', new.id, 'target_type', new.target_type, 'target_id', new.target_id));
  end if;
  return new;
end $$;
drop trigger if exists trg_report_dispatch on reports;
create trigger trg_report_dispatch after insert on reports
  for each row execute function fn_report_dispatch();
