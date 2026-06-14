-- ============================================================================
-- Migration 0004b — fix-forward: follower-visibility for profiles & plans
-- Now that `follows` exists (0009), activate the 'followers' visibility tier
-- the earlier phases deferred (documented "Phase 5 replaces" in 0004/0005/0014b).
-- Profiles/plans set to 'followers' become visible to accepted followers.
-- Block exclusion still lands in Phase 6 (is_blocked_pair already guarded).
-- ============================================================================

-- ── users_public: add the followers clause ────────────────────────────────
-- create-or-replace (not drop): match_contact_hashes returns setof users_public,
-- so the view's row type has dependents. Columns are unchanged — only the WHERE
-- gains the followers clause — so replace is valid.
create or replace view users_public
with (security_barrier = true) as
  select id, name, handle, avatar_path, neighbourhood, bio,
         verification_level, profile_visibility, plan_visibility,
         ig_handle, linkedin_handle, fb_handle,
         plans_hosted, plans_attended, people_met, attendance_score,
         created_at
  from users
  where deleted_at is null
    and account_status <> 'banned'
    and (
      id = auth.uid()
      or profile_visibility = 'everyone'
      or (profile_visibility = 'followers'
          and exists (select 1 from follows f
                      where f.follower_id = auth.uid() and f.following_id = users.id
                      and f.status = 'accepted'))
    );
alter view users_public owner to postgres;
grant select on users_public to authenticated;

-- ── plan_visible_to: add the followers clause (+ keep block guard) ─────────
create or replace function plan_visible_to(p_plan plans, p_viewer uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_plan.host_id = p_viewer then return true; end if;
  if p_plan.is_hidden then return false; end if;
  if is_blocked_pair(p_viewer, p_plan.host_id) then return false; end if;
  return exists (
    select 1 from users u
    where u.id = p_plan.host_id and u.deleted_at is null and u.account_status = 'active'
      and (
        u.plan_visibility = 'everyone'
        or (u.plan_visibility = 'followers'
            and exists (select 1 from follows f
                        where f.follower_id = p_viewer and f.following_id = p_plan.host_id
                        and f.status = 'accepted'))
      )
  );
end $$;

-- ── plans_select RLS: add the followers clause ────────────────────────────
drop policy if exists plans_select on plans;
create policy plans_select on plans
  for select to authenticated
  using (
    host_id = auth.uid()
    or (
      not is_hidden
      and not is_blocked_pair(auth.uid(), host_id)
      and exists (
        select 1 from users u
        where u.id = host_id and u.deleted_at is null and u.account_status = 'active'
          and (
            u.plan_visibility = 'everyone'
            or (u.plan_visibility = 'followers'
                and exists (select 1 from follows f
                            where f.follower_id = auth.uid() and f.following_id = host_id
                            and f.status = 'accepted'))
          )
      )
    )
  );
