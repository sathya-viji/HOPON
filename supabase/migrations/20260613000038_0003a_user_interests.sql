-- ============================================================================
-- Migration 0003a — add users.interests (Integration gap G1, approved)
-- The Interests onboarding screen + profile display had no column to persist to.
-- Added as a self-editable profile field (no RPC needed — uses the Phase-1
-- column-level UPDATE grant + users_update_self RLS). Exposed on users_public.
-- Appended LAST to users_public so create-or-replace is valid despite the
-- match_contact_hashes setof-dependency.
-- ============================================================================
alter table users add column if not exists interests text[] not null default '{}';

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_interests_count') then
    alter table users add constraint users_interests_count
      check (coalesce(array_length(interests,1),0) <= 20
             and array_position(interests, null) is null);
  end if;
end $$;

-- self-editable (added to the Phase-1 whitelist)
grant update (interests) on users to authenticated;

-- expose on the public profile view (appended as the trailing column)
create or replace view users_public
with (security_barrier = true) as
  select id, name, handle, avatar_path, neighbourhood, bio,
         verification_level, profile_visibility, plan_visibility,
         ig_handle, linkedin_handle, fb_handle,
         plans_hosted, plans_attended, people_met, attendance_score,
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
alter view users_public owner to postgres;
grant select on users_public to authenticated;
