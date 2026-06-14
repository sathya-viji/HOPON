-- ============================================================================
-- Migration 0004c — fix-forward: block exclusion in users_public
-- Now that blocks exists (0010), add the block-pair exclusion to the profile
-- view (the last surface still missing it; plans/recaps/stories/follows already
-- route through is_blocked_pair). create-or-replace (columns unchanged) because
-- match_contact_hashes returns setof users_public.
-- ============================================================================
create or replace view users_public
with (security_barrier = true) as
  select id, name, handle, avatar_path, neighbourhood, bio,
         verification_level, profile_visibility, plan_visibility,
         ig_handle, linkedin_handle, fb_handle,
         plans_hosted, plans_attended, people_met, attendance_score,
         created_at
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
alter view users_public owner to postgres;
grant select on users_public to authenticated;
