-- ============================================================================
-- Migration 0005 — plans
-- Execution doc Part 1, Migration 0005 + Part 3 RLS (plans row).
-- Capacity convention (frozen): capacity INCLUDES the host, so joinable spots
-- = capacity - 1. spots_remaining is denormalised, maintained by fn_sync_spots
-- (migration 0006) and seeded by create_plan.
--
-- RLS for Phase 2 is fail-closed: only 'everyone' plans are visible to
-- non-hosts. Phase 5 replaces plans_select to add the follower clause; Phase 6
-- adds block-pair exclusion. Documented so the later replacements are expected.
-- ============================================================================
create table if not exists plans (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null references users(id),
  category_id     text not null references categories(id),
  activity        text not null check (char_length(activity) between 1 and 60),
  description     text check (char_length(description) <= 500),
  rules           text check (char_length(rules) <= 140),
  location_label  text not null,
  lat             numeric(9,6) not null,
  lng             numeric(9,6) not null,
  starts_at       timestamptz not null,
  capacity        smallint not null check (capacity between 2 and 10),
  spots_remaining smallint not null check (spots_remaining >= 0),
  plan_type       plan_type_t not null default 'open',
  status          plan_status_t not null default 'active',
  cost            cost_t not null default 'free',
  cost_note       text check (char_length(cost_note) <= 80),
  gender_pref     gender_pref_t not null default 'all',
  is_hidden       boolean not null default false,
  search_vector   tsvector generated always as
                    (to_tsvector('english', activity || ' ' ||
                     coalesce(description,'') || ' ' || location_label)) stored,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  ended_at        timestamptz,
  cancelled_at    timestamptz,
  constraint plans_advance_window check (starts_at <= created_at + interval '14 days')
);

create index if not exists plans_geo       on plans using gist (point(lng, lat));
create index if not exists plans_starts_at on plans (starts_at) where status = 'active';
create index if not exists plans_status    on plans (status);
create index if not exists plans_host      on plans (host_id);
create index if not exists plans_category  on plans (category_id);
create index if not exists plans_search    on plans using gin (search_vector);

drop trigger if exists trg_plans_touch on plans;
create trigger trg_plans_touch before update on plans
  for each row execute function fn_touch_updated_at();

-- ── Privileges (explicit service_role per project rule) ────────────────────
alter table plans enable row level security;
grant select on plans to authenticated;                       -- RLS filters rows
grant select, insert, update, delete on plans to service_role;
-- No client INSERT/UPDATE/DELETE: all mutations go through the security-definer
-- RPCs in 0014b (create_plan, update_plan, cancel_plan, end_plan) which own the
-- counters, 14-day limit, ≤5-active limit, and notifications.

-- ── RLS: SELECT only (writes are RPC-only) ─────────────────────────────────
drop policy if exists plans_select on plans;
create policy plans_select on plans
  for select to authenticated
  using (
    host_id = auth.uid()
    or (
      not is_hidden
      and exists (
        select 1 from users u
        where u.id = host_id
          and u.deleted_at is null
          and u.account_status = 'active'
          and u.plan_visibility = 'everyone'   -- Phase 5: + followers clause
      )
      -- Phase 6: + block-pair exclusion
    )
  );
