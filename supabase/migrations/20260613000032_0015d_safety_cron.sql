-- ============================================================================
-- Migration 0015d — safety cron scheduling (guarded on pg_cron; production)
-- Emergency escalation dispatch is wired in the reports trigger (0010).
-- ============================================================================
do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    -- F3: hard-delete + anonymise accounts 30 days after soft-delete
    perform cron.schedule('hopon-account-hard-delete', '0 2 * * *', 'select fn_hard_delete_accounts()');
    -- reactivate suspensions whose timer has passed
    perform cron.schedule('hopon-suspension-expiry',   '0 * * * *', 'select fn_expire_suspensions()');
  else
    raise notice 'pg_cron not available — Phase 6 safety crons NOT scheduled (REQUIRED in production)';
  end if;
end $$;
