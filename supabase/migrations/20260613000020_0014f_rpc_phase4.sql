-- ============================================================================
-- Migration 0014f — Phase 4 RPCs (Trust Layer)
-- Execution doc Part 4: end_plan(4.7), submit_endorsements(4.8),
-- vote_host_noshow(4.9), compute_attendance_score(4.10),
-- rebuild_familiar_faces(4.11), get_endorsement_summary(4.19).
-- All security definer, pinned search_path, typed errors. RPC-only mutations.
-- ============================================================================

-- ─── 4.10 compute_attendance_score (D4) ─────────────────────────────────────
-- score = present/(present+noshow); null until ≥3 attendance events.
create or replace function compute_attendance_score(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_present integer;
  v_noshow  integer;
  v_total   integer;
  v_old     smallint;
  v_new     smallint;
begin
  select count(*) filter (where result='present'),
         count(*) filter (where result='noshow')
    into v_present, v_noshow
  from attendance_marks where subject_id = p_user_id;

  v_total := v_present + v_noshow;
  v_new := case when v_total < 3 then null else round(100.0 * v_present / v_total) end;

  select attendance_score into v_old from users where id = p_user_id;
  update users set attendance_score = v_new where id = p_user_id;

  if v_new is not null and v_old is not null and v_new <> v_old then
    if v_new > v_old then
      perform notify(p_user_id, 'attendance_score_improved',
        'Your attendance score improved to ' || v_new || '%.');
    else
      perform notify(p_user_id, 'attendance_score_dropped',
        'Your attendance score dropped to ' || v_new || '%. Show up to improve it.');
    end if;
  end if;

  if to_regclass('public.audit_logs') is not null then
    insert into audit_logs (actor_type, action, target_type, target_id, detail)
    values ('system','score_recomputed','user',p_user_id,
            jsonb_build_object('present',v_present,'noshow',v_noshow,'score',v_new));
  end if;
end $$;

-- ─── 4.11 rebuild_familiar_faces (DA, host included via its present mark) ────
create or replace function rebuild_familiar_faces(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    insert into familiar_faces (user_a_id, user_b_id, plans_together, last_met_at)
    select least(a.subject_id, b.subject_id), greatest(a.subject_id, b.subject_id), 1, now()
    from attendance_marks a
    join attendance_marks b
      on a.plan_id = b.plan_id and a.subject_id < b.subject_id
    where a.plan_id = p_plan_id and a.result='present' and b.result='present'
    on conflict (user_a_id, user_b_id)
      do update set plans_together = familiar_faces.plans_together + 1, last_met_at = now()
    returning user_a_id, user_b_id, (xmax = 0) as is_new
  loop
    if r.is_new then
      perform notify(r.user_a_id, 'new_familiar_face',
        'You and ' || (select name from users where id=r.user_b_id) || ' are now familiar faces.');
      perform notify(r.user_b_id, 'new_familiar_face',
        'You and ' || (select name from users where id=r.user_a_id) || ' are now familiar faces.');
      update users set people_met = people_met + 1 where id in (r.user_a_id, r.user_b_id);
    end if;
  end loop;
end $$;

-- ─── 4.7 end_plan (S3 frozen order) ─────────────────────────────────────────
create or replace function end_plan(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan plans; m record;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.host_id <> v_uid then raise exception 'not_host' using errcode='P0001'; end if;
  if v_plan.status not in ('active','full') then raise exception 'plan_closed' using errcode='P0001'; end if;

  update plans set status='ended', ended_at=now() where id = p_plan_id;

  -- S3.1: synthetic host membership row
  insert into plan_members (plan_id, user_id, status, is_host_row)
  values (p_plan_id, v_uid, 'attended', true)
  on conflict (plan_id, user_id) do update set status='attended', is_host_row=true;

  -- S3.2: host attendance mark = present
  insert into attendance_marks (plan_id, marked_by, subject_id, result)
  values (p_plan_id, v_uid, v_uid, 'present')
  on conflict (plan_id, subject_id) do nothing;

  -- S3.3: notify host + members (endorse/recap windows derive from ended_at)
  perform notify(v_uid, 'plan_ended_host',
    v_plan.activity || ' is done. Mark attendance and endorse your crew.', p_plan_id);
  for m in select user_id from plan_members
           where plan_id=p_plan_id and status in ('joined','approved') and not is_host_row loop
    perform notify(m.user_id, 'plan_ended_joiner',
      v_plan.activity || ' has ended. Endorse your crew and post a recap.', p_plan_id);
  end loop;

  -- S3.4: bump host plans_hosted
  update users set plans_hosted = plans_hosted + 1 where id = v_uid;
end $$;

-- ─── 4.8 submit_endorsements (host marks + host/peer endorse) ───────────────
-- p_marks = [{subject_id, result?, tag?}]. result entries are HOST-only.
create or replace function submit_endorsements(p_plan_id uuid, p_marks jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_plan plans;
  v_is_host boolean;
  v_caller_present boolean;
  m jsonb;
  v_subject uuid;
  v_result attendance_result;
  v_tag text;
  v_receivers uuid[] := '{}';
  r uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.ended_at is null then raise exception 'plan_not_ended' using errcode='P0001'; end if;
  if now() > v_plan.ended_at + interval '48 hours' then raise exception 'endorsement_window_closed' using errcode='P0001'; end if;

  v_is_host := (v_plan.host_id = v_uid);
  v_caller_present := exists (
    select 1 from attendance_marks where plan_id=p_plan_id and subject_id=v_uid and result='present');
  if not v_is_host and not v_caller_present then
    raise exception 'not_present' using errcode='P0001';
  end if;

  for m in select * from jsonb_array_elements(p_marks) loop
    v_subject := (m->>'subject_id')::uuid;
    v_result  := case when m ? 'result' and m->>'result' is not null then (m->>'result')::attendance_result else null end;
    v_tag     := nullif(trim(coalesce(m->>'tag','')), '');

    -- attendance marking: HOST ONLY
    if v_result is not null then
      if not v_is_host then raise exception 'not_host' using errcode='P0001'; end if;
      if v_subject = v_uid then raise exception 'cannot_mark_self' using errcode='P0001'; end if;
      insert into attendance_marks (plan_id, marked_by, subject_id, result)
      values (p_plan_id, v_uid, v_subject, v_result)
      on conflict (plan_id, subject_id) do update set result=excluded.result, marked_by=excluded.marked_by;

      update plan_members
        set status = (case when v_result='present' then 'attended' else 'noshow' end)::member_status_t,
            resolved_at = now()
        where plan_id=p_plan_id and user_id=v_subject and not is_host_row;

      if v_result='noshow' then
        perform notify(v_subject, 'marked_noshow',
          v_plan.activity || ' — you were marked absent. This affects your score.', p_plan_id, v_uid);
      else
        update users set plans_attended = plans_attended + 1 where id=v_subject;
      end if;
    end if;

    -- endorsement tag (host or present peer); guard enforces present + window
    if v_tag is not null and v_subject <> v_uid then
      insert into endorsements (plan_id, giver_id, receiver_id, tag)
      values (p_plan_id, v_uid, v_subject, v_tag)
      on conflict (plan_id, giver_id, receiver_id) do update set tag=excluded.tag;
      v_receivers := array_append(v_receivers, v_subject);
    end if;
  end loop;

  -- host path: recompute scores for everyone marked, rebuild familiar faces
  if v_is_host then
    perform compute_attendance_score(s.subject_id)
    from (select distinct subject_id from attendance_marks where plan_id=p_plan_id) s;
    perform rebuild_familiar_faces(p_plan_id);
  end if;

  -- batched endorsement_received (one per distinct receiver)
  foreach r in array (select coalesce(array_agg(distinct x), '{}') from unnest(v_receivers) x) loop
    perform notify(r, 'endorsement_received',
      'You received endorsements from ' || v_plan.activity || '.', p_plan_id, v_uid);
  end loop;
end $$;

-- ─── 4.9 vote_host_noshow (D7 quorum) ───────────────────────────────────────
create or replace function vote_host_noshow(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_plan plans;
  v_votes integer;
  v_present integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_uid = v_plan.host_id then raise exception 'host_cannot_vote' using errcode='P0001'; end if;
  if now() > v_plan.starts_at + interval '48 hours' then raise exception 'vote_window_closed' using errcode='P0001'; end if;
  if not exists (select 1 from attendance_marks where plan_id=p_plan_id and subject_id=v_uid and result='present') then
    raise exception 'not_present' using errcode='P0001';
  end if;

  insert into host_noshow_votes (plan_id, voter_id) values (p_plan_id, v_uid)
  on conflict (plan_id, voter_id) do nothing;

  -- already resolved?
  if exists (select 1 from attendance_marks
             where plan_id=p_plan_id and subject_id=v_plan.host_id and result='noshow') then
    return;
  end if;

  select count(*) into v_votes from host_noshow_votes where plan_id=p_plan_id;
  select count(*) into v_present from attendance_marks
    where plan_id=p_plan_id and result='present' and subject_id <> v_plan.host_id;

  if v_votes >= 3 or (v_present > 0 and v_votes >= ceil(0.5 * v_present)) then
    insert into attendance_marks (plan_id, marked_by, subject_id, result)
    values (p_plan_id, v_uid, v_plan.host_id, 'noshow')
    on conflict (plan_id, subject_id) do update set result='noshow';

    update plan_members set status='noshow'
      where plan_id=p_plan_id and user_id=v_plan.host_id and is_host_row;

    perform compute_attendance_score(v_plan.host_id);
    perform notify(v_plan.host_id, 'host_marked_absent',
      'Attendees reported you weren''t at ' || v_plan.activity || '. This affects your score.', p_plan_id);

    if to_regclass('public.audit_logs') is not null then
      insert into audit_logs (actor_type, action, target_type, target_id, detail)
      values ('system','host_noshow_resolved','plan',p_plan_id,
              jsonb_build_object('votes',v_votes,'present_attendees',v_present));
    end if;
  end if;
end $$;

-- ─── 4.19 get_endorsement_summary (DB top-5 tags) ───────────────────────────
create or replace function get_endorsement_summary(p_user_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('tag', tag, 'count', c) order by c desc), '[]'::jsonb)
  from (
    select tag, count(*) as c
    from endorsements where receiver_id = p_user_id
    group by tag order by c desc limit 5
  ) s;
$$;

-- ─── Grants ─────────────────────────────────────────────────────────────────
do $$
declare fn text;
begin
  -- client-callable
  foreach fn in array array[
    'end_plan(uuid)',
    'submit_endorsements(uuid,jsonb)',
    'vote_host_noshow(uuid)',
    'get_endorsement_summary(uuid)'
  ] loop
    execute format('revoke execute on function %s from anon, public', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
  -- internal (called by other definer RPCs / cron); service_role only
  foreach fn in array array[
    'compute_attendance_score(uuid)',
    'rebuild_familiar_faces(uuid)'
  ] loop
    execute format('revoke execute on function %s from anon, authenticated, public', fn);
    execute format('grant execute on function %s to service_role', fn);
  end loop;
end $$;
