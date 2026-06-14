-- ============================================================================
-- Migration 0014h — Phase 6 RPCs (block/unblock, report, moderation, hard-delete)
-- Execution doc Part 4 (4.15 submit_report, 4.16 block/unblock) + F3 hard-delete.
-- RPC-only mutations; security definer; typed errors; explicit grants.
-- ============================================================================

-- ─── block_user / unblock_user (4.16) ──────────────────────────────────────
-- Block severs the follow relationship both directions (incl. pending requests).
create or replace function block_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_user_id = v_uid then raise exception 'cannot_block_self' using errcode='P0001'; end if;
  insert into blocks (blocker_id, blocked_id) values (v_uid, p_user_id)
  on conflict do nothing;
  delete from follows
   where (follower_id = v_uid and following_id = p_user_id)
      or (follower_id = p_user_id and following_id = v_uid);
end $$;

create or replace function unblock_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  delete from blocks where blocker_id = v_uid and blocked_id = p_user_id;
end $$;

-- ─── set_account_status (internal moderation primitive) ────────────────────
create or replace function set_account_status(p_user_id uuid, p_status account_status,
  p_reason text default null, p_until timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update users set account_status = p_status,
                   suspension_reason = case when p_status='active' then null else p_reason end,
                   suspended_until = case when p_status='suspended' then p_until else null end
  where id = p_user_id;
  if to_regclass('public.audit_logs') is not null then
    insert into audit_logs (actor_type, action, target_type, target_id, detail)
    values ('system','account_status_changed','user',p_user_id,
            jsonb_build_object('status',p_status,'reason',p_reason,'until',p_until));
  end if;
end $$;
revoke execute on function set_account_status(uuid,account_status,text,timestamptz) from anon, authenticated, public;
grant execute on function set_account_status(uuid,account_status,text,timestamptz) to service_role;

-- ─── submit_report (4.15) + auto-moderation thresholds ─────────────────────
create or replace function submit_report(p_target_type report_target_t, p_target_id uuid,
  p_reason report_reason_t, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today integer;
  v_safety integer;
  v_total integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;

  -- rate limit: ≤10 reports/day (from source rows)
  select count(*) into v_today from reports
   where reporter_id = v_uid and created_at > now() - interval '1 day';
  if v_today >= 10 then raise exception 'rate_limited' using errcode='P0001'; end if;

  insert into reports (reporter_id, target_type, target_id, reason, notes)
  values (v_uid, p_target_type, p_target_id, p_reason, p_notes);
  -- emergency escalation handled by trigger (F4)

  -- auto-moderation: 3+ safety_concern on a user in 7d ⇒ suspend 7 days
  if p_target_type = 'user' then
    select count(distinct reporter_id) into v_safety from reports
     where target_type='user' and target_id=p_target_id and reason='safety_concern'
       and created_at > now() - interval '7 days';
    if v_safety >= 3 then
      perform set_account_status(p_target_id, 'suspended', 'auto: safety reports', now() + interval '7 days');
    end if;
  -- auto-hide: 5+ reports on a plan
  elsif p_target_type = 'plan' then
    select count(distinct reporter_id) into v_total from reports
     where target_type='plan' and target_id=p_target_id;
    if v_total >= 5 then
      update plans set is_hidden = true where id = p_target_id;
      if to_regclass('public.audit_logs') is not null then
        insert into audit_logs (actor_type, action, target_type, target_id, detail)
        values ('system','plan_auto_hidden','plan',p_target_id, jsonb_build_object('reports',v_total));
      end if;
    end if;
  end if;
end $$;

-- ─── F3 hard-delete cron: scrub PII + personal content at +30 days ──────────
-- Hybrid model: personal CONTENT is hard-deleted; the identity is anonymised
-- IN PLACE (not row-deleted) so trust-graph contributions (attendance_marks,
-- endorsements) and FK integrity (plans.host_id) survive with no identity.
create or replace function fn_hard_delete_accounts()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; u record;
begin
  for u in select id from users where deleted_at is not null and deleted_at < now() - interval '30 days'
                                  and account_status <> 'banned' loop
    -- personal content: hard delete (cascades likes/comments/views)
    delete from recaps  where author_id = u.id;
    delete from stories where author_id = u.id;
    delete from recap_likes    where user_id = u.id;
    delete from recap_comments where author_id = u.id;
    delete from story_views    where viewer_id = u.id;
    delete from follows where follower_id = u.id or following_id = u.id;
    delete from blocks  where blocker_id = u.id or blocked_id = u.id;
    delete from notifications where user_id = u.id or actor_id = u.id;
    delete from push_tokens    where user_id = u.id;
    delete from contact_hashes where owner_id = u.id;
    delete from familiar_faces where user_a_id = u.id or user_b_id = u.id;
    delete from feed_events    where actor_id = u.id;
    -- chat continuity: blank the body, keep the row
    update messages set body = '[deleted]', is_deleted = true where author_id = u.id;
    -- trust graph: preserved with anonymised identity (attendance_marks,
    -- endorsements keep their rows; the user row is scrubbed below).

    -- anonymise identity IN PLACE (keeps FKs: plans.host_id, marks, endorsements)
    update users set
      name = '[deleted]', handle = '@del_' || substr(replace(u.id::text,'-',''),1,20),
      avatar_path = null, bio = null, neighbourhood = '', gender = 'prefer_not',
      ig_handle = null, linkedin_handle = null, fb_handle = null,
      dob = date '1900-01-01', account_status = 'banned'
    where id = u.id;
    -- scrub auth PII (keep the auth row so FKs hold)
    update auth.users set phone = null, email = null where id = u.id;

    if to_regclass('public.audit_logs') is not null then
      insert into audit_logs (actor_type, action, target_type, target_id, detail)
      values ('system','account_hard_deleted','user',u.id,'{}');
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function fn_hard_delete_accounts() from anon, authenticated, public;
grant execute on function fn_hard_delete_accounts() to service_role;

-- ─── suspension expiry cron: reactivate when the timer passes ───────────────
create or replace function fn_expire_suspensions()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update users set account_status='active', suspension_reason=null, suspended_until=null
  where account_status='suspended' and suspended_until is not null and suspended_until < now()
    and deleted_at is null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function fn_expire_suspensions() from anon, authenticated, public;
grant execute on function fn_expire_suspensions() to service_role;

-- ─── Grants ─────────────────────────────────────────────────────────────────
do $$
declare fn text;
begin
  foreach fn in array array[
    'block_user(uuid)','unblock_user(uuid)','submit_report(report_target_t,uuid,report_reason_t,text)'
  ] loop
    execute format('revoke execute on function %s from anon, public', fn);
    execute format('grant execute on function %s to authenticated, service_role', fn);
  end loop;
end $$;
