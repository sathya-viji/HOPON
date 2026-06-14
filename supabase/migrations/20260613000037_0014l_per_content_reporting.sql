-- ============================================================================
-- Migration 0014l — per-content reporting + auto-takedown (Safety #1)
-- submit_report now handles recap/story/comment/message targets with auto-
-- moderation at ≥3 distinct reporters:
--   recap/story → moderation='rejected' (drops from feeds; author keeps own view)
--   comment/message → soft-deleted (is_deleted=true, body '[deleted]')
-- user (3 safety/7d → suspend) and plan (5 → hide) thresholds unchanged.
-- Emergency on any target still escalates via the reports trigger (F4).
-- Fix-forward replace of submit_report (0014h untouched).
-- ============================================================================
create or replace function submit_report(p_target_type report_target_t, p_target_id uuid,
  p_reason report_reason_t, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_today integer;
  v_safety integer;
  v_distinct integer;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='P0001'; end if;

  select count(*) into v_today from reports
   where reporter_id = v_uid and created_at > now() - interval '1 day';
  if v_today >= 10 then raise exception 'rate_limited' using errcode='P0001'; end if;

  insert into reports (reporter_id, target_type, target_id, reason, notes)
  values (v_uid, p_target_type, p_target_id, p_reason, p_notes);
  -- emergency escalation handled by trigger (F4)

  if p_target_type = 'user' then
    select count(distinct reporter_id) into v_safety from reports
     where target_type='user' and target_id=p_target_id and reason='safety_concern'
       and created_at > now() - interval '7 days';
    if v_safety >= 3 then
      perform set_account_status(p_target_id, 'suspended', 'auto: safety reports', now() + interval '7 days');
    end if;

  elsif p_target_type = 'plan' then
    select count(distinct reporter_id) into v_distinct from reports
     where target_type='plan' and target_id=p_target_id;
    if v_distinct >= 5 then
      update plans set is_hidden = true where id = p_target_id;
      perform fn_audit_autohide('plan', p_target_id, v_distinct);
    end if;

  elsif p_target_type = 'recap' then
    select count(distinct reporter_id) into v_distinct from reports
     where target_type='recap' and target_id=p_target_id;
    if v_distinct >= 3 then
      update recaps set moderation='rejected' where id = p_target_id;
      perform fn_audit_autohide('recap', p_target_id, v_distinct);
    end if;

  elsif p_target_type = 'story' then
    select count(distinct reporter_id) into v_distinct from reports
     where target_type='story' and target_id=p_target_id;
    if v_distinct >= 3 then
      update stories set moderation='rejected' where id = p_target_id;
      perform fn_audit_autohide('story', p_target_id, v_distinct);
    end if;

  elsif p_target_type = 'comment' then
    select count(distinct reporter_id) into v_distinct from reports
     where target_type='comment' and target_id=p_target_id;
    if v_distinct >= 3 then
      update recap_comments set is_deleted=true, body='[deleted]' where id = p_target_id;
      perform fn_audit_autohide('comment', p_target_id, v_distinct);
    end if;

  elsif p_target_type = 'message' then
    select count(distinct reporter_id) into v_distinct from reports
     where target_type='message' and target_id=p_target_id;
    if v_distinct >= 3 then
      update messages set is_deleted=true, body='[deleted]' where id = p_target_id;
      perform fn_audit_autohide('message', p_target_id, v_distinct);
    end if;
  end if;
end $$;

-- small audit helper (keeps submit_report readable)
create or replace function fn_audit_autohide(p_type text, p_id uuid, p_reports integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if to_regclass('public.audit_logs') is not null then
    insert into audit_logs (actor_type, action, target_type, target_id, detail)
    values ('system', p_type || '_auto_hidden', p_type, p_id, jsonb_build_object('reports', p_reports));
  end if;
end $$;
revoke execute on function fn_audit_autohide(text,uuid,integer) from anon, authenticated, public;
grant execute on function fn_audit_autohide(text,uuid,integer) to service_role;
