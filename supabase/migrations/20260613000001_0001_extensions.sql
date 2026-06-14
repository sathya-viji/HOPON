-- ============================================================================
-- Migration 0001 — extensions
-- Execution doc Part 1, Migration 0001. Idempotent.
-- pgcrypto: required by match_contact_hashes (SHA-256 digest) — standard
-- Supabase extension, enabled here so 0014 RPCs can reference it. (Noted in
-- Phase 1 review summary; not an architecture change.)
-- ============================================================================
create extension if not exists pg_trgm  with schema extensions;
create extension if not exists postgis  with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_net   with schema extensions;

-- pg_cron is unavailable in some local stacks; required in production.
do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron not available in this environment (ok locally; REQUIRED in production)';
end $$;
