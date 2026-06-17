-- ============================================================================
-- Migration 0023 — ensure the storage buckets exist (idempotent).
--
-- The avatars/recaps/stories buckets were previously only declared in
-- config.toml (created on `supabase start`/reset locally, and out-of-band on
-- prod). That made them fragile — a recursive storage rm can delete the bucket
-- itself. This migration codifies them so they always exist after a push/reset.
-- Settings mirror config.toml: all public; avatars/recaps 5 MiB, stories 10 MiB;
-- jpeg/png/webp only. on conflict do nothing so it never disturbs existing rows.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('recaps',  'recaps',  true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('stories', 'stories', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
