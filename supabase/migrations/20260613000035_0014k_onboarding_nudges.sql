-- ============================================================================
-- Migration 0014k — onboarding nudge cron logic (Part 6)
-- profile_incomplete (48h, no avatar/bio) and first_plan_nudge (72h, no plan
-- activity). Both dedupe and are preference-controlled (default on).
-- ============================================================================

create or replace function fn_notify_profile_incomplete()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; u record;
begin
  for u in
    select id from users
    where deleted_at is null and account_status='active'
      and created_at between now() - interval '54 hours' and now() - interval '48 hours'
      and (avatar_path is null or bio is null)
  loop
    if not exists (select 1 from notifications where user_id=u.id and type='profile_incomplete') then
      perform notify(u.id, 'profile_incomplete', 'Add a photo and bio so people know who''s hopping on.');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function fn_notify_first_plan()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; u record;
begin
  for u in
    select id from users
    where deleted_at is null and account_status='active'
      and created_at between now() - interval '78 hours' and now() - interval '72 hours'
      and not exists (select 1 from plans where host_id = users.id)
      and not exists (select 1 from plan_members where user_id = users.id and not is_host_row)
  loop
    if not exists (select 1 from notifications where user_id=u.id and type='first_plan_nudge') then
      perform notify(u.id, 'first_plan_nudge', 'There are plans near you right now. Find something to join.');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke execute on function fn_notify_profile_incomplete() from anon, authenticated, public;
revoke execute on function fn_notify_first_plan() from anon, authenticated, public;
grant execute on function fn_notify_profile_incomplete() to service_role;
grant execute on function fn_notify_first_plan() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('hopon-nudge-profile',    '0 9 * * *',  'select fn_notify_profile_incomplete()');
    perform cron.schedule('hopon-nudge-first-plan', '0 10 * * *', 'select fn_notify_first_plan()');
  else
    raise notice 'pg_cron not available — onboarding nudge crons NOT scheduled (REQUIRED in production)';
  end if;
end $$;
