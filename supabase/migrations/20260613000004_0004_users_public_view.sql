-- ============================================================================
-- Migration 0004 — users_public view + base-table privilege lockdown
-- Execution doc Part 1, Migration 0004 + Part 3 (users row in RLS matrix).
--
-- ENGINEERING NOTE (no architecture change): the doc sketched
-- `security_invoker = true` + full revoke on the base table — those two are
-- mutually exclusive (an invoker-rights view fails when the invoker has no
-- base-table privilege). Implemented per the doc's INTENT (RLS matrix:
-- "users_public: all authenticated, visibility filtered (view WHERE)"):
--   * view runs with OWNER rights (postgres) + security_barrier
--   * visibility filtering lives in the view's WHERE clause
--   * base table: SELECT limited to safe columns on own row only
--
-- Phase deltas (frozen plan): Phase 5 replaces this view to add the
-- follower-visibility clause; Phase 6 replaces it to add block exclusion.
-- Until then 'followers'/'nobody' profiles are hidden from others (fail closed).
-- ============================================================================

drop view if exists users_public;
create view users_public
with (security_barrier = true) as
  select id, name, handle, avatar_path, neighbourhood, bio,
         verification_level, profile_visibility, plan_visibility,
         ig_handle, linkedin_handle, fb_handle,
         plans_hosted, plans_attended, people_met, attendance_score,
         created_at
  from users
  where deleted_at is null
    and account_status <> 'banned'
    and (id = auth.uid() or profile_visibility = 'everyone');

alter view users_public owner to postgres;

-- ── Base table privileges: gender/dob unreachable by clients ───────────────
revoke all on users from anon, authenticated;

-- Column-level SELECT on safe columns only — required so authenticated UPDATEs
-- can target rows (WHERE id = ...) and PostgREST can return representations.
-- gender, dob, suspension fields are deliberately ABSENT from this grant.
grant select (id, name, handle, avatar_path, neighbourhood, bio,
              verification_level, profile_visibility, plan_visibility,
              ig_handle, linkedin_handle, fb_handle,
              plans_hosted, plans_attended, people_met, attendance_score,
              created_at, updated_at)
  on users to authenticated;

-- Whitelisted self-editable columns (frozen list from migration 0004 spec).
grant update (name, avatar_path, neighbourhood, bio, profile_visibility,
              plan_visibility, ig_handle, linkedin_handle, fb_handle)
  on users to authenticated;

grant select on users_public to authenticated;

-- ── RLS: row visibility on the base table is own-row only ──────────────────
alter table users enable row level security;

drop policy if exists users_select_self on users;
create policy users_select_self on users
  for select to authenticated
  using (id = auth.uid());

drop policy if exists users_update_self on users;
create policy users_update_self on users
  for update to authenticated
  using (id = auth.uid() and deleted_at is null and account_status = 'active')
  with check (id = auth.uid());

-- No INSERT/DELETE policies: profile creation only via complete_signup()
-- (security definer), deletion only via delete_account() (soft) + cron (hard).
