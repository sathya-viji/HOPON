-- ============================================================================
-- Migration 0011a — fix-forward: add the Silent notification class
-- Documented in docs/NOTIFICATION_MATRIX.md. The frozen notif_push_allowed
-- (0011) implemented only Mandatory + Preference-controlled; three types are
-- in-app-only (never push): plan_posted, plan_cancelled_confirm,
-- attendance_score_improved. Encoding the class here makes the function match
-- the matrix. Fix-forward (0011 left untouched).
-- ============================================================================
create or replace function notif_push_allowed(p_user uuid, p_type notif_type) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    -- Silent: in-app + realtime only, never push
    when p_type in ('plan_posted','plan_cancelled_confirm','attendance_score_improved')
      then false
    -- Mandatory: always push, prefs ignored (frozen 6)
    when p_type in ('request_approved','request_declined','plan_cancelled',
                    'host_marked_absent','marked_noshow','welcome')
      then true
    -- Preference-controlled: default on
    else coalesce(
      (select push_enabled from notification_prefs where user_id = p_user and event_type = p_type),
      true)
  end;
$$;
revoke execute on function notif_push_allowed(uuid, notif_type) from anon, public;
grant execute on function notif_push_allowed(uuid, notif_type) to service_role;
