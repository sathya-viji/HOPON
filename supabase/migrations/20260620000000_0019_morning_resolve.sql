-- ============================================================================
-- Migration 0019 — resolve attendance once each morning (10:30 IST), and tie the
-- submission window to resolution instead of a fixed 48h clock.
--
-- PRODUCT (founder, 2026-06-16): instead of resolving each plan 48h after it ends,
-- resolve in a daily morning batch at 10:30 IST. Familiar-face + score-change
-- notifications then land at a pleasant, predictable time. A plan that ends shortly
-- before 10:30 rolls to the NEXT morning (the resolver's 6h pickup buffer, set in
-- 0017), so nobody gets a near-zero endorsement window.
--
-- Two changes:
--   1. Reschedule the resolver cron: hourly → daily at 05:00 UTC (= 10:30 IST;
--      India has no DST, so this is stable year-round).
--   2. submit_endorsements: the window now closes when the plan has been RESOLVED
--      (an attendance_resolutions row exists), not at ended_at + 48h. So people can
--      keep submitting right up until the morning resolve, and not after.
-- ============================================================================

-- ─── 1. Daily morning resolver cron (10:30 IST = 05:00 UTC) ─────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- replace the prior hourly schedule (0014s) with a single daily morning run
    if exists (select 1 from cron.job where jobname = 'hopon-resolve-attendance') then
      perform cron.unschedule('hopon-resolve-attendance');
    end if;
    perform cron.schedule('hopon-resolve-attendance', '0 5 * * *', 'select fn_resolve_attendance()');
  else
    raise notice 'pg_cron absent — resolver not scheduled (call fn_resolve_attendance() manually in dev)';
  end if;
end $$;

-- ─── 2. submit_endorsements — close the window on resolution, not at +48h ────
-- Identical to 0014s except the window-close check: reject once the plan has been
-- resolved (attendance_resolutions row exists) rather than at ended_at + 48h.
create or replace function submit_endorsements(p_plan_id uuid, p_marks jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid(); v_plan plans; v_is_participant boolean; v_self_noshow boolean;
  m jsonb; v_subject uuid; v_result attendance_result; v_tag text;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.ended_at is null then raise exception 'plan_not_ended' using errcode='P0001'; end if;
  if exists (select 1 from attendance_resolutions ar where ar.plan_id = p_plan_id) then
    raise exception 'endorsement_window_closed' using errcode='P0001';
  end if;

  v_is_participant := (v_plan.host_id = v_uid) or exists (
    select 1 from plan_members where plan_id=p_plan_id and user_id=v_uid and not is_host_row
      and status in ('joined','approved','attended','noshow'));
  if not v_is_participant then raise exception 'not_member' using errcode='P0001'; end if;

  -- self-no-show in this submission → caller can't endorse (tags dropped below)
  select coalesce(bool_or((e->>'subject_id')::uuid = v_uid and (e->>'result') = 'noshow'), false)
    into v_self_noshow from jsonb_array_elements(p_marks) e;

  for m in select * from jsonb_array_elements(p_marks) loop
    v_subject := (m->>'subject_id')::uuid;
    v_result  := coalesce(nullif(m->>'result','')::attendance_result, 'present');
    v_tag     := nullif(trim(coalesce(m->>'tag','')), '');

    -- subject must be a participant (host or member); ignore anything else
    if not ((v_plan.host_id = v_subject) or exists (
         select 1 from plan_members where plan_id=p_plan_id and user_id=v_subject and not is_host_row)) then
      continue;
    end if;

    -- tags only from an attending caller, for another present-marked person
    if v_self_noshow or v_subject = v_uid or v_result = 'noshow' then v_tag := null; end if;

    insert into attendance_marks (plan_id, marked_by, subject_id, result, tag)
    values (p_plan_id, v_uid, v_subject, v_result, v_tag)
    on conflict (plan_id, marked_by, subject_id) do update set result = excluded.result, tag = excluded.tag;
  end loop;
end $$;
revoke execute on function submit_endorsements(uuid, jsonb) from anon, public;
grant  execute on function submit_endorsements(uuid, jsonb) to authenticated, service_role;
