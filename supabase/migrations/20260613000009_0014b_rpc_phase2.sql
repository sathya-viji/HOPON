-- ============================================================================
-- Migration 0014b — Phase 2 RPCs (Core Plan Loop)
-- Execution doc Part 4: create_plan(4.7-create), join_plan(4.2), leave_plan(4.3),
-- approve_request/decline_request(4.4), update_plan(4.5), cancel_plan(4.6),
-- get_home_feed(4.20), search_plans(4.21) + get_plan_detail (Discovery read path).
--
-- All security definer, pinned search_path, typed error codes (errcode P0001 →
-- ApiErrorCode contract). Mutations run as owner (postgres) and bypass RLS by
-- design — they ARE the only write path, owning counters/limits/notifications.
--
-- notify(): the doc's Part 4 helper, landed here because every Phase 2 mutation
-- notifies. Self-guards on the Phase 3 notifications table — no-op until it
-- exists, then live with zero changes. This IS the final notify() (push is a
-- separate Phase 3 webhook → push-sender; notify only writes the in-app row).
--
-- Rate limits are enforced from SOURCE rows (plan_members.joined_at,
-- plans.cancelled_at) rather than landing the Phase 7 user_counters_daily table
-- early — same limits ("≤20 joins/hour", "≥3 cancels/24h"), less surface.
-- ============================================================================

-- ─── notify() — in-app notification writer (guarded for Phase 3) ────────────
create or replace function notify(
  p_user uuid, p_type notif_type, p_body text,
  p_plan uuid default null, p_actor uuid default null, p_recap uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.notifications') is null then
    return;  -- notifications table lands in Phase 3
  end if;
  execute $g$
    insert into notifications (user_id, type, body, plan_id, actor_id, recap_id)
    select $1, $2, $3, $4, $5, $6
    where exists (select 1 from users
                  where id = $1 and deleted_at is null and account_status = 'active')
  $g$ using p_user, p_type, p_body, p_plan, p_actor, p_recap;
end $$;
revoke execute on function notify(uuid, notif_type, text, uuid, uuid, uuid) from anon, authenticated, public;
grant execute on function notify(uuid, notif_type, text, uuid, uuid, uuid) to service_role;

-- ─── plan_visible_to() — replicates plans_select for definer reads ──────────
create or replace function plan_visible_to(p_plan plans, p_viewer uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
begin
  if p_plan.host_id = p_viewer then return true; end if;
  if p_plan.is_hidden then return false; end if;
  if not exists (
    select 1 from users u
    where u.id = p_plan.host_id and u.deleted_at is null
      and u.account_status = 'active' and u.plan_visibility = 'everyone'   -- Phase 5: + followers
  ) then
    return false;
  end if;
  if to_regclass('public.blocks') is not null then     -- Phase 6 block exclusion
    if exists (select 1 from blocks
               where (blocker_id = p_plan.host_id and blocked_id = p_viewer)
                  or (blocker_id = p_viewer and blocked_id = p_plan.host_id)) then
      return false;
    end if;
  end if;
  return true;
end $$;

-- helper: build the joiner-avatar array for a plan (joined|approved, non-host)
create or replace function plan_joiners_json(p_plan_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id, 'name', u.name, 'avatar_path', u.avatar_path,
           'attendance_score', u.attendance_score) order by pm.joined_at), '[]'::jsonb)
  from plan_members pm
  join users u on u.id = pm.user_id
  where pm.plan_id = p_plan_id
    and pm.status in ('joined','approved')
    and not pm.is_host_row;
$$;

-- ─── create_plan ────────────────────────────────────────────────────────────
create or replace function create_plan(
  p_category_id   text,
  p_activity      text,
  p_location_label text,
  p_lat           numeric,
  p_lng           numeric,
  p_starts_at     timestamptz,
  p_capacity      smallint,
  p_plan_type     plan_type_t,
  p_cost          cost_t,
  p_gender_pref   gender_pref_t,
  p_cost_note     text default null,
  p_description   text default null,
  p_rules         text default null
) returns plans
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_plan plans;
  v_active integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if not exists (select 1 from users where id=v_uid and deleted_at is null and account_status='active') then
    raise exception 'account_suspended' using errcode='P0001';
  end if;
  if p_starts_at <= now() then raise exception 'starts_in_past' using errcode='P0001'; end if;
  if p_starts_at > now() + interval '14 days' then raise exception 'starts_too_far' using errcode='P0001'; end if;

  select count(*) into v_active from plans
  where host_id = v_uid and status in ('active','full');
  if v_active >= 5 then raise exception 'too_many_active_plans' using errcode='P0001'; end if;

  insert into plans (host_id, category_id, activity, description, rules, location_label,
                     lat, lng, starts_at, capacity, spots_remaining,
                     plan_type, cost, cost_note, gender_pref)
  values (v_uid, p_category_id, trim(p_activity), p_description, p_rules, trim(p_location_label),
          p_lat, p_lng, p_starts_at, p_capacity, p_capacity - 1,
          p_plan_type, p_cost, p_cost_note, p_gender_pref)
  returning * into v_plan;

  perform notify(v_uid, 'plan_posted', 'Your ' || v_plan.activity || ' plan is live.', v_plan.id);

  -- following_posted_plan fan-out is wired in Phase 5 (needs follows + the fn).
  if to_regprocedure('public.fanout_following_posted_plan(uuid)') is not null then
    perform fanout_following_posted_plan(v_plan.id);
  end if;

  return v_plan;
end $$;

-- ─── join_plan (4.2) ────────────────────────────────────────────────────────
create or replace function join_plan(p_plan_id uuid, p_idempotency_key uuid default null)
returns plan_members
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_gender gender_t;
  v_plan   plans;
  v_member plan_members;
  v_hour_joins integer;
  v_status member_status_t;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;

  -- idempotent retry
  if p_idempotency_key is not null then
    select * into v_member from plan_members where idempotency_key = p_idempotency_key;
    if found then return v_member; end if;
  end if;

  -- caller account + private gender (definer can read)
  select gender into v_gender from users
  where id = v_uid and deleted_at is null and account_status = 'active';
  if v_gender is null then raise exception 'account_suspended' using errcode='P0001'; end if;

  -- lock the plan row (race-safe spot accounting)
  select * into v_plan from plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.host_id = v_uid then raise exception 'host_cannot_join_own_plan' using errcode='P0001'; end if;
  if v_plan.status not in ('active','full') then raise exception 'plan_closed' using errcode='P0001'; end if;
  if v_plan.starts_at <= now() then raise exception 'plan_closed' using errcode='P0001'; end if;

  -- block-pair exclusion (Phase 6)
  if to_regclass('public.blocks') is not null then
    if exists (select 1 from blocks
               where (blocker_id=v_plan.host_id and blocked_id=v_uid)
                  or (blocker_id=v_uid and blocked_id=v_plan.host_id)) then
      raise exception 'blocked' using errcode='P0001';
    end if;
  end if;

  -- gender enforcement (D11): strict mapping, nonbinary/prefer_not excluded
  if v_plan.gender_pref = 'women' and v_gender <> 'woman' then
    raise exception 'gender_mismatch' using errcode='P0001';
  end if;
  if v_plan.gender_pref = 'men' and v_gender <> 'man' then
    raise exception 'gender_mismatch' using errcode='P0001';
  end if;

  -- already a member?
  select * into v_member from plan_members where plan_id = p_plan_id and user_id = v_uid;
  if found then return v_member; end if;

  -- rate limit: ≤20 joins / rolling hour (from source rows)
  select count(*) into v_hour_joins from plan_members
  where user_id = v_uid and joined_at > now() - interval '1 hour';
  if v_hour_joins >= 20 then raise exception 'rate_limited' using errcode='P0001'; end if;

  -- open ⇒ instant join (needs a spot); closed ⇒ request
  if v_plan.plan_type = 'open' then
    if v_plan.spots_remaining <= 0 then raise exception 'plan_full' using errcode='P0001'; end if;
    v_status := 'joined';
  else
    v_status := 'requested';
  end if;

  insert into plan_members (plan_id, user_id, status, idempotency_key)
  values (p_plan_id, v_uid, v_status, p_idempotency_key)
  returning * into v_member;

  if v_status = 'joined' then
    perform notify(v_plan.host_id, 'new_joiner',
      (select name from users where id=v_uid) || ' joined your ' || v_plan.activity || ' plan.',
      v_plan.id, v_uid);
    if (select spots_remaining from plans where id = p_plan_id) <= 0 then
      perform notify(v_plan.host_id, 'plan_full',
        'All spots for ' || v_plan.activity || ' are taken.', v_plan.id);
    end if;
  else
    perform notify(v_plan.host_id, 'join_request',
      (select name from users where id=v_uid) || ' wants to join your ' || v_plan.activity || ' plan.',
      v_plan.id, v_uid);
  end if;

  return v_member;
end $$;

-- ─── leave_plan (4.3) ───────────────────────────────────────────────────────
create or replace function leave_plan(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_plan plans;
  v_n    integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.status in ('ended','cancelled','expired') then
    raise exception 'plan_closed' using errcode='P0001';
  end if;

  delete from plan_members
  where plan_id = p_plan_id and user_id = v_uid and not is_host_row;
  get diagnostics v_n = row_count;

  if v_n > 0 then
    perform notify(v_plan.host_id, 'joiner_left',
      (select name from users where id=v_uid) || ' left your ' || v_plan.activity || ' plan.',
      v_plan.id, v_uid);
  end if;
end $$;

-- ─── approve_request (4.4) ──────────────────────────────────────────────────
create or replace function approve_request(p_plan_id uuid, p_user_id uuid)
returns plan_members
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_plan plans;
  v_member plan_members;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.host_id <> v_uid then raise exception 'not_host' using errcode='P0001'; end if;
  if v_plan.spots_remaining <= 0 then raise exception 'plan_full' using errcode='P0001'; end if;

  update plan_members set status='approved', resolved_at=now()
  where plan_id=p_plan_id and user_id=p_user_id and status='requested'
  returning * into v_member;
  if not found then raise exception 'request_not_found' using errcode='P0001'; end if;

  perform notify(p_user_id, 'request_approved',
    'You''re in! ' || v_plan.activity || ' — open chat to coordinate.', v_plan.id, v_uid);
  return v_member;
end $$;

-- ─── decline_request (4.4) ──────────────────────────────────────────────────
create or replace function decline_request(p_plan_id uuid, p_user_id uuid)
returns plan_members
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_plan plans;
  v_member plan_members;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.host_id <> v_uid then raise exception 'not_host' using errcode='P0001'; end if;

  update plan_members set status='declined', resolved_at=now()
  where plan_id=p_plan_id and user_id=p_user_id and status='requested'
  returning * into v_member;
  if not found then raise exception 'request_not_found' using errcode='P0001'; end if;

  perform notify(p_user_id, 'request_declined',
    v_plan.activity || ' — the host couldn''t fit you in this time.', v_plan.id, v_uid);
  return v_member;
end $$;

-- ─── update_plan (4.5) ──────────────────────────────────────────────────────
-- Editable fields per PlanEdit; capacity is NOT editable (would desync spots).
create or replace function update_plan(
  p_plan_id uuid,
  p_activity text, p_location_label text, p_lat numeric, p_lng numeric,
  p_starts_at timestamptz, p_cost cost_t, p_gender_pref gender_pref_t,
  p_cost_note text default null, p_description text default null, p_rules text default null
) returns plans
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_plan plans;
  v_new  plans;
  v_changed boolean;
  r record;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.host_id <> v_uid then raise exception 'not_host' using errcode='P0001'; end if;
  if v_plan.status not in ('active','full') then raise exception 'plan_closed' using errcode='P0001'; end if;
  if p_starts_at <= now() then raise exception 'starts_in_past' using errcode='P0001'; end if;
  if p_starts_at > now() + interval '14 days' then raise exception 'starts_too_far' using errcode='P0001'; end if;

  v_changed := (v_plan.activity is distinct from trim(p_activity))
            or (v_plan.location_label is distinct from trim(p_location_label))
            or (v_plan.starts_at is distinct from p_starts_at);

  update plans set
    activity = trim(p_activity), location_label = trim(p_location_label),
    lat = p_lat, lng = p_lng, starts_at = p_starts_at,
    cost = p_cost, cost_note = p_cost_note, gender_pref = p_gender_pref,
    description = p_description, rules = p_rules
  where id = p_plan_id
  returning * into v_new;

  if v_changed then
    for r in select user_id from plan_members
             where plan_id = p_plan_id and status in ('joined','approved') and not is_host_row loop
      perform notify(r.user_id, 'plan_updated',
        v_new.activity || ' — the host changed the details.', v_new.id, v_uid);
    end loop;
  end if;

  return v_new;
end $$;

-- ─── cancel_plan (4.6) ──────────────────────────────────────────────────────
create or replace function cancel_plan(p_plan_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_plan plans;
  v_cancels integer;
  r record;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id for update;
  if not found then raise exception 'plan_not_found' using errcode='P0001'; end if;
  if v_plan.host_id <> v_uid then raise exception 'not_host' using errcode='P0001'; end if;
  if v_plan.status not in ('active','full') then raise exception 'plan_closed' using errcode='P0001'; end if;

  for r in select user_id from plan_members
           where plan_id = p_plan_id and status in ('joined','approved','requested') and not is_host_row loop
    perform notify(r.user_id, 'plan_cancelled',
      'The host cancelled ' || v_plan.activity || '. Your spot has been released.', v_plan.id, v_uid);
  end loop;

  update plans set status='cancelled', cancelled_at=now() where id=p_plan_id;

  perform notify(v_uid, 'plan_cancelled_confirm',
    'Your ' || v_plan.activity || ' plan has been cancelled.', v_plan.id);

  -- spam flag: ≥3 cancels in 24h (audit only; does not block) — Phase 6 table
  select count(*) into v_cancels from plans
  where host_id = v_uid and cancelled_at > now() - interval '24 hours';
  if v_cancels >= 3 and to_regclass('public.audit_logs') is not null then
    execute $g$
      insert into audit_logs (actor_type, actor_id, action, target_type, target_id, detail)
      values ('system', $1, 'cancel_spam_flag', 'user', $1, jsonb_build_object('cancels_24h', $2))
    $g$ using v_uid, v_cancels;
  end if;
end $$;

-- ─── get_plan_detail (Discovery read path for Join/Host flows) ─────────────
-- Definer read: returns the plan + host + joiners for any viewer who passes
-- visibility. familiar_count is 0 until Phase 4 wires familiar_faces.
create or replace function get_plan_detail(p_plan_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_plan plans;
  v_familiar integer := 0;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_plan from plans where id = p_plan_id;
  if not found or not plan_visible_to(v_plan, v_uid) then
    raise exception 'plan_not_found' using errcode='P0001';
  end if;

  if to_regclass('public.familiar_faces') is not null then
    execute $g$
      select count(*) from plan_members pm
      where pm.plan_id = $1 and pm.status in ('joined','approved') and not pm.is_host_row
        and exists (
          select 1 from familiar_faces ff
          where (ff.user_a_id = least($2, pm.user_id) and ff.user_b_id = greatest($2, pm.user_id))
        )
    $g$ into v_familiar using p_plan_id, v_uid;
  end if;

  return jsonb_build_object(
    'plan', to_jsonb(v_plan) - 'search_vector',
    'host', (select to_jsonb(up) from users_public up where up.id = v_plan.host_id),
    'joiners', plan_joiners_json(p_plan_id),
    'familiar_count', v_familiar,
    'viewer_is_host', v_plan.host_id = v_uid,
    'viewer_membership', (select status from plan_members
                          where plan_id = p_plan_id and user_id = v_uid and not is_host_row)
  );
end $$;

-- ─── get_home_feed (4.20) ───────────────────────────────────────────────────
-- active+full plans, visibility/hidden filtered, optional geo radius, time-
-- ordered (soonest first, matching the Home tab's urgency grouping).
-- p_filters: { category_id, cost, plan_type, gender_pref, limit }
create or replace function get_home_feed(
  p_lat numeric default null,
  p_lng numeric default null,
  p_radius_km numeric default 50,
  p_filters jsonb default '{}'::jsonb,
  p_cursor integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(coalesce((p_filters->>'limit')::int, 30), 100);
  v_rows jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;

  select coalesce(jsonb_agg(item order by item_starts asc), '[]'::jsonb) into v_rows
  from (
    select
      jsonb_build_object(
        'plan', to_jsonb(p) - 'search_vector',
        'host', (select to_jsonb(up) from users_public up where up.id = p.host_id),
        'joiners', plan_joiners_json(p.id),
        'distance_m', case when p_lat is not null and p_lng is not null
          then round(extensions.ST_DistanceSphere(
               extensions.ST_MakePoint(p.lng, p.lat),
               extensions.ST_MakePoint(p_lng, p_lat)))
          else null end
      ) as item,
      p.starts_at as item_starts
    from plans p
    where p.status in ('active','full')
      and p.starts_at > now()
      and plan_visible_to(p, v_uid)
      and (p_filters->>'category_id' is null or p.category_id = p_filters->>'category_id')
      and (p_filters->>'cost'        is null or p.cost::text = p_filters->>'cost')
      and (p_filters->>'plan_type'   is null or p.plan_type::text = p_filters->>'plan_type')
      and (p_filters->>'gender_pref' is null or p.gender_pref::text = p_filters->>'gender_pref')
      and (
        p_lat is null or p_lng is null
        or extensions.ST_DWithin(
             extensions.ST_MakePoint(p.lng, p.lat)::extensions.geography,
             extensions.ST_MakePoint(p_lng, p_lat)::extensions.geography,
             p_radius_km * 1000)
      )
    order by p.starts_at asc
    offset greatest(p_cursor, 0)
    limit v_limit
  ) sub;

  return v_rows;
end $$;

-- ─── search_plans (4.21) ────────────────────────────────────────────────────
create or replace function search_plans(
  p_query text,
  p_filters jsonb default '{}'::jsonb,
  p_cursor integer default 0
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_limit integer := least(coalesce((p_filters->>'limit')::int, 30), 100);
  v_q tsquery := plainto_tsquery('english', coalesce(p_query, ''));
  v_rows jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;

  select coalesce(jsonb_agg(item order by rank desc, starts asc), '[]'::jsonb) into v_rows
  from (
    select
      jsonb_build_object(
        'plan', to_jsonb(p) - 'search_vector',
        'host', (select to_jsonb(up) from users_public up where up.id = p.host_id),
        'joiners', plan_joiners_json(p.id)
      ) as item,
      ts_rank(p.search_vector, v_q) as rank,
      p.starts_at as starts
    from plans p
    where p.status in ('active','full')
      and p.starts_at > now()
      and plan_visible_to(p, v_uid)
      and (v_q is null or p.search_vector @@ v_q)
      and (p_filters->>'category_id' is null or p.category_id = p_filters->>'category_id')
    order by rank desc, starts asc
    offset greatest(p_cursor, 0)
    limit v_limit
  ) sub;

  return v_rows;
end $$;

-- ─── Grants: clients call mutation + read RPCs; service_role too ───────────
do $$
declare fn text;
begin
  foreach fn in array array[
    'create_plan(text,text,text,numeric,numeric,timestamptz,smallint,plan_type_t,cost_t,gender_pref_t,text,text,text)',
    'join_plan(uuid,uuid)',
    'leave_plan(uuid)',
    'approve_request(uuid,uuid)',
    'decline_request(uuid,uuid)',
    'update_plan(uuid,text,text,numeric,numeric,timestamptz,cost_t,gender_pref_t,text,text,text)',
    'cancel_plan(uuid)',
    'get_plan_detail(uuid)',
    'get_home_feed(numeric,numeric,numeric,jsonb,integer)',
    'search_plans(text,jsonb,integer)'
  ] loop
    execute format('revoke execute on function %s from anon, public', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
