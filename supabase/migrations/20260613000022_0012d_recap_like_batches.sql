-- ============================================================================
-- Migration 0012d — recap_like_batches (partial early landing of doc 0012)
-- Batched-like push state (one recap_liked per recap per window). Same
-- "0012 remainder" precedent as contact_hashes / pending_jobs / audit_logs.
-- Service-role only — written by like_recap RPC + the like-batch cron.
-- ============================================================================
create table if not exists recap_like_batches (
  recap_id     uuid primary key references recaps(id) on delete cascade,
  unsent_count integer not null default 0,
  last_sent_at timestamptz
);

alter table recap_like_batches enable row level security;
revoke all on recap_like_batches from anon, authenticated;
grant select, insert, update, delete on recap_like_batches to service_role;
