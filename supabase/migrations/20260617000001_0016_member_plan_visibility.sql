-- 0016: plan_visible_to — members always see their own plans
--
-- Before this fix a plan member whose host had plan_visibility='followers'
-- (and who wasn't also a follower) would get "not available" on get_plan_detail
-- because plan_visible_to() had no path for existing members.

create or replace function plan_visible_to(p_plan plans, p_viewer uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  -- host always sees their own plan
  if p_plan.host_id = p_viewer then return true; end if;
  -- members (joined or approved) always see the plan they're in
  if exists (
    select 1 from plan_members
    where plan_id = p_plan.id and user_id = p_viewer
      and status in ('joined', 'approved')
  ) then return true; end if;
  -- hidden plans are invisible to non-members / non-hosts
  if p_plan.is_hidden then return false; end if;
  -- block exclusion
  if is_blocked_pair(p_viewer, p_plan.host_id) then return false; end if;
  -- host visibility gate (everyone / followers)
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
