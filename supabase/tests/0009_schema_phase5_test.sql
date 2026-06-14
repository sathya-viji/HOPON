-- ============================================================================
-- Phase 5 schema tests — social tables, image_paths CHECK, FK, RLS, grants.
-- Run with: supabase test db
-- ============================================================================
begin;
select plan(25);

select has_table('recaps');
select has_table('recap_likes');
select has_table('recap_comments');
select has_table('stories');
select has_table('story_views');
select has_table('follows');
select has_table('feed_events');
select has_table('recap_like_batches');

-- recaps multi-image (approved deviation)
select has_column('recaps', 'image_paths', 'recaps.image_paths array column');
select col_type_is('recaps', 'image_paths', 'text[]', 'image_paths is text[]');

-- CHECK 1..5 images
select throws_ok($SQL$
  insert into recaps (plan_id, author_id, image_paths)
  values ('00000000-0000-4000-b000-000000000000','00000000-0000-4000-a000-000000000001', array[]::text[])
$SQL$, '23514', null, '0 images rejected by CHECK');
select throws_ok($SQL$
  insert into recaps (plan_id, author_id, image_paths)
  values ('00000000-0000-4000-b000-000000000000','00000000-0000-4000-a000-000000000001',
          array['a','b','c','d','e','f'])
$SQL$, '23514', null, '6 images rejected by CHECK');
select lives_ok($SQL$
  insert into recaps (plan_id, author_id, image_paths)
  values ('00000000-0000-4000-b000-000000000000','00000000-0000-4000-a000-000000000001', array['a','b','c'])
$SQL$, '3 images accepted');

-- notifications.recap_id FK now wired
select fk_ok('notifications','recap_id','recaps','id');

-- RLS on
select results_eq($SQL$
  select count(*)::int from pg_tables where schemaname='public'
   and tablename in ('recaps','recap_likes','recap_comments','stories','story_views','follows','feed_events','recap_like_batches')
   and not rowsecurity
$SQL$, array[0], 'RLS enabled on all Phase 5 tables');

-- grants: explicit service_role; client read on content, none on feed_events
select ok(has_table_privilege('service_role','recaps','INSERT'), 'service_role INSERT recaps');
select ok(has_table_privilege('service_role','follows','INSERT'), 'service_role INSERT follows');
select ok(has_table_privilege('service_role','recap_like_batches','UPDATE'), 'service_role on recap_like_batches');
select ok(not has_table_privilege('authenticated','recaps','INSERT'), 'authenticated cannot INSERT recaps (RPC only)');
select ok(not has_table_privilege('authenticated','feed_events','SELECT'), 'feed_events not client-readable (write-only log)');
select ok(has_table_privilege('authenticated','recaps','SELECT'), 'authenticated can SELECT recaps (RLS filters)');

-- moderation auto-dispatch + live status (0015c)
select has_trigger('recaps', 'trg_recap_moderation', 'recaps INSERT → image-moderator dispatch');
select has_trigger('stories', 'trg_story_moderation', 'stories INSERT → image-moderator dispatch');
select results_eq($SQL$
  select count(*)::int from pg_publication_tables
  where pubname='supabase_realtime' and schemaname='public' and tablename in ('recaps','stories')
$SQL$, array[2], 'recaps + stories published for live moderation status');

-- Phase 1 privacy intact
select ok(not has_column_privilege('authenticated','users','gender','SELECT'),
  'D11 intact: gender still locked');

select * from finish();
rollback;
