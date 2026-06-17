-- ============================================================================
-- Migration 0017 — Social graph: pure default-present familiar faces.
--
-- PRODUCT CHANGE (founder, 2026-06-16): decouple social-graph growth from the
-- post-event attendance chore. Familiar faces should form by DEFAULT for everyone
-- who shared a plan that occurred, and be PRUNED only by no-show signals — rather
-- than requiring someone to submit an attendance form to confirm presence.
--
-- The attendance SCORE stays corroboration-gated (unchanged): compute_attendance_score
-- still reads only resolved plan_members.status ('attended'/'noshow'), and the
-- resolver's verdict logic (witness-gated) is untouched. Two mechanisms, two risk
-- profiles: a fake "present" inflates trust (gate it); a stray familiar-face edge
-- is near-zero harm (let it grow, prune by flags + blocks).
--
-- WHAT CHANGES
--   1. rebuild_familiar_faces gains an overload that builds pairs from an explicit
--      "graph-present" set (and now excludes blocked pairs via is_blocked_pair).
--   2. fn_resolve_attendance builds familiar faces for EVERY ended plan from all
--      participants by default (pairwise: a pair is dropped only on a no-show signal
--      between them — self-no-show, a single pairwise flag, or a block), OUTSIDE the
--      witness gate — so faces form even when nobody (or only one person) submits.
--      The score/verdict/endorsement paths are byte-for-byte unchanged.
--
-- Endorsements are NOT defaulted — they require an actual staged tag, so they stay
-- inside the witness-gated block exactly as before.
-- ============================================================================

-- ─── rebuild_familiar_faces(plan, participants[]) — pairwise default-present ──
-- Builds a face for every pair of participants (a<b) BY DEFAULT, dropping a pair
-- only when there's a no-show signal between them:
--   • either self-flagged no-show (they admit they weren't there → no faces), or
--   • either flagged the OTHER no-show (single pairwise flag removes just that
--     edge — "I didn't actually meet this person"), or
--   • the pair is blocked.
-- This is liberal on purpose (graph growth); the trust SCORE stays corroborated
-- (≥2 flaggers) separately in the resolver. Upsert increments plans_together;
-- new edges notify both sides + bump people_met.
create or replace function rebuild_familiar_faces(p_plan_id uuid, p_participants uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    insert into familiar_faces (user_a_id, user_b_id, plans_together, last_met_at)
    select least(a.u, b.u), greatest(a.u, b.u), 1, now()
    from unnest(p_participants) a(u)
    join unnest(p_participants) b(u) on a.u < b.u
    where not is_blocked_pair(a.u, b.u)
      -- neither self-flagged no-show
      and not exists (select 1 from attendance_marks m
        where m.plan_id=p_plan_id and m.marked_by=a.u and m.subject_id=a.u and m.result='noshow')
      and not exists (select 1 from attendance_marks m
        where m.plan_id=p_plan_id and m.marked_by=b.u and m.subject_id=b.u and m.result='noshow')
      -- neither flagged the other no-show (single pairwise flag removes this edge)
      and not exists (select 1 from attendance_marks m
        where m.plan_id=p_plan_id and m.marked_by=a.u and m.subject_id=b.u and m.result='noshow')
      and not exists (select 1 from attendance_marks m
        where m.plan_id=p_plan_id and m.marked_by=b.u and m.subject_id=a.u and m.result='noshow')
    on conflict (user_a_id, user_b_id)
      do update set plans_together = familiar_faces.plans_together + 1, last_met_at = now()
    returning user_a_id, user_b_id, (xmax = 0) as is_new
  loop
    if r.is_new then
      -- pass the OTHER user as the actor (5th arg) so the notification carries a
      -- userId the client can tap through to (ProfileOther).
      perform notify(r.user_a_id, 'new_familiar_face',
        'You and ' || (select name from users where id=r.user_b_id) || ' are now familiar faces.',
        null, r.user_b_id);
      perform notify(r.user_b_id, 'new_familiar_face',
        'You and ' || (select name from users where id=r.user_a_id) || ' are now familiar faces.',
        null, r.user_a_id);
      update users set people_met = people_met + 1 where id in (r.user_a_id, r.user_b_id);
    end if;
  end loop;
end $$;
revoke execute on function rebuild_familiar_faces(uuid, uuid[]) from anon, authenticated, public;
grant  execute on function rebuild_familiar_faces(uuid, uuid[]) to service_role;

-- ─── fn_resolve_attendance — graph-present faces for every plan ──────────────
-- Identical to 0014s except: (a) the in-gate `rebuild_familiar_faces(p.id)` call is
-- removed, and (b) a graph-present set is computed for every plan and faces are
-- built from it after the (unchanged) score/verdict/endorsement block.
create or replace function fn_resolve_attendance() returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_floor constant numeric := 0.5;
  p record; v_parts uuid[]; v_submitters uuid[]; v_credible uuid[];
  v_n int; v_sub_n int; v_subject uuid; v_verdict member_status_t;
  v_selfnoshow boolean; v_nf int; v_pv int; v_processed int := 0; rec record;
begin
  for p in
    -- Picked up by the daily morning resolver (cron at 10:30 IST, see 0019). The
    -- 6h buffer ensures a plan that ended shortly before 10:30 rolls to the NEXT
    -- morning rather than resolving with a near-zero endorsement window.
    select pl.* from plans pl
    where pl.status='ended' and pl.ended_at is not null
      and pl.ended_at < now() - interval '6 hours'
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

        -- recompute scores for every participant (resolved verdicts only)
        perform compute_attendance_score(x) from (select unnest(v_parts) x) q;

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

      -- ── PURE DEFAULT-PRESENT SOCIAL GRAPH (every plan, outside the witness gate) ──
      -- Faces form by default among all participants; the builder drops a pair only
      -- on a no-show signal between them (self-no-show, single pairwise flag, or
      -- block). This is liberal by design — the trust SCORE above stays corroborated.
      if coalesce(array_length(v_parts,1),0) >= 2 then
        perform rebuild_familiar_faces(p.id, v_parts);
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
