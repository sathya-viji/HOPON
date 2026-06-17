-- ============================================================================
-- Migration 0022 — get_plan_attendees returns the viewer's EXISTING marks.
--
-- The Endorse screen always initialised to default-present and never reflected
-- what the viewer already submitted. Re-opening it (the "plan ended" notification
-- stays around until the morning resolve) showed everyone "Showed up" again, and
-- a second submit upserted those defaults OVER the viewer's real no-show flags /
-- endorsement tags — silent data loss.
--
-- Fix (read side): expose per-attendee `my_result` / `my_tag` (the mark the viewer
-- made for that subject), so the client can hydrate the screen and indicate an
-- already-submitted state. submit_endorsements is unchanged.
-- ============================================================================
create or replace function get_plan_attendees(p_plan_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan plans;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.ended_at is null then raise exception 'plan_not_ended' using errcode='P0001'; end if;
  if v_plan.host_id <> v_uid and not exists (
       select 1 from plan_members where plan_id=p_plan_id and user_id=v_uid and not is_host_row) then
    raise exception 'not_member' using errcode='P0001';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user_id', s.uid, 'is_host', s.is_host,
             'name', up.name, 'avatar_path', up.avatar_path, 'attendance_score', up.attendance_score,
             -- the viewer's existing mark for this subject (null if not yet marked)
             'my_result', (select am.result from attendance_marks am
                           where am.plan_id=p_plan_id and am.marked_by=v_uid and am.subject_id=s.uid),
             'my_tag',    (select am.tag from attendance_marks am
                           where am.plan_id=p_plan_id and am.marked_by=v_uid and am.subject_id=s.uid)
           ) order by s.is_host desc, up.name)
    from (
      select v_plan.host_id as uid, true as is_host
      union
      select user_id, false from plan_members where plan_id=p_plan_id and not is_host_row
        and status in ('joined','approved','attended','noshow')
    ) s
    left join users_public up on up.id = s.uid
  ), '[]'::jsonb);
end $$;
revoke execute on function get_plan_attendees(uuid) from anon, public;
grant  execute on function get_plan_attendees(uuid) to authenticated, service_role;
