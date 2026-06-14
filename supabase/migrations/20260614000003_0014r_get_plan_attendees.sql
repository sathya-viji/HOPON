-- ============================================================================
-- Migration 0014r — get_plan_attendees (peer endorse read path).
--
-- The peer endorsement flow needs the list of co-attendees, but plan_members RLS
-- only lets a member see their OWN row (host sees all). This minimal read-only
-- SECURITY DEFINER RPC returns the endorsable crew of an ENDED plan to its host
-- or members, so a present peer can pick who to endorse.
--
-- Privacy is preserved tightly:
--   • only the plan host or a member may call it (else not_member);
--   • only ENDED plans (the endorse window) expose their attendee list;
--   • only endorsable statuses (joined/approved/attended) — requested/declined
--     and the synthetic host row are excluded;
--   • profiles come from the users_public VIEW (block/visibility rules apply);
--     hidden users-table columns are never granted.
-- ============================================================================
create or replace function get_plan_attendees(p_plan_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan plans;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  select * into v_plan from plans where id = p_plan_id;
  if not found then raise exception 'plan_not_found' using errcode = 'P0001'; end if;
  if v_plan.ended_at is null then raise exception 'plan_not_ended' using errcode = 'P0001'; end if;
  if v_plan.host_id <> v_uid and not exists (
       select 1 from plan_members where plan_id = p_plan_id and user_id = v_uid and not is_host_row
     ) then
    raise exception 'not_member' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id',          pm.user_id,
             'status',           pm.status,
             'name',             up.name,
             'avatar_path',      up.avatar_path,
             'attendance_score', up.attendance_score
           ) order by up.name)
    from plan_members pm
    left join users_public up on up.id = pm.user_id
    where pm.plan_id = p_plan_id and not pm.is_host_row
      and pm.user_id <> v_uid                              -- exclude the caller (no self-endorse)
      and pm.status in ('joined', 'approved', 'attended')
  ), '[]'::jsonb);
end $$;

revoke execute on function get_plan_attendees(uuid) from anon, public;
grant  execute on function get_plan_attendees(uuid) to authenticated, service_role;
