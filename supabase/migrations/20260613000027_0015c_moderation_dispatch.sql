-- ============================================================================
-- Migration 0015c — auto-dispatch moderation + live moderation status
--
-- Closes the gap where nothing invoked image-moderator (recaps/stories sat
-- 'pending' forever). The client uploads images THEN calls post_recap/post_story
-- with the paths, so when the row is INSERTed the objects already exist — an
-- INSERT webhook is therefore safe (no "before upload" race). Reuses the
-- Phase-3 fn_dispatch_edge pattern (no-op locally, live in prod via GUC config).
--
-- Live status UX: recaps + stories join the realtime publication so the AUTHOR
-- (who can SELECT their own pending row via RLS) receives the UPDATE when
-- moderation flips pending → approved/rejected, driving an Instagram-style
-- "Posting → In review → Live / Couldn't post" indicator. See
-- docs/MODERATION_STATUS_UX.md.
--
-- A stale-pending re-dispatch cron guarantees nothing is stuck "in review" if a
-- single dispatch is lost (Edge outage).
-- ============================================================================

-- ── INSERT webhooks → image-moderator ──────────────────────────────────────
create or replace function fn_recap_moderation_dispatch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform fn_dispatch_edge('image-moderator', jsonb_build_object('recap_id', new.id));
  return new;
end $$;
drop trigger if exists trg_recap_moderation on recaps;
create trigger trg_recap_moderation after insert on recaps
  for each row execute function fn_recap_moderation_dispatch();

create or replace function fn_story_moderation_dispatch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform fn_dispatch_edge('image-moderator', jsonb_build_object('story_id', new.id));
  return new;
end $$;
drop trigger if exists trg_story_moderation on stories;
create trigger trg_story_moderation after insert on stories
  for each row execute function fn_story_moderation_dispatch();

-- ── Realtime: authors watch their own moderation status flip ───────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='recaps') then
      alter publication supabase_realtime add table recaps;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='stories') then
      alter publication supabase_realtime add table stories;
    end if;
  end if;
end $$;

-- ── Stale-pending safety net (re-dispatch if a moderation call was lost) ───
create or replace function fn_redispatch_stale_moderation() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; r record;
begin
  for r in select id from recaps where moderation='pending' and created_at < now() - interval '5 minutes' loop
    perform fn_dispatch_edge('image-moderator', jsonb_build_object('recap_id', r.id));
    n := n + 1;
  end loop;
  for r in select id from stories where moderation='pending' and created_at < now() - interval '5 minutes' loop
    perform fn_dispatch_edge('image-moderator', jsonb_build_object('story_id', r.id));
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function fn_redispatch_stale_moderation() from anon, authenticated, public;
grant execute on function fn_redispatch_stale_moderation() to service_role;

do $$
begin
  if exists (select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('hopon-moderation-redispatch', '*/5 * * * *',
                          'select fn_redispatch_stale_moderation()');
  else
    raise notice 'pg_cron not available — stale-moderation re-dispatch NOT scheduled (REQUIRED in production)';
  end if;
end $$;
