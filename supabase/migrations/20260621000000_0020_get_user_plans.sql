-- ============================================================================
-- Migration 0020 — get_user_plans(p_user_id): plans HOSTED by a given user.
--
-- Fixes the "Hosted" tab on another user's profile (ProfileOther), which was
-- permanently empty: the client's getUserHostedPlans did a direct `plans` select
-- that fails with 42501 for `authenticated` (the users-column-privilege cascade),
-- so it always threw and the tab silently fell back to []. This SECURITY DEFINER
-- RPC mirrors get_my_plans but scoped to a target user's hosted plans.
--
-- Visibility: the viewer has already loaded the target's profile (ProfileOther
-- gates on profile_visibility/block), so this returns the target's hosted plans
-- ordered newest-first. Another user's JOINED plans are intentionally NOT exposed
-- (plan_members RLS only covers the viewer's own membership).
-- ============================================================================
create or replace function get_user_plans(p_user_id uuid)
returns setof plans
language sql stable security definer set search_path = public as $$
  select p.*
  from plans p
  where p.host_id = p_user_id
  order by p.starts_at desc;
$$;
revoke execute on function get_user_plans(uuid) from anon, public;
grant  execute on function get_user_plans(uuid) to authenticated, service_role;
