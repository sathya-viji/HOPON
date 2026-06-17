-- ============================================================================
-- Migration 0018 — auto-end plans 2h after start (was 1h).
--
-- PRODUCT (founder, 2026-06-16): the post-event "mark attendance & endorse"
-- prompt fires at auto-end. Ending 1h after start meant the prompt often landed
-- well before a longer plan actually wrapped up. Bumping to 2h pushes the prompt
-- closer to a typical plan's real end without adding any per-plan duration field.
--
-- Only the auto-end threshold changes. The 48h resolver (keys off ended_at), the
-- 6h fn_expire_plans fallback (2h < 6h, no conflict), the "starting soon"
-- reminder, feed, and joins are all unchanged.
-- ============================================================================
create or replace function fn_auto_end_plans() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; p record;
begin
  for p in select id, host_id from plans
           where status in ('active','full') and starts_at < now() - interval '2 hours' loop
    perform fn_end_plan_core(p.id, p.host_id);
    n := n + 1;
  end loop;
  return n;
end $$;
