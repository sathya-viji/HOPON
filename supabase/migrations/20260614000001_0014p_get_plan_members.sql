-- ============================================================================
-- Migration 0014p — get_plan_members (host-only member list for PlanHost/Requests)
--
-- Additive read RPC (post-Phase-7). Fixes the host-side member read: the client
-- previously did a direct `from('plan_members').select()` as role `authenticated`,
-- which triggers the plan_members SELECT RLS host-branch
--   EXISTS(SELECT 1 FROM plans WHERE id=… AND host_id=auth.uid())
-- → evaluates plans_select → reads users.deleted_at / users.account_status, two
-- columns `authenticated` is intentionally NOT granted (they hide suspension).
-- Postgres checks column privileges at PLAN time (the OR short-circuit doesn't
-- save it), so the query throws "permission denied for table users" and the host
-- sees ATTENDEES·0 / no pending banner / empty PlanRequests.
--
-- This SECURITY DEFINER RPC runs as owner (postgres), bypassing that RLS cascade,
-- and re-authorizes explicitly: ONLY the plan host may read the member list
-- (requested + joined/approved are host-sensitive). It mirrors get_plan_detail
-- (0014b): auth.uid() inside a definer fn still resolves to the CALLER. Profiles
-- are LEFT JOINed via the users_public VIEW (inherits block/visibility rules); a
-- member whose profile isn't visible to the host falls back to null fields, which
-- the client renders as a neutral "Member" label (same as before).
--
-- Returns a jsonb array (joined_at asc): { user_id, status, joined_at, name,
-- avatar_path, attendance_score, plans_attended }. The host row is excluded.
-- ============================================================================
create or replace function get_plan_members(p_plan_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_plan plans;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  select * into v_plan from plans where id = p_plan_id;
  if not found then raise exception 'plan_not_found' using errcode = 'P0001'; end if;
  if v_plan.host_id <> v_uid then raise exception 'not_authorized' using errcode = 'P0001'; end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id',          pm.user_id,
             'status',           pm.status,
             'joined_at',        pm.joined_at,
             'name',             up.name,
             'avatar_path',      up.avatar_path,
             'attendance_score', up.attendance_score,
             'plans_attended',   up.plans_attended
           ) order by pm.joined_at)
    from plan_members pm
    left join users_public up on up.id = pm.user_id
    where pm.plan_id = p_plan_id and not pm.is_host_row
  ), '[]'::jsonb);
end $$;

revoke execute on function get_plan_members(uuid) from anon, public;
grant  execute on function get_plan_members(uuid) to authenticated, service_role;
