-- ============================================================================
-- Migration 0014q — auto-end plans (~1h after start) into the Trust lifecycle.
--
-- Product (founder, Wave 4): there is no manual "End plan". A plan auto-ends ~1h
-- after its start time, which kicks off the Trust flow (attendance + endorsements)
-- and prompts the host + members. This RE-USES the existing end_plan flow: the
-- end steps are extracted into fn_end_plan_core(plan, host) and BOTH end_plan
-- (host-initiated, unchanged contract) and the new cron fn_auto_end_plans() call
-- it — so trust behaviour and notifications are identical.
--
-- Reconciliation: fn_expire_plans previously expired active/full plans at
-- start+10min, which would pre-empt a 1h auto-end (plans would never reach the
-- Trust flow). Auto-end now owns the post-start lifecycle, so fn_expire_plans is
-- widened to a far fallback (start+6h) that only fires if auto-end never ran.
-- ============================================================================

-- ─── fn_end_plan_core — the shared end-plan steps (no auth; caller passes host)
create or replace function fn_end_plan_core(p_plan_id uuid, p_host uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_plan plans; m record;
begin
  select * into v_plan from plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.status not in ('active','full') then raise exception 'plan_closed' using errcode='P0001'; end if;

  update plans set status='ended', ended_at=now() where id = p_plan_id;

  -- S3.1: synthetic host membership row
  insert into plan_members (plan_id, user_id, status, is_host_row)
  values (p_plan_id, p_host, 'attended', true)
  on conflict (plan_id, user_id) do update set status='attended', is_host_row=true;

  -- S3.2: host attendance mark = present
  insert into attendance_marks (plan_id, marked_by, subject_id, result)
  values (p_plan_id, p_host, p_host, 'present')
  on conflict (plan_id, subject_id) do nothing;

  -- S3.3: notify host + members (endorse/recap windows derive from ended_at)
  perform notify(p_host, 'plan_ended_host',
    v_plan.activity || ' is done. Mark attendance and endorse your crew.', p_plan_id);
  for m in select user_id from plan_members
           where plan_id=p_plan_id and status in ('joined','approved') and not is_host_row loop
    perform notify(m.user_id, 'plan_ended_joiner',
      v_plan.activity || ' has ended. Endorse your crew and post a recap.', p_plan_id);
  end loop;

  -- S3.4: bump host plans_hosted
  update users set plans_hosted = plans_hosted + 1 where id = p_host;
end $$;
revoke execute on function fn_end_plan_core(uuid, uuid) from anon, authenticated, public;
grant  execute on function fn_end_plan_core(uuid, uuid) to service_role;

-- ─── end_plan — host-initiated; same contract, now delegates to the core ─────
create or replace function end_plan(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_plan plans;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.host_id <> v_uid then raise exception 'not_host' using errcode='P0001'; end if;
  perform fn_end_plan_core(p_plan_id, v_uid);
end $$;

-- ─── fn_auto_end_plans — cron: end active/full plans ~1h past start ──────────
create or replace function fn_auto_end_plans() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; p record;
begin
  for p in select id, host_id from plans
           where status in ('active','full') and starts_at < now() - interval '1 hour' loop
    perform fn_end_plan_core(p.id, p.host_id);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function fn_auto_end_plans() from anon, authenticated, public;
grant  execute on function fn_auto_end_plans() to service_role;

-- ─── fn_expire_plans — widened to a far fallback so it no longer pre-empts ───
-- auto-end. Auto-end (1h) flips active/full → ended first; this only fires for
-- plans somehow still active 6h past start (e.g. cron was down).
create or replace function fn_expire_plans() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; p record; m record;
begin
  for p in select * from plans where status in ('active','full')
           and starts_at < now() - interval '6 hours' loop
    update plans set status='expired' where id = p.id;
    perform notify(p.host_id, 'plan_expired_host', 'Your '||p.activity||' plan expired.', p.id);
    for m in select user_id from plan_members
             where plan_id=p.id and status in ('joined','approved') and not is_host_row loop
      perform notify(m.user_id, 'plan_expired_joiner', p.activity||' started without being marked ended.', p.id);
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ─── Schedule the auto-end cron (guarded on pg_cron, mirroring 0015a) ────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if not exists (select 1 from cron.job where jobname = 'hopon-auto-end') then
      perform cron.schedule('hopon-auto-end', '*/10 * * * *', 'select fn_auto_end_plans()');
    end if;
  else
    raise notice 'pg_cron absent — fn_auto_end_plans not scheduled (call it manually in dev)';
  end if;
end $$;
