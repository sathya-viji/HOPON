-- ============================================================================
-- Migration 0014t — storage.objects RLS (Wave 5.1 gap #2).
--
-- The avatars / recaps / stories buckets are declared public in config.toml
-- (public READ via getPublicUrl already works), but storage.objects has RLS
-- enabled with NO write policies — so every authenticated upload failed with
-- "new row violates row-level security policy". This adds the minimal own-folder
-- write policies the client already targets: it uploads to `${auth.uid()}/<file>`,
-- so a user may only write/modify/delete objects under their own uid prefix.
--
-- Scope: write access for the three app buckets only. No change to read (public
-- buckets) and no change to any other bucket. Mirrors the standard Supabase
-- "own folder" pattern (storage.foldername(name)[1] = auth.uid()).
-- ============================================================================

-- The three app buckets, gated to the caller's own top-level folder.
drop policy if exists "app_own_folder_insert" on storage.objects;
create policy "app_own_folder_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars', 'recaps', 'stories')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "app_own_folder_update" on storage.objects;
create policy "app_own_folder_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars', 'recaps', 'stories')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('avatars', 'recaps', 'stories')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "app_own_folder_delete" on storage.objects;
create policy "app_own_folder_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars', 'recaps', 'stories')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
