-- ============================================================================
-- Migration 0014u — get_my_plans (Wave 5.1 gap #1).
--
-- There is no client read-path for "the plans I'm part of": a direct select on
-- `plans` (or `plan_members`) fails for `authenticated` with 42501 — the
-- plans_select RLS subquery reads users.deleted_at / account_status, columns the
-- client isn't column-granted (the users-column-privilege cascade). All plan
-- reads are designed to go through SECURITY DEFINER RPCs; this is the missing
-- one. It returns the CALLER's own plans (hosted + active membership), which the
-- recap-creation plan picker and the own-profile Hosted/Joined tabs need.
--
-- Minimal contract: no args, returns full plan rows (the same shape the existing
-- feed mappers already consume), soonest-started last (newest first). Caller's
-- own data only — no privacy surface beyond what the user already owns.
-- ============================================================================
create or replace function get_my_plans()
returns setof plans
language sql stable security definer set search_path = public as $$
  select p.*
  from plans p
  where p.host_id = auth.uid()
     or exists (
       select 1 from plan_members m
       where m.plan_id = p.id and m.user_id = auth.uid()
     )
  order by p.starts_at desc;
$$;

revoke execute on function get_my_plans() from anon, public;
grant execute on function get_my_plans() to authenticated, service_role;
