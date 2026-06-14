-- ============================================================================
-- Migration 0014s — Trust v2: peer-corroborated attendance resolution.
-- Implements docs/TRUST_V2_DESIGN.md. Everyone present marks everyone
-- (default-present); a 48h-close resolver turns marks into one verdict per
-- person (trust-weighted via a credibility floor; no-show needs ≥2 distinct
-- credible flaggers; self-no-show authoritative + floor-exempt). Scoring,
-- endorsements, and familiar faces all derive from RESOLVED attendance.
-- ============================================================================

-- ─── 1. attendance_marks: one row per (marker, subject) + staged endorse tag ─
alter table attendance_marks drop constraint if exists attendance_marks_plan_id_subject_id_key;
alter table attendance_marks add constraint attendance_marks_plan_marker_subject_key
  unique (plan_id, marked_by, subject_id);
alter table attendance_marks add column if not exists tag text;  -- endorsement staged here; finalized at resolution

-- ─── 2. attendance_resolutions (analytics only — not used in scoring) ────────
create table if not exists attendance_resolutions (
  plan_id               uuid primary key references plans(id) on delete cascade,
  resolved_at           timestamptz not null default now(),
  eligible_marker_count integer not null,
  submission_count      integer not null
);
alter table attendance_resolutions enable row level security;  -- no policy → service_role only
grant select, insert on attendance_resolutions to service_role;

-- ─── 3. Drop the host-no-show vote system (host is now a normal participant) ─
drop trigger if exists trg_endorsement_guard on endorsements;   -- resolver is sole creator; enforces present↔present
drop function if exists fn_endorsement_guard() cascade;
drop function if exists vote_host_noshow(uuid);
drop table if exists host_noshow_votes cascade;

-- ─── 4. Marker weight (cold-start neutral; 0.5 credibility floor in resolver) ─
create or replace function fn_marker_weight(p_user uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select 1.0
       * (case when u.attendance_score is null then 1.0 else 0.5 + u.attendance_score / 100.0 end)
       * (case u.verification_level when 'id' then 1.2 when 'phone' then 1.0 else 0.8 end)
  from users u where u.id = p_user;
$$;
revoke execute on function fn_marker_weight(uuid) from anon, authenticated, public;
grant  execute on function fn_marker_weight(uuid) to service_role;

-- ─── 5. end_plan flow: DROP host auto-present (host resolved by peers) ───────
-- Mirrors 0014q's fn_end_plan_core but no longer inserts the synthetic host
-- attended row or host present mark. The resolver writes the host's verdict.
create or replace function fn_end_plan_core(p_plan_id uuid, p_host uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_plan plans; m record;
begin
  select * into v_plan from plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.status not in ('active','full') then raise exception 'plan_closed' using errcode='P0001'; end if;

  update plans set status='ended', ended_at=now() where id = p_plan_id;

  -- notify host + members; everyone is prompted to mark attendance (default-present)
  perform notify(p_host, 'plan_ended_host',
    v_plan.activity || ' is done. Mark attendance and endorse your crew.', p_plan_id);
  for m in select user_id from plan_members
           where plan_id=p_plan_id and status in ('joined','approved') and not is_host_row loop
    perform notify(m.user_id, 'plan_ended_joiner',
      v_plan.activity || ' has ended. Mark attendance and endorse your crew.', p_plan_id);
  end loop;

  update users set plans_hosted = plans_hosted + 1 where id = p_host;
end $$;

-- ─── 6. compute_attendance_score: from RESOLVED verdicts (plan_members) ──────
create or replace function compute_attendance_score(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_present integer; v_noshow integer; v_total integer; v_old smallint; v_new smallint;
begin
  select count(*) filter (where status='attended'),
         count(*) filter (where status='noshow')
    into v_present, v_noshow
  from plan_members where user_id = p_user_id;   -- incl. host rows (is_host_row)

  v_total := v_present + v_noshow;
  v_new := case when v_total < 3 then null else round(100.0 * v_present / v_total) end;

  select attendance_score into v_old from users where id = p_user_id;
  update users set attendance_score = v_new where id = p_user_id;

  if v_new is not null and v_old is not null and v_new <> v_old then
    if v_new > v_old then
      perform notify(p_user_id, 'attendance_score_improved', 'Your attendance score improved to ' || v_new || '%.');
    else
      perform notify(p_user_id, 'attendance_score_dropped', 'Your attendance score dropped to ' || v_new || '%. Show up to improve it.');
    end if;
  end if;
end $$;

-- ─── 7. rebuild_familiar_faces: from RESOLVED present (plan_members attended) ─
create or replace function rebuild_familiar_faces(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    insert into familiar_faces (user_a_id, user_b_id, plans_together, last_met_at)
    select least(a.user_id, b.user_id), greatest(a.user_id, b.user_id), 1, now()
    from plan_members a
    join plan_members b on a.plan_id = b.plan_id and a.user_id < b.user_id
    where a.plan_id = p_plan_id and a.status='attended' and b.status='attended'
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

-- ─── 8. submit_endorsements: any participant; default-present; tags staged ──
-- p_marks = [{subject_id, result?('present'|'noshow'), tag?}]. Marks are votes;
-- they take effect only at resolution. A self-no-show caller's tags are dropped.
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
  if now() > v_plan.ended_at + interval '48 hours' then raise exception 'endorsement_window_closed' using errcode='P0001'; end if;

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

-- ─── 9. fn_resolve_attendance — the 48h-close resolver (cron) ────────────────
create or replace function fn_resolve_attendance() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_floor constant numeric := 0.5;
  p record; v_parts uuid[]; v_submitters uuid[]; v_credible uuid[];
  v_n int; v_sub_n int; v_subject uuid; v_verdict member_status_t;
  v_selfnoshow boolean; v_nf int; v_pv int; v_processed int := 0; rec record;
begin
  for p in
    select pl.* from plans pl
    where pl.status='ended' and pl.ended_at is not null
      and pl.ended_at < now() - interval '48 hours'
      and not exists (select 1 from attendance_resolutions ar where ar.plan_id = pl.id)
  loop
    begin
      -- participants = host + accepted members
      select array_agg(uid) into v_parts from (
        select p.host_id as uid
        union
        select user_id from plan_members where plan_id=p.id and not is_host_row
          and status in ('joined','approved','attended','noshow')
      ) q;
      v_n := coalesce(array_length(v_parts,1),0);

      select array_agg(distinct am.marked_by) into v_submitters
      from attendance_marks am where am.plan_id=p.id and am.marked_by = any(v_parts);
      v_sub_n := coalesce(array_length(v_submitters,1),0);

      -- credible markers: submitted, NOT self-no-show, weight ≥ floor
      select array_agg(mk) into v_credible from (
        select s as mk from unnest(coalesce(v_submitters,'{}')) s
        where not exists (select 1 from attendance_marks a
                          where a.plan_id=p.id and a.marked_by=s and a.subject_id=s and a.result='noshow')
          and fn_marker_weight(s) >= v_floor
      ) c;
      v_credible := coalesce(v_credible, '{}');

      -- Verdicts only when there's a possible witness: N≥3, OR N=2 with both submitted.
      if v_n >= 3 or (v_n = 2 and v_sub_n >= 2) then
        foreach v_subject in array v_parts loop
          v_selfnoshow := exists (select 1 from attendance_marks a
            where a.plan_id=p.id and a.marked_by=v_subject and a.subject_id=v_subject and a.result='noshow');

          if v_selfnoshow then
            v_verdict := 'noshow';
          else
            select count(distinct a.marked_by) into v_nf from attendance_marks a
              where a.plan_id=p.id and a.subject_id=v_subject and a.result='noshow'
                and a.marked_by <> v_subject and a.marked_by = any(v_credible);
            if v_nf >= 2 then
              v_verdict := 'noshow';
            else
              select count(*) into v_pv from attendance_marks a
                where a.plan_id=p.id and a.subject_id=v_subject and a.result='present'
                  and a.marked_by <> v_subject and a.marked_by = any(v_credible);
              v_verdict := case when v_pv >= 1 then 'attended'::member_status_t else null end;
            end if;
          end if;

          if v_verdict is not null then
            if v_subject = p.host_id then
              insert into plan_members (plan_id, user_id, status, is_host_row, resolved_at)
              values (p.id, v_subject, v_verdict, true, now())
              on conflict (plan_id, user_id) do update set status=excluded.status, is_host_row=true, resolved_at=now();
            else
              update plan_members set status=v_verdict, resolved_at=now()
                where plan_id=p.id and user_id=v_subject and not is_host_row;
            end if;
            if v_verdict='noshow' and not v_selfnoshow then
              perform notify(v_subject, 'marked_noshow',
                p.activity || ' — you were marked absent. This affects your score.', p.id);
            end if;
          end if;
        end loop;

        -- recompute scores for every participant; rebuild familiar faces (resolved-present)
        perform compute_attendance_score(x) from (select unnest(v_parts) x) q;
        perform rebuild_familiar_faces(p.id);

        -- finalize endorsements: staged tags where BOTH giver & receiver resolved present
        insert into endorsements (plan_id, giver_id, receiver_id, tag)
        select am.plan_id, am.marked_by, am.subject_id, am.tag
        from attendance_marks am
        join plan_members gm on gm.plan_id=am.plan_id and gm.user_id=am.marked_by and gm.status='attended'
        join plan_members rm on rm.plan_id=am.plan_id and rm.user_id=am.subject_id and rm.status='attended'
        where am.plan_id=p.id and am.tag is not null and am.marked_by <> am.subject_id
        on conflict (plan_id, giver_id, receiver_id) do update set tag=excluded.tag;

        for rec in select distinct receiver_id from endorsements where plan_id=p.id loop
          perform notify(rec.receiver_id, 'endorsement_received',
            'You received endorsements from ' || p.activity || '.', p.id);
        end loop;
      end if;

      insert into attendance_resolutions (plan_id, resolved_at, eligible_marker_count, submission_count)
      values (p.id, now(), v_n, v_sub_n) on conflict (plan_id) do nothing;
      v_processed := v_processed + 1;
    exception when others then
      raise notice 'fn_resolve_attendance: plan % failed: %', p.id, sqlerrm;
    end;
  end loop;
  return v_processed;
end $$;
revoke execute on function fn_resolve_attendance() from anon, authenticated, public;
grant  execute on function fn_resolve_attendance() to service_role;

-- ─── 10. get_plan_attendees: full participant set (host + members + self) ────
-- For the v2 default-present Endorse list — everyone marks everyone, incl. self.
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
             'name', up.name, 'avatar_path', up.avatar_path, 'attendance_score', up.attendance_score
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

-- ─── 11. Schedule the resolver cron (~hourly; guarded on pg_cron) ───────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'hopon-resolve-attendance') then
      perform cron.schedule('hopon-resolve-attendance', '7 * * * *', 'select fn_resolve_attendance()');
    end if;
  else
    raise notice 'pg_cron absent — fn_resolve_attendance not scheduled (call it manually in dev)';
  end if;
end $$;
