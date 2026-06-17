-- ============================================================================
-- Migration 0021 — live-derived profile metric tiles (HOSTED/ATTENDED/MET/%).
--
-- The profile stat tiles read users.{plans_hosted,plans_attended,people_met,
-- attendance_score} — denormalized counters that DRIFT from reality:
--   • plans_attended was orphaned by Trust V2 (no writer in the current flow);
--   • plans_hosted counts ended-only while the Hosted tab lists all hosted;
--   • people_met didn't reflect blocks;
--   • seed data sets all four to arbitrary values.
-- Fix: derive all four LIVE in users_public so the tiles can never disagree with
-- the tabs / familiar-faces list. Computed via SECURITY DEFINER scalar functions
-- (the view runs as the caller; a raw `plans` subquery would hit the same 42501
-- users-column-privilege cascade that broke getUserHostedPlans). Postgres prunes
-- unreferenced view columns, so list/search reads that don't select these stay fast.
--
-- No client change: the view's column names are unchanged, just live-derived.
-- compute_attendance_score is kept (it still drives score-change notifications);
-- only the DISPLAYED value is now live.
-- ============================================================================

-- HOSTED = all plans the user hosts (matches the "Hosted" tab / get_user_plans).
create or replace function fn_profile_hosted(p_uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from plans where host_id = p_uid;
$$;

-- ATTENDED = resolved-attended memberships (re-wires the orphaned counter).
create or replace function fn_profile_attended(p_uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from plan_members where user_id = p_uid and status = 'attended';
$$;

-- MET = familiar faces involving the user, excluding the user's blocked pairs
-- (matches the Familiar Faces screen, which hides blocked relationships).
create or replace function fn_profile_met(p_uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from familiar_faces f
  where (f.user_a_id = p_uid or f.user_b_id = p_uid)
    and not is_blocked_pair(case when f.user_a_id = p_uid then f.user_b_id else f.user_a_id end, p_uid);
$$;

-- ATTENDANCE % = present / (present+noshow) over resolved plan_members, null when
-- fewer than 3 resolved ("New"). Mirrors compute_attendance_score, but live.
create or replace function fn_profile_attendance(p_uid uuid) returns smallint
language sql stable security definer set search_path = public as $$
  select case
           when count(*) filter (where status in ('attended','noshow')) < 3 then null
           else round(100.0 * count(*) filter (where status = 'attended')
                      / count(*) filter (where status in ('attended','noshow')))::smallint
         end
  from plan_members where user_id = p_uid;
$$;

revoke execute on function fn_profile_hosted(uuid)     from anon, public;
revoke execute on function fn_profile_attended(uuid)   from anon, public;
revoke execute on function fn_profile_met(uuid)        from anon, public;
revoke execute on function fn_profile_attendance(uuid) from anon, public;
grant  execute on function fn_profile_hosted(uuid)     to authenticated, service_role;
grant  execute on function fn_profile_attended(uuid)   to authenticated, service_role;
grant  execute on function fn_profile_met(uuid)        to authenticated, service_role;
grant  execute on function fn_profile_attendance(uuid) to authenticated, service_role;

-- Redefine users_public: the 4 metric columns are now live-derived. Everything
-- else (visibility WHERE, interests, security_barrier) is unchanged from 0003a.
create or replace view users_public
with (security_barrier = true) as
  select id, name, handle, avatar_path, neighbourhood, bio,
         verification_level, profile_visibility, plan_visibility,
         ig_handle, linkedin_handle, fb_handle,
         fn_profile_hosted(id)     as plans_hosted,
         fn_profile_attended(id)   as plans_attended,
         fn_profile_met(id)        as people_met,
         fn_profile_attendance(id) as attendance_score,
         created_at,
         interests
  from users
  where deleted_at is null
    and account_status <> 'banned'
    and not is_blocked_pair(auth.uid(), users.id)
    and (
      id = auth.uid()
      or profile_visibility = 'everyone'
      or (profile_visibility = 'followers'
          and exists (select 1 from follows f
                      where f.follower_id = auth.uid() and f.following_id = users.id
                      and f.status = 'accepted'))
    );
