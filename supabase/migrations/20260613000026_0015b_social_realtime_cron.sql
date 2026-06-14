-- ============================================================================
-- Migration 0015b — social realtime publication + cron scheduling
-- Recaps/stories/follows do NOT get dedicated realtime channels (matrix §6) —
-- social updates ride user:{id}:notifications. We add recap_comments to the
-- publication so an open recap thread can live-update where desired; clients
-- may also refetch. Cron jobs are guarded on pg_cron (production).
-- ============================================================================

-- Optional live comment thread (clients may use it or refetch).
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='recap_comments') then
      alter publication supabase_realtime add table recap_comments;
    end if;
  end if;
end $$;

-- Phase 5 cron jobs (guarded; production only).
do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('hopon-like-batch',     '0 * * * *',  'select fn_flush_like_batches()');
    perform cron.schedule('hopon-story-expiring',  '*/30 * * * *','select fn_notify_story_expiring()');
    perform cron.schedule('hopon-story-cleanup',   '0 * * * *',  'select fn_cleanup_stories()');
    perform cron.schedule('hopon-recap-reminder',  '*/15 * * * *','select fn_notify_recap_reminder()');
  else
    raise notice 'pg_cron not available — Phase 5 cron jobs NOT scheduled (REQUIRED in production)';
  end if;
end $$;
