-- ============================================================================
-- Migration 0012a — contact_hashes (partial early landing of doc migration 0012)
-- Sanctioned by execution doc Phase 7 checklist: "Migration 0012 REMAINDER:
-- invites, feature_flags" — i.e. contact_hashes lands in Phase 1 because the
-- contacts-match Edge Function (Phase 1 deliverable) depends on it.
-- D10: SHA-256 of E.164 numbers only, hashed CLIENT-SIDE. Raw numbers never
-- reach the backend.
-- ============================================================================
create table if not exists contact_hashes (
  owner_id   uuid not null references users(id) on delete cascade,
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (owner_id, phone_hash)
);

create index if not exists contact_hashes_hash on contact_hashes (phone_hash);

-- Service-role only: NO client access, NO client RLS policies. (RLS matrix Part 3.)
-- service_role is granted DML EXPLICITLY rather than relying on Supabase default
-- privileges — Edge Functions (contacts-match) write here via the service client,
-- and default privileges in this project do not include DML for service_role.
-- This is the canonical pattern for every "service-role only" table.
alter table contact_hashes enable row level security;
revoke all on contact_hashes from anon, authenticated;
grant select, insert, update, delete on contact_hashes to service_role;
